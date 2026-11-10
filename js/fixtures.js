/* Gate Prototype — fixtures (R1.4).
 * Merchants, projects, payments, rates and fees in ONE file.
 * Every derived amount is computed in code, never hard-coded.
 * All values are illustrative (section 8 of the handoff). */
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
    eth: "0xDEMO000000000000000000000000000000000000"
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
    }
  ];

  window.GATE_FIXTURES = {
    rates: RATES,
    fees: FEES,
    rules: RULES,
    math: MATH,
    merchants: MERCHANTS,
    projects: PROJECTS,
    addresses: ADDRESSES,
    payers: PAYERS,
    payments: PAYMENTS
  };
})();
