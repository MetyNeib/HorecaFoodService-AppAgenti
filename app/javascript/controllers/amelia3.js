import WorkspaceController from 'controllers/workspace';
import { WorkspaceClient } from 'hfs/commands';
import { activeUserId } from 'hfs/storage';
import { announce, confirmAction } from 'hfs/ui';
import { find, findAll } from 'hfs/dom';
import { COMMANDS, projectCommand, mergeSnapshot, reconcileRecord, priceFor, decimalText } from 'amelia3/domain';
import { renderOffline } from 'amelia3/offline';

export default class Amelia3Controller extends WorkspaceController {
  async initialize() {
    document.body.dataset.pageController = 'amelia3';
    try {
      const source = document.getElementById('workspace-bootstrap');
      const bootstrap = source?.textContent.trim() ? JSON.parse(source.textContent) : null;
      const owner = bootstrap?.user.id || (document.body.dataset.offline === 'true' ? activeUserId() : null);
      if (!String(owner).startsWith('amelia3-')) { this.accessView(); return; }
      this.client = new WorkspaceClient(owner, { apiBase: '/amelia3', projectCommand, mergeSnapshot, reconcileRecord, allowedCommands: COMMANDS, strictAccess: true });
      await this.client.initialize(bootstrap);
      if (!bootstrap && new Date(this.client.snapshot.state.data.expiresAt).getTime() <= Date.now()) { this.client.authRequired = true; this.accessView(); return; }
      this.client.watchTabs();
      this.client.addEventListener('change', () => this.status());
      if (document.body.dataset.offline === 'true') {
        find('.header-dock').replaceWith(document.getElementById('amelia-offline-header').content.firstElementChild.cloneNode(true));
        find('.status-dock').replaceWith(document.getElementById('amelia-offline-footer').content.firstElementChild.cloneNode(true));
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
    const source = document.getElementById('amelia-access-required');
    if (source && find('main')) find('main').replaceChildren(source.content.cloneNode(true));
  }

  status() {
    if (this.client?.snapshot && new Date(this.client.snapshot.state.data.expiresAt).getTime() <= Date.now()) this.client.authRequired = true;
    super.status();
    if (this.client?.snapshot) findAll('.amelia_user_js').forEach(element => { element.textContent = this.client.snapshot.user.displayName || 'Amelia3'; });
    if (this.client?.authRequired) this.accessView();
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
    try { await this.client.refresh(); await this.client.sync(); this.status(); }
    catch { this.status(); }
  }

  scheduleDemoSync() {}

  async submit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
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
      if (type === 'ADD_LINE') {
        const data = this.client.snapshot.state.data;
        const order = data.orders.find(row => row.id === payload.orderId);
        const product = data.products.find(row => row.id === payload.productId);
        payload.expectedUnitPrice = decimalText(priceFor(data, order.customerId, product).amount);
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
    if (event.target.closest('.device_sync_js')) { event.preventDefault(); await this.ready; await this.syncDialog(); return; }
    await super.click(event);
  }

  input(event) {
    if (event.target.closest('.amelia_quantity_form_js')) {
      clearTimeout(this.quantityTimer);
      const form = event.target.closest('form');
      this.quantityTimer = setTimeout(() => { if (form.isConnected && form.checkValidity()) form.requestSubmit(); }, 500);
    }
  }

  change(event) { this.input(event); }
}
