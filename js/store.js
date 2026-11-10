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
      /* Phase 2 scenario/UI flags (transaction-level states that derivation
       * does not express: slow checks, refund prompt, schedule updates). */
      c.externalStatus = null;
      c.checksDelayed = false;
      c.scheduleStatus = null;
      c.appliedToPaymentId = null;
      c.surplusAppliedSc = 0;
      c.surplusRemainingSc = 0;
      c.surplusRefunded = false;
      c.surplusRefundPending = false;
      c.refundAddressRequired = false;
      c.refundAddress = null;
      c.refundAmountSc = null;
      c.caseOverdue = false;
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
      dialogs: [],
      /* Phase 2 scenario runtime: which payment artifacts have been rebuilt
       * for the current scenario, and how many status-bearing events have
       * been replayed (deep links and Back replay from zero). */
      _scenarioFor: null,
      _scenarioCursor: 0,
      _scenarioPrepared: {}
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
      p.externalStatus = d.status;
      p.receivedSc = totalSc(p.id);
      p.creditedAED = d.creditedAED;
      p.shortfall = d.shortfall;
      /* A shortfall accepted inside the tolerance still derives "paid"; keep
       * the visible shortfall so E6 can show it. */
      if (d.status === "paid" && d.clearedSc < p.requestedSc - 0.005) {
        p.shortfall = F.math.round2(p.requestedSc - d.clearedSc);
      }
      p.surplus = d.surplus;
    }
    return d;
  }

  function paymentForTx(tx) { return tx && tx.paymentId ? byId(tx.paymentId) : null; }

  /* --- scenario runtime (phase 2) -----------------------------------------
   * Scenario events are declarative programs (`ops`) applied to the
   * transaction model. The demo bar still calls setPaymentStatus per event;
   * the store maps that call to the next status-bearing event in the current
   * scenario, which also works when a deep link replays events from zero.
   */

  function nextScenarioEvent() {
    if (!state) return null;
    if (state._scenarioFor !== state.scenarioId) {
      state._scenarioFor = state.scenarioId;
      state._scenarioCursor = 0;
      state._scenarioPrepared = {};
    }
    var sc = window.GATE_SCENARIOS && window.GATE_SCENARIOS.byId(state.scenarioId);
    if (!sc) return null;
    var list = [];
    for (var i = 0; i < sc.events.length; i++) {
      if (sc.events[i].status != null) list.push(sc.events[i]);
    }
    var ev = list[state._scenarioCursor] || null;
    state._scenarioCursor += 1;
    return ev;
  }

  function feePctFor(p) {
    return p.merchantId === "M-002" ? F.fees.broker : F.fees.realEstate;
  }

  function assetUsdFor(p) {
    return p.asset === "USDC" ? F.rates.USDC_PER_USD : F.rates.USDT_PER_USD;
  }

  function grossAED(p, amountSc) {
    return F.math.round2((Number(amountSc) || 0) * F.rates.AED_PER_USD * assetUsdFor(p));
  }

  function creditCapAED(p) {
    return F.math.round2(p.requestedFiatAED * (1 - feePctFor(p)));
  }

  function availableSum(paymentId) {
    var n = 0;
    var list = state.ledger || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].paymentId === paymentId && list[i].type === "available") n += Number(list[i].amountAED) || 0;
    }
    return F.math.round2(n);
  }

  function hasLedger(paymentId, txId, type) {
    var list = state.ledger || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].paymentId === paymentId && list[i].txId === txId && list[i].type === type) return true;
    }
    return false;
  }

  function removeLedger(paymentId, txId, type) {
    state.ledger = (state.ledger || []).filter(function (l) {
      return !(l.paymentId === paymentId && l.txId === txId && l.type === type);
    });
  }

  function _addLedger(paymentId, txId, type, amountAED, extra) {
    var e = {
      id: "L-" + nextSuffix(state.ledger || [], "L-"),
      paymentId: paymentId,
      txId: txId || null,
      type: type || "available",
      amountAED: F.math.round2(Number(amountAED) || 0)
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k];
    state.ledger.push(e);
    return e;
  }

  function _emitEvent(paymentId, type, amounts, status) {
    var p = byId(paymentId);
    var id = nextEventId();
    var at = ts();
    var payload = {
      id: "evt_" + id.replace(/^EV-/, ""),
      type: type,
      created_at: at,
      payment_reference: p ? p.id : paymentId,
      amounts: amounts ? clone(amounts) : {},
      status: status || (p ? (p.externalStatus || p.derivedStatus || p.status) : null),
      idempotency_key: "idem_" + (p ? p.id : paymentId) + "_" + type + "_" + id.replace(/^EV-/, "")
    };
    var ev = { id: id, type: type, paymentId: paymentId, time: at, payload: payload };
    state.events.push(ev);
    return ev;
  }

  /* A scenario replays one payment from its beginning: drop the reference
   * dataset's transactions, cases, ledger and events for that payment once,
   * so sending 136,147.04 does not stack on a seeded cleared transaction. */
  function preparePayment(paymentId) {
    if (!state._scenarioPrepared) state._scenarioPrepared = {};
    if (state._scenarioPrepared[paymentId]) return;
    state._scenarioPrepared[paymentId] = true;
    var p = byId(paymentId);
    if (!p) return;
    var txIds = {};
    state.transactions = (state.transactions || []).filter(function (t) {
      if (t.paymentId === paymentId) { txIds[t.id] = true; return false; }
      return true;
    });
    state.cases = (state.cases || []).filter(function (c) { return !txIds[c.txId]; });
    state.ledger = (state.ledger || []).filter(function (l) { return l.paymentId !== paymentId; });
    state.events = (state.events || []).filter(function (e) { return e.paymentId !== paymentId; });

    p.status = "pending";
    p.timeline = [];
    p.receivedSc = 0;
    p.creditedAED = 0;
    p.feeAED = F.math.fee(p.requestedFiatAED, p.merchantId === "M-002" ? "broker" : "realEstate");
    p.shortfall = 0;
    p.surplus = 0;
    p.flaggedAt = null;
    p.decisionDueBy = null;
    p.reasonCategory = null;
    p.internalReason = null;
    p.note = null;
    p.infoRequested = null;
    p.infoProvided = false;
    p.lateMatched = false;
    p.expiredAt = null;
    p.poolReleased = false;
    p.receivedNetwork = null;
    p.externalStatus = null;
    p.checksDelayed = false;
    p.scheduleStatus = null;
    p.appliedToPaymentId = null;
    p.surplusAppliedSc = 0;
    p.surplusRemainingSc = 0;
    p.surplusRefunded = false;
    p.surplusRefundPending = false;
    p.refundAddressRequired = false;
    p.refundAddress = null;
    p.refundAmountSc = null;
    p.caseOverdue = false;
  }

  function defaultConfirmations(t) {
    return String(t.network || "").indexOf("TRC-20") === 0 ? F.confirmationCounts.tron : F.confirmationCounts.ethereum;
  }

  function _addTx(paymentId, spec) {
    var p = byId(paymentId);
    if (!p || !spec) return null;
    preparePayment(paymentId);
    var t = spec.id ? findTx(spec.id) : null;
    if (!t) {
      t = { id: spec.id || nextTxId(paymentId), paymentId: paymentId };
      state.transactions.push(t);
    }
    for (var k in spec) {
      if (k === "op" || k === "id" || k === "paymentId") continue;
      if (Object.prototype.hasOwnProperty.call(spec, k)) t[k] = spec[k];
    }
    if (t.amountSc == null) t.amountSc = 0;
    if (!t.network) t.network = p.network;
    if (!t.asset) t.asset = p.asset;
    if (t.walletType !== "exchange" && t.walletType !== "own") t.walletType = "own";
    if (!t.senderAddr) t.senderAddr = t.walletType === "exchange" ? F.addresses.exchangeTron : (String(t.network).indexOf("TRC-20") === 0 ? F.addresses.tron : F.addresses.eth);
    if (t.confirmations == null) t.confirmations = t.status === "cleared" ? defaultConfirmations(t) : 0;
    if (!t.screeningState) {
      t.screeningState = t.status === "cleared" ? "clear" : (t.status === "in_review" || t.status === "frozen" ? "in_review" : "pending");
    }
    if (t.caseId === undefined) t.caseId = null;
    if (!t.hash) t.hash = "0xdemo" + String(paymentId).replace(/\D/g, "") + "0000000000000000000000000000000000".slice(0, 30);
    syncDerived(p, true);
    return t;
  }

  function _txStatus(txId, status, extra) {
    var t = findTx(txId);
    if (!t) return null;
    t.status = status;
    if (extra) {
      if (extra.screeningState) t.screeningState = extra.screeningState;
      if (extra.confirmations != null) t.confirmations = Number(extra.confirmations) || 0;
      if (extra.network) t.network = extra.network;
    }
    syncDerived(paymentForTx(t), true);
    return t;
  }

  function _holdTx(p, txId) {
    var t = findTx(txId);
    if (!t) return null;
    t.status = "in_review";
    t.screeningState = "in_review";
    if (!hasLedger(p.id, t.id, "in_review")) _addLedger(p.id, t.id, "in_review", grossAED(p, t.amountSc));
    syncDerived(p, true);
    return t;
  }

  function _creditTx(p, txId) {
    var t = findTx(txId);
    if (!t) return null;
    removeLedger(p.id, t.id, "in_review");
    var gross = grossAED(p, t.amountSc);
    var fp = feePctFor(p);
    var fee = F.math.round2(gross * fp);
    var net = F.math.round2(gross - fee);
    var cap = creditCapAED(p);
    var already = availableSum(p.id);
    if (already >= cap - 0.005) {
      /* Entirely surplus: no fee and nothing more credited. */
      fee = 0;
      net = 0;
    } else if (already + net > cap + 0.005) {
      /* Overpayment: credit the request, charge the request's fee; the
       * remainder is surplus and is refunded/applied separately. */
      net = F.math.round2(cap - already);
      fee = F.math.round2(p.requestedFiatAED * fp);
    }
    t.status = "cleared";
    t.screeningState = "clear";
    if (!t.confirmations) t.confirmations = defaultConfirmations(t);
    if (fee > 0) _addLedger(p.id, t.id, "fee", fee);
    if (net > 0) _addLedger(p.id, t.id, "available", net);
    syncDerived(p, true);
    return t;
  }

  function _freezeTx(p, txId) {
    var t = findTx(txId);
    if (!t) return null;
    removeLedger(p.id, t.id, "in_review");
    t.status = "frozen";
    t.screeningState = "in_review";
    if (!hasLedger(p.id, t.id, "frozen")) _addLedger(p.id, t.id, "frozen", grossAED(p, t.amountSc));
    syncDerived(p, true);
    return t;
  }

  function _refundTx(p, txId, amountSc, op) {
    var t = findTx(txId);
    if (!t) return null;
    removeLedger(p.id, t.id, "in_review");
    t.status = "refunded";
    t.screeningState = "clear";
    var refundSc = F.math.round2(Number(amountSc) || 0);
    p.refundAmountSc = refundSc;
    _addLedger(p.id, t.id, "refund", grossAED(p, refundSc), { amountSc: refundSc, asset: p.asset });
    syncDerived(p, true);
    return t;
  }

  function _caseForTx(txId) {
    var t = findTx(txId);
    if (!t || !t.caseId) return null;
    return getCase(t.caseId);
  }

  function _ensureCase(txId, spec) {
    var t = findTx(txId);
    if (!t) return null;
    var c = t.caseId ? getCase(t.caseId) : null;
    if (!c) {
      c = {
        id: "C-" + nextSuffix(state.cases || [], "C-"),
        txId: txId,
        internalReason: spec.internalReason || null,
        externalStatus: spec.externalStatus || "in_review",
        infoRequested: spec.infoRequested || null,
        deadline: new Date(state.clock.getTime() + (spec.deadlineHours != null ? spec.deadlineHours : (F.rules.holdDeadlineHours || 24)) * 3600000).toISOString(),
        decisionLog: []
      };
      state.cases.push(c);
      t.caseId = c.id;
    } else {
      if (spec.internalReason) c.internalReason = spec.internalReason;
      if (spec.externalStatus) c.externalStatus = spec.externalStatus;
      if (spec.infoRequested != null) c.infoRequested = spec.infoRequested;
    }
    return c;
  }

  function _requestInfo(txId, info) {
    var c = _caseForTx(txId);
    if (c) {
      c.externalStatus = "information_requested";
      c.infoRequested = info || null;
    }
    var p = paymentForTx(findTx(txId));
    if (p) p.infoRequested = info || null;
    return c;
  }

  function _decideCase(txId, action, reason, note) {
    var c = _caseForTx(txId);
    if (!c) return null;
    var key = String(action || "").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "");
    var at = ts();
    c.decisionLog.push({ at: at, action: action || null, internalReason: reason || null, note: note || null });
    c.decidedAt = at;
    if (CASE_STATUS[key]) c.externalStatus = CASE_STATUS[key];
    return c;
  }

  function _overdue(txId) {
    var c = _caseForTx(txId);
    if (!c) return null;
    c.overdue = true;
    c.deadline = new Date(state.clock.getTime() - 3600000).toISOString();
    c.externalStatus = "overdue";
    var p = paymentForTx(findTx(txId));
    if (p) p.caseOverdue = true;
    return c;
  }

  function applyScenarioStatus(p, op) {
    p.status = op.value;
    if (op.externalStatus) p.externalStatus = op.externalStatus;
    if (op.scheduleStatus) p.scheduleStatus = op.scheduleStatus;
    if (op.category) { p.reasonCategory = op.category; p.flaggedAt = ts(); }
    if (op.deadlineHours != null) p.decisionDueBy = new Date(state.clock.getTime() + op.deadlineHours * 3600000).toISOString();
    if (op.internal) p.internalReason = op.internal;
    if (op.note != null) p.note = op.note;
    if (op.info) p.infoRequested = op.info;
    if (op.infoProvided) p.infoProvided = true;
    if (op.late) p.lateMatched = true;
    if (op.wrongNetwork) p.receivedNetwork = op.wrongNetwork;
    if (op.expired) { p.expiredAt = ts(); p.poolReleased = true; }
    if (op.checksDelayed != null) p.checksDelayed = op.checksDelayed;
    if (op.merchantBanner != null) p.merchantBanner = op.merchantBanner;
    if (op.refundAddressRequired != null) p.refundAddressRequired = op.refundAddressRequired;
    if (op.refundAddress != null) p.refundAddress = op.refundAddress;
    if (op.surplusRefunded != null) p.surplusRefunded = op.surplusRefunded;
    if (op.surplusRefundPending != null) p.surplusRefundPending = op.surplusRefundPending;
    if (op.surplusAppliedSc != null) p.surplusAppliedSc = op.surplusAppliedSc;
    if (op.surplusRemainingSc != null) p.surplusRemainingSc = op.surplusRemainingSc;

    var internalText = op.text || (window.GATE_STATUSES ? window.GATE_STATUSES.label(op.value, "compliance") : op.value);
    var externalText = op.externalText || (window.GATE_STATUSES ? window.GATE_STATUSES.label(op.value, "merchant") : op.value);
    p.timeline.push({ ts: ts(), seat: "system", text: internalText, internal: true });
    p.timeline.push({ ts: ts(), seat: "system", text: externalText, internal: false });
  }

  /* E17: the duplicate payment is applied to the next instalment. The target
   * payment gets a real cleared transaction, fee/available ledger and event;
   * the source keeps the mechanical surplus and records what was applied. */
  function _applyToInstalment(op) {
    var from = byId(op.from);
    var to = byId(op.to);
    if (!to) return;
    preparePayment(to.id);
    _addTx(to.id, { id: op.txId, amountSc: op.amountSc, status: "cleared", screeningState: "clear", walletType: "own" });
    _creditTx(to, op.txId);
    _emitEvent(to.id, "payment.credited", { received: usdtString(op.amountSc), credited: "AED " + F.math.round2(creditCapAED(to)).toFixed(2) }, "paid");
    to.scheduleStatus = "paid";
    to.appliedToPaymentId = from ? from.id : null;
    if (from) {
      from.surplusAppliedSc = op.amountSc;
      var ds = from.derived ? from.derived.surplus : 0;
      from.surplusRemainingSc = F.math.round2(Math.max(0, ds - op.amountSc));
    }
  }

  /* Scenario amounts in event payloads are display strings. */
  function usdtString(n) {
    var parts = Number(n).toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".") + " USDT";
  }

  function applyScenarioOps(p, ev) {
    preparePayment(p.id);
    var ops = ev.ops || [];
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      switch (o.op) {
        case "tx": _addTx(p.id, o); break;
        case "txStatus": _txStatus(o.id, o.status, o); break;
        case "hold": _holdTx(p, o.id); break;
        case "credit": _creditTx(p, o.id); break;
        case "freeze": _freezeTx(p, o.id); break;
        case "refund": _refundTx(p, o.id, o.amountSc, o); break;
        case "case": _ensureCase(o.txId, o); break;
        case "requestInfo": _requestInfo(o.txId, o.info); break;
        case "decideCase": _decideCase(o.txId, o.action, o.internalReason, o.note); break;
        case "overdue": _overdue(o.txId); break;
        case "ledger": _addLedger(p.id, o.txId, o.type, o.amountAED, o.extra); break;
        case "event": _emitEvent(p.id, o.name, o.amounts, o.status); break;
        case "status": applyScenarioStatus(p, o); break;
        case "applyToInstalment": _applyToInstalment(o); break;
      }
    }
    notify();
  }


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
    var ev = _emitEvent(paymentId, type, amounts, status);
    notify();
    return ev;
  }

  /* --- payment mutations --- */
  function setPaymentStatus(id, status, extra, force) {
    var p = byId(id);
    if (!p) return;

    /* Scenario stepping (demo bar, deep links, Back replay) is applied to the
     * transaction model. Each status-bearing event carries its own ops; if it
     * does not, the legacy payment-level path below still runs. */
    if (force && state.scenarioId) {
      var ev = nextScenarioEvent();
      if (ev && ev.ops && ev.ops.length) {
        applyScenarioOps(p, ev);
        return;
      }
    }

    applyLegacyStatus(p, status, extra, force);
  }

  function applyLegacyStatus(p, status, extra, force) {
    fx();
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
