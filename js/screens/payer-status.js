/* S2. Payer: Payment status (#/payer/status) */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render(app, params, query) {
    var st = window.GATE_STORE.get();
    var scId = st.scenarioId || "H1";
    var sc = window.GATE_SCENARIOS.byId(scId);
    var payId = (sc && sc.paymentId) || "P-1001";
    var p = window.GATE_STORE.byId(payId);
    if (!p) return;
    var v = S().status.variants;

    app.appendChild(el("h1", "screen-title", S().status.title + " · " + p.id));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    /* Timeline: Detected -> Checks -> Confirmed */
    var tl = el("div", "timeline");
    var stages = S().status.timeline;
    var currentIdx = { pending: -1, detected: 0, checks: 1, confirmed: 2, paid: 2, partial: 2, held: 1, action: 1, overpaid: 2, declined: 1, frozen: 1, expired: -1, needsManual: 1, overdueHeld: 1 }[p.status] != null ? { pending: -1, detected: 0, checks: 1, confirmed: 2, paid: 2, partial: 2, held: 1, action: 1, overpaid: 2, declined: 1, frozen: 1, expired: -1, needsManual: 1, overdueHeld: 1 }[p.status] : 0;
    stages.forEach(function (name, i) {
      var item = el("div", "timeline-item" + (i <= currentIdx ? " done" : "") + (i === currentIdx ? " current" : ""));
      item.appendChild(el("div", "tl-dot"));
      item.appendChild(el("div", "tl-label", name));
      tl.appendChild(item);
    });
    app.appendChild(tl);

    var card = el("div", "card");
    var variantKey = {
      paid: "paid", overpaid: "overpaid", partial: "partial",
      held: "review", overdueHeld: "review", action: "action",
      declined: "returned", frozen: "frozen", expired: "expired", needsManual: "needsManual",
      detected: "review", checks: "review", confirmed: "review", pending: "expired"
    }[p.status];

    if (p.status === "pending") {
      card.appendChild(el("h2", "card-title", "Awaiting payment"));
      card.appendChild(el("p", "muted", "Open the checkout and submit the form to begin the demo."));
    } else {
      var key = variantKey;
      var known = !!(key && v[key]);
      /* Unknown status: generic headline plus the raw value, never a crash. */
      var h = el("h2", "card-title", known ? v[key].headline : "Payment status");
      card.appendChild(h);
      if (!known) {
        card.appendChild(el("p", "", "Status: " + p.status));
      } else if (key === "paid") {
        card.appendChild(el("div", "kv-row"));
        var r = el("div", "kv");
        r.appendChild(row2(v[key].amountSent, window.GATE_STORE.fmtSC(p.receivedSc, p.asset)));
        r.appendChild(row2(v[key].amountApplied, window.GATE_STORE.fmtSC(Math.min(p.receivedSc, p.requestedSc), p.asset)));
        r.appendChild(row2("Reference", p.id));
        r.appendChild(row2(v[key].time, window.GATE_STORE.fmtClock(new Date(p.timeline.length ? p.timeline[p.timeline.length-1].ts : Date.now()))));
        card.appendChild(r);
        if (p.surplus > 0) card.appendChild(el("div", "banner info", v.overpaid.surplus.replace("{amount}", window.GATE_STORE.fmtSC(p.surplus, p.asset))));
      } else if (key === "partial") {
        card.appendChild(el("div", "kv"));
        var r2 = el("div", "kv");
        r2.appendChild(row2(v[key].received, window.GATE_STORE.fmtSC(p.receivedSc, p.asset)));
        r2.appendChild(row2(v[key].remaining, window.GATE_STORE.fmtSC(p.requestedSc - p.receivedSc, p.asset)));
        card.appendChild(r2);
        card.appendChild(el("p", "", v[key].keepPaying));
        card.appendChild(copyBlock(p.address));
      } else if (key === "review") {
        var deadline = p.decisionDueBy ? window.GATE_STORE.fmtClock(new Date(p.decisionDueBy)) : "—";
        card.appendChild(el("p", "", v[key].body.replace("{deadline}", deadline)));
        card.appendChild(el("p", "muted", v[key].whatNext));
        card.appendChild(el("div", "kv"));
        card.appendChild(row2("Reference", p.id));
      } else if (key === "action") {
        card.appendChild(el("p", "", v[key].body));
        card.appendChild(el("div", "banner warning"));
        card.lastChild.appendChild(el("strong", "", v[key].request + ": " + (p.infoRequested || "Documents")));
        var up = el("button", "btn primary", v[key].uploadBtn);
        up.type = "button";
        up.addEventListener("click", function () {
          p.infoProvided = true;
          p.timeline.push({ ts: window.GATE_STORE.ts(), seat: "payer", text: "Information uploaded", internal: false });
          window.GATE_STORE.addToast("Information received (simulated)", "success");
          window.GATE_STORE.notify();
        });
        card.appendChild(up);
        if (p.infoProvided) card.appendChild(el("div", "badge success", "✓ " + v[key].uploadDone));
      } else if (key === "overpaid") {
        card.appendChild(el("p", "", v[key].surplus.replace("{amount}", window.GATE_STORE.fmtSC(p.surplus, p.asset))));
      } else if (key === "returned") {
        card.appendChild(el("p", "", v[key].body));
        var r3 = el("div", "kv");
        r3.appendChild(row2(v[key].returned, window.GATE_STORE.fmtSC(p.receivedSc - F().rules.refundNetworkFee, p.asset)));
        r3.appendChild(row2(v[key].fee, window.GATE_STORE.fmtSC(F().rules.refundNetworkFee, p.asset)));
        card.appendChild(r3);
      } else if (key === "frozen") {
        card.appendChild(el("p", "", v[key].body));
      } else if (key === "expired") {
        card.appendChild(el("p", "", v[key].body));
      } else if (key === "needsManual") {
        card.appendChild(el("p", "", v[key].body));
        card.appendChild(el("div", "banner warning", "Sent on " + (p.receivedNetwork || "another network") + ", expected " + p.network + "."));
      }
    }
    app.appendChild(card);

    function row2(k, val) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v", val));
      return r;
    }
    function copyBlock(addr) {
      var w = el("div", "copy-field");
      var out = el("code", "copy-value"); out.textContent = addr;
      var b = el("button", "btn small", "Copy"); b.type = "button";
      b.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr);
        b.textContent = "Copied"; setTimeout(function(){ b.textContent = "Copy"; }, 1500);
        window.GATE_STORE.addToast("Copied " + addr, "success");
      });
      w.appendChild(out); w.appendChild(b);
      return w;
    }
  }

  window.GATE_ROUTER.register("payer/status", render, "payer-status");
})();
