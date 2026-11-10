/* S2. Payer: Payment status (#/payer/status)
 *
 * Phase 3a rework (followup §3.2, §3.4, §3.9):
 *  - On-chain timeline: Detected → Confirming (n of N) → Checks → Converted
 *    → Credited, driven by the payment's transactions. Confirmation totals
 *    are fixtures (Tron 19, Ethereum 12).
 *  - Times are Gulf Standard Time (UTC+4) and labelled as such.
 *  - Refunds: an own-wallet payment goes back to the sending address after
 *    re-screening; an exchange payment needs a refund address in the payer's
 *    own account. Refund = received - 2.00 USDT, no conversion. Frozen funds
 *    are never refunded.
 *  - E16: slow checks are stated once, in neutral wording, with nothing
 *    asked of the payer.
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
      ", " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " GST (UTC+4)";
  }
  function netKey(network) {
    return String(network || "").indexOf("TRC-20") === 0 ? "tron" : "ethereum";
  }
  function confirmTotal(tx) {
    var k = netKey(tx && tx.network);
    return k === "tron" ? F().confirmationCounts.tron : F().confirmationCounts.ethereum;
  }
  function fmtElapsed(ms) {
    var mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 60) return mins + " min";
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + " h" + (m ? " " + m + " min" : "");
    var d = Math.floor(h / 24), hh = h % 24;
    return d + " d" + (hh ? " " + hh + " h" : "");
  }

  /* Where one transaction sits on the on-chain lifecycle. */
  function txStep(tx) {
    if (!tx) return -1;
    var total = confirmTotal(tx);
    var conf = Number(tx.confirmations) || 0;
    if (tx.status === "cleared") return 4;
    if (tx.status === "frozen") return 2;
    if (tx.status === "in_review" || tx.status === "held") return 2;
    if (tx.status === "needs_manual") return 2;
    if (conf >= total) return 2;
    if (conf > 0) return 1;
    return 0;
  }

  function onchain(p) {
    var txs = G().getTransactions(p.id);
    if (!txs.length) return { idx: -1, tx: null, total: 0, conf: 0 };
    var best = txs[0], bestIdx = txStep(txs[0]);
    txs.forEach(function (tx) {
      var i = txStep(tx);
      if (i > bestIdx || (i === bestIdx && (Number(tx.confirmations) || 0) > (Number(best.confirmations) || 0))) {
        best = tx; bestIdx = i;
      }
    });
    var anyCleared = txs.some(function (t) { return t.status === "cleared"; });
    var anyReview = txs.some(function (t) { return t.status === "in_review" || t.status === "held"; });
    /* A credited leg plus a held leg is the "converted" state: part of the
     * money is already working, the rest is still being checked. */
    if (anyCleared && anyReview) bestIdx = 3;
    return { idx: bestIdx, tx: best, total: confirmTotal(best), conf: Number(best.confirmations) || 0 };
  }

  function render(app, params, query) {
    var st = G().get();
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId || "H1");
    var p = G().byId((sc && sc.paymentId) || "P-1001");
    if (!p) return;
    var v = S().status.variants;
    var o = S().status.onchain;
    var oc = onchain(p);
    var txs = G().getTransactions(p.id);
    var evs = G().getEvents(p.id).slice().sort(function (a, b) {
      return new Date(a.time || a.payload.created_at) - new Date(b.time || b.payload.created_at);
    });
    function evAt(type) {
      var found = null;
      evs.forEach(function (e) { if (e.type === type) found = e.time || e.payload.created_at; });
      return found;
    }

    app.appendChild(el("h1", "screen-title", S().status.title + " · " + p.id));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    var chipRow = el("div", "chip-row");
    chipRow.appendChild(el("span", "chip tone-" + (window.GATE_STATUSES.config[p.status] ? window.GATE_STATUSES.config[p.status].tone : "neutral"), G().statusLabel(p.status, "payer")));
    app.appendChild(chipRow);

    /* ---------- On-chain timeline ---------- */
    var tlCard = el("div", "card");
    tlCard.appendChild(el("h2", "card-title", o.title));
    tlCard.appendChild(el("div", "muted", S().view.gst));

    if (oc.idx < 0) {
      tlCard.appendChild(el("p", "muted", o.awaiting));
    } else {
      var tl = el("div", "timeline");
      o.steps.forEach(function (name, i) {
        var label = name;
        if (i === 1) label = o.confirming.replace("{n}", String(oc.conf)).replace("{total}", String(oc.total));
        var item = el("div", "timeline-item" + (i < oc.idx ? " done" : "") + (i === oc.idx ? " current done" : ""));
        item.appendChild(el("div", "tl-dot"));
        item.appendChild(el("div", "tl-label", label));
        var when = i === 0 ? evAt("payment.detected") : i === 1 ? evAt("payment.confirmed") : i === 4 ? evAt("payment.credited") : null;
        if (when) item.appendChild(el("div", "cell-sub", fmtGST(when)));
        tl.appendChild(item);
      });
      tlCard.appendChild(tl);

      var startedAt = evs.length ? (evs[0].time || evs[0].payload.created_at) : (p.timeline.length ? p.timeline[0].ts : null);
      var meta = [];
      if (startedAt) meta.push(o.elapsed.replace("{time}", fmtElapsed(st.clock.getTime() - new Date(startedAt).getTime())));
      var lastAt = evs.length ? (evs[evs.length - 1].time || evs[evs.length - 1].payload.created_at) : null;
      meta.push("Last update " + (lastAt ? fmtGST(lastAt) : "—"));
      var metaLine = el("div", "muted", meta.join(" · "));
      tlCard.appendChild(metaLine);
    }
    app.appendChild(tlCard);

    /* ---------- Status variant ---------- */
    var card = el("div", "card");
    card.dataset.anchor = "s2-status";
    var heldV = G().variant("held");
    var partV = G().variant("partial");
    var overV = G().variant("overpaid");
    var lateV = G().variant("late");
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
      var headline = known ? v[key].headline : "Payment status";
      if (known && (key === "review" || key === "action") && (!heldV.showDeadline || !heldV.showActions)) headline = heldV.payer;
      card.appendChild(el("h2", "card-title", headline));
      if (!known) {
        card.appendChild(el("p", "", "Status: " + p.status));
      } else if (key === "paid") {
        var r = el("div", "kv");
        r.appendChild(row2(v[key].amountSent, G().fmtSC(p.receivedSc, p.asset)));
        r.appendChild(row2(v[key].amountApplied, G().fmtSC(Math.min(p.receivedSc, p.requestedSc), p.asset)));
        if (p.creditedAED > 0) r.appendChild(row2(v[key].credited, G().fmtAED(p.creditedAED)));
        r.appendChild(row2("Reference", p.id));
        var paidAt = evAt("payment.credited") || (p.timeline.length ? p.timeline[p.timeline.length - 1].ts : null);
        r.appendChild(row2(v[key].time, paidAt ? fmtGST(paidAt) : "—"));
        card.appendChild(r);
        if (p.surplus > 0 && overV.showSurplus) card.appendChild(el("div", "banner info", v.overpaid.surplus.replace("{amount}", G().fmtSC(p.surplus, p.asset))));
        if (p.lateMatched) card.appendChild(el("div", lateV.matched ? "banner info" : "banner warning", lateV.body));
      } else if (key === "partial") {
        var r2 = el("div", "kv");
        r2.appendChild(row2(v[key].received, G().fmtSC(p.receivedSc, p.asset)));
        if (partV.showRemaining) r2.appendChild(row2(v[key].remaining, G().fmtSC(Math.max(0, p.requestedSc - p.receivedSc), p.asset)));
        card.appendChild(r2);
        if (partV.showRemaining) card.appendChild(el("p", "", v[key].keepPaying));
        if (partV.showAddress) card.appendChild(copyBlock(p.address, p.asset, p.network));
        if (!partV.showRemaining) card.appendChild(el("p", "muted", partV.note));
      } else if (key === "review") {
        if (!heldV.showDeadline) {
          card.appendChild(el("p", "", heldV.payerBody));
          card.appendChild(el("p", "muted", v[key].whatNext));
          var r0 = el("div", "kv");
          r0.appendChild(row2("Reference", p.id));
          card.appendChild(r0);
        } else {
          var deadline = p.decisionDueBy ? fmtGST(p.decisionDueBy) : "—";
          card.appendChild(el("p", "", v[key].body.replace("{deadline}", deadline)));
          card.appendChild(el("p", "muted", v[key].whatNext));
          var r3 = el("div", "kv");
          r3.appendChild(row2("Reference", p.id));
          card.appendChild(r3);
        }
        if (p.checksDelayed) card.appendChild(el("div", "banner neutral", S().status.slowChecks));
      } else if (key === "action") {
        if (!heldV.showActions) {
          card.appendChild(el("p", "", heldV.payerBody));
          var r5 = el("div", "kv");
          r5.appendChild(row2("Reference", p.id));
          card.appendChild(r5);
        } else {
          card.appendChild(el("p", "", v[key].body));
          var banner = el("div", "banner warning");
          banner.appendChild(el("strong", "", v[key].request + ": " + (p.infoRequested || "Documents")));
          card.appendChild(banner);
          var up = el("button", "btn primary", v[key].uploadBtn);
          up.type = "button";
          up.addEventListener("click", function () {
            p.infoProvided = true;
            p.timeline.push({ ts: G().ts(), seat: "payer", text: "Information uploaded", internal: false });
            G().addToast("Information received (simulated)", "success");
            G().notify();
          });
          card.appendChild(up);
          if (p.infoProvided) card.appendChild(el("div", "badge success", "✓ " + v[key].uploadDone));
        }
      } else if (key === "overpaid") {
        if (overV.showSurplus) card.appendChild(el("p", "", v[key].surplus.replace("{amount}", G().fmtSC(p.surplus, p.asset))));
      } else if (key === "returned") {
        card.appendChild(el("p", "", v[key].body));
        var r4 = el("div", "kv");
        r4.appendChild(row2(v[key].returned, G().fmtSC(refundAmount(p), p.asset)));
        r4.appendChild(row2(v[key].fee, G().fmtSC(F().rules.refundNetworkFee, p.asset)));
        card.appendChild(r4);
      } else if (key === "frozen") {
        card.appendChild(el("p", "", v[key].body));
        card.appendChild(el("p", "muted", S().refund.frozenNeverRefunded));
      } else if (key === "expired") {
        card.appendChild(el("p", "", v[key].body));
      } else if (key === "needsManual") {
        card.appendChild(el("p", "", v[key].body));
        card.appendChild(el("div", "banner warning", "Sent on " + (p.receivedNetwork || "another network") + ", expected " + p.network + "."));
      }
    }
    app.appendChild(card);

    /* ---------- Refund flow ---------- */
    if (p.status === "declined") app.appendChild(refundCard(p, txs[0]));

    function row2(k, val) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v", val));
      return r;
    }
  }

  function refundAmount(p) {
    if (p.refundAmountSc != null) return Number(p.refundAmountSc);
    return Math.max(0, (Number(p.receivedSc) || 0) - F().rules.refundNetworkFee);
  }

  function refundCard(p, tx) {
    var r = S().refund;
    var v = S().status.variants.returned;
    var card = el("div", "card accent");
    card.dataset.anchor = "s2-refund";
    card.appendChild(el("h2", "card-title", r.heading));

    var kv = el("div", "kv");
    kv.appendChild(kvRow(v.returned, G().fmtSC(refundAmount(p), p.asset)));
    kv.appendChild(kvRow(v.fee, G().fmtSC(F().rules.refundNetworkFee, p.asset)));
    card.appendChild(kv);
    card.appendChild(el("p", "muted", r.amountNote.replace("{fee}", F().rules.refundNetworkFee.toFixed(2))));

    var fromExchange = tx ? tx.walletType === "exchange" : false;
    var refunded = p.refundAmountSc != null;

    if (refunded) {
      card.appendChild(el("p", "", v.sentTo.replace("{address}", p.refundAddress || p.address)));
      card.appendChild(el("p", "muted", r.screeningNote));
    } else if (fromExchange) {
      card.appendChild(el("p", "", r.exchangeExplanation));
      var err = el("div", "field-error");
      var input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.id = "refund-address";
      input.placeholder = r.addressPlaceholder;
      var label = el("label", "field-label", r.addressPrompt);
      label.htmlFor = input.id;
      var field = el("div", "field");
      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(err);
      card.appendChild(field);
      var btn = el("button", "btn primary", r.submit);
      btn.type = "button";
      btn.addEventListener("click", function () {
        var value = input.value.trim();
        err.textContent = value ? "" : r.addressRequired;
        input.classList.toggle("invalid", !value);
        if (!value) { input.focus(); return; }
        p.refundAddress = value;
        G().addToast(r.submitted, "success");
        G().notify();
      });
      card.appendChild(btn);
      card.appendChild(el("p", "muted", r.screeningNote));
    } else {
      card.appendChild(el("p", "", v.sentOwn));
      card.appendChild(el("p", "muted", r.ownWalletNote));
    }

    card.appendChild(el("p", "muted", r.frozenNeverRefunded));
    return card;
  }

  function kvRow(k, val) {
    var row = el("div", "kv-row");
    row.appendChild(el("dt", "kv-k", k));
    row.appendChild(el("dd", "kv-v", val));
    return row;
  }

  /* Partial payments keep the same address: copy it with the network named. */
  function copyBlock(addr, asset, network) {
    var w = el("div", "copy-field");
    var out = el("code", "copy-value");
    out.textContent = addr;
    var b = el("span", "chip tone-info", S().address.networkLabel[netKey(network)]);
    var btn = el("button", "btn small", S().address.copy);
    btn.type = "button";
    btn.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr);
      btn.textContent = S().address.copiedBtn;
      setTimeout(function () { btn.textContent = S().address.copy; }, 1500);
      G().addToast(S().address.copiedShort.replace("{asset}", asset).replace("{network}", S().address.networkName[netKey(network)]), "success");
    });
    w.appendChild(out);
    w.appendChild(b);
    w.appendChild(btn);
    return w;
  }

  window.GATE_ROUTER.register("payer/status", render, "payer-status");
})();
