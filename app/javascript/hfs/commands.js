import { OfflineStorage, validateSnapshot } from 'hfs/storage';
import { OFFLINE_COMMANDS, projectCommand, uid } from 'hfs/domain';
import { find } from 'hfs/dom';

export class WorkspaceClient extends EventTarget {
  constructor(userId, options = {}) {
    super();
    this.userId = String(userId);
    this.storage = options.storage || new OfflineStorage(userId);
    this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
    this.owner = uid('tab');
    this.apiBase = options.apiBase || '';
    this.snapshotPath = options.snapshotPath || (() => this.apiBase + '/snapshot');
    this.project = options.projectCommand || projectCommand;
    this.allowedCommands = options.allowedCommands;
    this.strictAccess = options.strictAccess || false;
    this.mergeSnapshot = options.mergeSnapshot || (snapshot => snapshot);
    this.reconcileRecord = options.reconcileRecord;
    this.reachable = navigator.onLine;
    this.authRequired = false;
  }

  async initialize(snapshot) {
    this.record = snapshot ? await this.storage.initialize(snapshot) : await this.storage.read();
    if (!this.record) throw new Error('Nessun dato offline disponibile. Accedi e prepara l’app con una connessione.');
    if (snapshot) await this.renewAccess(snapshot);
    return this.record;
  }

  async renewAccess(snapshot) {
    if (!this.strictAccess) return;
    this.record = await this.storage.update(record => {
      // Renew only the signed account lease; queued prices and edits stay intact.
      record.server.state.data.expiresAt = snapshot.state.data.expiresAt;
      record.projected.data.expiresAt = snapshot.state.data.expiresAt;
      return record;
    });
  }

  get snapshot() {
    return this.record ? { ...this.record.server, state: this.record.projected } : null;
  }

  changed() {
    this.dispatchEvent(new Event('change'));
    try { this.channel?.postMessage('changed'); } catch { /* BroadcastChannel is optional. */ }
  }

  watchTabs() {
    if ('BroadcastChannel' in globalThis) {
      this.channel = new BroadcastChannel(`hfs-workspace-${this.userId}`);
      this.channel.onmessage = async () => {
        try { this.record = await this.storage.read(); }
        catch (error) { this.lastError = error.message; }
        this.dispatchEvent(new Event('change'));
      };
    }
  }

  async enqueue(type, payload) {
    if (this.allowedCommands && !this.allowedCommands.has(type)) throw new Error('Operazione non consentita per questo dataset.');
    const expiresAt = new Date(this.snapshot.state.data.expiresAt).getTime();
    if (this.strictAccess && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) this.authRequired = true;
    if (this.authRequired) throw new Error('Accedi nuovamente con lo stesso account prima di salvare altre modifiche. Le modifiche precedenti sono conservate.');
    if (!this.reachable && !OFFLINE_COMMANDS.has(type)) throw new Error('Questa funzione richiede il collegamento al server.');
    this.record = await this.storage.update(record => {
      if (record.closing?.until > Date.now()) throw new Error('Uscita in corso in un’altra finestra. Le modifiche non sono state salvate.');
      if (record.conflict) throw new Error('Risolvi prima il conflitto di sincronizzazione. Le modifiche locali sono conservate.');
      const command = { operationId: crypto.randomUUID(), baseVersion: record.server.version + record.outbox.length,
        epoch: record.server.epoch, type, payload: structuredClone(payload) };
      record.projected = this.project(record.projected, command);
      record.outbox.push(command);
      record.savedAt = new Date().toISOString();
      return record;
    });
    this.changed();
    return this.record;
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
      this.reachable = true;
      if (response.status === 401 || this.strictAccess && response.status === 403 || response.redirected && new URL(response.url).pathname.includes('sign_in')) {
        this.authRequired = true;
        throw new Error('La sessione è scaduta. Accedi con lo stesso account per sincronizzare le modifiche conservate.');
      }
      return response;
    } catch (error) {
      if (!this.authRequired) this.reachable = false;
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async refresh() {
    let response = await this.request(this.snapshotPath(), { headers: { Accept: 'application/json' } });
    if (this.strictAccess && response.status === 404) response = await this.request(this.apiBase + '/snapshot', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Impossibile aggiornare i dati dal server.');
    const snapshot = this.acceptSnapshot(await response.json());
    if (snapshot.csrfToken) this.setCsrf(snapshot.csrfToken);
    this.record = await this.storage.initialize(snapshot);
    await this.renewAccess(snapshot);
    this.changed();
    return snapshot;
  }

  acceptSnapshot(snapshot) {
    if (String(snapshot?.user?.id) !== this.userId) {
      this.authRequired = true;
      throw new Error('La sessione appartiene a un altro account. Accedi con lo stesso account per recuperare le modifiche locali.');
    }
    this.authRequired = false;
    return validateSnapshot(snapshot, this.userId);
  }

  async sync() {
    if (this.syncing || !navigator.onLine || this.authRequired) return;
    this.syncing = true;
    this.dispatchEvent(new Event('change'));
    try {
      // Durable lease also works on browsers without Web Locks. A crashed tab expires.
      const leaseUntil = Date.now() + 20000;
      this.record = await this.storage.update(record => {
        if (record.closing?.until > Date.now()) return record;
        if (record.lease?.until > Date.now() && record.lease.owner !== this.owner) return record;
        record.lease = { owner: this.owner, until: leaseUntil };
        return record;
      });
      if (this.record.closing?.until > Date.now() || this.record.lease?.owner !== this.owner) return;
      while (true) {
        this.record = await this.storage.read();
        if (!this.record.outbox.length || this.record.conflict) break;
        const command = this.record.outbox[0];
        this.record = await this.storage.update(record => {
          record.lease = { owner: this.owner, until: Date.now() + 20000 };
          return record;
        });
        const token = find('meta[name="csrf-token"]')?.content;
        if (!token) {
          const response = await this.request(this.apiBase + '/snapshot', { headers: { Accept: 'application/json' } });
          if (!response.ok) break;
          const snapshot = this.acceptSnapshot(await response.json());
          if (snapshot.csrfToken) this.setCsrf(snapshot.csrfToken);
          else throw new Error('Riapri la pagina online per aggiornare la sessione e sincronizzare.');
        }
        const transmit = () => this.request(this.apiBase + '/commands', { method: 'POST', headers: {
          Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': find('meta[name="csrf-token"]')?.content || '', 'X-HFS-User-Id': this.userId
        }, body: JSON.stringify(command) });
        let response = await transmit();
        let result = await response.json();
        if (response.status === 422 && result.code === 'CSRF_EXPIRED') {
          const session = await this.request(this.apiBase + '/snapshot', { headers: { Accept: 'application/json' } });
          if (!session.ok) throw new Error('Riapri la sessione per continuare.');
          const snapshot = this.acceptSnapshot(await session.json());
          this.setCsrf(snapshot.csrfToken);
          response = await transmit(); result = await response.json();
        }
        if (response.status === 409 || response.status === 422) {
          this.record = await this.storage.update(record => {
            record.conflict = { operationId: command.operationId, kind: response.status === 409 ? 'version' : 'validation',
              message: result.error || result.message || (result.errors || []).join(' ') || 'La versione sul server è cambiata.',
              server: result.snapshot || (result.state ? result : null), recordedAt: new Date().toISOString() };
            return record;
          });
          break;
        }
        if (!response.ok) throw new Error(result.error || 'Salvataggio sul server non completato. Le modifiche restano sul dispositivo.');
        this.acceptSnapshot(result);
        this.record = await this.storage.update(record => {
          record.outbox = record.outbox.filter(item => item.operationId !== command.operationId);
          if (result.epoch > record.server.epoch || result.epoch === record.server.epoch && result.version >= record.server.version) record.server = this.mergeSnapshot(result, record.server, record.outbox);
          if (this.reconcileRecord) this.reconcileRecord(record, result);
          else record.projected = record.outbox.reduce(this.project, record.server.state);
          record.savedAt = new Date().toISOString();
          return record;
        });
        if (result.csrfToken) this.setCsrf(result.csrfToken);
        this.changed();
      }
    } catch (error) {
      this.lastError = error.message;
    } finally {
      try {
        this.record = await this.storage.update(record => {
          if (record.lease?.owner === this.owner) delete record.lease;
          return record;
        });
      } catch (error) { this.lastError = error.message; }
      this.syncing = false;
      this.changed();
    }
  }

  setCsrf(value) {
    let meta = find('meta[name="csrf-token"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'csrf-token'; document.head.append(meta); }
    meta.content = value;
  }

  /** Explicit conflict resolution preserves the prior local version as a recovery archive. */
  async useServerVersion() {
    const response = await this.request(this.apiBase + '/snapshot', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Collegati al server per risolvere il conflitto.');
    const server = this.acceptSnapshot(await response.json());
    this.record = await this.storage.update(record => {
      if (record.closing?.until > Date.now()) throw new Error('Uscita in corso in un’altra finestra. Attendi e riprova.');
      return { schemaVersion: 2, server, projected: server.state, outbox: [], conflict: null,
        savedAt: new Date().toISOString(), recovery: [...(record.recovery || []), { projected: record.projected, outbox: record.outbox, savedAt: record.savedAt }] };
    });
    this.changed();
  }

  async logout(form) {
    // Mark the record atomically before the network request, blocking edits in another tab.
    this.record = await this.storage.update(record => {
      if (record.outbox.length) throw new Error('Sincronizza le modifiche prima di uscire. Restano conservate su questo dispositivo.');
      if (record.closing?.until > Date.now()) throw new Error('Uscita già in corso in un’altra finestra.');
      record.closing = { owner: this.owner, until: Date.now() + 20000 }; return record;
    });
    const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 12000);
    let signedOut = false;
    try {
      const response = await this.fetch(form.action, { method: 'POST', credentials: 'same-origin', signal: abort.signal,
        body: new FormData(form), headers: { 'X-CSRF-Token': find('meta[name="csrf-token"]')?.content || '', 'X-HFS-User-Id': this.userId } });
      if (!response.ok) throw new Error('Uscita non completata.');
      signedOut = true;
      this.record = await this.storage.update(record => {
        if (record.closing?.owner !== this.owner || record.closing.until <= Date.now() || record.outbox.length) {
          throw new Error('Sessione chiusa. Nuove modifiche locali conservate: accedi con lo stesso account per sincronizzarle.');
        }
        record.closing.until = Date.now() + 20000; return record;
      });
      this.storage.deactivate(); this.channel?.close();
      await this.storage.purge();
      location.assign('/users/sign_in');
    } catch (error) {
      if (signedOut) this.authRequired = true;
      else this.record = await this.storage.update(record => { if (record.closing?.owner === this.owner) delete record.closing; return record; });
      throw error;
    } finally { clearTimeout(timeout); }
  }
}
