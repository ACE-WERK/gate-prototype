/* Gate Prototype — shared state, demo clock, reset.
 * All three seats read and write this one object (R3).
 * Time is simulated; the presenter advances the demo clock (R3).
 *
 * Phase 1b: payments carry transactions. Screening, holds and crediting are
 * per transaction; the payment's derived status comes from GATE_DERIVE and is
 * stored on the payment (p.derived / p.derivedStatus). Every transaction
 * mutation re-derives. Legacy payment-level fields and methods keep working so
 * the pre-1b screens and scenarios continue to run unchanged. */
(function () {
  "use strict";

  var F, S;
  function fx() { F = window.GATE_FIXTURES; S = window.GATE_STATUSES; }

  /* Base demo clock: a fixed "now" so deadlines render deterministically. */
  var BASE_NOW = new Date(2026, 10, 10, 18, 0, 0); // Tue 10 Nov 2026 18:00 (local display)

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function deepClonePayments() {
    fx();
    return F.payments.map(function (p) {
      var c = clone(p);
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
      /* Transaction-level derived status (filled after seeding, below). */
      c.derived = null;
      c.derivedStatus = null;
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
      transactions: [],
      cases: [],
      ledger: [],
      events: [],
      toasts: [],
      dialogs: []
    };
    seedTransactions();
    /* Seed a little history so the merchant list is never empty by default. */
    seedHistory();
    return state;
  }

  /* Fixture transactions/cases/ledger/events are the reference dataset.
   * They are cloned into state so a scenario can mutate them without touching
   * the fixtures. Derived status is computed but NOT copied onto p.status at
   * init: the legacy screens/scenarios start from their seeded `pending`
   * states, and only transaction mutations move the payment status. */
  function seedTransactions() {
    fx();
    state.transactions = clone(F.transactions || []);
    state.cases = clone(F.cases || []);
    state.ledger = clone(F.ledger || []);
    state.events = clone(F.events || []);
    for (var i = 0; i < state.payments.length; i++) {
      var p = state.payments[i];
      var d = deriveFor(p);
      if (d) {
        p.derived = d;
        p.derivedStatus = d.status;
      }
    }
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

  /* --- transactions: lookup and derivation --- */

  function allTransactions() { return (state && state.transactions) ? state.transactions : []; }

  function findTx(txId) {
    var list = allTransactions();
    for (var i = 0; i < list.length; i++) if (list[i].id === txId) return list[i];
    return null;
  }

  function getTransactions(paymentId) {
    var list = allTransactions();
    if (paymentId == null) return list.slice();
    return list.filter(function (t) { return t.paymentId === paymentId; });
  }

  function getLedger(paymentId) {
    var list = state.ledger || [];
    if (paymentId == null) return list.slice();
    return list.filter(function (l) { return l.paymentId === paymentId; });
  }

  function getEvents(paymentId) {
    var list = state.events || [];
    if (paymentId == null) return list.slice();
    return list.filter(function (e) { return e.paymentId === paymentId; });
  }

  function getCases() { return (state.cases || []).slice(); }

  function getCase(caseId) {
    var list = state.cases || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === caseId) return list[i];
    return null;
  }

  /* derive.js reads tx.status only. Older fixtures/scenarios use "held" for a
   * transaction that is in review; normalise that to the derive vocabulary
   * without mutating the stored transaction. */
  function forDerive(tx) {
    if (!tx) return tx;
    if (tx.status === "held") {
      var c = {};
      for (var k in tx) if (Object.prototype.hasOwnProperty.call(tx, k)) c[k] = tx[k];
      c.status = "in_review";
      return c;
    }
    return tx;
  }

  function deriveFor(p) {
    if (!p) return null;
    if (!window.GATE_DERIVE || typeof window.GATE_DERIVE.derivePayment !== "function") {
      return null; // derive.js not loaded (index.html adds it in a later phase)
    }
    var txs = getTransactions(p.id).map(forDerive);
    var seg = p.merchantId === "M-002" ? "broker" : "realEstate";
    return window.GATE_DERIVE.derivePayment(
      txs,
      p.requestedSc,
      F.rules.underpaymentTolerancePct,
      {
        toleranceAbsSc: F.rules.underpaymentToleranceAbs,
        aedPerUsd: F.rates.AED_PER_USD,
        feePct: seg === "broker" ? F.fees.broker : F.fees.realEstate
      }
    );
  }

  /* derive.js status -> legacy payment status understood by statuses.js.
   * "pending" is deliberately absent: a transaction mutation that adds up to
   * nothing must not wipe a scenario's detected/checks state. */
  var LEGACY_STATUS = {
    paid: "paid",
    partial: "partial",
    overpaid: "overpaid",
    in_review: "held",
    partially_credited_in_review: "held",
    frozen: "frozen"
  };

  function totalSc(paymentId) {
    var n = 0;
    var txs = getTransactions(paymentId);
    for (var i = 0; i < txs.length; i++) n += Number(txs[i].amountSc) || 0;
    return F.math.round2(n);
  }

  /* Re-derives and copies the result onto the payment. applyStatus is false at
   * init (legacy scenarios must still start from their seeded state) and true
   * after every transaction mutation. */
  function syncDerived(p, applyStatus) {
    if (!p) return null;
    var d = deriveFor(p);
    p.derived = d;
    p.derivedStatus = d ? d.status : null;
    if (!d) return null;
    if (applyStatus) {
      var mapped = LEGACY_STATUS[d.status];
      if (mapped) p.status = mapped;
      p.receivedSc = totalSc(p.id);
      p.creditedAED = d.creditedAED;
      p.shortfall = d.shortfall;
      p.surplus = d.surplus;
    }
    return d;
  }

  function paymentForTx(tx) { return tx && tx.paymentId ? byId(tx.paymentId) : null; }

  function nextSuffix(list, prefix) {
    var max = 0;
    for (var i = 0; i < list.length; i++) {
      var m = String(list[i].id || "").match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }

  function nextTxId(paymentId) {
    var n = getTransactions(paymentId).length + 1;
    return "TX-" + String(paymentId).replace(/^P-/, "") + "-" + n;
  }

  function nextEventId() {
    return "EV-" + nextSuffix(state.events || [], "EV-");
  }

  /* --- transaction mutations --- */

  function addTransaction(paymentId, tx) {
    if (!state) return null;
    var p = byId(paymentId);
    if (!p || !tx) return null;
    var t = clone(tx);
    t.paymentId = paymentId;
    if (!t.id) t.id = nextTxId(paymentId);
    if (!t.network) t.network = p.network;
    if (!t.asset) t.asset = p.asset;
    if (t.amountSc == null) t.amountSc = 0;
    if (t.walletType !== "exchange" && t.walletType !== "own") t.walletType = "own";
    if (t.confirmations == null) t.confirmations = 0;
    if (t.screeningState == null) t.screeningState = "pending";
    if (t.status == null) t.status = "detected";
    if (t.caseId === undefined) t.caseId = null;
    state.transactions.push(t);
    syncDerived(p, true);
    notify();
    return t;
  }

  /* Screening and on-chain status are two views of the same transaction.
   * derive.js reads status, so screening is mirrored onto it. */
  function setTxScreening(txId, screeningState) {
    var t = findTx(txId);
    if (!t) return null;
    t.screeningState = screeningState;
    if (screeningState === "clear") t.status = "cleared";
    else if (screeningState === "in_review") t.status = "in_review";
    else if (screeningState === "pending" && !t.status) t.status = "checks";
    syncDerived(paymentForTx(t), true);
    notify();
    return t;
  }

  function setTxStatus(txId, status) {
    var t = findTx(txId);
    if (!t) return null;
    t.status = status;
    if (status === "cleared") t.screeningState = "clear";
    else if (status === "in_review" || status === "held") t.screeningState = "in_review";
    syncDerived(paymentForTx(t), true);
    notify();
    return t;
  }

  function setTxConfirmations(txId, n) {
    var t = findTx(txId);
    if (!t) return null;
    t.confirmations = Number(n) || 0;
    notify();
    return t;
  }

  /* --- cases --- */

  function createCase(txId, internalReason, externalStatus) {
    if (!state) return null;
    var t = findTx(txId);
    if (!t) return null;
    if (t.caseId) return getCase(t.caseId);
    var c = {
      id: "C-" + nextSuffix(state.cases, "C-"),
      txId: txId,
      internalReason: internalReason || null,
      externalStatus: externalStatus || "in_review",
      infoRequested: null,
      deadline: new Date(state.clock.getTime() + (F.rules.holdDeadlineHours || 24) * 3600000).toISOString(),
      decisionLog: []
    };
    state.cases.push(c);
    t.caseId = c.id;
    notify();
    return c;
  }

  var CASE_STATUS = {
    approve: "paid",
    request: "information_requested",
    request_info: "information_requested",
    request_information: "information_requested",
    decline: "declined",
    decline_and_refund: "declined",
    refund: "declined",
    freeze: "frozen"
  };

  function decideCase(caseId, action, reason, note) {
    var c = getCase(caseId);
    if (!c) return null;
    var key = String(action || "").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "");
    var at = ts();
    c.decisionLog.push({
      at: at,
      action: action || null,
      internalReason: reason || null,
      note: note || null
    });
    c.decidedAt = at;
    if (CASE_STATUS[key]) c.externalStatus = CASE_STATUS[key];
    notify();
    return c;
  }

  /* --- ledger and events --- */

  var LEDGER_TYPES = ["in_review", "available", "fee", "refund", "frozen"];

  function addLedgerEntry(paymentId, txId, type, amountAED) {
    if (!state) return null;
    if (!byId(paymentId)) return null;
    var e = {
      id: "L-" + nextSuffix(state.ledger, "L-"),
      paymentId: paymentId,
      txId: txId || null,
      type: type || "available",
      amountAED: F.math.round2(Number(amountAED) || 0)
    };
    if (LEDGER_TYPES.indexOf(e.type) === -1 && typeof console !== "undefined") {
      console.warn("ledger type", e.type, "not in", LEDGER_TYPES.join("|"));
    }
    state.ledger.push(e);
    notify();
    return e;
  }

  /* Event payloads are merchant-facing: external status only, never an
   * internal reason, risk score or screening result. */
  function addEvent(paymentId, type, amounts, status) {
    if (!state) return null;
    var p = byId(paymentId);
    var id = nextEventId();
    var at = ts();
    var payload = {
      id: "evt_" + id.replace(/^EV-/, ""),
      type: type,
      created_at: at,
      payment_reference: p ? p.id : paymentId,
      amounts: amounts ? clone(amounts) : {},
      status: status || (p ? (p.derivedStatus || p.status) : null),
      idempotency_key: "idem_" + (p ? p.id : paymentId) + "_" + type + "_" + id.replace(/^EV-/, "")
    };
    var ev = { id: id, type: type, paymentId: paymentId, time: at, payload: payload };
    state.events.push(ev);
    notify();
    return ev;
  }

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
    reset: reset,

    /* Phase 1b additions */
    addTransaction: addTransaction,
    setTxScreening: setTxScreening,
    setTxStatus: setTxStatus,
    setTxConfirmations: setTxConfirmations,
    getTransactions: getTransactions,
    getLedger: getLedger,
    getEvents: getEvents,
    getCases: getCases,
    getCase: getCase,
    createCase: createCase,
    decideCase: decideCase,
    addLedgerEntry: addLedgerEntry,
    addEvent: addEvent
  };
})();
