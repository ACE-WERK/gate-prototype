/* S4. Merchant: Payment detail (#/merchant/payments/:id) */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  /* Recovery link for empty states: a real anchor that also routes in-app. */
  function recoveryLink(label, hash) {
    var a = el("a", "btn ghost", label);
    a.href = hash;
    a.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate(hash); });
    return a;
  }

  function render(app, params, query) {
    var st = window.GATE_STORE.get();
    var p = window.GATE_STORE.byId(params.id);
    var d = S().detail;
    if (!p) {
      app.appendChild(el("h1", "screen-title", d.breakdown));
      app.appendChild(el("div", "proto-badge", S().protoLabel));
      app.appendChild(el("p", "muted", "Payment not found."));
      app.appendChild(recoveryLink("Back to payments", "#/merchant/payments"));
      return;
    }
    app.appendChild(el("h1", "screen-title", "Payment " + p.id));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    var project = F().projects.find(function (x) { return x.id === p.projectId; });
    var payer = F().payers.find(function (x) { return x.id === p.payerId; });
    var seg = p.merchantId === "M-002" ? "broker" : "realEstate";
    var M = F().math;

    /* Status chip */
    var chipRow = el("div", "chip-row");
    chipRow.appendChild(el("span", "chip tone-" + window.GATE_STATUSES.config[p.status].tone, window.GATE_STATUSES.label(p.status, "merchant")));
    app.appendChild(chipRow);

    /* Breakdown */
    var card = el("div", "card");
    card.appendChild(el("h2", "card-title", d.breakdown));
    card.appendChild(kv(d.requested, window.GATE_STORE.fmtAED(p.requestedFiatAED)));
    card.appendChild(kv(d.received, window.GATE_STORE.fmtSC(p.receivedSc, p.asset) + (p.receivedNetwork && p.receivedNetwork !== p.network ? "  (sent on " + p.receivedNetwork + ")" : "")));
    card.appendChild(kv(d.rate, F().rates.AED_PER_USD.toFixed(4) + " AED/USD · 1 " + p.asset + " = 1.00 USD"));
    card.appendChild(kv(d.fee, window.GATE_STORE.fmtAED(p.feeAED) + " (" + (seg === "broker" ? "0.25" : "1.00") + "%)"));
    if (p.status === "paid") card.appendChild(kv(d.credited, window.GATE_STORE.fmtAED(p.creditedAED), "kv-strong"));
    if (p.shortfall > 0) card.appendChild(kv(d.shortfall, window.GATE_STORE.fmtSC(p.shortfall, p.asset), "kv-warn"));
    if (p.surplus > 0) card.appendChild(kv(d.surplus, window.GATE_STORE.fmtSC(p.surplus, p.asset), "kv-warn"));
    app.appendChild(card);

    /* Underpaid / overpaid / late panels */
    if (p.status === "partial") {
      var up = el("div", "card accent");
      up.appendChild(el("h3", "card-subtitle", d.underpaid.remaining + ": " + window.GATE_STORE.fmtSC(p.requestedSc - p.receivedSc, p.asset)));
      var btn = el("button", "btn primary", d.underpaid.topUp);
      btn.type = "button";
      btn.addEventListener("click", function () {
        var reset = function () { btn.textContent = d.underpaid.topUp; };
        var copied = function () {
          btn.textContent = d.underpaid.topUpCopied;
          setTimeout(reset, 1800);
        };
        var manual = function () {
          btn.textContent = "Copy manually";
          setTimeout(reset, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            navigator.clipboard.writeText("gate://topup/" + p.id).then(copied).catch(manual);
          } catch (err) {
            manual();
          }
        } else {
          manual();
        }
      });
      up.appendChild(btn);
      app.appendChild(up);
    }
    if (p.surplus > 0 && (p.status === "overpaid" || p.status === "paid")) {
      var op = el("div", "card accent");
      op.appendChild(el("h3", "card-subtitle", d.overpaid.surplusLine.replace("{amount}", window.GATE_STORE.fmtSC(p.surplus, p.asset))));
      var b1 = el("button", "btn", d.overpaid.apply);
      var b2 = el("button", "btn", d.overpaid.refund);
      b1.type = "button"; b2.type = "button";
      b1.addEventListener("click", function () {
        p.surplusApplied = true;
        b1.disabled = true;
        b2.disabled = true;
        p.timeline.push({ ts: window.GATE_STORE.ts(), seat: "merchant", text: "Surplus applied to next instalment", internal: false });
        window.GATE_STORE.addToast(d.overpaid.applied, "success");
        window.GATE_STORE.notify();
      });
      b2.addEventListener("click", function () {
        p.surplusRefunded = true;
        b1.disabled = true;
        b2.disabled = true;
        p.timeline.push({ ts: window.GATE_STORE.ts(), seat: "merchant", text: "Surplus refunded", internal: false });
        window.GATE_STORE.addToast(d.overpaid.refunded, "success");
        window.GATE_STORE.notify();
      });
      if (p.surplusApplied) { b1.textContent = d.overpaid.applied; b1.disabled = true; b2.disabled = true; }
      if (p.surplusRefunded) { b2.textContent = d.overpaid.refunded; b1.disabled = true; b2.disabled = true; }
      op.appendChild(b1); op.appendChild(b2);
      app.appendChild(op);
    }
    if (p.lateMatched) {
      var late = el("div", "banner info");
      late.appendChild(el("strong", "", d.late.notice + ". "));
      late.appendChild(el("span", "", d.late.detail.replace("{expiry}", p.expiredAt ? window.GATE_STORE.fmtClock(new Date(p.expiredAt)) : "—")));
      app.appendChild(late);
    }

    /* Hold panel */
    if (p.status === "held" || p.status === "overdueHeld" || p.status === "action" || p.status === "frozen") {
      var h = el("div", "card hold-panel");
      h.appendChild(el("h2", "card-title", d.hold.title));
      if (p.status === "overdueHeld") {
        var esc = el("div", "banner warning");
        esc.textContent = d.hold.escalation;
        h.appendChild(esc);
      }
      if (p.status !== "frozen") {
        h.appendChild(kv(d.hold.dueBy, p.decisionDueBy ? window.GATE_STORE.fmtClock(new Date(p.decisionDueBy)) : "—"));
        if (p.reasonCategory) h.appendChild(kv(d.hold.reasonCategory, p.reasonCategory));
        if (p.status === "action" && p.infoRequested) h.appendChild(kv(d.hold.needed, p.infoRequested + " — from the payer"));
        var outcomes = el("div", "kv-row");
        h.appendChild(el("div", "kv-k", d.hold.outcomes));
        var ul = el("ul", "outcome-list");
        d.hold.outcomeList.forEach(function (o) {
          var li = el("li"); li.textContent = o; ul.appendChild(li);
        });
        h.appendChild(ul);
        if (p.status !== "action" && p.status !== "frozen") {
          var b1 = el("button", "btn", d.hold.reminder);
          var b2 = el("button", "btn", d.hold.contact);
          b1.type = "button"; b2.type = "button";
          b1.addEventListener("click", function () {
            b1.textContent = d.hold.reminderSent;
            window.GATE_STORE.addToast(d.hold.reminderSent, "success");
            setTimeout(function () { b1.textContent = d.hold.reminder; }, 1800);
          });
          b2.addEventListener("click", function () {
            b2.textContent = d.hold.contactSent;
            window.GATE_STORE.addToast(d.hold.contactSent, "success");
            setTimeout(function () { b2.textContent = d.hold.contact; }, 1800);
          });
          h.appendChild(b1); h.appendChild(b2);
        }
      } else {
        /* Frozen: neutral wording, no reason, no further merchant actions */
        h.appendChild(el("p", "", "This payment cannot be released at this time. Our team will contact you if anything is needed."));
      }
      app.appendChild(h);
    }

    /* Timeline (merchant-visible events) */
    var tl = el("div", "card");
    tl.appendChild(el("h2", "card-title", d.timeline));
    var list = el("div", "timeline vertical");
    p.timeline.filter(function (e) { return !e.internal; }).forEach(function (e) {
      var item = el("div", "timeline-item v");
      item.appendChild(el("div", "tl-label", e.text));
      item.appendChild(el("div", "tl-time", window.GATE_STORE.fmtClock(new Date(e.ts))));
      list.appendChild(item);
    });
    if (p.priorCleared) {
      var prior = el("div", "timeline-item v muted");
      prior.appendChild(el("div", "tl-label", "Previous instalment from this wallet cleared on " + p.priorCleared));
      list.appendChild(prior);
    }
    tl.appendChild(list);
    app.appendChild(tl);

    function kv(k, v, cls) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v" + (cls ? " " + cls : ""), v));
      return r;
    }
  }

  window.GATE_ROUTER.register("merchant/payments/:id", render, "merchant-payment-detail");
})();
