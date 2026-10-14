import { parseCents, number, money, percent, calculateLine } from 'hfs/domain';
import { find, findAll, on } from 'hfs/dom';

export function announce(message, error = false) {
  let box = find('.snackbar_js');
  if (!box) { box = document.createElement('div'); box.id = 'client-message'; box.className = 'snackbar snackbar_js client_notice_js'; find('.workspace-shell')?.append(box); }
  box.hidden = false;
  box.setAttribute('role', error ? 'alert' : 'status');
  box.classList.toggle('error', error);
  box.textContent = message;
  clearTimeout(box._dismissTimer);
  box._dismissTimer = setTimeout(() => { box.hidden = true; }, error ? 15000 : 5000);
}

export function openDialog(dialog, opener = document.activeElement) {
  if (!dialog) return;
  // WebKit does not focus buttons on a pointer click. Retain the actual trigger,
  // and restore it after the browser finishes closing the modal (including Esc).
  dialog._opener = opener;
  dialog.addEventListener('close', () => {
    if (dialog._opener?.isConnected && !document.querySelector('dialog[open]')) dialog._opener.focus();
  }, { once: true });
  dialog.showModal();
}

export function closeDialog(dialog) {
  dialog?.close();
  dialog?._opener?.focus();
}

export function confirmAction(message, action) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog_js';
  dialog.setAttribute('aria-label', 'Conferma operazione');
  const title = document.createElement('h2'); title.textContent = 'Conferma operazione';
  const text = document.createElement('p'); text.textContent = message;
  const actions = document.createElement('div'); actions.className = 'actions';
  const cancel = document.createElement('button'); cancel.textContent = 'Annulla';
  const confirm = document.createElement('button'); confirm.className = 'primary'; confirm.textContent = 'Conferma';
  cancel.onclick = () => { closeDialog(dialog); dialog.remove(); };
  confirm.onclick = async () => { closeDialog(dialog); dialog.remove(); await action(); };
  dialog.addEventListener('cancel', () => queueMicrotask(() => { dialog._opener?.focus(); dialog.remove(); }));
  actions.append(cancel, confirm); dialog.append(title, text, actions); document.body.append(dialog); openDialog(dialog);
}

function sizeLists(main) {
  main.querySelectorAll('.scroll-area[data-kind="list"]').forEach(region => {
    let items = [...region.querySelectorAll(':scope > article, :scope > .summary-line')];
    if (!items.length) items = [...region.querySelectorAll(':scope > table > tbody > tr')];
    if (!items.length) items = [...region.querySelectorAll(':scope > button,:scope > a')];
    region.dataset.shortList = String(items.length <= 2);
    let minimum = 120;
    if (items.length) {
      const boxes = items.map(item => item.getBoundingClientRect());
      const prefix = Math.max(0, boxes[0].top - region.getBoundingClientRect().top + region.scrollTop);
      minimum = Math.ceil(prefix + Math.max(...boxes.map((box, index) => (boxes[index + 1] || box).bottom - box.top)) + 6);
    }
    region.style.setProperty('--list-min-height', `${minimum}px`);
  });
}

export class WorkspaceUI {
  constructor() {
    this.timers = new Map();
    this.listener = event => this.click(event);
    on(document, 'click', this.listener);
    document.addEventListener('cancel', event => {
      if (event.target instanceof HTMLDialogElement) queueMicrotask(() => event.target._opener?.focus());
    }, true);
    document.addEventListener('pointerdown', event => this.retain(event), true);
    document.addEventListener('keydown', event => this.retain(event), true);
    document.addEventListener('change', event => this.quantityChange(event));
    window.addEventListener('resize', () => this.schedule());
    window.visualViewport?.addEventListener('resize', () => this.schedule());
  }

  setOpen(dock, open) {
    if (!dock) return;
    dock.dataset.open = String(open);
    const panel = dock.querySelector('.dock-panel');
    if (panel) panel.inert = !open;
    const toggle = dock.querySelector('.dock-toggle');
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', `${open ? 'Comprimi' : 'Apri'} ${dock.classList.contains('header-dock') ? 'intestazione e agente' : 'stato e sincronizzazione'}`);
    if (!open && dock.contains(document.activeElement)) toggle?.focus();
    this.schedule();
  }

  retain(event) {
    const dock = event.target.closest?.('.dock-content_js,.footer-content,.app-header');
    if (!dock || event.target.closest?.('.dock-toggle')) return;
    const outer = dock.closest('.header-dock,.status-dock') || dock;
    clearTimeout(this.timers.get(outer));
  }

  mount({ introduce = true } = {}) {
    this.observer?.disconnect(); this.resize?.disconnect();
    this.main?.removeEventListener('scroll', this.scroll, true);
    this.main = find('main');
    if (!this.main) return;
    const docks = findAll('.header-dock,.status-dock');
    docks.forEach(dock => {
      clearTimeout(this.timers.get(dock));
      if (introduce) {
        this.setOpen(dock, true);
        this.timers.set(dock, setTimeout(() => this.setOpen(dock, false), 1000));
      }
    });
    const positions = new WeakMap();
    this.scroll = event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const previous = positions.get(target) || 0;
      positions.set(target, target.scrollTop);
      if (Math.abs(target.scrollTop - previous) <= 1) return;
      if ([...findAll('.dock-panel')].some(panel => panel.getAnimations().some(animation => animation.playState === 'running'))) return;
      docks.forEach(dock => { clearTimeout(this.timers.get(dock)); this.setOpen(dock, false); });
    };
    this.main.addEventListener('scroll', this.scroll, { passive: true, capture: true });
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(this.main, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
    this.resize = new ResizeObserver(() => this.schedule());
    this.resize.observe(this.main);
    this.schedule();
  }

  schedule() { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.layout()); }

  layout() {
    const shell = find('.workspace-shell');
    const main = this.main;
    if (!shell || !main || !main.querySelector('.view')) return;
    if ([...findAll('.dock-panel')].some(panel => panel.getAnimations().some(animation => animation.playState === 'running'))) {
      this.schedule(); return;
    }
    const positions = [main, ...main.querySelectorAll('.scroll-area')].map(element => [element, element.scrollTop]);
    const usable = () => main.clientHeight >= 180 && [...main.querySelectorAll('.view,.pane,.workspace-split,.cart,.home-view .grid,.hero-card,.navigation-card,.action-bar,.resolver-confirm,.customer-strip')].every(element => {
      const style = getComputedStyle(element);
      return style.overflowY === 'auto' || element.scrollHeight <= element.clientHeight + 2 && element.scrollWidth <= element.clientWidth + 2;
    }) && [...main.querySelectorAll('.scroll-area')].every(element => element.clientHeight >= 120);
    shell.dataset.layout = 'fit'; shell.dataset.density = 'regular'; sizeLists(main);
    const phone = innerWidth < 600 || matchMedia('(max-width:650px) and (max-aspect-ratio:93/200)').matches;
    const compact = !phone && !usable() || phone && innerHeight < 720;
    shell.dataset.density = compact ? 'compact' : 'regular'; sizeLists(main);
    shell.dataset.layout = phone || !usable() ? 'flow' : 'fit'; sizeLists(main);
    positions.forEach(([element, top]) => { element.scrollTop = top; });
  }

  click(event) {
    const toggle = event.target.closest('.dock-toggle,.dock_toggle_js');
    if (toggle) { event.preventDefault(); const dock = toggle.closest('.header-dock,.status-dock'); clearTimeout(this.timers.get(dock)); this.setOpen(dock, dock.dataset.open !== 'true'); return; }
    const opener = event.target.closest('.dialog_open_js');
    if (opener) { event.preventDefault(); openDialog(document.getElementById(opener.dataset.dialog), opener); return; }
    const close = event.target.closest('.dialog_close_js');
    if (close) { event.preventDefault(); closeDialog(close.closest('dialog')); return; }
    const step = event.target.closest('.quantity_step_js');
    if (step) {
      event.preventDefault();
      const input = step.closest('.quantity_js')?.querySelector('.quantity_input_js');
      if (!input) return;
      const next = number(input.value) + Number(step.dataset.direction) * number(input.step || 1);
      input.value = String(Math.max(number(input.min || input.step || 1), Math.round(next * 1000) / 1000));
      const minus = step.closest('.quantity_js').querySelector('[data-direction="-1"]');
      if (minus) minus.disabled = number(input.value) <= number(input.step || 1);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  quantityChange(event) {
    const select = event.target.closest('.quantity_unit_js');
    if (!select) return;
    const group = select.closest('.quantity_js');
    const units = JSON.parse(group.dataset.units || '[]');
    const unit = units.find(item => item.code === select.value);
    const input = group.querySelector('.quantity_input_js');
    if (unit && input) { input.step = unit.step; input.min = unit.step; if (number(input.value) % unit.step !== 0) input.value = unit.step; }
  }
}

export function formCommand(form, submitter) {
  const data = new FormData(form);
  if (submitter?.name) data.set(submitter.name, submitter.value);
  const payload = {};
  for (const [key, value] of data.entries()) {
    const path = key.match(/^payload\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (!path) continue;
    if (path[2]) { payload[path[1]] ||= {}; payload[path[1]][path[2]] = value; }
    else payload[path[1]] = value;
  }
  const priceInput = form.querySelector('.price_input_js');
  const discountInput = form.querySelector('.discount_input_js');
  if (priceInput && payload.priceMode === 'FIXED_PRICE') payload.unitPriceBaseCents = parseCents(priceInput.value);
  if (discountInput && payload.priceMode === 'DISCOUNT') {
    const basis = number(discountInput.value) * 100;
    if (!Number.isInteger(basis) || basis < 0 || basis > 10000) throw new Error('Sconto non valido.');
    payload.discountBasisPoints = basis;
  }
  for (const key of ['quantity', 'unitPriceBaseCents', 'discountBasisPoints']) if (payload[key] !== undefined) payload[key] = number(payload[key]);
  for (const key of ['isGift', 'confirmClear', 'online', 'whatsappEnabled', 'overdue']) if (payload[key] !== undefined) payload[key] = ['true', '1', 'on'].includes(String(payload[key]));
  if (payload.condition?.replaceOverlaps !== undefined) payload.condition.replaceOverlaps = ['true', '1', 'on'].includes(String(payload.condition.replaceOverlaps));
  return { type: data.get('type'), payload, returnTo: data.get('return_to') };
}
