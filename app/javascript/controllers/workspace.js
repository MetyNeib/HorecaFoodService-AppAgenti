import { WorkspaceClient } from 'hfs/commands';
import { activeUserId } from 'hfs/storage';
import { WorkspaceUI, announce, formCommand, openDialog, closeDialog, confirmAction } from 'hfs/ui';
import { renderOffline, safePath } from 'hfs/offline';
import { find, findAll, on } from 'hfs/dom';
import { OFFLINE_COMMANDS, uid, number, money, percent, projectCommand, orderErrors, nextDelivery } from 'hfs/domain';

export default class WorkspaceController {
  constructor() {
    this.ui = new WorkspaceUI();
    this.ui.mount();
    this.ready = this.initialize();
    on(document, 'submit', event => this.submit(event));
    on(document, 'click', event => this.click(event));
    on(document, 'input', event => this.input(event));
    on(document, 'change', event => this.change(event));
    window.addEventListener('popstate', () => this.navigate(location.pathname + location.search, { history: false }));
    window.addEventListener('online', () => this.reconnect());
    window.addEventListener('offline', () => { if (this.client) { this.client.reachable = false; this.status(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) this.reconnect(); });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); this.installPrompt = event; });
    window.HFS = this;
  }

  async initialize() {
    const source = document.getElementById('workspace-bootstrap');
    let bootstrap;
    try {
      bootstrap = source?.textContent.trim() ? JSON.parse(source.textContent) : null;
      const userId = bootstrap?.user?.id || (document.body.dataset.offline === 'true' ? activeUserId() : null);
      if (!userId) { await this.registerWorker(); return; }
      this.client = new WorkspaceClient(userId);
      await this.client.initialize(bootstrap);
      this.client.watchTabs();
      this.client.addEventListener('change', () => this.status());
      this.offlineView = !bootstrap || this.client.record.outbox.length > 0;
      if (this.offlineView) this.render();
      this.status();
      await this.registerWorker();
      if (navigator.onLine) await this.reconnect();
    } catch (error) {
      // With storage denied, do not pretend that a durable offline save succeeded.
      this.storageFailure = error;
      this.status();
      announce(`Memoria locale non disponibile: ${error.message} Le modifiche offline non sono abilitate.`, true);
    }
  }

  async registerWorker() {
    if (!('serviceWorker' in navigator) || !isSecureContext) return;
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'PRECACHE_COMPLETE') {
          this.offlinePrepared = !event.data.failed?.length;
          if (!this.offlinePrepared) announce('Alcune risorse offline non sono state preparate. Mantieni la connessione e riapri l’app.', true);
        }
      });
      const map = JSON.parse(find('script[type="importmap"]')?.textContent || '{"imports":{}}');
      const assets = [...Object.values(map.imports || {}), ...[...findAll('link[rel="stylesheet"],script[src]')].map(item => item.href || item.src)];
      (registration.active || navigator.serviceWorker.controller)?.postMessage({ type: 'PRECACHE', assets });
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', () => {
          if (registration.waiting) announce('Aggiornamento disponibile. Chiudi e riapri l’app dopo la sincronizzazione.');
        });
      });
    } catch (error) { announce('Preparazione offline non completata. Riprova con il server raggiungibile.'); }
  }

  async reconnect() {
    if (!this.client || this.storageFailure || !navigator.onLine || this.client.syncing) return;
    try {
      await this.client.refresh();
      await this.client.sync();
      this.status();
      this.scheduleDemoSync();
    } catch (error) { this.status(); }
  }

  status() {
    if (!this.client?.record && !this.storageFailure) return;
    let target = document.getElementById('device-sync-status');
    if (!target) {
      target = document.createElement('div'); target.id = 'device-sync-status'; target.className = 'device-sync-status'; target.setAttribute('role', 'status');
      find('.footer-content')?.append(target);
    }
    if (this.storageFailure) {
      target.replaceChildren(document.getElementById('hfs-storage-failure').content.cloneNode(true));
      return;
    }
    const pending = this.client.record.outbox.length;
    const conflict = this.client.record.conflict;
    const status = this.client.authRequired ? 'Accesso richiesto' : conflict ? 'Conflitto da risolvere' : this.client.syncing ? 'Sincronizzazione con il server…' : pending ? `${pending} modifiche da sincronizzare` : this.client.reachable ? 'Dati salvati sul server' : 'Offline · dati salvati sul dispositivo';
    const template = document.getElementById('hfs-device-status');
    if (template) {
      const content = template.content.cloneNode(true);
      content.querySelector('span').textContent = status;
      content.querySelector('button').textContent = conflict ? 'Risolvi conflitto' : this.client.authRequired ? 'Accedi' : 'Sincronizza';
      content.querySelector('.recovery_copy_js').hidden = !this.client.record.recovery?.length;
      target.replaceChildren(content);
    } else target.textContent = status;
    target.dataset.pending = String(pending);
    target.dataset.reachable = String(this.client.reachable);
    findAll('.transport_status_js').forEach(element => { element.textContent = status; });
    findAll('.offline-user_js').forEach(item => { item.textContent = this.client.snapshot.user.email; });
    this.ui.schedule();
  }

  render({ preserveFocus = false } = {}) {
    if (!this.client?.snapshot) return;
    const focus = preserveFocus ? this.captureFocus() : null;
    find('main').replaceChildren(renderOffline(this.client.snapshot));
    this.offlineView = true;
    this.ui.mount({ introduce: !preserveFocus });
    if (focus) this.restoreFocus(focus);
    this.status();
  }

  captureFocus() {
    const element = document.activeElement;
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
      ? { name: element.name, selectionStart: element.selectionStart, selectionEnd: element.selectionEnd } : null;
  }

  restoreFocus(focus) {
    if (!focus?.name) return;
    const input = find(`[name="${CSS.escape(focus.name)}"]`);
    input?.focus({ preventScroll: true });
    if (focus.selectionStart != null && input?.setSelectionRange) { try { input.setSelectionRange(focus.selectionStart, focus.selectionEnd); } catch { /* numeric input */ } }
  }

  async navigate(path, options = {}) {
    await this.ready;
    const target = safePath(path);
    const focus = options.preserveFocus ? this.captureFocus() : null;
    const positions = options.preserveScroll ? [...findAll('main,.scroll-area')].map(element => [element.getAttribute('aria-label') || 'main', element.scrollTop]) : [];
    const serial = this.navigationSerial = (this.navigationSerial || 0) + 1;
    if (options.history !== false) history[options.replace ? 'replaceState' : 'pushState']({}, '', target);
    if (!this.client || this.storageFailure) { location.assign(target); return; }
    if (navigator.onLine && this.client.reachable && !this.client.record.outbox.length && !this.client.record.conflict) {
      try {
        const response = await this.client.request(target, { headers: { Accept: 'text/html', 'X-HFS-Navigation': 'true' } });
        if (!response.ok) throw new Error('Pagina non disponibile.');
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (serial !== this.navigationSerial) return;
        const main = html.querySelector('main');
        const source = html.getElementById('workspace-bootstrap');
        if (!main || !source) throw new Error('Server non disponibile.');
        const snapshot = JSON.parse(source.textContent);
        if (String(snapshot.user.id) !== this.client.userId) { location.reload(); return; }
        await this.client.storage.initialize(snapshot);
        this.client.record = await this.client.storage.read();
        find('main').replaceWith(main);
        for (const selector of ['.status-dock', '.header-dock', '#workspace-bootstrap']) {
          const replacement = html.querySelector(selector); const current = find(selector);
          if (replacement && current) current.replaceWith(replacement);
        }
        findAll('.workspace-shell > dialog').forEach(dialog => dialog.remove());
        html.querySelectorAll('.workspace-shell > dialog').forEach(dialog => find('.workspace-shell').append(dialog));
        const token = html.querySelector('meta[name="csrf-token"]')?.content;
        if (token) this.client.setCsrf(token);
        document.title = html.title;
        this.offlineView = false;
        this.ui.mount({ introduce: !options.preserveFocus });
      } catch (error) {
        if (serial !== this.navigationSerial) return;
        this.render({ preserveFocus: options.preserveFocus });
      }
    } else this.render({ preserveFocus: options.preserveFocus });
    this.restoreFocus(focus);
    for (const [label, top] of positions) {
      const element = label === 'main' ? find('main') : find(`.scroll-area[aria-label="${CSS.escape(label)}"]`);
      if (element) element.scrollTop = top;
    }
    if (!options.preserveFocus) {
      const title = find('main h1');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    }
    this.status();
  }

  async execute(type, payload, returnTo, options = {}) {
    if (!this.client) throw new Error('Archivio locale non disponibile. Ricarica online prima di modificare i dati.');
    clearTimeout(this.demoTimer);
    if (type === 'CREATE_DRAFT') payload.id ||= uid('BOZ');
    if (type === 'ADD_LINE') payload.lineId ||= uid('L');
    if (payload.condition) payload.condition.id ||= uid('COND');
    await this.client.enqueue(type, payload);
    if (navigator.onLine && this.client.reachable) await this.client.sync();
    const target = safePath(returnTo || location.pathname + location.search).replace(':id', encodeURIComponent(payload.id || payload.orderId || ''));
    await this.navigate(target, { replace: target === location.pathname + location.search, preserveFocus: options.preserveFocus, preserveScroll: options.preserveScroll });
    if (this.client.record.conflict) announce(this.client.record.conflict.message, true);
    else if (this.client.authRequired) announce('Sessione scaduta. Le modifiche sono conservate; accedi con lo stesso account.', true);
    else announce(this.client.record.outbox.length ? 'Salvato sul dispositivo · da sincronizzare.' : 'Modifiche salvate.');
    this.scheduleDemoSync();
  }

  scheduleDemoSync() {
    clearTimeout(this.demoTimer);
    if (!this.client?.reachable || this.client.record.outbox.length || this.client.record.conflict || this.client.snapshot.state.network !== 'SYNCING') return;
    this.demoTimer = setTimeout(async () => {
      try { await this.execute('SYNC_DEMO', {}, location.pathname + location.search, { preserveScroll: true }); } catch (error) { announce(error.message, true); }
    }, 800);
  }

  async submit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (this.storageFailure) return; // Online HTML forms remain usable when IndexedDB is unavailable.
    if (new URL(form.action).pathname === '/users/sign_out') {
      event.preventDefault(); await this.ready;
      try { await this.client.logout(form); } catch (error) { announce(error.message, true); }
      return;
    }
    if (form.matches('.filter_form_js')) { event.preventDefault(); this.filter(form, event.submitter); return; }
    if (!form.matches('.command_form_js')) return;
    event.preventDefault();
    clearTimeout(this.reviewTimer);
    const submitter = event.submitter;
    const message = submitter?.dataset.confirmMessage || form.dataset.confirmMessage || form.dataset.confirm;
    if (message && !form.dataset.confirmed) {
      confirmAction(message, async () => { form.dataset.confirmed = 'true'; form.requestSubmit(submitter); });
      return;
    }
    const dialogId = form.dataset.confirmDialog;
    if (dialogId && !form.dataset.confirmed && !submitter?.closest('dialog')) {
      const dialog = document.getElementById(dialogId);
      if (dialog) { dialog._pendingForm = form; dialog._pendingSubmitter = submitter; openDialog(dialog); return; }
    }
    if (form.dataset.saving === 'true') return;
    form.dataset.saving = 'true';
    if (submitter) submitter.disabled = true;
    try {
      await this.ready;
      const command = formCommand(form, submitter);
      if (form.querySelector('.condition_enabled_js,.save_condition_js') && !form.querySelector('.condition_enabled_js,.save_condition_js').checked) delete command.payload.condition;
      if (command.payload.condition && !form.dataset.conditionConfirmed) {
        const condition = command.payload.condition;
        const order = this.client.snapshot.state.data.orders.find(item => item.id === command.payload.orderId);
        const productId = order.lines.find(item => item.id === command.payload.lineId).productId;
        const overlapping = this.client.snapshot.state.data.customerConditions.some(item => item.customerId === order.customerId && item.productId === productId && (!item.validTo || !condition.validFrom || item.validTo >= condition.validFrom) && (!condition.validTo || !item.validFrom || item.validFrom <= condition.validTo));
        if (overlapping && !window.confirm('Sostituire le condizioni sovrapposte per questo cliente e prodotto?')) return;
        command.payload.condition.replaceOverlaps = overlapping;
      }
      for (const key of ['quantity', 'unitPriceBaseCents', 'discountBasisPoints']) if (command.payload[key] !== undefined) command.payload[key] = number(command.payload[key]);
      if (submitter?.name === 'next_command') {
        // The offline template sends all review fields in the single confirmation intent.
        command.type = submitter.value;
      }
      if (command.type === 'CONFIRM_ORDER') command.returnTo = '/orders?tab=pending';
      await this.execute(command.type, command.payload, command.returnTo, { preserveScroll: true });
    } catch (error) { announce(error.message, true); }
    finally { form.dataset.saving = 'false'; delete form.dataset.confirmed; if (submitter) submitter.disabled = false; }
  }

  filter(form, submitter) {
    clearTimeout(this.filterTimer);
    const params = new URLSearchParams(new FormData(form));
    if (submitter?.name) params.set(submitter.name, submitter.value);
    const target = new URL(form.action).pathname + '?' + params;
    if (target !== location.pathname + location.search) this.navigate(target, { replace: true, preserveFocus: true, preserveScroll: true });
  }

  input(event) {
    const form = event.target.closest('form');
    if (form?.matches('.filter_form_js')) {
      clearTimeout(this.filterTimer);
      if (this.offlineView || !this.client?.reachable) this.filter(form);
      else this.filterTimer = setTimeout(() => this.filter(form), 180);
    }
    if (form?.matches('.line_editor_js')) this.previewLine(form);
    if (event.target.matches('.required_reason_js')) { const button = form.querySelector('.reason_submit_js'); if (button) button.disabled = !event.target.value.trim(); }
    if (form?.matches('.review_form_js')) this.previewReview(form);
  }

  change(event) {
    const form = event.target.closest('form');
    if (form?.matches('.filter_form_js')) this.filter(form);
    if (event.target.matches('.save_condition_js,.condition_enabled_js')) {
      form?.querySelectorAll('.condition_field_js').forEach(input => { input.disabled = !event.target.checked; });
    }
    if (form?.matches('.quantity_autosave_js,.autosave_command_js')) form.requestSubmit();
    if (form?.matches('.line_editor_js')) this.previewLine(form);
    if (form?.matches('.review_form_js') && event.target.matches('.review_field_js')) {
      this.previewReview(form);
      clearTimeout(this.reviewTimer);
      this.reviewTimer = setTimeout(async () => {
        if (form.dataset.saving === 'true') return;
        try { const command = formCommand(form); await this.execute('SAVE_REVIEW', command.payload, location.pathname + location.search, { preserveFocus: true, preserveScroll: true }); }
        catch (error) { announce(error.message, true); }
      }, 350);
    }
  }

  previewReview(form) {
    if (!this.client?.snapshot) return;
    try {
      const command = formCommand(form); command.type = 'SAVE_REVIEW';
      const next = projectCommand(this.client.snapshot.state, command);
      const order = next.data.orders.find(item => item.id === command.payload.orderId);
      const errors = orderErrors(next.data, order);
      const box = form.querySelector('.form_error_js');
      if (box) { box.textContent = errors.join(' '); box.hidden = !errors.length; }
      const button = form.querySelector('.confirm_order_js'); if (button) button.disabled = errors.length > 0;
    } catch (error) { announce(error.message, true); }
  }

  previewLine(form) {
    if (!this.client?.snapshot) return;
    try {
      const command = formCommand(form);
      delete command.payload.condition;
      const next = projectCommand(this.client.snapshot.state, command);
      const order = next.data.orders.find(item => item.id === command.payload.orderId);
      const line = order.lines.find(item => item.id === command.payload.lineId);
      for (const [selector, value] of [['.preview_quantity_js', line.baseQuantity], ['.preview_cost_js', money(line.lineCostCents)], ['.preview_margin_js', money(line.marginCents) + ' · ' + percent(line.marginPercent)], ['.preview_price_js', money(line.unitPriceBaseCents)], ['.total_net_js', money(line.lineNetCents)], ['.total_margin_js', money(line.marginCents) + ' · ' + percent(line.marginPercent)]]) form.querySelectorAll(selector).forEach(element => { element.textContent = value; });
      const local = form.querySelector('.line_preview_js');
      if (local) {
        local.querySelector('.total_net_js').textContent = money(line.lineNetCents);
        local.querySelector('.total_margin_js').textContent = money(line.marginCents) + ' · ' + percent(line.marginPercent);
        local.querySelector('.error').hidden = line.marginCents >= 0;
      }
      form.querySelectorAll('button[type="submit"],button:not([type])').forEach(button => { button.disabled = false; });
      const error = form.querySelector('.form_error_js'); if (error) { error.textContent = ''; error.hidden = true; }
    } catch (error) {
      let target = form.querySelector('.form_error_js');
      if (!target) { target = document.createElement('p'); target.className = 'error form_error_js'; target.setAttribute('role', 'alert'); form.prepend(target); }
      target.textContent = error.message;
      target.hidden = false;
      form.querySelectorAll('button[type="submit"],button:not([type])').forEach(button => { button.disabled = true; });
    }
  }

  async click(event) {
    if (event.target.closest('.storage_repair_js')) { event.preventDefault(); await this.storageRecoveryDialog(); return; }
    if (event.target.closest('.recovery_copy_js')) { event.preventDefault(); this.recoveryDialog(true); return; }
    const conflictButton = event.target.closest('.device_sync_js');
    if (conflictButton) { event.preventDefault(); await this.ready; this.syncDialog(); return; }
    const install = event.target.closest('.install_app_js');
    if (install) {
      event.preventDefault();
      if (this.installPrompt) await this.installPrompt.prompt();
      else announce('iPhone/iPad: Safari → Condividi → Aggiungi alla schermata Home. Android: menu del browser → Installa app. Il primo accesso richiede connessione.');
      await navigator.storage?.persist?.();
      return;
    }
    const mode = event.target.closest('.price_mode_js');
    if (mode) {
      event.preventDefault(); const form = mode.closest('form');
      form.querySelector('[name="payload[priceMode]"]').value = mode.dataset.mode;
      form.querySelectorAll('.price_mode_js').forEach(button => { button.classList.toggle('primary', button === mode); button.setAttribute('aria-pressed', String(button === mode)); });
      const price = form.querySelector('.price_input_js'); if (price) price.disabled = mode.dataset.mode !== 'FIXED_PRICE';
      const discount = form.querySelector('.discount_input_js'); if (discount) discount.disabled = mode.dataset.mode !== 'DISCOUNT';
      this.previewLine(form); return;
    }
    const payment = event.target.closest('.reset_payment_js,.restore_payment_js');
    if (payment) { event.preventDefault(); const input = payment.closest('form').querySelector('[name="payload[paymentId]"]'); input.value = payment.dataset.paymentId || input.dataset.default; input.dispatchEvent(new Event('change', { bubbles: true })); return; }
    const jump = event.target.closest('.focus_jump_js');
    if (jump) { event.preventDefault(); const target = find('.' + CSS.escape(jump.dataset.target)); target?.focus(); target?.scrollIntoView({ block: 'nearest' }); return; }
    const description = event.target.closest('.description_toggle_js');
    if (description) { event.preventDefault(); const section = description.closest('section'); const full = section.querySelector('.description_full_js'); const short = section.querySelector('.description_short_js'); full.hidden = !full.hidden; short.hidden = !full.hidden; description.textContent = full.hidden ? 'Leggi tutto' : 'Riduci'; description.setAttribute('aria-expanded', String(!full.hidden)); return; }
    const confirm = event.target.closest('.dialog_confirm_js');
    if (confirm) {
      const dialog = confirm.closest('dialog');
      if (dialog?._pendingForm) { event.preventDefault(); const form = dialog._pendingForm; form.dataset.confirmed = 'true'; closeDialog(dialog); form.requestSubmit(dialog._pendingSubmitter); return; }
    }
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/users/') || url.hash || !this.client || this.storageFailure) return;
    event.preventDefault();
    const editing = location.pathname.match(/^\/orders\/([^/]+)\/(products|lines\/[^/]+\/edit)$/);
    if (url.pathname === '/' && editing) {
      const order = this.client.snapshot.state.data.orders.find(item => item.id === decodeURIComponent(editing[1]));
      if (order?.lines.length) { confirmAction('Conservare la bozza e tornare alla Home?', () => this.navigate('/')); return; }
    }
    await this.navigate(url.pathname + url.search);
  }

  async syncDialog() {
    if (this.storageFailure) { await this.storageRecoveryDialog(); return; }
    if (this.client.authRequired) { location.assign('/users/sign_in'); return; }
    if (!this.client.record.conflict) { await this.reconnect(); if (!this.client.reachable) announce('Il server non è raggiungibile. Le modifiche restano sul dispositivo.', true); return; }
    this.recoveryDialog(false);
  }

  recoveryDialog(archiveOnly) {
    const template = document.getElementById('hfs-conflict-dialog');
    const dialog = template.content.firstElementChild.cloneNode(true);
    const recovery = archiveOnly ? this.client.record.recovery.at(-1) : { projected: this.client.record.projected, outbox: this.client.record.outbox, savedAt: this.client.record.savedAt };
    dialog.querySelector('.conflict_message_js').textContent = archiveOnly ? 'Copia locale conservata prima della risoluzione del conflitto.' : this.client.record.conflict.message;
    dialog.querySelector('.download_recovery_js').addEventListener('click', () => {
      this.downloadRecovery({ schemaVersion: 2, datasetId: this.client.snapshot.state.datasetId, userId: this.client.userId, recovery }, 'hfs-copia-locale.json');
    });
    const useServer = dialog.querySelector('.use_server_js'); useServer.hidden = archiveOnly;
    useServer.addEventListener('click', async () => {
      try { await this.client.useServerVersion(); closeDialog(dialog); dialog.remove(); await this.navigate(location.pathname + location.search, { replace: true }); }
      catch (error) { announce(error.message, true); }
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog); openDialog(dialog);
  }

  downloadRecovery(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async storageRecoveryDialog() {
    if (!this.client) return;
    const dialog = document.getElementById('hfs-storage-dialog').content.firstElementChild.cloneNode(true);
    dialog.querySelector('.storage_error_js').textContent = this.storageFailure?.message || 'Archivio locale da ripristinare.';
    const download = dialog.querySelector('.download_raw_js');
    try {
      const raw = await this.client.storage.readRaw();
      download.disabled = !raw;
      download.addEventListener('click', () => this.downloadRecovery({ userId: this.client.userId, raw }, 'hfs-archivio-originale.json'));
    } catch (error) { download.disabled = true; }
    dialog.querySelector('.restore_storage_js').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true;
      try {
        const response = await this.client.request('/snapshot', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Collegati al server con lo stesso account prima di ripristinare.');
        const snapshot = this.client.acceptSnapshot(await response.json());
        this.client.record = await this.client.storage.recover(snapshot);
        this.client.setCsrf(snapshot.csrfToken);
        this.storageFailure = null;
        this.client.watchTabs();
        this.client.addEventListener('change', () => this.status());
        closeDialog(dialog);
        await this.registerWorker();
        await this.navigate(location.pathname + location.search, { replace: true });
        announce('Archivio ripristinato. La copia originale è disponibile da Stato sincronizzazione.');
      } catch (error) { dialog.querySelector('.storage_error_js').textContent = error.message; }
      finally { button.disabled = false; }
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog); openDialog(dialog);
  }
}
