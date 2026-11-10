/* Gate Prototype — demo bar (not product UI).
 * Seat switch, scenario picker, step controls, demo clock, view switches,
 * keyboard shortcuts, and the simulated Compliance decision panel (§4.2).
 *
 * Phase 3b: the Compliance seat is gone (payer and merchant only). A case
 * decision is demo tooling: a side panel opened from the bar whenever an
 * undecided case exists. It shows the case facts, requires an internal reason
 * and a note, previews exactly what each side will see, and applies the
 * decision to the current scenario (or, where the scenario has no matching
 * event, to the transaction model directly).
 */
(function () {
  "use strict";

  var stepRefs = { back: null, next: null };
  /* Collapse and hide state live outside the DOM: build() rebuilds the bar on
     every store notification, so a class on #demo-bar would not survive. */
  var _collapsed = false;
  var _hidden = false;
  var _autoCollapsed = false;
  /* Compliance panel state, same reason. */
  var _panelOpen = false;
  var _panelCaseId = null;
  var _panelAction = null;
  var _panelReason = "";
  var _panelNote = "";
  var _panelError = "";
  /* Annotations (phase 4): which note is open, and one listener set. */
  var _annOpen = null; // { screen, i }
  var _annListeners = false;

  function S() { return window.GATE_STRINGS; }
  function G() { return window.GATE_STORE; }
  function F() { return window.GATE_FIXTURES; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  /* ---- cases ---------------------------------------------------------- */

  var CLOSED_CASE_STATUSES = ["paid", "declined", "frozen", "cannot_be_released", "approved", "refunded"];

  /* A case is open until a decision is recorded for it. */
  function openCases() {
    return G().getCases().filter(function (c) {
      if (CLOSED_CASE_STATUSES.indexOf(c.externalStatus) !== -1) return false;
      return !(c.decisionLog && c.decisionLog.length);
    });
  }

  function hasCase(cases, id) {
    for (var i = 0; i < cases.length; i++) if (cases[i].id === id) return true;
    return false;
  }

  /* If the scenario on screen owns a case, that is the case the presenter
   * means — not the first seeded reference case. */
  function preferredCase(cases) {
    var st = G().get();
    var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
    if (!sc || !sc.paymentId) return null;
    for (var i = 0; i < cases.length; i++) {
      var tx = findTx(cases[i].txId);
      if (tx && tx.paymentId === sc.paymentId) return cases[i];
    }
    return null;
  }

  function findTx(txId) {
    var list = G().getTransactions(null);
    for (var i = 0; i < list.length; i++) if (list[i].id === txId) return list[i];
    return null;
  }

  function rateFor(p) {
    var f = F();
    return f.rates.AED_PER_USD * (p.asset === "USDC" ? f.rates.USDC_PER_USD : f.rates.USDT_PER_USD);
  }
  function feePctFor(p) { return p.merchantId === "M-002" ? F().fees.broker : F().fees.realEstate; }
  function grossAED(p, amountSc) { return round2((Number(amountSc) || 0) * rateFor(p)); }

  function sumAvailable(paymentId) {
    var n = 0;
    var list = G().get().ledger || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].paymentId === paymentId && list[i].type === "available") n += Number(list[i].amountAED) || 0;
    }
    return round2(n);
  }

  function dropLedger(paymentId, txId, type) {
    var st = G().get();
    st.ledger = (st.ledger || []).filter(function (l) {
      return !(l.paymentId === paymentId && l.txId === txId && l.type === type);
    });
  }

  function caseContext(c) {
    var tx = c ? findTx(c.txId) : null;
    var p = tx ? G().byId(tx.paymentId) : null;
    return { c: c, tx: tx, p: p };
  }

  function contextRow(label, value, cls) {
    var row = el("div", "kv-row");
    row.appendChild(el("span", "kv-k", label));
    row.appendChild(el("span", "kv-v" + (cls ? " " + cls : ""), value == null || value === "" ? "—" : value));
    return row;
  }

  function caseSummary(host, ctx) {
    var P = S().compliancePanel;
    var card = el("div", "cp-case");
    card.appendChild(el("h3", "cp-section-title", P.caseSummary));
    var kv = el("div", "kv");

    kv.appendChild(contextRow(P.amount, G().fmtAED(grossAED(ctx.p, ctx.tx.amountSc)) + " · " + G().fmtSC(ctx.tx.amountSc, ctx.p.asset)));

    var payer = F().payers.filter(function (x) { return x.id === ctx.p.payerId; })[0];
    kv.appendChild(contextRow(P.payer, ctx.p.payerName || (payer ? payer.name : "—")));
    kv.appendChild(contextRow(P.country, ctx.p.payerCountry || (payer ? payer.country : "—")));

    var buyerAnswer = ctx.p.buyerAnswer;
    var relationship = ctx.p.payerRelationship;
    /* E2's documented trigger is "No — paying for the buyer (parent)". The
     * checkout stores that answer when its form renders; starting E2 straight
     * on S2 never visits it, so the case summary states the scripted answer. */
    if (!buyerAnswer && G().get().scenarioId === "E2") {
      buyerAnswer = "no";
      relationship = relationship || "parent";
    }

    var buyer;
    if (buyerAnswer === "yes") buyer = P.buyerYes;
    else if (buyerAnswer === "no") buyer = P.buyerNo;
    else buyer = P.notCollected;
    kv.appendChild(contextRow(P.buyerAnswer, buyer));
    if (buyerAnswer === "no" && relationship) {
      kv.appendChild(contextRow(P.relationshipLabel, S().travelRule.relationships[relationship] || relationship));
    }

    var wallet = S().transactions.wallet[ctx.tx.walletType] || ctx.tx.walletType || "—";
    kv.appendChild(contextRow(P.walletType, wallet));

    /* Illustrative: a held transaction has one check still open at most. */
    var clear = ctx.tx.walletType === "exchange" ? "2" : "3";
    kv.appendChild(contextRow(P.screening, P.screeningLine.replace("{clear}", clear)));

    kv.appendChild(contextRow(P.walletHistory, P.walletHistoryLine.replace("{date}", fmtDate(ctx.p.priorCleared || "2026-09-28"))));

    card.appendChild(kv);
    host.appendChild(card);
  }

  /* ---- panel ---------------------------------------------------------- */

  function renderPanel(host, cases) {
    var P = S().compliancePanel;
    host.innerHTML = "";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "false");
    host.setAttribute("aria-label", P.title);

    var head = el("div", "cp-head");
    head.appendChild(el("span", "cp-badge", "DEMO"));
    head.appendChild(el("h2", "cp-title", P.title));
    var close = el("button", "cp-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", P.close);
    close.addEventListener("click", closePanel);
    head.appendChild(close);
    host.appendChild(head);

    if (cases.length > 1) {
      var pick = el("div", "cp-case-pick");
      var lab = el("label", "cp-field-label", P.caseSelect);
      lab.htmlFor = "cp-case-select";
      pick.appendChild(lab);
      var sel = document.createElement("select");
      sel.className = "select small";
      sel.id = "cp-case-select";
      cases.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.id + " · " + c.txId;
        if (c.id === _panelCaseId) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        _panelCaseId = sel.value;
        _panelAction = null;
        _panelError = "";
        build();
      });
      pick.appendChild(sel);
      host.appendChild(pick);
    }

    var ctx = caseContext(G().getCase(_panelCaseId));
    if (!ctx.tx || !ctx.p) {
      host.appendChild(el("p", "muted", P.noCases));
      host.appendChild(el("div", "cp-foot", P.footer));
      return;
    }

    caseSummary(host, ctx);

    /* Actions */
    var actionsWrap = el("div", "cp-actions-wrap");
    actionsWrap.appendChild(el("h3", "cp-section-title", P.chooseAction));
    var actions = el("div", "cp-actions");
    [["approve", P.actions.approve], ["request", P.actions.request], ["decline", P.actions.decline], ["freeze", P.actions.freeze]].forEach(function (pair) {
      var b = el("button", "cp-action" + (_panelAction === pair[0] ? " active" : ""), pair[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", _panelAction === pair[0] ? "true" : "false");
      b.addEventListener("click", function () {
        _panelAction = pair[0];
        _panelError = "";
        build();
      });
      actions.appendChild(b);
    });
    actionsWrap.appendChild(actions);
    host.appendChild(actionsWrap);

    if (_panelAction) {
      host.appendChild(reasonForm());
      host.appendChild(previewBox(ctx));
    } else {
      var hint = el("div", "preview cp-preview");
      hint.appendChild(el("div", "preview-title", P.preview));
      hint.appendChild(el("div", "preview-box", P.previewEmpty));
      host.appendChild(hint);
    }

    if (_panelError) host.appendChild(el("div", "cp-error", _panelError));

    var confirm = el("button", "btn primary cp-confirm", P.confirm);
    confirm.type = "button";
    confirm.disabled = !_panelAction;
    confirm.addEventListener("click", confirmDecision);
    host.appendChild(confirm);

    host.appendChild(el("div", "cp-foot", P.footer));
  }

  function reasonForm() {
    var P = S().compliancePanel;
    var form = el("div", "cp-form");

    var reasonField = el("div", "field cp-field");
    var rl = el("label", "cp-field-label", P.internalReason);
    rl.htmlFor = "cp-reason";
    reasonField.appendChild(rl);
    var sel = document.createElement("select");
    sel.className = "select";
    sel.id = "cp-reason";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "—";
    sel.appendChild(ph);
    P.reasons.forEach(function (r) {
      var o = document.createElement("option");
      o.value = r;
      o.textContent = r;
      if (r === _panelReason) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { _panelReason = sel.value; });
    reasonField.appendChild(sel);
    form.appendChild(reasonField);

    var noteField = el("div", "field cp-field");
    var nl = el("label", "cp-field-label", P.note);
    nl.htmlFor = "cp-note";
    noteField.appendChild(nl);
    var note = document.createElement("textarea");
    note.className = "textarea";
    note.id = "cp-note";
    note.rows = 2;
    note.placeholder = P.notePlaceholder;
    note.value = _panelNote;
    note.addEventListener("input", function () { _panelNote = note.value; });
    noteField.appendChild(note);
    form.appendChild(noteField);

    return form;
  }

  function previewBox(ctx) {
    var P = S().compliancePanel;
    var o = P.outcomes[_panelAction];
    var wrap = el("div", "preview cp-preview");
    wrap.appendChild(el("div", "preview-title", P.preview));

    var payerText = o.payer;
    if (_panelAction === "decline" && ctx.tx.walletType === "exchange" && o.payerExchange) payerText = o.payerExchange;

    wrap.appendChild(previewLine(P.payerPreview, payerText));
    wrap.appendChild(previewLine(P.merchantPreview, o.merchant));
    wrap.appendChild(previewLine(P.eventPreview, o.event));
    wrap.appendChild(el("div", "cp-never", P.reasonNeverShared));
    return wrap;
  }

  function previewLine(label, text) {
    var box = el("div", "preview-box");
    box.appendChild(el("div", "preview-label", label));
    box.appendChild(el("div", "preview-text", text));
    return box;
  }

  function syncPanel() {
    var host = document.getElementById("cp-panel");
    if (!_panelOpen) {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    var cases = openCases();
    if (!cases.length) {
      _panelOpen = false;
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    if (!_panelCaseId || !hasCase(cases, _panelCaseId)) {
      var pref = preferredCase(cases);
      _panelCaseId = pref ? pref.id : cases[0].id;
      _panelAction = null;
    }
    if (!host) {
      host = el("aside", "cp-panel");
      host.id = "cp-panel";
      document.body.appendChild(host);
    }
    renderPanel(host, cases);
  }

  function togglePanel() {
    var cases = openCases();
    if (!cases.length) return;
    _panelOpen = !_panelOpen;
    if (_panelOpen) {
      var pref = preferredCase(cases);
      _panelCaseId = pref ? pref.id : cases[0].id;
    } else {
      _panelAction = null;
    }
    _panelError = "";
    build();
  }

  function closePanel() {
    _panelOpen = false;
    _panelAction = null;
    _panelError = "";
    build();
  }

  function confirmDecision() {
    var P = S().compliancePanel;
    if (!_panelAction) return;
    if (!_panelReason) { _panelError = P.reasonRequired; build(); return; }
    if (!_panelNote.replace(/\s/g, "")) { _panelError = P.noteRequired; build(); return; }

    var c = G().getCase(_panelCaseId);
    if (!c) { _panelError = P.noCases; build(); return; }

    var action = _panelAction;
    runDecision(c, action, _panelReason, _panelNote.trim());

    _panelOpen = false;
    _panelAction = null;
    _panelReason = "";
    _panelNote = "";
    _panelError = "";
    G().addToast(P.done.replace("{action}", P.actions[action]), "success");
  }

  /* Apply a decision. Preferred path: step the active scenario to its own
   * decision event, so the tested ops (credit, refund, freeze, events) run
   * unchanged. Fallback: the scenario has no matching event (E7's overdue
   * case, or a seeded case at boot) — apply it to the transaction model. */
  function runDecision(c, action, reason, note) {
    var st = G().get();
    var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
    var ctx = caseContext(c);

    var idx = sc ? decisionIndex(sc, st.step, action) : -1;
    if (idx >= 0 && ctx.tx && ctx.p) {
      if (action === "decline") idx = extendRefund(sc, idx);
      while (G().get().step <= idx) window.GATE_DEMO.step(1);

      var c2 = G().getCase(c.id);
      if (c2) {
        if (action === "request") {
          /* requestInfo does not write a decision log entry. */
          G().decideCase(c2.id, "request", reason, note);
        } else if (c2.decisionLog && c2.decisionLog.length) {
          /* Keep the scenario's external outcome, replace its scripted
             internal reason and note with the analyst's. */
          var last = c2.decisionLog[c2.decisionLog.length - 1];
          last.action = action;
          last.internalReason = reason;
          last.note = note;
        }
      }
      return;
    }

    fallbackDecision(ctx, action, reason, note);
  }

  function decisionIndex(sc, from, action) {
    var types = { approve: ["approve"], request: ["requestInfo"], decline: ["decline"], freeze: ["freeze"] }[action] || [];
    for (var i = from; i < sc.events.length; i++) {
      if (types.indexOf(sc.events[i].type) !== -1) return i;
    }
    return -1;
  }

  /* A decline is followed by its refund event in the same scenario; include
   * it so the payer ends on "Returned" rather than mid-flow. */
  function extendRefund(sc, idx) {
    for (var j = idx + 1; j < sc.events.length; j++) {
      var ev = sc.events[j];
      var hasRefund = (ev.ops || []).some(function (o) { return o.op === "refund"; });
      if (hasRefund) return j;
      if (ev.type === "note" || ev.type === "advance" || ev.type === "advanceClock") continue;
      break;
    }
    return idx;
  }

  /* Direct application for cases the active scenario does not script. */
  function fallbackDecision(ctx, action, reason, note) {
    var p = ctx.p;
    var tx = ctx.tx;
    var st = G().get();
    var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
    /* Force only when there is no scenario event left to consume. */
    var forced = !st.scenarioId || !sc || st.step >= sc.events.length;

    G().decideCase(ctx.c.id, action, reason, note);

    if (action === "request") {
      G().addEvent(p.id, "payment.information_requested", { received: G().fmtSC(tx.amountSc, p.asset) }, "information_requested");
      G().setPaymentStatus(p.id, "action", {
        info: "Additional information requested by Compliance (simulated).",
        internal: reason, note: note
      }, forced);
      return;
    }

    if (action === "approve") {
      dropLedger(p.id, tx.id, "in_review");
      G().setTxStatus(tx.id, "cleared");
      creditTx(p, tx);
      G().addEvent(p.id, "payment.credited", {
        received: G().fmtSC(tx.amountSc, p.asset),
        credited: G().fmtAED(p.creditedAED || 0)
      }, "paid");
      return;
    }

    if (action === "decline") {
      var refundSc = round2(Number(tx.amountSc) - F().rules.refundNetworkFee);
      dropLedger(p.id, tx.id, "in_review");
      G().setTxStatus(tx.id, "refunded");
      G().addLedgerEntry(p.id, tx.id, "refund", grossAED(p, refundSc));
      G().addEvent(p.id, "payment.refunded", {
        received: G().fmtSC(tx.amountSc, p.asset),
        refunded: G().fmtSC(refundSc, p.asset),
        network_fee: G().fmtSC(F().rules.refundNetworkFee, p.asset)
      }, "refunded");
      G().setPaymentStatus(p.id, "declined", {
        text: "Declined and refunded by Compliance (simulated).",
        internal: reason, note: note, refundAddressRequired: false
      }, forced);
      return;
    }

    if (action === "freeze") {
      dropLedger(p.id, tx.id, "in_review");
      G().setPaymentStatus(p.id, "frozen", {
        text: "Frozen by Compliance (simulated).",
        internal: reason, note: note
      }, forced);
      G().setTxStatus(tx.id, "frozen");
      G().addLedgerEntry(p.id, tx.id, "frozen", grossAED(p, tx.amountSc));
      G().addEvent(p.id, "payment.cannot_be_released", { received: G().fmtSC(tx.amountSc, p.asset) }, "cannot_be_released");
    }
  }

  /* Mirror of the store's per-transaction credit (fee + available, capped at
   * the credit value of the amount due). */
  function creditTx(p, tx) {
    var gross = grossAED(p, tx.amountSc);
    var fp = feePctFor(p);
    var cap = round2(p.requestedFiatAED * (1 - fp));
    var already = sumAvailable(p.id);
    var fee = round2(gross * fp);
    var net = round2(gross - fee);
    if (already >= cap - 0.005) { fee = 0; net = 0; }
    else if (already + net > cap + 0.005) { net = round2(cap - already); fee = round2(p.requestedFiatAED * fp); }
    if (fee > 0) G().addLedgerEntry(p.id, tx.id, "fee", fee);
    if (net > 0) G().addLedgerEntry(p.id, tx.id, "available", net);
    return net;
  }

  /* ---- annotations (phase 4, followup §4.4) ---------------------------- */

  function currentScreen() {
    var h = window.location.hash || "";
    if (/^#\/payer\/checkout/.test(h)) return "payer-checkout";
    if (/^#\/payer\/status/.test(h)) return "payer-status";
    if (/^#\/merchant\/payments\/[^/?]+/.test(h)) return "merchant-payment-detail";
    if (/^#\/merchant\/payments/.test(h)) return "merchant-payments";
    return null;
  }

  /* Numbered pins anchored to the current screen. At most four per screen;
   * notes live in strings.js. Pins are fixed-position and re-laid on scroll,
   * resize and hash change, so they follow the element they point at. */
  function renderAnnotations() {
    var st = G().get();
    var layer = document.getElementById("annotation-layer");
    if (!st || !st.annotations) {
      if (layer) layer.innerHTML = "";
      return;
    }
    if (!layer) {
      layer = el("div", "annotation-layer");
      layer.id = "annotation-layer";
      document.body.appendChild(layer);
    }
    layer.innerHTML = "";
    var key = currentScreen();
    var defs = (S().annotations.screens[key] || []).slice(0, 4);
    var openIdx = (_annOpen && _annOpen.screen === key) ? _annOpen.i : -1;
    var placed = 0;

    defs.forEach(function (def, i) {
      var target = document.querySelector(def.anchor);
      if (!target) return;
      var r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      var num = placed + 1;
      var pin = el("button", "annotation-pin", String(num));
      pin.type = "button";
      pin.setAttribute("aria-label", S().annotations.label.replace("{n}", String(num)));
      pin.setAttribute("aria-expanded", openIdx === i ? "true" : "false");
      pin.style.left = Math.max(4, r.left - 12) + "px";
      pin.style.top = Math.max(4, r.top + 8) + "px";
      pin.addEventListener("click", function () {
        _annOpen = (openIdx === i) ? null : { screen: key, i: i };
        renderAnnotations();
      });
      layer.appendChild(pin);

      if (openIdx === i) {
        var note = el("div", "annotation-note");
        note.appendChild(el("div", "annotation-note-title", S().annotations.title + " " + num));
        note.appendChild(el("div", "annotation-note-text", def.text));
        var close = el("button", "annotation-close", "×");
        close.type = "button";
        close.setAttribute("aria-label", S().annotations.close);
        close.addEventListener("click", function () { _annOpen = null; renderAnnotations(); });
        note.appendChild(close);
        var w = Math.min(288, window.innerWidth - 32);
        note.style.width = w + "px";
        note.style.left = Math.max(8, Math.min(r.left + 24, window.innerWidth - w - 8)) + "px";
        note.style.top = Math.max(8, Math.min(r.top + 36, window.innerHeight - 170)) + "px";
        layer.appendChild(note);
      }
      placed++;
    });
  }

  function annotationListeners() {
    if (_annListeners) return;
    _annListeners = true;
    window.addEventListener("resize", renderAnnotations);
    window.addEventListener("scroll", renderAnnotations, true);
    window.addEventListener("hashchange", renderAnnotations);
  }

  /* ---- demo bar ------------------------------------------------------- */

  function build() {
    var bar = document.getElementById("demo-bar");
    if (!bar) return;
    /* On a phone the full bar would eat the screen: start collapsed once. */
    if (!_autoCollapsed) {
      _autoCollapsed = true;
      if (window.innerWidth <= 700) _collapsed = true;
    }
    annotationListeners();
    var st = G().get();
    var d = S().demoBar;

    document.body.classList.toggle("view-proposed", st.viewMode === "proposed");
    document.body.classList.toggle("annotations-on", !!st.annotations);

    bar.innerHTML = "";
    bar.classList.toggle("collapsed", _collapsed);
    bar.classList.toggle("db-hidden", _hidden);

    if (_hidden) {
      var handle = el("button", "db-handle", "▴ " + d.collapsed);
      handle.type = "button";
      handle.setAttribute("aria-label", d.show);
      handle.addEventListener("click", function () { _hidden = false; build(); });
      bar.appendChild(handle);
      syncPanel();
      renderAnnotations();
      return;
    }

    var head = el("div", "db-head");
    var title = el("button", "db-toggle", (_collapsed ? "▸ " : "▾ ") + d.collapsed);
    title.type = "button";
    title.setAttribute("aria-expanded", _collapsed ? "false" : "true");
    title.addEventListener("click", function () {
      _collapsed = !_collapsed;
      build();
    });
    head.appendChild(title);

    var mapBtn = el("button", "db-map", d.map);
    mapBtn.type = "button";
    mapBtn.addEventListener("click", function () { window.GATE_ROUTER.navigate("#/"); });
    head.appendChild(mapBtn);

    if (openCases().length) {
      var comp = el("button", "db-compliance" + (_panelOpen ? " active" : ""), S().compliancePanel.title);
      comp.type = "button";
      comp.setAttribute("aria-haspopup", "dialog");
      comp.setAttribute("aria-expanded", _panelOpen ? "true" : "false");
      comp.addEventListener("click", togglePanel);
      head.appendChild(comp);
    }

    var seatWrap = el("div", "db-seats");
    ["payer", "merchant"].forEach(function (seat) {
      var b = el("button", "db-seat" + (st.seat === seat ? " active" : ""), S().seats[seat]);
      b.dataset.seat = seat;
      b.addEventListener("click", function () { switchSeat(seat); });
      seatWrap.appendChild(b);
    });
    head.appendChild(seatWrap);

    var hide = el("button", "db-hide", "×");
    hide.type = "button";
    hide.setAttribute("aria-label", d.hide);
    hide.addEventListener("click", function () { _hidden = true; _panelOpen = false; build(); });
    head.appendChild(hide);
    bar.appendChild(head);

    var body = el("div", "db-body");

    /* View switch + annotations (phase 4 wires the behaviour). */
    var viewRow = el("div", "db-row db-view");
    viewRow.appendChild(el("span", "db-label", d.viewLabel));
    var mode = st.viewMode === "proposed" ? "proposed" : "today";
    var seg = el("div", "db-seg");
    [["today", d.today], ["proposed", d.proposed]].forEach(function (pair) {
      var b = el("button", "db-seg-btn" + (mode === pair[0] ? " active" : ""), pair[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", mode === pair[0] ? "true" : "false");
      b.addEventListener("click", function () { setView(pair[0]); });
      seg.appendChild(b);
    });
    viewRow.appendChild(seg);
    var ann = el("button", "db-btn" + (st.annotations ? " active" : ""), d.annotations);
    ann.type = "button";
    ann.setAttribute("aria-pressed", st.annotations ? "true" : "false");
    ann.addEventListener("click", toggleAnnotations);
    viewRow.appendChild(ann);
    body.appendChild(viewRow);

    /* Scenario picker */
    var scRow = el("div", "db-row");
    var scLabel = el("label", "db-label", d.scenario);
    scLabel.htmlFor = "demo-scenario";
    scRow.appendChild(scLabel);
    var sel = document.createElement("select");
    sel.className = "db-select";
    sel.id = "demo-scenario";
    window.GATE_SCENARIOS.list.forEach(function (sc) {
      var o = document.createElement("option");
      o.value = sc.id;
      o.textContent = "[" + sc.priority + "] " + sc.id + " — " + sc.name;
      if (st.scenarioId === sc.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { loadScenario(sel.value, 0); });
    scRow.appendChild(sel);
    body.appendChild(scRow);

    /* Step controls */
    var stepRow = el("div", "db-row db-steps");
    var stepLabel = el("span", "db-stepnum");
    updateStepLabel(stepLabel);
    stepRow.appendChild(stepLabel);
    var back = el("button", "db-btn", d.back);
    back.addEventListener("click", function () { step(-1); });
    var next = el("button", "db-btn primary", d.next);
    next.addEventListener("click", function () { step(1); });
    stepRefs.back = back;
    stepRefs.next = next;
    var reset = el("button", "db-btn", d.reset);
    reset.addEventListener("click", resetScenario);
    stepRow.appendChild(back);
    stepRow.appendChild(next);
    stepRow.appendChild(reset);
    body.appendChild(stepRow);
    syncStepControls();

    /* Demo clock */
    var clockRow = el("div", "db-row");
    var st2 = G().get();
    clockRow.appendChild(el("span", "db-label", d.clock + ": " + G().fmtClock(st2.clock)));
    var h1 = el("button", "db-btn", d.advanceHour);
    h1.addEventListener("click", function () { G().advanceClock(1, "hours"); G().notify(); refreshClock(clockRow); });
    var d1 = el("button", "db-btn", d.advanceDay);
    d1.addEventListener("click", function () { G().advanceClock(1, "days"); G().notify(); refreshClock(clockRow); });
    clockRow.appendChild(h1);
    clockRow.appendChild(d1);
    body.appendChild(clockRow);

    /* Volume + split */
    var optRow = el("div", "db-row");
    optRow.appendChild(el("label", "db-label", d.listVolume));
    ["0", "1", "200"].forEach(function (v) {
      var b = el("button", "db-btn" + (String(st.volume) === v ? " active" : ""), v === "0" ? d.vol0 : v === "1" ? d.vol1 : d.vol200);
      b.addEventListener("click", function () {
        st.volume = parseInt(v, 10);
        G().notify();
      });
      optRow.appendChild(b);
    });
    var splitB = el("button", "db-btn" + (st.split ? " active" : ""), d.splitView);
    splitB.addEventListener("click", function () {
      st.split = !st.split;
      document.body.classList.toggle("split-on", st.split);
      G().notify();
    });
    optRow.appendChild(splitB);
    body.appendChild(optRow);

    body.appendChild(el("div", "db-keys", d.keys));
    bar.appendChild(body);

    syncPanel();
    renderAnnotations();
  }

  function refreshClock(row) {
    var label = row.querySelector(".db-label");
    if (label) label.textContent = S().demoBar.clock + ": " + G().fmtClock(G().get().clock);
  }

  function updateStepLabel(span) {
    var st = G().get();
    if (!st.scenarioId) { span.textContent = ""; return; }
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
    var total = sc.events.length;
    /* st.step is the number of replayed events; the label is 1-based and never
       runs past the total, so terminal reads "Step 4 / 4", not "Step 5 / 4". */
    var current = Math.min(st.step + 1, total);
    span.textContent = "Step " + current + " / " + total + " — " + sc.name;
  }

  /* Disable Back at the first step and Next at the last one (no dead clicks). */
  function syncStepControls() {
    var st = G().get();
    var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
    var total = sc ? sc.events.length : 0;
    if (stepRefs.back) stepRefs.back.disabled = !sc || st.step <= 0;
    if (stepRefs.next) stepRefs.next.disabled = !sc || st.step >= total;
  }

  function switchSeat(seat) {
    var st = G().get();
    st.seat = seat;
    var home = { payer: "#/payer/checkout", merchant: "#/merchant/payments" }[seat];
    window.GATE_ROUTER.navigate(home);
    G().notify();
  }

  function setView(mode) {
    /* The store owns the switch: setting it re-renders the bar and the screen
     * through the normal subscription, and touches no scenario state. */
    G().setView(mode);
  }

  function toggleAnnotations() {
    var st = G().get();
    st.annotations = !st.annotations;
    if (!st.annotations) _annOpen = null;
    document.body.classList.toggle("annotations-on", st.annotations);
    build();
    renderAnnotations();
  }

  function loadScenario(id, startStep) {
    var sc = window.GATE_SCENARIOS.byId(id);
    if (!sc) return;
    /* reset() reinitializes `state`, so capture the fresh object AFTER it. */
    G().reset();
    var st = G().get();
    st.scenarioId = id;
    st.step = 0;
    if (startStep > 0) {
      for (var i = 0; i < startStep; i++) applyEvent(sc.events[i]);
      st.step = startStep;
    }
    G().notify();
  }

  function resetScenario() {
    var st = G().get();
    var id = st.scenarioId || window.GATE_SCENARIOS.list[0].id;
    G().reset();
    loadScenario(id, 0);
  }

  function step(dir) {
    var st = G().get();
    if (!st.scenarioId) return;
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
    var next = st.step + dir;
    if (next < 0) next = 0;
    if (next > sc.events.length) next = sc.events.length;
    if (next === st.step) { syncStepControls(); return; }
    /* Rewind: reset reinitializes state; re-assert identity on the fresh object. */
    if (dir < 0) {
      G().reset();
      var fresh = G().get();
      fresh.scenarioId = sc.id;
      fresh.step = 0;
      for (var i = 0; i < next; i++) applyEvent(sc.events[i]);
      fresh.step = next;
    } else {
      while (st.step < next) {
        applyEvent(sc.events[st.step]);
        st.step++;
      }
    }
    syncStepControls();
    G().notify();
  }

  function applyEvent(ev) {
    var st = G().get();
    var P = G();
    switch (ev.type) {
      case "note":
        break;
      case "send": {
        var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
        var p = P.byId(sc.paymentId);
        if (p && p.receivedSc == null) p.receivedSc = 0;
        P.setPaymentStatus(sc.paymentId, ev.status, { sc: ev.sc, wrongNetwork: ev.wrongNetwork, late: ev.late }, true);
        break;
      }
      case "advance":
      case "flag":
      case "requestInfo":
      case "approve":
      case "decline":
      case "freeze": {
        var sc2 = window.GATE_SCENARIOS.byId(st.scenarioId);
        var extra = {};
        if (ev.category) extra.category = ev.category;
        if (ev.deadlineHours != null) extra.deadlineHours = ev.deadlineHours;
        if (ev.internal) extra.internal = ev.internal;
        if (ev.note != null) extra.note = ev.note;
        if (ev.info) extra.info = ev.info;
        if (ev.infoProvided) extra.infoProvided = true;
        if (ev.text) extra.text = ev.text;
        P.setPaymentStatus(sc2.paymentId, ev.status, extra, true);
        break;
      }
      case "advanceClock": {
        if (ev.minutes != null) P.advanceClock(ev.minutes, "minutes");
        if (ev.hours != null) P.advanceClock(ev.hours, "hours");
        if (ev.days != null) P.advanceClock(ev.days, "days");
        if (ev.status) {
          var sc3 = window.GATE_SCENARIOS.byId(st.scenarioId);
          var extra2 = {};
          if (ev.text) extra2.text = ev.text;
          P.setPaymentStatus(sc3.paymentId, ev.status, extra2, true);
        } else {
          P.notify();
        }
        break;
      }
      case "volume":
        st.volume = ev.value;
        break;
    }
  }

  /* Keyboard: 1/2 seat, → next, R reset, T view, N notes, H hide, C panel. */
  function keys() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (_panelOpen) { closePanel(); e.preventDefault(); }
        else if (_annOpen) { _annOpen = null; renderAnnotations(); e.preventDefault(); }
        return;
      }
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      var k = String(e.key);
      var lower = k.toLowerCase();
      if (k === "1") switchSeat("payer");
      else if (k === "2") switchSeat("merchant");
      else if (k === "ArrowRight") { e.preventDefault(); step(1); }
      else if (lower === "r") resetScenario();
      else if (lower === "t") setView(G().get().viewMode === "proposed" ? "today" : "proposed");
      else if (lower === "n") toggleAnnotations();
      else if (lower === "h") { _hidden = !_hidden; if (_hidden) _panelOpen = false; build(); }
      else if (lower === "c") togglePanel();
    });
  }

  /* Re-render demo bar + screens on store changes. */
  function observe() {
    G().subscribe(function () {
      build();
      window.GATE_ROUTER.render();
      renderAnnotations();
    });
  }

  window.GATE_DEMO = {
    build: build,
    switchSeat: switchSeat,
    loadScenario: loadScenario,
    step: step,
    applyEvent: applyEvent,
    keys: keys,
    observe: observe,
    openCases: openCases
  };
})();
