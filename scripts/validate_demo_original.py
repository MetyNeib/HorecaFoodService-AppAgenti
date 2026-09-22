#!/usr/bin/env python3
"""Validate the synthetic HFS seed. No external libraries or network access."""
import json, sys, re
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from collections import Counter

def validate(path):
    d=json.loads(Path(path).read_text(encoding="utf-8"))
    checks=[]
    def check(name, condition, detail=""):
        checks.append({"check":name,"status":"PASS" if condition else "FAIL","detail":detail})
    def money(q,p):
        return int((Decimal(str(q))*Decimal(p)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    index={}
    for coll in ["agents","warehouses","deliveryRoutes","paymentMethods","priceLists","products","categories",
                 "customers","contacts","destinations","customerConditions","orders","invoices","receivables",
                 "payments","insights","analyses","syncQueue","whatsappInbox","scenarioBank"]:
        vals=d[coll];ids=[x["id"] for x in vals]
        check("unique_ids_"+coll,len(ids)==len(set(ids)))
        index[coll]={x["id"]:x for x in vals}
    check("product_count",len(d["products"])==120)
    check("product_codes",all(re.fullmatch(r"\d{7}",p["code"]) for p in d["products"]) and
          len({p["code"] for p in d["products"]})==120)
    check("leading_zero_codes_retained",any(p["code"].startswith("0") for p in d["products"]))
    check("category_refs",all(p["categoryId"] in index["categories"] for p in d["products"]))
    check("case_conversions",all(abs(p["caseQuantityBase"]-p["innerQuantityBase"]*p["innerUnitsPerCase"])<.00001 for p in d["products"]))
    check("positive_costs_and_prices",all(p["costBaseCents"]>0 and p["standardPriceBaseCents"]>p["costBaseCents"] for p in d["products"]))
    check("unit_maps",all(len({u["code"] for u in p["units"]})==len(p["units"]) and all(u["factorToBase"]>0 and u["step"]>0 for u in p["units"]) for p in d["products"]))
    check("customer_refs",all(c["agentId"] in index["agents"] and c["warehouseId"] in index["warehouses"]
                             and c["deliveryRouteId"] in index["deliveryRoutes"] and c["defaultPaymentId"] in index["paymentMethods"]
                             and c["defaultPriceListId"] in index["priceLists"] for c in d["customers"]))
    check("customer_destinations",all(index["destinations"][c["defaultDestinationId"]]["customerId"]==c["id"] for c in d["customers"]))
    check("contact_refs",all(c["customerId"] in index["customers"] for c in d["contacts"]))
    check("geography",set(c["region"] for c in d["customers"])=={"Marche","Emilia-Romagna"})
    check("routes_and_warehouses",all(index["deliveryRoutes"][c["deliveryRouteId"]]["warehouseId"]==c["warehouseId"] for c in d["customers"]))
    def invalid_vat(s):
        a=[int(c) for c in s[:10]]
        z=sum(v if i%2==0 else (2*v if v<5 else 2*v-9) for i,v in enumerate(a))
        return int(s[-1])!=(10-z%10)%10
    check("deliberately_invalid_demo_tax_ids",all(len(c["taxId"])==11 and invalid_vat(c["taxId"]) and c["taxIdIsDemoInvalid"] for c in d["customers"]))
    check("nonroutable_contacts",all(c["email"].endswith("@example.invalid") and "X" in c["phoneDisplay"] for c in d["customers"]+d["contacts"]))
    pricekeys=[(x["priceListId"],x["productId"]) for x in d["priceListItems"]]
    stockkeys=[(x["warehouseId"],x["productId"]) for x in d["stocks"]]
    check("complete_price_matrix",len(pricekeys)==len(set(pricekeys))==len(d["products"])*len(d["priceLists"]))
    check("complete_stock_matrix",len(stockkeys)==len(set(stockkeys))==len(d["products"])*len(d["warehouses"]))
    check("valid_price_matrix_refs",all(x["productId"] in index["products"] and x["priceListId"] in index["priceLists"] for x in d["priceListItems"]))
    check("valid_stock_refs_nonnegative",all(x["productId"] in index["products"] and x["warehouseId"] in index["warehouses"] and x["availableBaseQuantity"]>=0 for x in d["stocks"]))
    lineids=[];line_ok=True;order_ok=True;order_refs=True;delivery_ok=True
    for o in d["orders"]:
        order_refs &= o["customerId"] in index["customers"] and o["warehouseId"] in index["warehouses"] and o["agentId"] in index["agents"]
        order_refs &= index["destinations"][o["destinationId"]]["customerId"]==o["customerId"]
        order_refs &= index["contacts"][o["contactId"]]["customerId"]==o["customerId"]
        route=index["deliveryRoutes"][index["customers"][o["customerId"]]["deliveryRouteId"]]
        delivery_ok &= date.fromisoformat(o["deliveryDate"]).isoweekday() in route["weekdaysISO"]
        for l in o["lines"]:
            lineids.append(l["id"])
            if l["productId"] not in index["products"]:line_ok=False;continue
            p=index["products"][l["productId"]]
            u=next((u for u in p["units"] if u["code"]==l["unit"]),None)
            if not u:line_ok=False;continue
            base=Decimal(str(l["quantity"]))*Decimal(str(u["factorToBase"]))
            net=0 if l["isGift"] else money(l["baseQuantity"],l["unitPriceBaseCents"])
            cost=money(l["baseQuantity"],l["costBaseCents"])
            line_ok &= abs(float(base)-l["baseQuantity"])<.000001
            line_ok &= (l["lineNetCents"],l["lineCostCents"],l["marginCents"])==(net,cost,net-cost)
            line_ok &= l["marginPercent"]==(round((net-cost)/net*100,2) if net else None)
            line_ok &= Decimal(str(l["quantity"])) % Decimal(str(u["step"])) == 0
        net=sum(l["lineNetCents"] for l in o["lines"]);cost=sum(l["lineCostCents"] for l in o["lines"])
        order_ok &= o["totals"]=={"netCents":net,"costCents":cost,"marginCents":net-cost,"marginPercent":round((net-cost)/net*100,2) if net else None}
    check("unique_order_line_ids",len(lineids)==len(set(lineids)))
    check("order_references",order_refs)
    check("delivery_days",delivery_ok)
    check("line_quantities_rounding_margin",line_ok)
    check("order_totals_margin",order_ok)
    check("order_status_fixtures",Counter(o["status"] for o in d["orders"])=={"SENT":24,"DRAFT":2,"PENDING_SEND":1,"WHATSAPP_REVIEW":3})
    active=set(d["demoDefaults"]["activeCustomerIds"])
    cnt=Counter(o["status"] for o in d["orders"] if o["customerId"] in active)
    expected={"drafts":cnt["DRAFT"],"pendingSend":cnt["PENDING_SEND"],"sent":cnt["SENT"],
              "whatsappToReview":len(d["whatsappInbox"]),"insightCustomers":len({s["customerId"] for s in d["insights"] if s["status"]=="TO_REVIEW"}),
              "insightsToReview":sum(s["status"]=="TO_REVIEW" for s in d["insights"])}
    check("home_counter_reconciliation",expected==d["derived"]["homeCounters"])
    waok=True;counts=[]
    for w in d["whatsappInbox"]:
        o=index["orders"][w["orderId"]]
        waok &= o["status"]=="WHATSAPP_REVIEW" and o["customerId"]==w["customerId"]
        matched=[r for r in w["requests"] if r["status"]=="MATCHED"]
        counts.append((len(w["requests"]),len(w["requests"])-len(matched)))
        waok &= len(matched)==len(o["lines"])
        for r in matched:
            ll=[l for l in o["lines"] if l["whatsappRequestId"]==r["id"]]
            waok &= len(ll)==1 and ll[0]["productId"]==r["productId"]
        for r in w["requests"]:
            waok &= all(a["productId"] in index["products"] for a in r["alternatives"])
            waok &= r["confidencePercent"] is None or 0<=r["confidencePercent"]<=100
    check("whatsapp_refs_and_canonical_lines",waok)
    check("whatsapp_unresolved_counts",counts==[(8,2),(5,0),(6,1)])
    pkey={p["demoKey"]:p for p in d["products"]}
    stock={(s["warehouseId"],s["productId"]):s["availableBaseQuantity"] for s in d["stocks"]}
    check("milk_out_of_stock_scenario",stock[("DEP-07",pkey["latte_ad"]["id"])]==0 and stock[("DEP-07",pkey["latte_sl"]["id"])]>=24)
    check("ambiguous_unit_explicit",d["whatsappInbox"][2]["requests"][0]["unitRequested"] is None and d["whatsappInbox"][2]["requests"][0]["quantityNeedsConfirmation"])
    check("seed_learning_does_not_resolve_exceptions",d["learnedMappings"]==[])
    queued=[q["entityId"] for q in d["syncQueue"]]
    check("queue_exact_pending_orders",set(queued)=={o["id"] for o in d["orders"] if o["status"]=="PENDING_SEND"} and len(queued)==len(set(queued)))
    condok=True
    for c in d["customerConditions"]:
        condok &= c["customerId"] in index["customers"] and c["productId"] in index["products"]
        condok &= not c["validFrom"] or not c["validTo"] or c["validFrom"]<=c["validTo"]
        condok &= not c["priceListId"] or c["priceListId"] in index["priceLists"]
    check("commercial_condition_refs_dates",condok)
    paid=Counter()
    for p in d["payments"]:
        if p["receivableId"] not in index["receivables"]:raise ValueError("Unknown receivable")
        paid[p["receivableId"]]+=p["amountCents"]
    rviews=[];snapshot=date.fromisoformat(d["meta"]["demoClock"][:10])
    for r in d["receivables"]:
        inv=index["invoices"][r["invoiceId"]]
        check("invoice_customer_"+r["id"],inv["customerId"]==r["customerId"])
        left=r["faceValueCents"]-paid[r["id"]]
        status="CREDIT" if left<0 else "SETTLED" if left==0 else "OVERDUE" if date.fromisoformat(r["dueDate"])<snapshot else "DUE"
        rviews.append({**r,"paidCents":paid[r["id"]],"remainingCents":left,"status":status})
    check("instalments_sum_to_document",all(sum(r["faceValueCents"] for r in d["receivables"] if r["invoiceId"]==i["id"])==i["faceValueCents"] for i in d["invoices"]))
    check("receivable_projections",rviews==d["derived"]["receivableViews"])
    balance_ok=True
    for b in d["derived"]["customerBalances"]:
        rs=[r for r in rviews if r["customerId"]==b["customerId"]]
        balance_ok &= b["openBalanceCents"]==sum(r["remainingCents"] for r in rs)
        balance_ok &= b["overdueCents"]==sum(r["remainingCents"] for r in rs if r["status"]=="OVERDUE")
        balance_ok &= b["receivedCents"]==sum(r["paidCents"] for r in rs)
        balance_ok &= b["remainingCreditCents"]==b["creditLimitCents"]-b["openBalanceCents"]
    check("customer_balance_reconciliation",balance_ok)
    b=d["derived"]["customerBalances"][0]
    check("demo_financial_showcase",(b["openBalanceCents"],b["overdueCents"],b["receivedCents"])==(58746,45000,10000))
    a=d["analyses"][0];analytics_ok=True
    for period in ["previousPeriod","currentPeriod"]:
        pp=a[period];os=[o for o in d["orders"] if o["status"]=="SENT" and o["customerId"]==a["customerId"] and pp["start"]<=o["createdAt"][:10]<=pp["end"]]
        cats=Counter();pres=Counter()
        for o in os:
            for l in o["lines"]:cats[index["products"][l["productId"]]["categoryId"]]+=l["lineNetCents"]
            pres.update(set(l["productId"] for l in o["lines"]))
        analytics_ok &= set(pp["orderIds"])=={o["id"] for o in os} and pp["orderCount"]==len(os)
        analytics_ok &= pp["netCents"]==sum(o["totals"]["netCents"] for o in os)
        analytics_ok &= pp["costCents"]==sum(o["totals"]["costCents"] for o in os)
        analytics_ok &= pp["categoryNetCents"]==dict(cats) and pp["productOrderCounts"]==dict(pres)
    check("insights_reconcile_to_order_lines",analytics_ok)
    p,c=a["previousPeriod"],a["currentPeriod"]
    check("insight_showcase_values",(p["orderCount"],c["orderCount"],p["netCents"],c["netCents"],p["categoryNetCents"]["CAT-01"],c["categoryNetCents"]["CAT-01"])==(8,4,240000,156000,100000,24000))
    check("usual_milk_has_real_demo_history",pkey["latte_ad"]["id"] in c["productOrderCounts"])
    check("amaro_absence",(p["productOrderCounts"][pkey["amaro"]["id"]],c["productOrderCounts"].get(pkey["amaro"]["id"],0))==(6,0))
    check("beer_presence",(p["productOrderCounts"][pkey["lager"]["id"]],c["productOrderCounts"].get(pkey["lager"]["id"],0))==(6,3))
    delay=d["analyses"][1]
    os=sorted(o["createdAt"][:10] for o in d["orders"] if o["customerId"]==delay["customerId"] and o["status"]=="SENT")
    check("reorder_delay_arithmetic",(snapshot-date.fromisoformat(os[-1])).days==delay["daysSinceLastOrder"]==12)
    check("reorder_baseline",[(date.fromisoformat(b)-date.fromisoformat(a)).days for a,b in zip(os,os[1:])]==[7,7])
    check("fixed_clock_and_offline",d["demoDefaults"]["networkMode"]=="OFFLINE" and d["meta"]["demoClock"].startswith("2026-09-22"))
    check("no_extra_features",not any(d["demoDefaults"][k] for k in ["visibleProspects","visibleAlertConfiguration","visibleCollectionsAction","visibleCreditLimitFeature"]))
    serialized=json.dumps(d,ensure_ascii=False).lower()
    check("no_production_urls",not re.search(r"https?://",serialized))
    check("no_raw_source_names_in_demo",not any(s in serialized for s in ["itarca","staging1.","pa8360","lea&p","gastrosupplyagent.com"]))
    result={"datasetId":d["meta"]["datasetId"],"validationScope":"SEED_DATA_ONLY_NOT_UI_OR_REAL_NETWORK",
            "status":"PASS" if all(c["status"]=="PASS" for c in checks) else "FAIL",
            "passed":sum(c["status"]=="PASS" for c in checks),"failed":sum(c["status"]=="FAIL" for c in checks),"checks":checks}
    return result
if __name__=="__main__":
    path=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name("hfs_demo_data.json")
    result=validate(path)
    out=path.with_name("validation_report.json");out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k!="checks"},ensure_ascii=False))
    sys.exit(0 if result["status"]=="PASS" else 1)
