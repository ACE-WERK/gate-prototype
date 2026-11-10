/* S4. Merchant: Payment detail (#/merchant/payments/:id)
 *
 * Phase 3a rework (followup §3.2, §3.5, §3.6, §3.8):
 *  - Transactions: one row per on-chain transaction, each with its own status,
 *    masked hash, wallet type and confirmations. "View on explorer" is
 *    disabled and says why on hover.
 *  - Ledger breakdown: received, fee, credited, in review, refunded, frozen.
 *  - Conversion rate and when it was applied.
 *  - Events sent to your system: collapsible list; each event expands to the
 *    JSON payload. Payloads carry the external status only.
 *  - Instalment schedule; "Apply surplus to the next instalment" reduces the
 *    next amount due.
 */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function G() { return window.GATE_STORE; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtGST(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    d = new Date(d.getTime() + 4 * 3600000); // GST = UTC+4
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() +
      ", " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " GST";
  }
  function fmtDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function netKey(network) {
    return String(network || "").indexOf("TRC-20") === 0 ? "tron" : "ethereum";
  }
  function confirmTotal(tx) {
    return netKey(tx && tx.network) === "tron" ? F().confirmationCounts.tron : F().confirmationCounts.ethereum;
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function parseLabel(label) {
    var m = /^\s*(Unit [^,]+),\s*instalment\s+(\d+)\s+of\s+(\d+)/i.exec(label || "");
    if (!m) return null;
    return { unit: m[1].trim(), n: parseInt(m[2], 10), total: parseInt(m[3], 10) };
  }
  function maskedHash(hash) {
    var body = String(hash || "").replace(/^0x/, "");
    if (body.length <= 10) return body;
    return body.slice(0, 4) + "…" + body.slice(-4);
  }
  function recoveryLink(label, hash) {
    var a = el("a", "btn ghost", label);
    a.href = hash;
    a.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate(hash); });
    return a;
  }

  /* Payment status the merchant sees. Derived status wins over the legacy
   * payment status because it is the one built from the transactions. */
  var DERIVED_TONE = {
    pending: "neutral", paid: "success", partial: "warning", overpaid: "info",
    in_review: "warning", partially_credited_in_review: "warning", frozen: "neutral"
  };
  function merchantStatus(p) {
    var ext = p.externalStatus || p.derivedStatus;
    var label = ext && S().derivedStatus[ext] ? S().derivedStatus[ext].merchant : window.GATE_STATUSES.label(p.status, "merchant");
    var tone = ext && DERIVED_TONE[ext] ? DERIVED_TONE[ext] : (window.GATE_STATUSES.config[p.status] ? window.GATE_STATUSES.config[p.status].tone : "neutral");
    return { label: label, tone: tone };
  }

  function ledgerSum(p, type) {
    var n = 0;
    G().getLedger(p.id).forEach(function (l) {
      if (l.type === type) n += Number(l.amountAED) || 0;
    });
    return round2(n);
  }

  function eventsFor(p) {
    return G().getEvents(p.id).slice().sort(function (a, b) {
      return new Date(a.time || a.payload.created_at) - new Date(b.time || b.payload.created_at);
    });
  }

  /* Merchant-facing payload: the documented fields only. Anything else — an
   * internal reason, a risk score, a screening result — can never render. */
  function externalPayload(payload) {
    var keep = ["id", "type", "created_at", "payment_reference", "amounts", "status", "idempotency_key"];
    var out = {};
    keep.forEach(function (k) { if (payload && payload[k] !== undefined) out[k] = payload[k]; });
    return out;
  }

  function render(app, params, query) {
    var st = G().get();
    var p = G().byId(params.id);
    var d = S().detail;
    if (!p) {
      app.appendChild(el("h1", "screen-title", "Payment not found"));
      app.appendChild(el("div", "proto-badge", S().protoLabel));
      app.appendChild(el("p", "muted", "This payment is not in the current demo state."));
      app.appendChild(recoveryLink("Back to payments", "#/merchant/payments"));
      return;
    }

    var txs = G().getTransactions(p.id);
    var evs = eventsFor(p);
    var project = F().projects.filter(function (x) { return x.id === p.projectId; })[0];
    var payerFixture = F().payers.filter(function (x) { return x.id === p.payerId; })[0];
    var parsed = parseLabel(p.label);
    var seg = p.merchantId === "M-002" ? "broker" : "realEstate";
    var rate = F().rates.AED_PER_USD;
    var assetUsd = p.asset === "USDC" ? F().rates.USDC_PER_USD : F().rates.USDT_PER_USD;
    var status = merchantStatus(p);

    app.appendChild(recoveryLink(d.backToPayments, "#/merchant/payments"));
    app.appendChild(el("h1", "screen-title", "Payment " + p.id));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    var chipRow = el("div", "chip-row");
    chipRow.appendChild(el("span", "chip tone-" + status.tone, status.label));
    if (p.priorCleared) chipRow.appendChild(el("span", "muted", "Previous instalment cleared " + p.priorCleared));
    app.appendChild(chipRow);

    /* ---------- Summary ---------- */
    var receivedSc = 0;
    txs.forEach(function (tx) { receivedSc += Number(tx.amountSc) || 0; });
    receivedSc = round2(receivedSc);
    var receivedAed = round2(receivedSc * rate * assetUsd);
    var feeAED = ledgerSum(p, "fee");
    var availableAED = ledgerSum(p, "available");

    var sum = el("div", "card");
    sum.appendChild(el("h2", "card-title", d.breakdown));
    sum.appendChild(kv(d.requested, G().fmtAED(p.requestedFiatAED)));
    sum.appendChild(kv(d.received, G().fmtSC(receivedSc, p.asset)));
    sum.appendChild(kv(S().ledger.received, G().fmtAED(receivedAed)));
    sum.appendChild(kv(d.rate, "1 " + p.asset + " = " + assetUsd.toFixed(2) + " USD · " + rate.toFixed(4) + " AED/USD"));
    sum.appendChild(kv(d.fee, G().fmtAED(feeAED) + " (" + (seg === "broker" ? "0.25" : "1.00") + "%)"));
    sum.appendChild(kv(d.credited, G().fmtAED(availableAED), "kv-strong"));
    if (p.shortfall > 0) sum.appendChild(kv(d.shortfall, G().fmtSC(p.shortfall, p.asset), "kv-warn"));
    var surplusLeft = round2((Number(p.surplus) || 0) - (Number(p.surplusAppliedSc) || 0));
    if (surplusLeft > 0) sum.appendChild(kv(d.surplus, G().fmtSC(surplusLeft, p.asset), "kv-warn"));

    var creditedEv = null;
    evs.forEach(function (e) { if (e.type === "payment.credited") creditedEv = e.time || e.payload.created_at; });
    sum.appendChild(kv(d.rateApplied, creditedEv ? fmtGST(creditedEv) : d.rateWaiting));
    app.appendChild(sum);

    /* ---------- Who paid (merchant-safe fields only) ---------- */
    var meta = el("div", "card");
    meta.appendChild(el("h2", "card-title", d.paymentDetails));
    meta.appendChild(kv("Project", project ? project.name : "—"));
    meta.appendChild(kv("Unit / instalment", parsed ? parsed.unit + ", " + parsed.n + " of " + parsed.total : p.label));
    meta.appendChild(kv("Payer", p.payerName || (payerFixture ? payerFixture.name : "—")));
    meta.appendChild(kv("Country", p.payerCountry || (payerFixture ? payerFixture.country : "—")));
    if (p.buyerAnswer) {
      meta.appendChild(kv("Buyer on the sale agreement", p.buyerAnswer === "no" ? "No — paying for the buyer" : "Yes"));
      if (p.buyerAnswer === "no" && p.payerRelationship) {
        meta.appendChild(kv("Relationship", S().travelRule.relationships[p.payerRelationship] || p.payerRelationship));
      }
    }
    if (txs.length) {
      meta.appendChild(kv("Sent from", txs[0].walletType === "exchange" ? S().transactions.wallet.exchange : S().transactions.wallet.own));
    }
    app.appendChild(meta);

    /* ---------- Transactions ---------- */
    var txCard = el("div", "card");
    txCard.appendChild(el("h2", "card-title", d.transactionsTitle));
    txCard.appendChild(el("div", "muted", d.transactionsHint));
    if (!txs.length) {
      txCard.appendChild(el("p", "muted", d.noTransactions));
    } else {
      txCard.appendChild(transactionsTable(txs));
    }
    app.appendChild(txCard);

    /* ---------- Ledger ---------- */
    var led = el("div", "card");
    led.appendChild(el("h2", "card-title", d.ledgerTitle));
    if (!G().getLedger(p.id).length) {
      led.appendChild(el("p", "muted", S().ledger.empty));
    } else {
      led.appendChild(kv(S().ledger.received, G().fmtAED(receivedAed)));
      led.appendChild(kv(S().ledger.fee, G().fmtAED(ledgerSum(p, "fee"))));
      led.appendChild(kv(S().ledger.credited, G().fmtAED(availableAED), "kv-strong"));
      led.appendChild(kv(S().ledger.inReview, G().fmtAED(ledgerSum(p, "in_review"))));
      led.appendChild(kv(S().ledger.refunded, G().fmtAED(ledgerSum(p, "refund"))));
      led.appendChild(kv(S().ledger.frozen, G().fmtAED(ledgerSum(p, "frozen"))));
    }
    app.appendChild(led);

    /* ---------- Surplus: apply to the next instalment ---------- */
    if (surplusLeft > 0 || (p.status === "overpaid" && !p.surplusRefunded)) {
      app.appendChild(surplusPanel(surplusLeft));
    }

    /* ---------- Instalment schedule ---------- */
    var sch = buildSchedule(p);
    if (sch) app.appendChild(scheduleCard(sch, p.asset));

    /* ---------- Underpaid ---------- */
    if (p.status === "partial" && p.derivedStatus !== "partially_credited_in_review") {
      var up = el("div", "card accent");
      up.appendChild(el("h3", "card-subtitle", d.underpaid.remaining + ": " + G().fmtSC(Math.max(0, p.requestedSc - receivedSc), p.asset)));
      var btn = el("button", "btn primary", d.underpaid.topUp);
      btn.type = "button";
      btn.addEventListener("click", function () {
        var copied = function () {
          btn.textContent = d.underpaid.topUpCopied;
          setTimeout(function () { btn.textContent = d.underpaid.topUp; }, 1800);
        };
        var manual = function () { btn.textContent = "Copy manually"; setTimeout(function () { btn.textContent = d.underpaid.topUp; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try { navigator.clipboard.writeText("gate://topup/" + p.id).then(copied).catch(manual); }
          catch (err) { manual(); }
        } else { manual(); }
      });
      up.appendChild(btn);
      app.appendChild(up);
    }

    if (p.lateMatched) {
      var late = el("div", "banner info");
      late.appendChild(el("strong", "", d.late.notice + ". "));
      late.appendChild(el("span", "", d.late.detail.replace("{expiry}", p.expiredAt ? fmtGST(p.expiredAt) : "—")));
      app.appendChild(late);
    }

    /* ---------- Hold panel ---------- */
    if (p.status === "held" || p.status === "overdueHeld" || p.status === "action" || p.status === "frozen") {
      app.appendChild(holdPanel(p));
    }

    /* ---------- Events sent to your system ---------- */
    app.appendChild(eventsPanel(evs));

    /* ---------- Activity (merchant-visible timeline) ---------- */
    var tl = el("div", "card");
    tl.appendChild(el("h2", "card-title", d.timeline));
    var list = el("div", "timeline vertical");
    p.timeline.filter(function (e) { return !e.internal; }).forEach(function (e) {
      var item = el("div", "timeline-item v");
      item.appendChild(el("div", "tl-label", e.text));
      item.appendChild(el("div", "tl-time", fmtGST(e.ts)));
      list.appendChild(item);
    });
    if (p.priorCleared) {
      var prior = el("div", "timeline-item v muted");
      prior.appendChild(el("div", "tl-label", "Previous instalment from this wallet cleared on " + p.priorCleared));
      list.appendChild(prior);
    }
    tl.appendChild(list);
    app.appendChild(tl);

    /* ---------- helpers bound to this payment ---------- */

    function transactionsTable(rows) {
      var table = el("table", "data-table");
      var thead = el("thead");
      var hr = el("tr");
      [S().transactions.hash, S().transactions.amount, S().transactions.network, S().transactions.walletType, "Confirmations", "Status", ""].forEach(function (h) {
        hr.appendChild(el("th", "", h));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      rows.forEach(function (tx) {
        var tr = el("tr", "row");
        var tdHash = el("td", "");
        tdHash.dataset.label = S().transactions.hash;
        var code = el("code", "", maskedHash(tx.hash));
        code.title = tx.hash || "";
        tdHash.appendChild(code);
        tr.appendChild(tdHash);

        var tdAmt = el("td", "num", G().fmtSC(tx.amountSc, tx.asset || p.asset));
        tdAmt.dataset.label = S().transactions.amount;
        tr.appendChild(tdAmt);

        var tdNet = el("td", "", tx.network || p.network);
        tdNet.dataset.label = S().transactions.network;
        tr.appendChild(tdNet);

        var tdWall = el("td", "", tx.walletType === "exchange" ? S().transactions.wallet.exchange : S().transactions.wallet.own);
        tdWall.dataset.label = S().transactions.walletType;
        tr.appendChild(tdWall);

        var total = confirmTotal(tx);
        var tdConf = el("td", "", S().transactions.confirmations.replace("{n}", String(Number(tx.confirmations) || 0)).replace("{total}", String(total)));
        tdConf.dataset.label = "Confirmations";
        tr.appendChild(tdConf);

        var tdStatus = el("td", "");
        tdStatus.dataset.label = "Status";
        var labels = S().transactions.status;
        var tone = tx.status === "cleared" ? "success" : (tx.status === "frozen" ? "neutral" : "warning");
        tdStatus.appendChild(el("span", "chip tone-" + tone, labels[tx.status] || tx.status));
        tr.appendChild(tdStatus);

        var tdLink = el("td", "");
        var link = el("span", "muted", d.explorer);
        link.title = d.explorerTooltip;
        link.setAttribute("aria-disabled", "true");
        link.style.opacity = "0.5";
        link.style.cursor = "not-allowed";
        link.style.textDecoration = "underline dotted";
        tdLink.appendChild(link);
        tr.appendChild(tdLink);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      return table;
    }

    function surplusPanel(amountLeft) {
      var card = el("div", "card accent");
      card.appendChild(el("h3", "card-subtitle", d.overpaid.surplusLine.replace("{amount}", G().fmtSC(amountLeft, p.asset))));
      var applyBtn = el("button", "btn", d.overpaid.apply);
      var refundBtn = el("button", "btn ghost", d.overpaid.refund);
      applyBtn.type = "button"; refundBtn.type = "button";

      if (p.surplusAppliedSc) {
        applyBtn.textContent = d.overpaid.applied;
        applyBtn.disabled = true;
      }
      if (p.surplusRefunded) {
        refundBtn.textContent = d.overpaid.refunded;
        refundBtn.disabled = true;
      }

      applyBtn.addEventListener("click", function () {
        var next = nextInstalment(p);
        if (!next) {
          G().addToast(d.overpaid.noNext, "warning");
          return;
        }
        var open = Math.max(0, (Number(next.payment.requestedSc) || 0) - (Number(next.payment.scheduleAdjustSc) || 0));
        var applied = round2(Math.min(amountLeft, open));
        if (applied <= 0) return;
        p.surplusAppliedSc = round2((Number(p.surplusAppliedSc) || 0) + applied);
        next.payment.scheduleAdjustSc = round2((Number(next.payment.scheduleAdjustSc) || 0) + applied);
        p.timeline.push({ ts: G().ts(), seat: "merchant", text: d.overpaid.applied, internal: false });
        G().addToast(d.overpaid.applied, "success");
        G().notify();
      });

      refundBtn.addEventListener("click", function () {
        p.surplusRefunded = true;
        p.timeline.push({ ts: G().ts(), seat: "merchant", text: d.overpaid.refunded, internal: false });
        G().addToast(d.overpaid.refunded, "success");
        G().notify();
      });

      card.appendChild(applyBtn);
      card.appendChild(refundBtn);
      return card;
    }

    function holdPanel(target) {
      var h = el("div", "card hold-panel");
      h.appendChild(el("h2", "card-title", d.hold.title));
      if (target.status === "overdueHeld") {
        h.appendChild(el("div", "banner warning", d.hold.escalation));
      }
      if (target.status !== "frozen") {
        h.appendChild(kv(d.hold.dueBy, target.decisionDueBy ? fmtGST(target.decisionDueBy) : "—"));
        if (target.reasonCategory) h.appendChild(kv(d.hold.reasonCategory, target.reasonCategory));
        if (target.status === "action" && target.infoRequested) h.appendChild(kv(d.hold.needed, target.infoRequested + " — from the payer"));
        h.appendChild(el("div", "kv-k", d.hold.outcomes));
        var ul = el("ul", "outcome-list");
        d.hold.outcomeList.forEach(function (o) {
          var li = el("li", "", o); ul.appendChild(li);
        });
        h.appendChild(ul);
        if (target.status !== "action") {
          var b1 = el("button", "btn", d.hold.reminder);
          var b2 = el("button", "btn ghost", d.hold.contact);
          b1.type = "button"; b2.type = "button";
          b1.addEventListener("click", function () {
            b1.textContent = d.hold.reminderSent;
            G().addToast(d.hold.reminderSent, "success");
            setTimeout(function () { b1.textContent = d.hold.reminder; }, 1800);
          });
          b2.addEventListener("click", function () {
            b2.textContent = d.hold.contactSent;
            G().addToast(d.hold.contactSent, "success");
            setTimeout(function () { b2.textContent = d.hold.contact; }, 1800);
          });
          h.appendChild(b1); h.appendChild(b2);
        }
      } else {
        h.appendChild(el("p", "", "This payment cannot be released at this time. Our team will contact you if anything is needed."));
      }
      return h;
    }

    function eventsPanel(list) {
      var card = el("div", "card");
      card.appendChild(el("h2", "card-title", S().events.title));
      card.appendChild(el("div", "muted", S().events.subtitle));

      var outer = document.createElement("details");
      outer.style.marginBlockStart = "var(--sp-3)";
      var summary = document.createElement("summary");
      summary.textContent = S().events.toggle.replace("{n}", String(list.length));
      summary.style.cursor = "pointer";
      outer.appendChild(summary);

      var head = el("code", "copy-value", S().events.signature);
      head.style.display = "inline-block";
      head.style.marginBlock = "var(--sp-3) var(--sp-2)";
      outer.appendChild(head);

      if (!list.length) {
        outer.appendChild(el("p", "muted", S().events.empty));
      } else {
        list.forEach(function (ev) {
          var row = document.createElement("details");
          row.style.borderBlockEnd = "1px solid var(--color-line)";
          var s2 = document.createElement("summary");
          s2.textContent = ev.type + " · " + fmtGST(ev.time || ev.payload.created_at);
          s2.style.cursor = "pointer";
          s2.style.padding = "var(--sp-2) 0";
          row.appendChild(s2);
          var pre = el("pre", "", JSON.stringify(externalPayload(ev.payload), null, 2));
          pre.style.fontSize = "var(--fs-xs)";
          pre.style.overflowX = "auto";
          pre.style.background = "var(--color-surface-alt)";
          pre.style.padding = "var(--sp-3)";
          pre.style.borderRadius = "var(--radius-sm)";
          row.appendChild(pre);
          outer.appendChild(row);
        });
      }
      card.appendChild(outer);
      return card;
    }
  }

  /* ---------- schedule (same shape as S1) ---------- */
  function buildSchedule(p) {
    var parsed = parseLabel(p.label);
    if (!parsed) return null;
    var rows = [];
    F().payments.forEach(function (q) {
      var qp = parseLabel(q.label);
      if (q.projectId !== p.projectId || !qp || qp.unit !== parsed.unit) return;
      rows.push({ payment: q, n: qp.n, total: qp.total });
    });
    rows.sort(function (a, b) { return a.n - b.n; });
    function paid(q) { return q.status === "paid" || q.scheduleStatus === "paid"; }
    var currentN = null;
    for (var i = 0; i < rows.length; i++) {
      if (!paid(rows[i].payment)) { currentN = rows[i].n; break; }
    }
    if (currentN == null) currentN = parsed.n;
    rows.forEach(function (row) {
      row.due = new Date(Date.UTC(2026, 10 + (row.n - currentN), 10));
      row.adjust = Number(row.payment.scheduleAdjustSc) || 0;
      row.amountSc = Math.max(0, (Number(row.payment.requestedSc) || 0) - row.adjust);
      row.status = paid(row.payment) ? "paid" : (row.n === currentN ? "current" : "upcoming");
    });
    return { unit: parsed.unit, total: parsed.total, rows: rows };
  }

  function nextInstalment(p) {
    var sch = buildSchedule(p);
    if (!sch) return null;
    var parsed = parseLabel(p.label);
    for (var i = 0; i < sch.rows.length; i++) {
      var row = sch.rows[i];
      if (row.n > parsed.n && row.status !== "paid") return row;
    }
    return null;
  }

  function scheduleCard(sch, asset) {
    var st = S().schedule;
    var card = el("div", "card");
    card.appendChild(el("h2", "card-title", st.title));
    card.appendChild(el("div", "muted", st.subtitle));
    var table = el("table", "data-table");
    var thead = el("thead");
    var hr = el("tr");
    hr.appendChild(el("th", "", st.instalment));
    hr.appendChild(el("th", "", st.dueDate));
    hr.appendChild(el("th", "num", st.amount));
    hr.appendChild(el("th", "", st.status));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    sch.rows.forEach(function (row) {
      var tr = el("tr", "row");
      if (row.status === "current") tr.style.background = "var(--color-warning-soft)";
      var tdN = el("td", "", "Instalment " + row.n + " of " + row.total);
      tdN.dataset.label = st.instalment;
      tr.appendChild(tdN);
      var tdD = el("td", "", fmtDate(row.due));
      tdD.dataset.label = st.dueDate;
      tr.appendChild(tdD);
      var tdA = el("td", "num", G().fmtSC(row.amountSc, asset));
      tdA.dataset.label = st.amount;
      if (row.adjust > 0) {
        tdA.appendChild(el("div", "cell-sub", st.reducedBy.replace("{amount}", G().fmtSC(row.adjust, asset))));
      }
      tr.appendChild(tdA);
      var tdS = el("td", "");
      tdS.dataset.label = st.status;
      var tone = row.status === "paid" ? "success" : row.status === "current" ? "warning" : "neutral";
      var label = row.status === "paid" ? st.paid : row.status === "current" ? st.current : st.upcoming;
      tdS.appendChild(el("span", "chip tone-" + tone, label));
      tr.appendChild(tdS);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  function kv(k, v, cls) {
    var r = el("div", "kv-row");
    r.appendChild(el("dt", "kv-k", k));
    r.appendChild(el("dd", "kv-v" + (cls ? " " + cls : ""), v));
    return r;
  }

  window.GATE_ROUTER.register("merchant/payments/:id", render, "merchant-payment-detail");
})();
