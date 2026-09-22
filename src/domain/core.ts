/** Pure domain helpers. No I/O, no real sends, no Date.now(): demo clock is explicit. */
export interface Unit { code: string; factorToBase: number; step: number; estimated: boolean }
export interface Product { id: string; code: string; name: string; units: Unit[]; costBaseCents: number; standardPriceBaseCents: number }
export interface PriceItem { productId: string; priceListId: string; unitPriceBaseCents: number }
export interface Condition { id: string; customerId: string; productId: string; type: string; unitPriceBaseCents: number|null; priceListId: string|null; discountBasisPoints: number|null; validFrom: string|null; validTo: string|null }
export interface CustomerPricing { id: string; defaultPriceListId: string }
export interface PricingData { priceListItems: PriceItem[]; customerConditions: Condition[] }
export interface Amounts { netCents: number; costCents: number; marginCents: number; marginPercent: number|null }
export interface OrderSummary { id: string; customerId: string; agentId: string; status: string }

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label}: richiesto intero sicuro.`);
  return value;
}
function scaled(value: number, label: string): bigint {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}: valore non valido.`);
  const x = value * 1000;
  if (!Number.isSafeInteger(Math.round(x)) || Math.abs(x-Math.round(x)) > 1e-7) throw new Error(`${label}: massimo 3 decimali.`);
  return BigInt(Math.round(x));
}
function safeNumber(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Valore fuori intervallo sicuro.');
  return n;
}
/** Half-up, symmetric for negative values. Denominator must be positive. */
export function halfUp(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new Error('Divisore non valido.');
  const sign = numerator < 0n ? -1n : 1n;
  const n = numerator * sign;
  return safeNumber(sign * ((n*2n + denominator)/(denominator*2n)));
}
export function baseQuantity(product: Product, quantity: number, unitCode: string) {
  const code = unitCode === 'COLLI' ? 'CT' : unitCode;
  const unit = product.units.find(u=>u.code===code);
  if (!unit) throw new Error('Unità non disponibile per il prodotto.');
  const q=scaled(quantity,'Quantità'), step=scaled(unit.step,'Step');
  if (q===0n || step===0n || q%step!==0n) throw new Error('Quantità incompatibile con lo step della unità.');
  const productScaled=q*scaled(unit.factorToBase,'Fattore');
  if (productScaled%1000n!==0n) throw new Error('Conversione con più di 3 decimali: confermare quantità.');
  return { quantity: safeNumber(productScaled/1000n)/1000, estimated: unit.estimated };
}
export function lineAmounts(base: number, unitPriceCents: number, unitCostCents: number, gift=false): Amounts {
  const qty=scaled(base,'Quantità base');
  integer(unitPriceCents,'Prezzo'); integer(unitCostCents,'Costo');
  if (unitPriceCents<0 || unitCostCents<0) throw new Error('Prezzo e costo non possono essere negativi.');
  const net=gift?0:halfUp(qty*BigInt(unitPriceCents),1000n);
  const cost=halfUp(qty*BigInt(unitCostCents),1000n);
  return amounts(net,cost);
}
function amounts(net:number,cost:number): Amounts {
  integer(net,'Ricavo');integer(cost,'Costo');
  const margin=integer(net-cost,'Margine');
  return {netCents:net,costCents:cost,marginCents:margin,marginPercent:net===0?null:halfUp(BigInt(margin)*10000n,BigInt(net))/100};
}
export function sumAmounts(lines: Amounts[]): Amounts {
  return amounts(lines.reduce((s,l)=>s+l.netCents,0),lines.reduce((s,l)=>s+l.costCents,0));
}
export function isConditionActive(condition: Condition, date: string): boolean {
  const day=date.slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Data ISO richiesta.');
  return (!condition.validFrom || condition.validFrom<=day) && (!condition.validTo || condition.validTo>=day);
}
export function listPrice(data: PricingData, product: Product, listId: string): number {
  return data.priceListItems.find(p=>p.productId===product.id && p.priceListId===listId)?.unitPriceBaseCents ?? product.standardPriceBaseCents;
}
export function resolvePrice(data: PricingData, customer: CustomerPricing, product: Product, date: string) {
  const active=data.customerConditions.filter(c=>c.customerId===customer.id && c.productId===product.id && isConditionActive(c,date));
  if (active.length>1) throw new Error('Condizioni sovrapposte: risolvere esplicitamente.');
  const c=active[0];
  if (!c) return {unitPriceBaseCents:listPrice(data,product,customer.defaultPriceListId),source:'CUSTOMER_LIST',conditionId:null};
  const reference=listPrice(data,product,c.priceListId??customer.defaultPriceListId);
  let price=reference;
  if (c.type==='FIXED_PRICE') {
    if (c.unitPriceBaseCents===null) throw new Error('Prezzo condizione assente.');
    price=c.unitPriceBaseCents;
  } else if (c.type==='DISCOUNT') {
    const bp=c.discountBasisPoints;
    if (bp===null || !Number.isInteger(bp) || bp<0 || bp>10000) throw new Error('Sconto non valido.');
    price=halfUp(BigInt(reference)*BigInt(10000-bp),10000n);
  } else if (c.type!=='PRICE_LIST') throw new Error('Tipo condizione sconosciuto.');
  if (price<0) throw new Error('Prezzo negativo.');
  integer(price,'Prezzo condizione');
  return {unitPriceBaseCents:price,source:c.type,conditionId:c.id};
}
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it-IT').replace(/\s+/g,' ').trim();
}
export function homeCounts(data: {orders:OrderSummary[]}, agentId: string, customerIds: string[]) {
  const orders=data.orders.filter(o=>o.agentId===agentId && customerIds.includes(o.customerId));
  const count=(status:string)=>orders.filter(o=>o.status===status).length;
  return {drafts:count('DRAFT'),pending:count('PENDING_SEND'),sent:count('SENT'),whatsapp:count('WHATSAPP_REVIEW')};
}
export interface Receivable {id:string;customerId:string;invoiceId:string;dueDate:string;faceValueCents:number}
export interface Payment {receivableId:string;amountCents:number}
export function receivablesSummary(data:{receivables:Receivable[];payments:Payment[]},customerId:string,date:string) {
  let balance=0,overdue=0,received=0;
  for(const r of data.receivables.filter(r=>r.customerId===customerId)) {
    const paid=data.payments.filter(p=>p.receivableId===r.id).reduce((s,p)=>s+p.amountCents,0);
    const residual=r.faceValueCents-paid;
    balance+=residual; received+=paid;
    if(residual>0 && r.dueDate<date.slice(0,10)) overdue+=residual;
  }
  return {balanceCents:balance,overdueCents:overdue,receivedCents:received};
}
export interface QueueOrder extends OrderSummary {updatedAt:string;sentAt:string|null}
export interface QueueJob {id:string;entityType:string;entityId:string;operation:string;idempotencyKey:string;status:string;attempts:number}
export interface QueueState {orders:QueueOrder[];syncQueue:QueueJob[]}
/** Call ONLY after UI/order validation, including WA ambiguities and stock validation. */
export function queueValidatedOrder<T extends QueueState>(state:T,orderId:string,clock:string):T {
  const next=structuredClone(state);
  const order=next.orders.find(o=>o.id===orderId);
  if(!order) throw new Error('Ordine inesistente.');
  if(order.status==='SENT' || order.status==='PENDING_SEND') return next;
  if(!['DRAFT','WHATSAPP_REVIEW'].includes(order.status)) throw new Error('Stato ordine non confermabile.');
  order.status='PENDING_SEND';order.updatedAt=clock;
  const key=`SEND_ORDER:${orderId}:1`;
  if(!next.syncQueue.some(j=>j.operation==='SEND_ORDER' && j.entityId===orderId))
    next.syncQueue.push({id:`SYNC-${orderId}`,entityType:'ORDER',entityId:orderId,operation:'SEND_ORDER',idempotencyKey:key,status:'WAITING_NETWORK',attempts:0});
  return next;
}
/** Simulation only. UI controls delay/network state; no HTTP call is performed. */
export function transmitQueuedOrders<T extends QueueState>(state:T,clock:string):T {
  const next=structuredClone(state);
  for(const job of next.syncQueue.filter(j=>j.operation==='SEND_ORDER' && j.status==='WAITING_NETWORK')) {
    const order=next.orders.find(o=>o.id===job.entityId);
    if(!order) throw new Error('Job senza ordine.');
    if(order.status!=='PENDING_SEND' && order.status!=='SENT') throw new Error('Job con ordine non confermato.');
    if(order.status==='PENDING_SEND') {order.status='SENT';order.sentAt=clock;order.updatedAt=clock;}
    job.status='DONE';job.attempts+=1;
  }
  return next;
}
