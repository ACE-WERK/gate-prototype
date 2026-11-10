/* Gate Prototype — shared state, demo clock, reset.
 * All three seats read and write this one object (R3).
 * Time is simulated; the presenter advances the demo clock (R3). */
(function () {
  "use strict";

  var F, S;
  function fx() { F = window.GATE_FIXTURES; S = window.GATE_STATUSES; }

  /* Base demo clock: a fixed "now" so deadlines render deterministically. */
  var BASE_NOW = new Date(2026, 10, 10, 18, 0, 0); // Tue 10 Nov 2026 18:00 (local display)

  function deepClonePayments() {
    fx();
    return F.payments.map(function (p) {
      var c = JSON.parse(JSON.stringify(p));
      /* Derived runtime fields */
      c.requestedSc = F.math.stablecoinAmount(c.requestedFiatAED, c.asset);
      c.receivedSc = 0;
      c.creditedAED = 0;
      c.feeAED = F.math.fee(c.requestedFiatAED, c.merchantId === "M-002" ? "broker" : "realEstate");
      c.address = c.network.indexOf("TRC-20") === 0 ? F.addresses.tron : F.addresses.eth;
      c.timeline = [];   // {ts, seat, text, internal}
      c.flaggedAt = null;
      c.decisionDueBy = null;
      c.reasonCategory = null;
      c.internalReason = null;
      c.note = null;
      c.infoRequested = null;
      c.infoProvided = false;
      c.shortfall = 0;
      c.surplus = 0;
      c.lateMatched = false;
      c.expiredAt = null;
      c.poolReleased = false;
      c.receivedNetwork = null;
      c.txHash = "0x" + ("DEMO".charCodeAt(0).toString(16)).repeat(8) + "0000000000000000";
      return c;
    });
  }

  var state = null;

  function init() {
    fx();
    state = {
      seat: "payer",
      scenarioId: null,
      step: 0,
      clock: new Date(BASE_NOW.getTime()),
      volume: 1,          // merchant list volume: 0 | 1 | 200
      split: false,
      payments: deepClonePayments(),
      toasts: [],
      dialogs: []
    };
    /* Seed a little history so the merchant list is never empty by default. */
    seedHistory();
    return state;
  }

  function seedHistory() {
    /* Two prior cleared instalments for wallet-history context (S5). */
    var p1 = byId("P-1001");
    if (p1) {
      p1.priorCleared = "2026-09-28"; // previous instalment cleared
    }
    /* P-1002 & P-1003 & P-1004 & P-1005 remain pending (open checkouts). */
  }

  var listeners = [];
  function subscribe(fn) { listeners.push(fn); }
  function notify() {
    var url = currentHash();
    for (var i = 0; i < listeners.length; i++) listeners[i](state, url);
  }

  function currentHash() {
    return window.location.hash || "#/payer/checkout";
  }

  function byId(id) {
    for (var i = 0; i < state.payments.length; i++) if (state.payments[i].id === id) return state.payments[i];
    return null;
  }

  function ts() { return new Date(state.clock.getTime()).toISOString(); }

  function advanceClock(amount, unit) {
    var ms = amount * (unit === "hours" ? 3600000 : unit === "minutes" ? 60000 : 86400000);
    state.clock = new Date(state.clock.getTime() + ms);
  }

  function fmtClock(d) {
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getUTCDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] +
      " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  }

  /* Money formatters: thousands separators, tabular-nums in CSS. */
  function grp(n) {
    var parts = String(n).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  function fmtAED(n) { return "AED " + grp((Number(n) || 0).toFixed(2)); }
  function fmtSC(n, asset) { return grp((Number(n) || 0).toFixed(2)) + (asset ? " " + asset : ""); }

  function G() { return window.GATE_STORE; }
  function money(n, asset) { return asset ? fmtSC(n, asset) : fmtAED(n); }

  /* --- payment mutations --- */
  function setPaymentStatus(id, status, extra, force) {
    fx();
    var p = byId(id);
    if (!p) return;
    var from = p.status;
    if (from !== status && !S.canTransition(from, status)) {
      if (!force) {
        /* User action: reject, leaving the status untouched. */
        if (typeof console !== "undefined") console.warn("transition", from, "->", status, "rejected");
        return;
      }
      /* Scenario stepping replays fixture events: allow, but warn for QA. */
      if (typeof console !== "undefined") console.warn("transition", from, "->", status, "not in config");
    }
    p.status = status;
    var entry = { ts: ts(), seat: "system", text: S.label(status, "compliance"), internal: true };
    var extEntry = { ts: ts(), seat: "system", text: S.label(status, "merchant"), internal: false };
    /* Scenario events may carry an explanation (e.g. E6's tolerance note).
       It belongs on the internal entry only: the external entry always uses
       the merchant-safe label so nothing internal can leak to the merchant. */
    if (extra && extra.text) entry.text = extra.text;
    p.timeline.push(entry);
    p.timeline.push(extEntry);
    if (status === "expired" && !p.expiredAt) p.expiredAt = ts();
    if (extra) {
      if (extra.sc != null) p.receivedSc = F.math.round2((p.receivedSc || 0) + extra.sc);
      if (extra.category) { p.reasonCategory = extra.category; p.flaggedAt = ts(); }
      if (extra.deadlineHours != null) p.decisionDueBy = new Date(state.clock.getTime() + extra.deadlineHours * 3600000).toISOString();
      if (extra.internal) p.internalReason = extra.internal;
      if (extra.note != null) p.note = extra.note;
      if (extra.info) p.infoRequested = extra.info;
      if (extra.infoProvided) p.infoProvided = true;
      if (extra.wrongNetwork) p.receivedNetwork = extra.wrongNetwork;
      if (extra.late) p.lateMatched = true;
    }
    if (status === "expired") p.poolReleased = true;
    if (status === "paid" && p.lateMatched) p.poolReleased = true;
    if (status === "paid" || status === "overpaid") {
      var seg = p.merchantId === "M-002" ? "broker" : "realEstate";
      var tol = F.math.withinTolerance(p.requestedSc, p.receivedSc);
      p.shortfall = tol.shortfall;
      p.surplus = F.math.round2(p.receivedSc - p.requestedSc);
      if (p.surplus < 0) p.surplus = 0;
      /* Exact or in-tolerance payment: credit = fiat request - fee (no round-trip
         conversion loss). Underpaid (partial topped up to full): same. */
      var fullPaid = p.receivedSc >= p.requestedSc - tol.shortfall && p.receivedSc >= p.requestedSc - 0.009;
      if (fullPaid) {
        p.creditedAED = F.math.credited(p.requestedFiatAED, seg);
      } else {
        var fiatReceived = F.math.round2(p.receivedSc * F.rates.AED_PER_USD * (p.asset === "USDC" ? F.rates.USDC_PER_USD : F.rates.USDT_PER_USD));
        p.creditedAED = F.math.round2(fiatReceived - p.feeAED);
      }
      p.timeline.push({ ts: ts(), seat: "merchant", text: "Credited " + fmtAED(p.creditedAED), internal: false });
    }
    if (status === "declined") {
      p.creditedAED = 0;
      p.timeline.push({ ts: ts(), seat: "system", text: "Refunded " + fmtSC(F.math.round2(p.receivedSc - F.rules.refundNetworkFee), p.asset) + " (fee " + F.rules.refundNetworkFee + ")", internal: false });
    }
    notify();
  }

  /* Monotonic toast id: Date.now() alone can repeat inside one millisecond and
     Math.random() would break the oldest-first ordering, so add a sequence. */
  var toastSeq = 0;
  function nextToastId() { toastSeq += 1; return Date.now() * 1000 + (toastSeq % 1000); }

  function addToast(text, tone) {
    var id = nextToastId();
    state.toasts.push({ id: id, text: text, tone: tone || "info", at: ts() });
    /* Cap the stack at three: drop the oldest by id, never by text match. */
    while (state.toasts.length > 3) {
      var oldest = 0;
      for (var i = 1; i < state.toasts.length; i++) {
        if (state.toasts[i].id < state.toasts[oldest].id) oldest = i;
      }
      state.toasts.splice(oldest, 1);
    }
    notify();
    setTimeout(function () {
      state.toasts = state.toasts.filter(function (t) { return t.id !== id; });
      notify();
    }, 4000);
  }

  function reset() {
    init();
    /* Navigation is the caller's responsibility; reset() only rebuilds state. */
    notify();
  }

  function get() { return state; }

  window.GATE_STORE = {
    init: init,
    get: get,
    subscribe: subscribe,
    notify: notify,
    byId: byId,
    setPaymentStatus: setPaymentStatus,
    advanceClock: advanceClock,
    fmtClock: fmtClock,
    fmtAED: fmtAED,
    fmtSC: fmtSC,
    G: G,
    money: money,
    ts: ts,
    addToast: addToast,
    reset: reset
  };
})();
