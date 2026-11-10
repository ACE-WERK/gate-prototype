/* Gate Prototype — fixtures (R1.4).
 * Merchants, projects, payments, rates and fees in ONE file.
 * Every derived amount is computed in code, never hard-coded.
 * All values are illustrative (section 8 of the handoff).
 *
 * Phase 1b adds the transaction-level model (followup §3.1):
 * payments have transactions; screening cases, ledger entries and
 * merchant-facing events hang off those transactions. */
(function () {
  "use strict";

  var RATES = {
    AED_PER_USD: 3.6725,
    USDT_PER_USD: 1.00,
    USDC_PER_USD: 1.00
  };

  var FEES = {
    realEstate: 0.01,   // 1.00% of fiat, borne by merchant
    broker: 0.0025      // 0.25%, borne by merchant
  };

  var RULES = {
    underpaymentTolerancePct: 0.005,  // 0.5%
    underpaymentToleranceAbs: 50.0,   // and at most 50 USDT
    holdDeadlineHours: 24,            // placeholder
    pooledTimerMinutes: 15,
    refundNetworkFee: 2.00,
    networks: {
      USDT: ["TRC-20 (Tron)", "ERC-20 (Ethereum)"],
      USDC: ["ERC-20 (Ethereum)"]
    }
  };

  /* Amount math — all derived values flow through here (R1.4). */
  var MATH = {
    round2: function (n) { return Math.round(n * 100) / 100; },
    /* Fiat (AED) -> stablecoin amount */
    stablecoinAmount: function (fiatAED, asset) {
      var usd = fiatAED / RATES.AED_PER_USD;
      var perUsd = asset === "USDC" ? RATES.USDC_PER_USD : RATES.USDT_PER_USD;
      return MATH.round2(usd / perUsd);
    },
    /* Gate fee in AED, by segment */
    fee: function (fiatAED, segment) {
      return MATH.round2(fiatAED * (segment === "broker" ? FEES.broker : FEES.realEstate));
    },
    /* Credited AED = fiat request - fee (for exact/full payment) */
    credited: function (fiatAED, segment) {
      return MATH.round2(fiatAED - MATH.fee(fiatAED, segment));
    },
    /* Shortfall check: is a received amount acceptable as "paid"? */
    withinTolerance: function (requestedSc, receivedSc) {
      var shortfall = MATH.round2(requestedSc - receivedSc);
      if (shortfall <= 0) return { ok: true, shortfall: 0 };
      var pctOk = shortfall <= requestedSc * RULES.underpaymentTolerancePct;
      var absOk = shortfall <= RULES.underpaymentToleranceAbs;
      return { ok: pctOk && absOk, shortfall: shortfall };
    }
  };

  var MERCHANTS = [
    {
      id: "M-001",
      name: "Developer A (demo)",
      segment: "realEstate",
      model: "reserved",
      balanceAED: 1250000.00
    },
    {
      id: "M-002",
      name: "Broker B (demo)",
      segment: "broker",
      model: "pooled",
      balanceAED: 48250.75
    }
  ];

  var PROJECTS = [
    { id: "PRJ-ALPHA", merchantId: "M-001", name: "Project Alpha" },
    { id: "PRJ-BETA", merchantId: "M-001", name: "Project Beta" }
  ];

  /* Demo addresses: visibly fake, invalid on their networks (R6). */
  var ADDRESSES = {
    tron: "TDEMO00000000000000000000000000000",
    eth: "0xDEMO000000000000000000000000000000000000",
    exchangeTron: "TEXCH00000000000000000000000000000"
  };

  var PAYERS = [
    { id: "P-Y-1", name: "Sample Buyer", country: "United Arab Emirates" },
    { id: "P-Y-2", name: "Sample Buyer Two", country: "Bahrain" }
  ];

  /* Core payments that drive the scenarios.
   * requestedFiatAED is the source of truth; SC amounts are derived via MATH. */
  var PAYMENTS = [
    {
      id: "P-1001",
      merchantId: "M-001",
      projectId: "PRJ-ALPHA",
      payerId: "P-Y-1",
      label: "Unit 1204, instalment 2 of 4",
      requestedFiatAED: 500000.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "reserved",
      status: "pending"
    },
    {
      id: "P-1002",
      merchantId: "M-001",
      projectId: "PRJ-ALPHA",
      payerId: "P-Y-1",
      label: "Unit 1204, instalment 3 of 4",
      requestedFiatAED: 250000.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "reserved",
      status: "pending"
    },
    {
      id: "P-1003",
      merchantId: "M-001",
      projectId: "PRJ-BETA",
      payerId: "P-Y-1",
      label: "Unit 300, instalment 1 of 6",
      requestedFiatAED: 1200000.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "reserved",
      status: "pending"
    },
    {
      id: "P-1004",
      merchantId: "M-001",
      projectId: "PRJ-ALPHA",
      payerId: "P-Y-2",
      label: "Unit 1204, instalment 4 of 4",
      requestedFiatAED: 100000.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "reserved",
      status: "pending"
    },
    {
      id: "P-1005",
      merchantId: "M-002",
      projectId: null,
      payerId: "P-Y-2",
      label: "Broker deposit",
      requestedFiatAED: 1836.25, // USD 500 * 3.6725
      requestedFiatUSD: 500.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "pooled",
      status: "pending"
    },
    {
      /* E15: AED 250,000 due (68,073.52 USDT), paid in two transactions. */
      id: "P-1015",
      merchantId: "M-001",
      projectId: "PRJ-ALPHA",
      payerId: "P-Y-1",
      label: "Unit 1205, instalment 1 of 4",
      requestedFiatAED: 250000.00,
      asset: "USDT",
      network: "TRC-20 (Tron)",
      model: "reserved",
      status: "pending"
    }
  ];

  /* --- Transactions (followup §3.1). One payment, one or more transactions. ---
   * status uses the derive.js vocabulary (detected, confirming, checks, held,
   * in_review, frozen, cleared, ...). "in_review" is what derive.js reads for
   * a held transaction; the UI label for it is "In review" / "Cannot be
   * released" (frozen).
   * Hashes and addresses are visibly fake (R6). Confirmation counts are the
   * illustrative fixtures from §3.2 (Tron 19, Ethereum 12). */
  var HASH = {
    tx1001: "0xdemo100100000000000000000000000000000000000000000000000000000001",
    tx1002: "0xdemo100200000000000000000000000000000000000000000000000000000002",
    tx1003: "0xdemo100300000000000000000000000000000000000000000000000000000003",
    tx1004: "0xdemo100400000000000000000000000000000000000000000000000000000004",
    tx1015a: "0xdemo101500000000000000000000000000000000000000000000000000000015",
    tx1015b: "0xdemo101500000000000000000000000000000000000000000000000000000016"
  };

  var TRANSACTIONS = [
    {
      id: "TX-1001-1",
      paymentId: "P-1001",
      hash: HASH.tx1001,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 136147.04,
      senderAddr: ADDRESSES.tron,
      walletType: "own",
      confirmations: 19,
      screeningState: "clear",
      caseId: null,
      status: "cleared"
    },
    {
      id: "TX-1002-1",
      paymentId: "P-1002",
      hash: HASH.tx1002,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 326752.89,
      senderAddr: ADDRESSES.tron,
      walletType: "own",
      confirmations: 6,
      screeningState: "in_review",
      caseId: "C-2001",
      status: "in_review"
    },
    {
      id: "TX-1003-1",
      paymentId: "P-1003",
      hash: HASH.tx1003,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 27229.41,
      senderAddr: ADDRESSES.exchangeTron,
      walletType: "exchange",
      confirmations: 19,
      screeningState: "clear",
      caseId: "C-2002",
      status: "frozen"
    },
    {
      id: "TX-1004-1",
      paymentId: "P-1004",
      hash: HASH.tx1004,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 27500.00,
      senderAddr: ADDRESSES.exchangeTron,
      walletType: "exchange",
      confirmations: 19,
      screeningState: "clear",
      caseId: null,
      status: "cleared"
    },
    {
      id: "TX-1015-1",
      paymentId: "P-1015",
      hash: HASH.tx1015a,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 60000.00,
      senderAddr: ADDRESSES.tron,
      walletType: "own",
      confirmations: 7,
      screeningState: "in_review",
      caseId: "C-2003",
      status: "in_review"
    },
    {
      id: "TX-1015-2",
      paymentId: "P-1015",
      hash: HASH.tx1015b,
      network: "TRC-20 (Tron)",
      asset: "USDT",
      amountSc: 8073.52,
      senderAddr: ADDRESSES.tron,
      walletType: "own",
      confirmations: 19,
      screeningState: "clear",
      caseId: null,
      status: "cleared"
    }
  ];

  /* --- Cases (followup §3.1): one per held/frozen transaction. --- */
  var CASES = [
    {
      id: "C-2001",
      txId: "TX-1002-1",
      internalReason: "Enhanced due diligence threshold",
      externalStatus: "in_review",
      infoRequested: "Proof of relationship to the buyer and evidence of source of funds.",
      deadline: "2026-11-11T14:00:00.000Z",
      decisionLog: []
    },
    {
      id: "C-2002",
      txId: "TX-1003-1",
      internalReason: "Screening alert: indirect exposure",
      externalStatus: "cannot_be_released",
      infoRequested: null,
      deadline: "2026-11-12T10:00:00.000Z",
      decisionLog: []
    },
    {
      id: "C-2003",
      txId: "TX-1015-1",
      internalReason: "Enhanced due diligence threshold",
      externalStatus: "in_review",
      infoRequested: null,
      deadline: "2026-11-11T14:00:00.000Z",
      decisionLog: []
    }
  ];

  /* --- Ledger (followup §3.1, §3.5): AED amounts, per transaction. ---
   * Cleared transactions post fee + available; held ones post in_review;
   * frozen ones post frozen. E15's two credits are the check values from §6. */
  var LEDGER = [
    { id: "L-1001", paymentId: "P-1001", txId: "TX-1001-1", type: "fee", amountAED: 5000.00 },
    { id: "L-1002", paymentId: "P-1001", txId: "TX-1001-1", type: "available", amountAED: 495000.00 },
    { id: "L-1003", paymentId: "P-1002", txId: "TX-1002-1", type: "in_review", amountAED: 1199999.99 },
    { id: "L-1004", paymentId: "P-1003", txId: "TX-1003-1", type: "frozen", amountAED: 100000.01 },
    { id: "L-1005", paymentId: "P-1004", txId: "TX-1004-1", type: "fee", amountAED: 1000.00 },
    { id: "L-1006", paymentId: "P-1004", txId: "TX-1004-1", type: "available", amountAED: 99000.01 },
    { id: "L-1007", paymentId: "P-1015", txId: "TX-1015-1", type: "in_review", amountAED: 220350.00 },
    { id: "L-1008", paymentId: "P-1015", txId: "TX-1015-2", type: "fee", amountAED: 296.50 },
    { id: "L-1009", paymentId: "P-1015", txId: "TX-1015-2", type: "available", amountAED: 29353.50 }
  ];

  /* --- Events (followup §3.6): external status only, never a reason. ---
   * Payload fields: id, type, created_at, payment_reference, amounts, status,
   * idempotency_key. */
  var EVENT_TYPES = [
    "payment.created",
    "payment.detected",
    "payment.confirmed",
    "payment.in_review",
    "payment.information_requested",
    "payment.partially_paid",
    "payment.overpaid",
    "payment.credited",
    "payment.refunded",
    "payment.cannot_be_released",
    "payment.expired",
    "payment.late_matched"
  ];

  function event(id, type, paymentId, time, amounts, status) {
    return {
      id: id,
      type: type,
      paymentId: paymentId,
      time: time,
      payload: {
        id: "evt_" + id.replace(/^EV-/, ""),
        type: type,
        created_at: time,
        payment_reference: paymentId,
        amounts: amounts,
        status: status,
        idempotency_key: "idem_" + paymentId + "_" + type + "_" + id.replace(/^EV-/, "")
      }
    };
  }

  var EVENTS = [
    event("EV-1001", "payment.created", "P-1001", "2026-11-08T09:00:00.000Z", { amount_due: "136147.04 USDT" }, "pending"),
    event("EV-1002", "payment.detected", "P-1001", "2026-11-10T08:10:00.000Z", { received: "136147.04 USDT" }, "detected"),
    event("EV-1003", "payment.credited", "P-1001", "2026-11-10T08:12:00.000Z", { received: "136147.04 USDT", credited: "AED 495000.00" }, "paid"),
    event("EV-1004", "payment.created", "P-1002", "2026-11-09T11:30:00.000Z", { amount_due: "68073.52 USDT" }, "pending"),
    event("EV-1005", "payment.in_review", "P-1002", "2026-11-10T12:40:00.000Z", { received: "326752.89 USDT" }, "in_review"),
    event("EV-1006", "payment.created", "P-1003", "2026-11-09T15:00:00.000Z", { amount_due: "326752.89 USDT" }, "pending"),
    event("EV-1007", "payment.cannot_be_released", "P-1003", "2026-11-10T13:05:00.000Z", { received: "27229.41 USDT" }, "frozen"),
    event("EV-1008", "payment.created", "P-1004", "2026-11-10T07:45:00.000Z", { amount_due: "27229.41 USDT" }, "pending"),
    event("EV-1009", "payment.overpaid", "P-1004", "2026-11-10T09:20:00.000Z", { received: "27500.00 USDT", surplus: "270.59 USDT" }, "overpaid"),
    event("EV-1010", "payment.created", "P-1015", "2026-11-10T10:00:00.000Z", { amount_due: "68073.52 USDT" }, "pending"),
    event("EV-1011", "payment.partially_paid", "P-1015", "2026-11-10T11:15:00.000Z", { received: "8073.52 USDT", credited: "AED 29353.50" }, "partially_credited_in_review")
  ];

  /* --- Regulatory / operational fixtures (followup §3.2, §3.3, §3.9). ---
   * Illustrative and owned by Compliance. */
  var TRAVEL_RULE_THRESHOLD_AED = { uae: 3500, bahrain: 0 };
  var WORKING_WEEK = {
    uae: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    bahrain: ["Sun", "Mon", "Tue", "Wed", "Thu"]
  };
  var NETWORK_FEE = 2.00;
  var CONFIRMATION_COUNTS = { tron: 19, ethereum: 12 };
  var EXCHANGE_NAMES = ["Exchange A", "Exchange B", "Other exchange"];

  window.GATE_FIXTURES = {
    rates: RATES,
    fees: FEES,
    rules: RULES,
    math: MATH,
    merchants: MERCHANTS,
    projects: PROJECTS,
    addresses: ADDRESSES,
    payers: PAYERS,
    payments: PAYMENTS,
    transactions: TRANSACTIONS,
    cases: CASES,
    ledger: LEDGER,
    events: EVENTS,
    eventTypes: EVENT_TYPES,
    travelRuleThresholdAED: TRAVEL_RULE_THRESHOLD_AED,
    workingWeek: WORKING_WEEK,
    networkFee: NETWORK_FEE,
    confirmationCounts: CONFIRMATION_COUNTS,
    exchangeNames: EXCHANGE_NAMES
  };
})();
