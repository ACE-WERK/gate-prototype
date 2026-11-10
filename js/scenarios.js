/* Gate Prototype — scenarios (R1.2).
 * A scenario is data: an ordered list of events. Adding one = one new entry.
 * Each event mutates shared state via the store. Priority per section 7. */
(function () {
  "use strict";

  var F;
  function fx() { F = window.GATE_FIXTURES; }

  var SCENARIOS = [
    {
      id: "H1",
      priority: "P0",
      name: "Happy path: exact payment clears",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Payer opens the reserved-address checkout (no expiry). Sends 136,147.04 USDT on TRC-20." },
        { type: "send", sc: 136147.04, status: "detected" },
        { type: "advance", status: "checks", text: "Payment checks in progress." },
        { type: "advance", status: "paid", text: "Payment verified and credited." }
      ]
    },
    {
      id: "E1",
      priority: "P0",
      name: "Underpaid, then topped up",
      paymentId: "P-1002",
      events: [
        { type: "note", text: "AED 250,000 due (68,073.52 USDT). Payer sends 60,000.00 USDT on TRC-20." },
        { type: "send", sc: 60000.00, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "advance", status: "partial", text: "Underpaid: amount credited, payer can keep paying on the same link." },
        { type: "note", text: "Later the payer sends the remainder: 8,073.52 USDT." },
        { type: "send", sc: 8073.52, status: "partial" },
        { type: "advance", status: "paid", text: "Full amount received; credited." }
      ]
    },
    {
      id: "E2",
      priority: "P0",
      name: "Flagged, information requested, approved",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "AED 1,200,000 instalment (326,752.89 USDT) sent on TRC-20." },
        { type: "send", sc: 326752.89, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "flag", status: "held", category: "Payment is above the review threshold", internal: "Enhanced due diligence threshold", note: "Instalment above the review threshold; wallet history consistent with prior cleared instalment.", deadlineHours: 24 },
        { type: "requestInfo", status: "action", info: "Please provide proof of source of funds for this instalment." },
        { type: "note", text: "Payer uploads the requested documents (simulated)." },
        { type: "approve", status: "paid", internal: "Enhanced due diligence threshold", note: "Source of funds confirmed." }
      ]
    },
    {
      id: "E3",
      priority: "P1",
      name: "Flagged, declined and refunded",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 (27,229.41 USDT) sent on TRC-20." },
        { type: "send", sc: 27229.41, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "flag", status: "held", category: "Sending wallet needs verification", internal: "Payer name mismatch", note: "Payer name on file does not match the provided details.", deadlineHours: 24 },
        { type: "decline", status: "declined", internal: "Payer name mismatch", note: "Details not confirmed after reminder; returning funds." }
      ]
    },
    {
      id: "E4",
      priority: "P1",
      name: "Flagged, frozen",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 (27,229.41 USDT) sent on TRC-20." },
        { type: "send", sc: 27229.41, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "flag", status: "held", category: "Additional checks on the source of funds", internal: "Screening alert: indirect exposure", note: "Indirect exposure flagged by screening; holding while reviewed.", deadlineHours: 24 },
        { type: "freeze", status: "frozen", internal: "Screening alert: indirect exposure", note: "Frozen pending further review; no further action needed from merchant." }
      ]
    },
    {
      id: "E5",
      priority: "P1",
      name: "Overpaid",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 due (27,229.41 USDT). Payer sends 27,500.00 USDT." },
        { type: "send", sc: 27500.00, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "advance", status: "overpaid", text: "Full request covered; surplus 270.59 USDT." }
      ]
    },
    {
      id: "E6",
      priority: "P1",
      name: "Shortfall within tolerance",
      paymentId: "P-1002",
      events: [
        { type: "note", text: "AED 250,000 due (68,073.52 USDT). Payer sends 68,048.52 USDT (25.00 short)." },
        { type: "send", sc: 68048.52, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "advance", status: "paid", text: "Shortfall 25.00 USDT is within tolerance (0.5% and 50.00). Auto-accepted as Paid; credited on amount received." }
      ]
    },
    {
      id: "E7",
      priority: "P1",
      name: "Hold passes its deadline",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "AED 1,200,000 instalment sent; flagged on review." },
        { type: "send", sc: 326752.89, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "flag", status: "held", category: "Payment is above the review threshold", internal: "Enhanced due diligence threshold", note: "Instalment above the review threshold.", deadlineHours: 24 },
        { type: "advanceClock", hours: 25, status: "overdueHeld", text: "24h decision deadline passed; case marked overdue." }
      ]
    },
    {
      id: "E8",
      priority: "P1",
      name: "Pooled link expires unpaid",
      paymentId: "P-1005",
      events: [
        { type: "note", text: "Broker deposit USD 500 (1,836.25 AED). Pooled link with a 15-minute timer. No payment arrives." },
        { type: "advanceClock", minutes: 15, status: "expired", text: "Timer ran out; address returns to the pool." }
      ]
    },
    {
      id: "E9",
      priority: "P1",
      name: "Late payment after expiry",
      paymentId: "P-1005",
      events: [
        { type: "note", text: "Broker deposit USD 500. Pooled timer (15 min) runs out — link expires." },
        { type: "advanceClock", minutes: 15, status: "expired" },
        { type: "note", text: "Four minutes later, 500.00 USDT arrives to the same address." },
        { type: "advanceClock", minutes: 4 },
        { type: "send", sc: 500.00, status: "expired", late: true },
        { type: "advance", status: "paid", text: "Late payment auto-matched to the expired checkout and credited." }
      ]
    },
    {
      id: "E10",
      priority: "P1",
      name: "Form validation",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Payer opens checkout and submits without name or country. Inline errors appear; cannot proceed. (Demo: use the form on S1.)" }
      ]
    },
    {
      id: "E11",
      priority: "P1",
      name: "List volume states",
      paymentId: null,
      events: [
        { type: "note", text: "Toggle the merchant list volume in the demo bar: 0 rows, one row, 200 rows." },
        { type: "volume", value: 0 },
        { type: "volume", value: 1 },
        { type: "volume", value: 200 }
      ]
    },
    {
      id: "E12",
      priority: "P2",
      name: "Wrong network or unsupported asset",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Payer sends 136,147.04 USDT on ERC-20, but the checkout was for TRC-20." },
        { type: "send", sc: 136147.04, status: "detected", wrongNetwork: "ERC-20 (Ethereum)" },
        { type: "advance", status: "needsManual", text: "Not credited automatically; guidance shown to payer, merchant sees Needs manual review." }
      ]
    },
    {
      id: "E13",
      priority: "P2",
      name: "Split view",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "Enable split view in the demo bar to watch two seats side by side. AED 1,200,000 instalment sent and flagged." },
        { type: "send", sc: 326752.89, status: "detected" },
        { type: "advance", status: "checks" },
        { type: "flag", status: "held", category: "Payment is above the review threshold", internal: "Enhanced due diligence threshold", note: "Instalment above the review threshold.", deadlineHours: 24 }
      ]
    }
  ];

  window.GATE_SCENARIOS = {
    list: SCENARIOS,
    byId: function (id) {
      for (var i = 0; i < SCENARIOS.length; i++) if (SCENARIOS[i].id === id) return SCENARIOS[i];
      return null;
    }
  };
})();
