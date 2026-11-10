/* Gate Prototype — scenarios (R1.2, followup §6).
 * A scenario is data: an ordered list of events. Adding one = one new entry.
 *
 * Phase 2: every event that changes state carries `ops`, a small declarative
 * program the store executes against the transaction-level model. The legacy
 * `type` and `status` fields stay on each event so the demo bar keeps
 * dispatching through GATE_DEMO.applyEvent unchanged; the store reads `ops`
 * when replaying a scenario step. Amounts are the handoff's check values.
 *
 * Ops used below:
 *   tx        add or update a transaction (amount, status, confirmations...)
 *   txStatus  change a transaction's lifecycle/screening state
 *   hold      put a transaction in review and post its ledger line
 *   credit    clear a transaction: fee + available ledger, re-derive
 *   freeze    freeze a transaction: frozen ledger, neutral external status
 *   refund    refund a transaction in stablecoin (received - 2.00 fee)
 *   case      open a screening case on a transaction
 *   requestInfo  move a case to information requested
 *   decideCase   record a Compliance decision
 *   overdue   mark a case past its deadline
 *   ledger    append an arbitrary ledger line
 *   event     emit a merchant-facing event (external status only)
 *   status    set the payment's external/legacy status and timeline
 *   applyToInstalment  apply part of a duplicate payment to the next one
 *
 * Event payloads never carry an internal reason, risk score or screening
 * result. Internal reasons live on cases only.
 */
(function () {
  "use strict";

  function grp(s) {
    return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function usdt(n) { return grp(Number(n).toFixed(2)) + " USDT"; }
  function aed(n) { return "AED " + grp(Number(n).toFixed(2)); }

  var SCENARIOS = [
    {
      id: "H1",
      priority: "P0",
      name: "Happy path: exact payment clears",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Payer opens the reserved-address checkout (no expiry). Sends 136,147.04 USDT on TRC-20." },
        {
          type: "send", sc: 136147.04, status: "detected",
          ops: [
            { op: "tx", id: "TX-1001-1", amountSc: 136147.04, status: "detected", screeningState: "pending", confirmations: 3, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(136147.04) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(136147.04) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected on TRC-20; 3 of 19 confirmations.", externalText: "Payment detected. Confirming on TRC-20." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1001-1", status: "checks", screeningState: "pending", confirmations: 12 },
            { op: "status", value: "checks", text: "Confirming 12 of 19; screening in progress.", externalText: "Confirming 12 of 19." }
          ]
        },
        {
          type: "advance", status: "paid",
          ops: [
            { op: "credit", id: "TX-1001-1" },
            { op: "event", name: "payment.confirmed", amounts: { received: usdt(136147.04), confirmations: "19 of 19" }, status: "confirmed" },
            { op: "event", name: "payment.credited", amounts: { received: usdt(136147.04), credited: aed(495000) }, status: "paid" },
            { op: "status", value: "paid", text: "19 of 19 confirmations; converted and credited.", externalText: "Payment received. Instalment 2 is paid.", scheduleStatus: "paid" }
          ]
        }
      ]
    },

    {
      id: "E1",
      priority: "P0",
      name: "Underpaid, then topped up",
      paymentId: "P-1002",
      events: [
        { type: "note", text: "AED 250,000 due (68,073.52 USDT). Payer sends 60,000.00 USDT on TRC-20." },
        {
          type: "send", sc: 60000.00, status: "detected",
          ops: [
            { op: "tx", id: "TX-1002-1", amountSc: 60000.00, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(68073.52) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(60000.00) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1002-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "advance", status: "partial",
          ops: [
            { op: "credit", id: "TX-1002-1" },
            { op: "event", name: "payment.partially_paid", amounts: { received: usdt(60000.00), remaining: usdt(8073.52), credited: aed(218146.50) }, status: "partial" },
            { op: "status", value: "partial", text: "Underpaid; AED 218,146.50 credited, 8,073.52 USDT remaining.", externalText: "Partially paid — 8,073.52 USDT remaining." }
          ]
        },
        { type: "note", text: "Later the payer sends the remainder: 8,073.52 USDT to the same address." },
        {
          type: "send", sc: 8073.52, status: "partial",
          ops: [
            { op: "tx", id: "TX-1002-2", amountSc: 8073.52, status: "cleared", screeningState: "clear", confirmations: 19, walletType: "own" },
            { op: "credit", id: "TX-1002-2" },
            { op: "event", name: "payment.credited", amounts: { received: usdt(8073.52), credited: aed(247500) }, status: "paid" },
            { op: "status", value: "paid", text: "Full amount received; AED 247,500.00 credited.", externalText: "Paid in full." }
          ]
        }
      ]
    },

    {
      id: "E2",
      priority: "P0",
      name: "Third-party payer: information requested, approved",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "AED 1,200,000 due (326,752.89 USDT). Payer answers \"No, I am paying for the buyer\" (relationship: parent) and sends from their own wallet." },
        {
          type: "send", sc: 326752.89, status: "detected",
          ops: [
            { op: "tx", id: "TX-1003-1", amountSc: 326752.89, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(326752.89) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(326752.89) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations. Buyer answer: No (parent).", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1003-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress; third-party payer route.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "flag", status: "held",
          ops: [
            { op: "hold", id: "TX-1003-1" },
            { op: "case", txId: "TX-1003-1", internalReason: "Enhanced due diligence threshold", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(326752.89) }, status: "in_review" },
            { op: "status", value: "held", text: "Held: third-party payer and instalment above the review threshold.", category: "Payment is above the review threshold", deadlineHours: 24, internal: "Enhanced due diligence threshold", note: "Third-party payer (parent); wallet history consistent with the prior cleared instalment.", externalText: "In review. Decision expected by the date shown." }
          ]
        },
        {
          type: "requestInfo", status: "action",
          ops: [
            { op: "requestInfo", txId: "TX-1003-1", info: "Proof of relationship to the buyer (parent) and evidence of source of funds." },
            { op: "event", name: "payment.information_requested", amounts: { received: usdt(326752.89) }, status: "information_requested" },
            { op: "status", value: "action", text: "Information requested from the payer.", externalText: "Information needed to release this payment." }
          ]
        },
        { type: "note", text: "Payer uploads proof of relationship and source-of-funds documents (simulated)." },
        {
          type: "advance", status: "action",
          ops: [
            { op: "status", value: "action", text: "Payer uploaded the requested documents (simulated).", infoProvided: true, externalText: "Documents received. Review continues." }
          ]
        },
        {
          type: "approve", status: "paid",
          ops: [
            { op: "credit", id: "TX-1003-1" },
            { op: "decideCase", txId: "TX-1003-1", action: "approve", internalReason: "Enhanced due diligence threshold", note: "Relationship and source of funds confirmed." },
            { op: "event", name: "payment.credited", amounts: { received: usdt(326752.89), credited: aed(1188000) }, status: "paid" },
            { op: "status", value: "paid", text: "Approved by Compliance; AED 1,188,000.00 credited.", externalText: "Payment received." }
          ]
        }
      ]
    },

    {
      id: "E3",
      priority: "P1",
      name: "Declined, refunded to an address in the payer's own account",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "AED 1,200,000 (326,752.89 USDT) arrived from an exchange account, not the payer's own wallet." },
        {
          type: "send", sc: 326752.89, status: "detected",
          ops: [
            { op: "tx", id: "TX-1003-1", amountSc: 326752.89, status: "detected", screeningState: "pending", confirmations: 19, walletType: "exchange" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(326752.89) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(326752.89), wallet_type: "exchange" }, status: "detected" },
            { op: "status", value: "detected", text: "Detected from an exchange wallet; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1003-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "flag", status: "held",
          ops: [
            { op: "hold", id: "TX-1003-1" },
            { op: "case", txId: "TX-1003-1", internalReason: "Payer name mismatch", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(326752.89) }, status: "in_review" },
            { op: "status", value: "held", text: "Held: payer name does not match the account on file.", category: "Sending wallet needs verification", deadlineHours: 24, internal: "Payer name mismatch", note: "Exchange wallet; name on file does not match the payer details.", externalText: "In review. Decision expected by the date shown." }
          ]
        },
        {
          type: "decline", status: "declined",
          ops: [
            { op: "decideCase", txId: "TX-1003-1", action: "decline", internalReason: "Payer name mismatch", note: "Details not confirmed after reminder; returning funds." },
            { op: "status", value: "declined", text: "Compliance declined. Refund address requested in the payer's own exchange account.", externalText: "Returned to the sending wallet.", refundAddressRequired: true }
          ]
        },
        {
          type: "advance", status: "declined",
          ops: [
            { op: "refund", id: "TX-1003-1", amountSc: 326750.89 },
            { op: "event", name: "payment.refunded", amounts: { received: usdt(326752.89), refunded: usdt(326750.89), network_fee: usdt(2.00) }, status: "refunded" },
            { op: "status", value: "declined", text: "Refunded 326,750.89 USDT (326,752.89 less the 2.00 network fee) to an address in the payer's own account.", externalText: "Refunded to an address in your own exchange account.", refundAddress: "TDEMO00000000000000000000000000000", refundAddressRequired: false }
          ]
        }
      ]
    },

    {
      id: "E4",
      priority: "P1",
      name: "Frozen: neutral wording, no reason",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 (27,229.41 USDT) sent on TRC-20." },
        {
          type: "send", sc: 27229.41, status: "detected",
          ops: [
            { op: "tx", id: "TX-1004-1", amountSc: 27229.41, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(27229.41) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(27229.41) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1004-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "flag", status: "held",
          ops: [
            { op: "hold", id: "TX-1004-1" },
            { op: "case", txId: "TX-1004-1", internalReason: "Screening alert: indirect exposure", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(27229.41) }, status: "in_review" },
            { op: "status", value: "held", text: "Held: screening alert on indirect exposure.", category: "Additional checks on the source of funds", deadlineHours: 24, internal: "Screening alert: indirect exposure", note: "Indirect exposure flagged by screening; holding while reviewed.", externalText: "In review. Decision expected by the date shown." }
          ]
        },
        {
          type: "freeze", status: "frozen",
          ops: [
            { op: "freeze", id: "TX-1004-1" },
            { op: "decideCase", txId: "TX-1004-1", action: "freeze", internalReason: "Screening alert: indirect exposure", note: "Funds frozen pending further review." },
            { op: "event", name: "payment.cannot_be_released", amounts: { received: usdt(27229.41) }, status: "cannot_be_released" },
            { op: "status", value: "frozen", text: "Frozen pending further review; no merchant action.", externalText: "This payment cannot be released at this time. Our team will contact you if anything is needed." }
          ]
        }
      ]
    },

    {
      id: "E5",
      priority: "P1",
      name: "Overpaid: surplus shown, then refunded",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 due (27,229.41 USDT). Payer sends 27,500.00 USDT from an exchange account." },
        {
          type: "send", sc: 27500.00, status: "detected",
          ops: [
            { op: "tx", id: "TX-1004-1", amountSc: 27500.00, status: "detected", screeningState: "pending", confirmations: 19, walletType: "exchange" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(27229.41) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(27500.00), wallet_type: "exchange" }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1004-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "advance", status: "overpaid",
          ops: [
            { op: "credit", id: "TX-1004-1" },
            { op: "event", name: "payment.overpaid", amounts: { received: usdt(27500.00), credited: aed(99000), surplus: usdt(270.59) }, status: "overpaid" },
            { op: "status", value: "overpaid", text: "Full request covered; surplus 270.59 USDT. Payer sent from an exchange, so a refund address in their own account is required.", externalText: "Overpaid by 270.59 USDT. Apply it to the next instalment or refund it.", surplusRefundPending: true, refundAddressRequired: true }
          ]
        },
        {
          type: "advance", status: "paid",
          ops: [
            { op: "ledger", type: "refund", amountAED: 973.74, extra: { amountSc: 268.59, asset: "USDT", note: "Surplus refunded in USDT (270.59 less 2.00 fee)" } },
            { op: "event", name: "payment.refunded", amounts: { surplus: usdt(270.59), refunded: usdt(268.59), network_fee: usdt(2.00) }, status: "refunded" },
            { op: "status", value: "paid", text: "Surplus 270.59 USDT refunded to an address in the payer's own exchange account (268.59 after the 2.00 fee).", externalText: "Surplus refunded to your own exchange account.", surplusRefunded: true, surplusRefundPending: false, refundAddress: "TDEMO00000000000000000000000000000", refundAddressRequired: false }
          ]
        }
      ]
    },

    {
      id: "E6",
      priority: "P1",
      name: "Shortfall within tolerance",
      paymentId: "P-1002",
      events: [
        { type: "note", text: "AED 250,000 due (68,073.52 USDT). Payer sends 68,048.52 USDT (25.00 short)." },
        {
          type: "send", sc: 68048.52, status: "detected",
          ops: [
            { op: "tx", id: "TX-1002-1", amountSc: 68048.52, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(68073.52) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(68048.52) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1002-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "advance", status: "paid",
          ops: [
            { op: "credit", id: "TX-1002-1" },
            { op: "event", name: "payment.credited", amounts: { received: usdt(68048.52), shortfall: usdt(25.00), credited: aed(247409.11) }, status: "paid" },
            { op: "status", value: "paid", text: "Shortfall 25.00 USDT is within tolerance (0.5% and 50.00 USDT). Auto-accepted as Paid; credited on the amount received.", externalText: "Paid. A 25.00 USDT shortfall was accepted." }
          ]
        }
      ]
    },

    {
      id: "E7",
      priority: "P1",
      name: "Hold passes its deadline",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "AED 1,200,000 instalment sent; flagged on review." },
        {
          type: "send", sc: 326752.89, status: "detected",
          ops: [
            { op: "tx", id: "TX-1003-1", amountSc: 326752.89, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(326752.89) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(326752.89) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1003-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "flag", status: "held",
          ops: [
            { op: "hold", id: "TX-1003-1" },
            { op: "case", txId: "TX-1003-1", internalReason: "Enhanced due diligence threshold", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(326752.89) }, status: "in_review" },
            { op: "status", value: "held", text: "Held: instalment above the review threshold.", category: "Payment is above the review threshold", deadlineHours: 24, internal: "Enhanced due diligence threshold", note: "Instalment above the review threshold.", externalText: "In review. Decision expected by the date shown." }
          ]
        },
        {
          type: "advanceClock", hours: 25, status: "overdueHeld",
          ops: [
            { op: "overdue", txId: "TX-1003-1" },
            { op: "status", value: "overdueHeld", text: "24-hour decision deadline passed; case escalated and marked overdue.", externalText: "Decision overdue — escalated to Compliance." }
          ]
        }
      ]
    },

    {
      id: "E8",
      priority: "P1",
      name: "Pooled link expires unpaid",
      paymentId: "P-1005",
      events: [
        { type: "note", text: "Broker deposit USD 500 (1,836.25 AED). Pooled link with a 15-minute timer. No payment arrives." },
        {
          type: "advanceClock", minutes: 15, status: "expired",
          ops: [
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(500.00) }, status: "pending" },
            { op: "event", name: "payment.expired", amounts: { amount_due: usdt(500.00) }, status: "expired" },
            { op: "status", value: "expired", text: "Pooled timer ran out; address returned to the pool.", expired: true, externalText: "This link has expired. Ask the merchant for a new one." }
          ]
        }
      ]
    },

    {
      id: "E9",
      priority: "P1",
      name: "Late payment after expiry",
      paymentId: "P-1005",
      events: [
        { type: "note", text: "Broker deposit USD 500. Pooled timer (15 min) runs out — link expires." },
        {
          type: "advanceClock", minutes: 15, status: "expired",
          ops: [
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(500.00) }, status: "pending" },
            { op: "event", name: "payment.expired", amounts: { amount_due: usdt(500.00) }, status: "expired" },
            { op: "status", value: "expired", text: "Pooled timer ran out; address returned to the pool.", expired: true, externalText: "This link has expired. Ask the merchant for a new one." }
          ]
        },
        { type: "note", text: "Four minutes later, 500.00 USDT arrives to the same address." },
        { type: "advanceClock", minutes: 4 },
        {
          type: "send", sc: 500.00, status: "expired", late: true,
          ops: [
            { op: "tx", id: "TX-1005-1", amountSc: 500.00, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(500.00), matched_to_expired: "true" }, status: "detected" },
            { op: "status", value: "expired", late: true, text: "Payment arrived after expiry; matching to the expired checkout.", externalText: "Payment detected after expiry. Matching it now." }
          ]
        },
        {
          type: "advance", status: "paid",
          ops: [
            { op: "credit", id: "TX-1005-1" },
            { op: "event", name: "payment.late_matched", amounts: { received: usdt(500.00), credited: aed(1831.66) }, status: "paid" },
            { op: "status", value: "paid", text: "Late payment auto-matched to the expired checkout and credited.", externalText: "Late payment matched and credited." }
          ]
        }
      ]
    },

    {
      id: "E10",
      priority: "P1",
      name: "Form validation",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Payer opens checkout and submits without the buyer question, relationship (when the answer is No) or sending-from. Inline errors appear; cannot proceed. (Demo: use the form on S1.)" }
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
        {
          type: "send", sc: 136147.04, status: "detected", wrongNetwork: "ERC-20 (Ethereum)",
          ops: [
            { op: "tx", id: "TX-1001-1", amountSc: 136147.04, status: "detected", screeningState: "pending", confirmations: 12, network: "ERC-20 (Ethereum)", walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(136147.04) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(136147.04), network: "ERC-20 (Ethereum)" }, status: "detected" },
            { op: "status", value: "detected", text: "Detected on ERC-20 but the checkout expects TRC-20.", wrongNetwork: "ERC-20 (Ethereum)", externalText: "Payment detected on a different network. Do not send again." }
          ]
        },
        {
          type: "advance", status: "needsManual",
          ops: [
            { op: "txStatus", id: "TX-1001-1", status: "needs_manual", screeningState: "pending", confirmations: 12 },
            { op: "status", value: "needsManual", text: "Wrong network; not credited automatically. Merchant sees Needs manual review; payer sees guidance.", wrongNetwork: "ERC-20 (Ethereum)", externalText: "Needs manual review. We will contact you with next steps." }
          ]
        }
      ]
    },

    {
      id: "E13",
      priority: "P2",
      name: "Split view",
      paymentId: "P-1003",
      events: [
        { type: "note", text: "Enable split view in the demo bar to watch two seats side by side. AED 1,200,000 instalment sent and flagged." },
        {
          type: "send", sc: 326752.89, status: "detected",
          ops: [
            { op: "tx", id: "TX-1003-1", amountSc: 326752.89, status: "detected", screeningState: "pending", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(326752.89) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(326752.89) }, status: "detected" },
            { op: "status", value: "detected", text: "Detected; 19 of 19 confirmations.", externalText: "Payment detected." }
          ]
        },
        {
          type: "advance", status: "checks",
          ops: [
            { op: "txStatus", id: "TX-1003-1", status: "checks", screeningState: "pending", confirmations: 19 },
            { op: "status", value: "checks", text: "Screening in progress.", externalText: "Checks in progress." }
          ]
        },
        {
          type: "flag", status: "held",
          ops: [
            { op: "hold", id: "TX-1003-1" },
            { op: "case", txId: "TX-1003-1", internalReason: "Enhanced due diligence threshold", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(326752.89) }, status: "in_review" },
            { op: "status", value: "held", text: "Held: instalment above the review threshold.", category: "Payment is above the review threshold", deadlineHours: 24, internal: "Enhanced due diligence threshold", note: "Instalment above the review threshold.", externalText: "In review. Decision expected by the date shown." }
          ]
        }
      ]
    },

    {
      id: "E15",
      priority: "P0",
      name: "Top-up while part is held",
      paymentId: "P-1015",
      events: [
        { type: "note", text: "AED 250,000 due (68,073.52 USDT). Payer sends 60,000.00 USDT; screening holds it." },
        {
          type: "send", sc: 60000.00, status: "held",
          ops: [
            { op: "tx", id: "TX-1015-1", amountSc: 60000.00, status: "in_review", screeningState: "in_review", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(68073.52) }, status: "pending" },
            { op: "hold", id: "TX-1015-1" },
            { op: "case", txId: "TX-1015-1", internalReason: "Enhanced due diligence threshold", externalStatus: "in_review", deadlineHours: 24 },
            { op: "event", name: "payment.in_review", amounts: { received: usdt(60000.00) }, status: "in_review" },
            { op: "status", value: "held", text: "First transaction held for review: 60,000.00 USDT.", category: "Additional checks on the source of funds", deadlineHours: 24, internal: "Enhanced due diligence threshold", note: "Top-up expected while the first transaction is in review.", externalText: "Part of this payment is in review. Nothing is needed from the payer." }
          ]
        },
        {
          type: "send", sc: 8073.52, status: "held",
          ops: [
            { op: "tx", id: "TX-1015-2", amountSc: 8073.52, status: "cleared", screeningState: "clear", confirmations: 19, walletType: "own" },
            { op: "credit", id: "TX-1015-2" },
            { op: "event", name: "payment.partially_paid", amounts: { received: usdt(8073.52), credited: aed(29353.50), in_review: usdt(60000.00) }, status: "partially_credited_in_review" },
            { op: "status", value: "held", text: "Second transaction cleared. AED 29,353.50 credited (29,650.00 less 296.50); 60,000.00 USDT still in review.", externalText: "Partially credited, part in review.", externalStatus: "partially_credited_in_review" }
          ]
        },
        {
          type: "approve", status: "paid",
          ops: [
            { op: "credit", id: "TX-1015-1" },
            { op: "decideCase", txId: "TX-1015-1", action: "approve", internalReason: "Enhanced due diligence threshold", note: "Source of funds confirmed; releasing the held transaction." },
            { op: "event", name: "payment.credited", amounts: { credited: aed(247500), released: aed(218146.50) }, status: "paid" },
            { op: "status", value: "paid", text: "Held transaction approved. AED 218,146.50 released; total credited AED 247,500.00.", externalText: "Payment received in full." }
          ]
        }
      ]
    },

    {
      id: "E16",
      priority: "P2",
      name: "Checks slow (screening provider delayed)",
      paymentId: "P-1004",
      events: [
        { type: "note", text: "AED 100,000 (27,229.41 USDT) sent. The screening provider is delayed; no case is opened." },
        {
          type: "send", sc: 27229.41, status: "checks",
          ops: [
            { op: "tx", id: "TX-1004-1", amountSc: 27229.41, status: "checks", screeningState: "pending", confirmations: 6, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(27229.41) }, status: "pending" },
            { op: "event", name: "payment.detected", amounts: { received: usdt(27229.41) }, status: "detected" },
            { op: "status", value: "checks", text: "Screening provider delayed; merchant banner set, no case opened.", checksDelayed: true, externalText: "Checks are taking longer than usual. Nothing is needed from you.", merchantBanner: "Checks delayed" }
          ]
        },
        {
          type: "advanceClock", hours: 2, status: "paid",
          ops: [
            { op: "credit", id: "TX-1004-1" },
            { op: "event", name: "payment.credited", amounts: { received: usdt(27229.41), credited: aed(99000) }, status: "paid" },
            { op: "status", value: "paid", text: "Screening cleared after the provider recovered; AED 99,000.00 credited.", checksDelayed: false, externalText: "Payment received." }
          ]
        }
      ]
    },

    {
      id: "E17",
      priority: "P2",
      name: "Instalment paid twice",
      paymentId: "P-1001",
      events: [
        { type: "note", text: "Unit 1204 instalment 2 (136,147.04 USDT) was already paid. A second payment of the same amount arrives." },
        {
          type: "send", sc: 136147.04, status: "overpaid",
          ops: [
            { op: "tx", id: "TX-1001-1", amountSc: 136147.04, status: "cleared", screeningState: "clear", confirmations: 19, walletType: "own" },
            { op: "event", name: "payment.created", amounts: { amount_due: usdt(136147.04) }, status: "pending" },
            { op: "credit", id: "TX-1001-1" },
            { op: "tx", id: "TX-1001-2", amountSc: 136147.04, status: "cleared", screeningState: "clear", confirmations: 19, walletType: "own" },
            { op: "credit", id: "TX-1001-2" },
            { op: "event", name: "payment.overpaid", amounts: { received: usdt(136147.04), credited: aed(495000), surplus: usdt(136147.04) }, status: "overpaid" },
            { op: "status", value: "overpaid", text: "Instalment 2 paid twice; 136,147.04 USDT surplus. Merchant can apply it to instalment 3.", externalText: "Paid twice. The extra payment can be applied to the next instalment.", scheduleStatus: "paid" }
          ]
        },
        {
          type: "advance", status: "paid",
          ops: [
            { op: "applyToInstalment", from: "P-1001", to: "P-1002", amountSc: 68073.52, txId: "TX-1002-1" },
            { op: "status", value: "paid", text: "Applied 68,073.52 USDT of the duplicate to instalment 3 (P-1002); schedule updated.", externalText: "Extra payment applied to instalment 3.", scheduleStatus: "paid", surplusAppliedSc: 68073.52, surplusRemainingSc: 68073.52 }
          ]
        }
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
