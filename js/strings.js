/* Gate Prototype — all user-facing strings (R1.5).
 * Compliance-safe wording: payers and merchants never see screening results,
 * risk scores or internal reasons — only merchant-safe reason categories. */
(function () {
  "use strict";

  window.GATE_STRINGS = {
    brand: "Gate",
    brandTag: "Prototype",
    protoLabel: "Prototype · illustrative data",
    demoAddressLabel: "Demo address. Do not send funds.",
    buyerVerified: "Buyer verified",

    seats: { payer: "Payer", merchant: "Merchant", compliance: "Compliance" },

    demoBar: {
      title: "Demo controls",
      seat: "Seat",
      scenario: "Scenario",
      next: "Next event",
      back: "Back",
      reset: "Reset",
      advanceHour: "Advance 1 hour",
      advanceDay: "Advance 1 day",
      splitView: "Split view",
      listVolume: "Merchant list volume",
      vol0: "Empty (0 rows)",
      vol1: "One row",
      vol200: "200 rows",
      clock: "Demo clock",
      keys: "Keys: 1/2/3 seat · → next · R reset",
      collapsed: "Demo bar"
    },

    // S1 Payer checkout
    checkout: {
      title: "Pay your instalment",
      merchant: "Merchant",
      project: "Project",
      reference: "Reference",
      forLabel: "What this is for",
      amountDue: "Amount due",
      chooseAsset: "Select stablecoin",
      chooseNetwork: "Network",
      yourName: "Your full name",
      yourCountry: "Your country",
      nameRequired: "Enter your full name",
      countryRequired: "Select your country",
      continueBtn: "Show payment details",
      exactAmount: "Amount to send",
      sendTo: "Send to",
      qr: "QR placeholder (not scannable)",
      warnings: [
        "Send only {asset} on {network}.",
        "Send the exact amount shown. The link is matched by amount.",
        "Exchange withdrawal fees can cause a shortfall."
      ],
      expiryCountdown: "Link expires in {time}",
      noExpiry: "No expiry, pay in instalments to this address",
      kycBadge: "Buyer verified",
      backToForm: "Change details"
    },

    // S2 Payer status
    status: {
      title: "Payment status",
      timeline: ["Detected", "Checks", "Confirmed"],
      variants: {
        paid: {
          headline: "Payment received",
          receipt: "Receipt",
          amountSent: "Amount sent",
          amountApplied: "Amount applied",
          time: "Time"
        },
        partial: {
          headline: "Partially paid",
          received: "Amount received",
          remaining: "Amount remaining",
          keepPaying: "Keep paying to the same address below until the remaining amount is received."
        },
        review: {
          headline: "Under review",
          body: "Your payment is being checked. A decision is expected by {deadline}.",
          whatNext: "You will be contacted if anything is needed."
        },
        action: {
          headline: "Action needed",
          body: "Please provide the information requested below so we can continue.",
          request: "Information requested",
          uploadBtn: "Upload documents (simulated)",
          uploadDone: "Information received"
        },
        overpaid: {
          headline: "Payment received",
          surplus: "Amount received exceeds the request by {amount}. The surplus will be handled by the merchant."
        },
        returned: {
          headline: "Payment returned",
          body: "This payment could not be accepted and has been returned to the sending wallet.",
          returned: "Amount returned",
          fee: "Network fee deducted"
        },
        frozen: {
          headline: "Payment pending",
          body: "This payment cannot be released at this time. Our team will contact you if anything is needed."
        },
        expired: {
          headline: "Link expired",
          body: "This payment link has expired. Please ask the merchant for a new link."
        },
        needsManual: {
          headline: "Needs manual review",
          body: "The payment was sent on a network that is not expected for this link. Please contact the merchant for guidance."
        }
      }
    },

    // S3 Merchant payments list
    merchant: {
      paymentsTitle: "Payments",
      tiles: {
        collected: "Collected this month",
        inReview: "In review",
        actionNeeded: "Action needed"
      },
      table: {
        ref: "Reference",
        customer: "Project / customer",
        payer: "Payer",
        requested: "Requested",
        received: "Received",
        credited: "Credited (fiat)",
        status: "Status",
        age: "Age"
      },
      filters: { all: "All", placeholder: "Search by reference…" },
      empty: "No payments yet. New checkouts will appear here.",
      emptyHint: "Waiting for the first payment on this account.",
      openCase: "Open",
      heldCountdown: "Decision due in {time}",
      overdue: "Overdue"
    },

    // S4 Merchant payment detail
    detail: {
      breakdown: "Breakdown",
      requested: "Requested (fiat)",
      received: "Received (stablecoin)",
      rate: "Rate",
      fee: "Gate fee",
      credited: "Credited (fiat)",
      shortfall: "Shortfall (within tolerance)",
      surplus: "Surplus",
      timeline: "Activity",
      hold: {
        title: "Payment on hold",
        dueBy: "Decision due by",
        reasonCategory: "Reason (merchant-safe)",
        needed: "What is needed and from whom",
        outcomes: "Possible outcomes",
        outcomeList: [
          "Approved and released to your balance",
          "Information requested from the payer",
          "Declined and returned to the sender",
          "Frozen until further notice"
        ],
        reminder: "Send payer a reminder",
        reminderSent: "Reminder sent (simulated)",
        contact: "Contact compliance",
        contactSent: "Message sent to compliance (simulated)",
        escalation: "This hold has passed its decision deadline. Compliance has been notified of the escalation."
      },
      underpaid: { remaining: "Remaining", topUp: "Copy top-up link", topUpCopied: "Top-up link copied (simulated)" },
      overpaid: {
        surplusLine: "Surplus {amount}",
        apply: "Apply to next instalment",
        refund: "Refund the surplus",
        applied: "Surplus applied to next instalment",
        refunded: "Surplus refunded"
      },
      late: { notice: "Late payment matched", detail: "Arrived after the link expired on {expiry}; matched automatically to this checkout." }
    },

    // S5 Compliance case
    compliance: {
      title: "Compliance case",
      queue: "Open holds (by SLA)",
      overdue: "overdue",
      timeLeft: "{time} left",
      paymentFacts: "Payment facts",
      payer: "Payer",
      country: "Country",
      wallet: "Wallet",
      walletHistory: "Wallet history",
      walletHistoryExample: "Previous instalment from this wallet cleared on {date}",
      screening: "Screening summary (illustrative)",
      internalTimeline: "Internal timeline",
      actions: {
        approve: "Approve and release",
        request: "Request information",
        decline: "Decline and refund",
        freeze: "Freeze"
      },
      dialog: {
        title: "{action}",
        internalReason: "Internal reason (analyst only)",
        note: "Note",
        noteRequired: "A note is required.",
        reasonRequired: "Choose a reason.",
        preview: "Preview — what will be shown",
        merchantPreview: "Merchant sees",
        payerPreview: "Payer sees",
        confirm: "Confirm",
        cancel: "Cancel"
      },
      done: {
        approve: "Payment approved and released. The payer now sees Paid; the merchant sees the credited amount.",
        request: "Information requested from the payer. The payer now sees Action needed.",
        decline: "Payment declined and refunded. The payer sees Returned; the merchant sees Declined and refunded.",
        freeze: "Payment frozen. Payer and merchant see neutral wording; no reason is shown."
      }
    },

    // Status labels per seat (used by chips)
    statusLabels: {
      pending:     { payer: "Awaiting payment",    merchant: "Open",              compliance: "Open" },
      detected:    { payer: "Detected",            merchant: "Payment detected",  compliance: "Detected" },
      checks:      { payer: "Checks running",      merchant: "Checks running",    compliance: "Screening" },
      confirmed:   { payer: "Confirmed",           merchant: "Confirmed",         compliance: "Confirmed" },
      paid:        { payer: "Paid",                merchant: "Credited",          compliance: "Cleared" },
      partial:     { payer: "Partially paid",      merchant: "Partially paid",    compliance: "Partial" },
      held:        { payer: "Under review",        merchant: "On hold",           compliance: "On hold" },
      overdueHeld: { payer: "Under review",        merchant: "Checks running",   compliance: "Overdue — awaiting review" },
      action:      { payer: "Action needed",       merchant: "Action needed",     compliance: "Info requested" },
      overpaid:    { payer: "Overpaid",            merchant: "Overpaid",          compliance: "Overpaid" },
      declined:    { payer: "Returned",            merchant: "Declined and refunded", compliance: "Declined" },
      frozen:      { payer: "Pending",             merchant: "Frozen",            compliance: "Frozen" },
      expired:     { payer: "Expired",             merchant: "Expired",           compliance: "Expired" },
      needsManual: { payer: "Needs manual review", merchant: "Needs manual review", compliance: "Needs review" }
    }
  };
})();
