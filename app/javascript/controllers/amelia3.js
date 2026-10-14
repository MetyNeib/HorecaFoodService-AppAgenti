import WorkspaceController from 'controllers/workspace';
import { WorkspaceClient } from 'hfs/commands';
import { activeUserId } from 'hfs/storage';
import { announce, confirmAction, openDialog, closeDialog } from 'hfs/ui';
import { find, findAll } from 'hfs/dom';
import { COMMANDS, projectCommand, mergeSnapshot, reconcileRecord, priceFor, fractionData, romeDate, stepQuantity, equivalentQuantity, decimalText } from 'amelia3/domain';
import { renderOffline } from 'amelia3/offline';

export default class Amelia3Controller extends WorkspaceController {
  async initialize() {
    document.body.dataset.pageController = 'amelia3';
    try {
      const source = document.getElementById('workspace-bootstrap');
      const bootstrap = source?.textContent.trim() ? JSON.parse(source.textContent) : null;
      const owner = bootstrap?.user.id || (document.body.dataset.offline === 'true' ? activeUserId() : null);
      if (!String(owner).startsWith('amelia3-')) { this.accessView(); return; }
      this.client = new WorkspaceClient(owner, { apiBase: '/amelia3', snapshotPath: () => this.snapshotPath(), projectCommand, mergeSnapshot, reconcileRecord, allowedCommands: COMMANDS, strictAccess: true });
      await this.client.initialize(bootstrap);
      const expiry = new Date(this.client.snapshot.state.data.expiresAt).getTime();
      if (!bootstrap && (!Number.isFinite(expiry) || expiry <= Date.now())) { this.client.authRequired = true; this.accessView(); return; }
      this.client.watchTabs();
      if (globalThis.BroadcastChannel) {
        this.demoChannel = new BroadcastChannel('amelia3-demo-switch');
        this.demoChannel.onmessage = ({ data }) => {
          if (data.type === 'check' && (find('main form[data-dirty="true"], main form[data-saving="true"]') || this.client.record.outbox.length || this.client.record.conflict || this.client.syncing)) this.demoChannel.postMessage({ type: 'busy', id: data.id });
          if (data.type === 'busy' && data.id === this.switchCheck) this.otherTabBusy = true;
        };
      }
      this.client.addEventListener('change', () => this.status());
      if (document.body.dataset.offline === 'true') {
        if (!find('#amelia-menu')) { location.replace('/amelia3/offline'); return; }
        this.render();
      } else if (this.client.record.outbox.length) this.render();
      this.status();
      await this.registerWorker();
      if (navigator.onLine) await this.reconnect();
    } catch (error) {
      this.storageFailure = error; this.status();
      announce(`Archivio locale non disponibile: ${error.message} Puoi continuare online senza salvataggio offline.`, true);
    }
  }

  accessView() {
    if (find('main form[data-dirty="true"], main form[data-saving="true"]')) {
      announce('Account cambiato in un’altra finestra. Modifiche non salvate conservate: torna allo stesso account prima di continuare.', true);
      return;
    }
    const source = document.getElementById('amelia-access-required');
    if (source && find('main')) find('main').replaceChildren(source.content.cloneNode(true));
  }

  status() {
    const expiry = this.client?.snapshot ? new Date(this.client.snapshot.state.data.expiresAt).getTime() : null;
    if (this.client?.snapshot && (!Number.isFinite(expiry) || expiry <= Date.now())) this.client.authRequired = true;
    super.status();
    const snapshot = this.client?.snapshot;
    if (snapshot) {
      const user = snapshot.user, data = snapshot.state.data;
      findAll('.amelia_user_js').forEach(element => { element.textContent = user.displayName || 'Amelia3'; });
      findAll('.amelia_identity_js').forEach(element => { element.textContent = `${user.role === 'admin' ? 'Admin' : 'Agente ' + user.agentId} · ${user.email}`; });
      findAll('[data-notification]').forEach(element => {
        const count = data.notifications?.[element.dataset.notification];
        element.textContent = Number.isInteger(count) ? String(count) : '—';
        element.setAttribute('aria-label', `${Number.isInteger(count) ? count : 'Numero non disponibile'} ${element.dataset.notification === 'salesAlerts' ? 'alert attivi' : 'ordini da leggere'}`);
        element.dataset.empty = count === 0 ? 'true' : 'false';
        element.title = this.client.reachable ? 'Conteggio nel portafoglio' : 'Ultimo conteggio salvato sul dispositivo';
      });
      findAll('.amelia_role_js').forEach(element => { element.textContent = user.role === 'admin' ? 'Admin' : `Agente ${user.agentId}`; });
      findAll('.amelia_company_js').forEach(element => { element.textContent = data.tenant.name; });
      findAll('.amelia_admin_js').forEach(element => { element.hidden = user.role !== 'admin'; });
      findAll('.amelia_rails_status_js').forEach(element => { element.textContent = this.client.reachable ? 'Server Rails raggiungibile' : 'Server Rails non raggiungibile · lavoro sul dispositivo'; });
      findAll('.amelia_ftp_status_js').forEach(element => { element.textContent = `Importazione FTP: ${data.importStatus || 'stato da verificare sul server'}`; });
    }
    const indicator = find('.amelia-network-button');
    if (indicator) {
      const record = this.client?.record;
      indicator.hidden = !!(this.client?.reachable && !record?.outbox.length && !record?.conflict && !this.client?.authRequired && !this.client?.syncing && !this.storageFailure);
      indicator.dataset.state = this.storageFailure || record?.conflict || this.client?.authRequired ? 'error' : 'pending';
    }
    const record = this.client?.record;
    const pending = record?.outbox.length || 0;
    const connected = navigator.onLine && this.client?.reachable;
    const message = this.storageFailure ? 'Archivio locale non disponibile: salvataggio offline non disponibile' : this.client?.authRequired ? 'Accesso richiesto · modifiche conservate sul dispositivo' : record?.conflict ? 'Conflitto da risolvere · modifiche conservate sul dispositivo' : !navigator.onLine ? 'Offline · lavori sui dati salvati sul dispositivo' : !connected ? 'Server non raggiungibile · lavori sui dati salvati sul dispositivo' : this.client?.syncing ? 'Sincronizzazione in corso' : 'Online · collegato al server';
    findAll('.amelia_connection_text_js').forEach(element => { element.textContent = `${message}${pending ? ` · ${pending} modifiche da sincronizzare` : ''}`; });
    findAll('.amelia_connection_summary_js').forEach(element => { element.textContent = connected && !pending && !record?.conflict && !this.client?.authRequired && !this.storageFailure ? '● Online' : message; });
    const bar = find('.amelia-connection');
    if (bar) bar.hidden = !!(connected && !pending && !record?.conflict && !this.client?.authRequired && !this.storageFailure && !this.client?.syncing);
    document.body.classList.toggle('amelia-connection-visible', !!bar && !bar.hidden);
    findAll('.amelia_line_unit_js').forEach(selector => { selector.disabled = !record || !!this.storageFailure; });
    findAll('.amelia_account_switch_js select, .amelia_account_switch_js button').forEach(element => {
      element.disabled = !connected || !record || !!(pending || record.conflict || this.client?.syncing || this.client?.authRequired || this.storageFailure || this.switchingAccount);
    });
    this.updateMenu();
    if (this.client?.authRequired) this.accessView();
  }

  updateMenu() {
    const url = new URL(location.href), path = url.pathname;
    const mother = url.searchParams.get('pick') === '1' || url.searchParams.has('order_id') ? 'new' : path.includes('/whatsapp') ? 'whatsapp' : /\/(alerts|insights)(\/|$)/.test(path) ? 'alerts' : path.includes('/customers') ? 'customers' : path.includes('/catalog') ? 'catalog' : 'home';
    findAll('[data-menu]').forEach(link => { if (link.dataset.menu === mother) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    const drawer = find('#amelia-menu'), trigger = find('.amelia_menu_open_js');
    if (drawer && trigger && !drawer.dataset.bound) {
      drawer.dataset.bound = 'true';
      drawer.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); });
    }
  }

  render({ preserveFocus = false } = {}) {
    if (!this.client?.snapshot) return;
    if (this.client.authRequired) { this.accessView(); return; }
    const focus = preserveFocus ? this.captureFocus() : null;
    find('main').replaceChildren(renderOffline(this.client.snapshot));
    this.offlineView = true; this.ui.mount({ introduce: !preserveFocus });
    if (focus) this.restoreFocus(focus);
    this.status();
  }

  async reconnect() {
    if (!this.client || this.storageFailure || !navigator.onLine || this.client.syncing) return;
    try {
      const serial = this.navigationSerial;
      await this.client.refresh(); await this.client.sync(); this.status();
      if (this.offlineView && serial === this.navigationSerial && this.client.reachable && !this.client.record.outbox.length && !this.client.record.conflict && !this.client.authRequired && !find('main form[data-dirty="true"]')) {
        // Initialize also calls reconnect: do not await navigate (which awaits ready) here.
        this.ready.then(() => {
          if (serial === this.navigationSerial && !find('main form[data-dirty="true"]')) return this.navigate(location.pathname + location.search, { replace: true, preserveFocus: true, preserveScroll: true });
        }).catch(() => this.status());
      }
    }
    catch { this.status(); }
  }

  scheduleDemoSync() {}

  snapshotPath() {
    const params = new URLSearchParams();
    [...findAll('main [data-product-code]')].slice(0, 50).forEach(row => params.append('products[]', row.dataset.productCode));
    [...findAll('main [data-customer-code]')].slice(0, 50).forEach(row => params.append('customers[]', row.dataset.customerCode));
    const url = new URL(location.href), orderId = url.searchParams.get('order_id') || url.pathname.match(/^\/amelia3\/orders\/([^/]+)$/)?.[1];
    if (url.pathname === '/amelia3/alerts') params.set('context', 'alerts');
    if (orderId && this.client.record.server.state.data.orders.some(order => order.id === orderId)) params.set('order_id', orderId);
    const customer = url.pathname.match(/^\/amelia3\/customers\/([^/]+)$/)?.[1];
    if (customer) params.append('customers[]', decodeURIComponent(customer));
    const product = url.pathname.match(/^\/amelia3\/catalog\/([^/]+)$/)?.[1];
    if (product) params.append('products[]', decodeURIComponent(product));
    return '/amelia3/snapshot?' + params;
  }

  async switchAccount(form) {
    try {
      if (this.switchingAccount || this.storageFailure || !navigator.onLine || !this.client?.reachable || this.client.authRequired || this.client.syncing) throw new Error('Il cambio account richiede una connessione attiva e un archivio locale disponibile.');
      const record = await this.client.storage.read();
      if (!record || record.outbox.length || record.conflict || find('main form[data-dirty="true"], main form[data-saving="true"]')) throw new Error('Salva le modifiche e completa la sincronizzazione prima di cambiare account.');
      this.otherTabBusy = false;
      this.switchCheck = crypto.randomUUID();
      this.demoChannel?.postMessage({ type: 'check', id: this.switchCheck });
      await new Promise(resolve => setTimeout(resolve, 300));
      if (this.otherTabBusy) throw new Error('Completa le modifiche aperte nelle altre finestre prima di cambiare account.');
      await this.client.storage.update(current => {
        if (current.outbox.length || current.conflict || current.lease?.until > Date.now() || current.closing?.until > Date.now()) throw new Error('Completa la sincronizzazione prima di cambiare account.');
        current.closing = { owner: this.client.owner, until: Date.now() + 20000 };
        return current;
      });
      const accountId = form.elements.account_id.value;
      this.switchingAccount = true;
      this.status();
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content, 'X-HFS-User-Id': this.client.snapshot.user.id },
        body: JSON.stringify({ account_id: accountId, return_to: location.pathname + location.search })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Cambio account non disponibile.');
      await this.client.storage.update(current => { delete current.closing; return current; });
      location.assign(result.location);
    } catch (error) {
      if (this.switchingAccount) await this.client.storage.update(current => { if (current.closing?.owner === this.client.owner) delete current.closing; return current; }).catch(() => {});
      form.elements.account_id.value = String(this.client.snapshot.user.ownerId);
      this.switchingAccount = false;
      this.status();
      announce(error.message, true);
    }
  }

  async submit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.matches('.amelia_account_switch_js')) {
      event.preventDefault();
      await this.ready;
      await this.switchAccount(form);
      return;
    }
    if (form.matches('.logout_form_js')) {
      if (this.storageFailure && activeUserId()) { event.preventDefault(); announce('Recupera prima l’archivio locale per verificare la coda.', true); return; }
      if (!this.client || this.storageFailure) return;
      event.preventDefault(); await this.ready;
      try { await this.client.logout(form); } catch (error) { announce(error.message, true); } return;
    }
    if (form.matches('.amelia_search_form_js') && this.client && !this.storageFailure) {
      event.preventDefault(); const query = new URLSearchParams(new FormData(form));
      await this.navigate(new URL(form.action).pathname + '?' + query, { replace: true, preserveFocus: true }); return;
    }
    if (!form.matches('.amelia_command_form_js') || this.storageFailure) return;
    event.preventDefault();
    if (form.dataset.saving === 'true') return;
    const submitter = event.submitter;
    if (submitter?.dataset.confirmMessage && !form.dataset.confirmed) {
      confirmAction(submitter.dataset.confirmMessage, () => { form.dataset.confirmed = 'true'; form.requestSubmit(submitter); }); return;
    }
    form.dataset.saving = 'true';
    try {
      await this.ready;
      if (!form.reportValidity()) return;
      const payload = JSON.parse(form.dataset.payload || '{}');
      for (const [key, value] of new FormData(form)) {
        const match = key.match(/^payload\[([A-Za-z]+)\]$/); if (match) payload[match[1]] = value;
      }
      const type = form.dataset.command;
      payload.batchId = this.client.snapshot.state.data.batchId;
      if (type === 'UPDATE_LINE' && payload.unit) {
        const data = this.client.snapshot.state.data, order = data.orders.find(row => row.id === payload.orderId);
        const line = order.lines.find(row => row.id === payload.lineId);
        if (payload.unit !== line.unit) {
          const quote = priceFor(data, order.customerId, data.products.find(row => row.id === line.productId), romeDate(), payload.unit);
          payload.expectedExactPrice = fractionData(quote.amount);
          payload.expectedConversionVersion = quote.terms.conversionVersion;
        }
      }
      if (type === 'ADD_LINE' && payload.expectedExactPrice == null && payload.expectedUnitPrice == null) {
        const data = this.client.snapshot.state.data;
        const order = data.orders.find(row => row.id === payload.orderId);
        const product = data.products.find(row => row.id === payload.productId);
        const quote = priceFor(data, order.customerId, product, romeDate(), payload.unit);
        payload.expectedExactPrice = fractionData(quote.amount);
        payload.expectedConversionVersion = quote.terms.conversionVersion;
      }
      if (type !== 'CREATE_DRAFT') payload.expectedVersion = this.client.snapshot.state.data.orders.find(order => order.id === payload.orderId)?.version;
      await this.client.enqueue(type, payload);
      if (submitter?.name === 'next_command' && submitter.value === 'CONFIRM_ORDER') {
        const order = this.client.snapshot.state.data.orders.find(row => row.id === payload.orderId);
        await this.client.enqueue('CONFIRM_ORDER', { orderId: order.id, expectedVersion: order.version, batchId: payload.batchId });
      }
      if (navigator.onLine && this.client.reachable) await this.client.sync();
      let target = form.dataset.returnTo || location.pathname + location.search;
      target = target.replace(':id', encodeURIComponent(payload.id || payload.orderId || ''));
      if (submitter?.name === 'next_command') target = '/amelia3/orders?status=CONFIRMED_LOCAL';
      await this.navigate(target, { replace: target === location.pathname + location.search, preserveFocus: true, preserveScroll: true });
      announce(this.client.record.conflict?.message || (this.client.record.outbox.length ? 'Salvato sul dispositivo · da sincronizzare.' : 'Salvato nel database locale.'), !!this.client.record.conflict);
    } catch (error) { announce(error.message, true); }
    finally { form.dataset.saving = 'false'; delete form.dataset.confirmed; }
  }

  async click(event) {
    if (event.target.closest('.amelia_menu_open_js')) { event.preventDefault(); const trigger = event.target.closest('button'); openDialog(find('#amelia-menu'), trigger); trigger.setAttribute('aria-expanded', 'true'); return; }
    if (event.target.closest('.amelia_status_open_js')) { event.preventDefault(); const trigger = event.target.closest('#amelia-menu') ? find('.amelia_menu_open_js') : event.target.closest('button'); closeDialog(find('#amelia-menu')); openDialog(find('#amelia-status'), trigger); return; }
    const drawer = find('#amelia-menu');
    if (event.target === drawer) { const rect = drawer.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { closeDialog(drawer); return; } }
    if (event.target.closest('#amelia-menu a')) closeDialog(drawer);
    const step = event.target.closest('.amelia_step_js');
    if (step) {
      event.preventDefault(); const input = step.closest('.quantity').querySelector('input[type="number"]');
      try { input.value = stepQuantity(input.value, input.step, step.dataset.direction); input.dispatchEvent(new Event('input', { bubbles: true })); }
      catch (error) { announce(error.message, true); }
      return;
    }
    if (event.target.closest('.device_sync_js')) { event.preventDefault(); await this.ready; await this.syncDialog(); return; }
    await super.click(event);
  }

  input(event) {
    const edited = event.target.closest('main form');
    if (edited) edited.dataset.dirty = 'true';
    if (event.target.closest('.amelia_quantity_form_js') && edited?.dataset.unitChanged !== 'true') {
      clearTimeout(this.quantityTimer);
      const form = event.target.closest('form');
      this.quantityTimer = setTimeout(() => { if (form.isConnected && form.checkValidity()) form.requestSubmit(); }, 500);
    }
  }

  change(event) {
    if (event.target.matches('#demo-account')) {
      event.target.form.requestSubmit();
      return;
    }
    if (event.target.matches('.amelia_line_unit_js')) {
      clearTimeout(this.quantityTimer);
      const selector = event.target, form = selector.closest('form');
      form.dataset.dirty = 'true';
      form.dataset.unitChanged = 'true';
      const { orderId, lineId } = JSON.parse(form.dataset.payload);
      const data = this.client.snapshot.state.data, order = data.orders.find(row => row.id === orderId);
      const line = order.lines.find(row => row.id === lineId), product = data.products.find(row => row.id === line.productId);
      const input = form.querySelector('input[type="number"]'), unit = selector.value;
      const quote = priceFor(data, order.customerId, product, romeDate(), unit);
      const quantity = equivalentQuantity(product, { ...line, unit: form.dataset.currentUnit || line.unit, quantity: input.value }, unit);
      form.dataset.currentUnit = unit;
      input.step = quote.terms.quantityStep; input.min = input.step === 'any' ? '0' : input.step;
      input.value = quantity ?? ''; input.disabled = false;
      form.querySelectorAll('.quantity .field > span:first-child').forEach(label => { if (label.textContent.startsWith('Quantità')) label.textContent = `Quantità (${unit})`; });
      const unitLabel = form.querySelector('.quantity > .field b'); if (unitLabel) unitLabel.textContent = unit;
      form.querySelector('.amelia-line-help').textContent = `${quantity === null ? 'Equivalenza non disponibile per questa quantità: inserisci la nuova quantità.' : 'Quantità equivalente verificata.'} Prezzo: ${decimalText(quote.amount).replace('.', ',')} € / ${unit}. Salva la riga per applicare il cambio.`;
      input.focus();
      return;
    }
    if (event.target.matches('.amelia_unit_select_js')) {
      const selector = event.target;
      for (const panel of selector.closest('.product-card').querySelectorAll('.amelia-unit-option')) {
        panel.hidden = panel.dataset.unit !== selector.value;
        if (!panel.hidden) {
          const input = panel.querySelector('.amelia_quantity_js');
          if (input) input.value = input.step === 'any' ? '' : input.step;
        }
      }
      return;
    }
    this.input(event);
  }
}
