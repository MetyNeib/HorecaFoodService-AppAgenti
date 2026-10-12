const SCHEMA = 2;
const POINTER = 'hfs-rails-active-user-v2';
const DATABASE_PREFIX = 'hfs-rails-user-v2-';
const GENERATION_PREFIX = 'hfs-rails-session-generation-';

function generation(userId) {
  try { return localStorage.getItem(GENERATION_PREFIX + userId) || 'initial'; } catch { return null; }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Archivio locale non disponibile.'));
    tx.onabort = () => reject(tx.error || new Error('Salvataggio locale annullato.'));
  });
}

export function activeUserId() {
  try { return localStorage.getItem(POINTER); } catch { return null; }
}

export function validateSnapshot(snapshot, userId) {
  if (!snapshot || snapshot.state?.schemaVersion !== SCHEMA || !snapshot.state?.data ||
    String(snapshot.user?.id) !== String(userId) || !Number.isInteger(snapshot.version) || !Number.isInteger(snapshot.epoch)) {
    throw new Error('Archivio locale incompatibile. Accedi online per recuperare i dati.');
  }
  if (!Array.isArray(snapshot.state.data.orders) || !Array.isArray(snapshot.state.data.products)) {
    throw new Error('Dati locali non leggibili. Le modifiche conservate non sono state cancellate.');
  }
  return snapshot;
}

function validateRecord(record, userId) {
  validateSnapshot(record.server, userId);
  if (record.schemaVersion !== SCHEMA || !Array.isArray(record.outbox) || !record.projected?.data || record.projected.schemaVersion !== SCHEMA) {
    throw new Error('Coda locale incompatibile. Le modifiche conservate non sono state cancellate.');
  }
  return record;
}

/** A database per signed-in user; only a non-sensitive identifier is kept in localStorage. */
export class OfflineStorage {
  constructor(userId, factory = globalThis.indexedDB) {
    if (!userId) throw new Error('Accedi online prima di utilizzare i dati offline.');
    this.userId = String(userId);
    this.factory = factory;
    this.generation = generation(this.userId);
  }

  assertActive() {
    if (this.revoked || generation(this.userId) !== this.generation) {
      throw new Error('Sessione locale chiusa. Accedi nuovamente prima di utilizzare questo archivio.');
    }
  }

  async open() {
    this.assertActive();
    if (this.db) return this;
    if (!this.factory) throw new Error('Archivio offline non disponibile in questo browser.');
    const request = this.factory.open(DATABASE_PREFIX + this.userId, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    this.db = await requestResult(request);
    this.db.onversionchange = () => { this.db.close(); this.db = null; };
    return this;
  }

  async readRaw() {
    await this.open();
    const tx = this.db.transaction('workspace', 'readonly');
    const completed = transactionDone(tx);
    const record = await requestResult(tx.objectStore('workspace').get('state'));
    await completed;
    return record || null;
  }

  async read() {
    const record = await this.readRaw();
    return record ? validateRecord(record, this.userId) : null;
  }

  /** IDB serializes these readwrite transactions across tabs, preventing lost local edits. */
  async update(change) {
    await this.open();
    const tx = this.db.transaction('workspace', 'readwrite');
    const completed = transactionDone(tx);
    const objectStore = tx.objectStore('workspace');
    let next;
    let failure;
    const request = objectStore.get('state');
    request.onsuccess = () => {
      try {
        this.assertActive();
        next = change(request.result ? structuredClone(request.result) : null);
        if (!next || next.schemaVersion !== SCHEMA) throw new Error('Stato locale non valido.');
        validateSnapshot(next.server, this.userId);
        objectStore.put(next, 'state');
      } catch (error) { failure = error; tx.abort(); }
    };
    try { await completed; } catch (error) { throw failure || error; }
    this.assertActive();
    try { localStorage.setItem(POINTER, this.userId); } catch { /* IDB remains authoritative. */ }
    return next;
  }

  async initialize(snapshot) {
    validateSnapshot(snapshot, this.userId);
    return this.update(record => {
      if (record) validateRecord(record, this.userId);
      if (record?.outbox.length || record?.conflict || record?.closing?.until > Date.now()) return record;
      return { schemaVersion: SCHEMA, server: snapshot, projected: snapshot.state, outbox: [], conflict: null, recovery: record?.recovery || [], savedAt: new Date().toISOString() };
    });
  }

  /** Only used after explicit confirmation; the entire old record is retained for export. */
  async recover(snapshot) {
    validateSnapshot(snapshot, this.userId);
    return this.update(raw => {
      if (raw?.closing?.until > Date.now()) throw new Error('Uscita in corso in un’altra finestra. Attendi e riprova.');
      return { schemaVersion: SCHEMA, server: snapshot, projected: snapshot.state, outbox: [], conflict: null,
        savedAt: new Date().toISOString(), recovery: raw ? [{ raw, savedAt: new Date().toISOString() }] : [] };
    });
  }

  deactivate() {
    if (!this.revoked) {
      try { localStorage.setItem(GENERATION_PREFIX + this.userId, crypto.randomUUID()); } catch { /* The current instance is still revoked. */ }
      this.revoked = true;
    }
    try { if (activeUserId() === this.userId) localStorage.removeItem(POINTER); } catch { /* no pointer */ }
  }

  async purge() {
    this.db?.close();
    this.db = null;
    const request = this.factory.deleteDatabase(DATABASE_PREFIX + this.userId);
    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Chiudi le altre finestre dell’app prima di uscire.'));
    });
    this.deactivate();
  }
}
