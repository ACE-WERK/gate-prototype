/* Gate Prototype — all user-facing strings (R1.5).
 * Compliance-safe wording: payers and merchants never see screening results,
 * risk scores or internal reasons — only merchant-safe reason categories.
 *
 * Phase 3a: Travel Rule, address safety, instalment schedule, on-chain
 * lifecycle, refund and ledger/event copy added. All times are labelled
 * GST (UTC+4) by the screens that render them. */
(function () {
  "use strict";

  window.GATE_STRINGS = {
    brand: "Gate",
    brandTag: "Prototype",
    protoLabel: "Prototype · illustrative data",
    demoAddressLabel: "Demo address. Do not send funds.",
    buyerVerified: "Buyer verified",

    /* The demo bar still renders a seat per key. Compliance is a demo-bar
     * panel in phase 3b, not a seat; removing the key here would print
     * "undefined" until demo-bar.js changes. */
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
      backToForm: "Change details",
      payerDetails: "Payer details",
      relationshipRequired: "Choose a relationship to the buyer.",
      sendingFromRequired: "Choose where you are sending from.",
      sendingFromHint: "This tells Gate what information to collect.",
      viewStatus: "View payment status",
      summary: "Your details",
      buyerAnswer: "Buyer on the sale agreement",
      buyerYesShort: "Buyer",
      buyerNoShort: "Paying for the buyer",
      sendingFromShort: "Sending from"
    },

    // S2 Payer status
    status: {
      title: "Payment status",
      slowChecks: "Checks are taking longer than usual. Nothing is needed from you.",
      timeline: ["Detected", "Checks", "Confirmed"],
      onchain: {
        title: "On-chain progress",
        steps: ["Detected", "Confirming", "Checks", "Converted", "Credited"],
        confirming: "Confirming ({n} of {total})",
        elapsed: "Elapsed {time}",
        awaiting: "Waiting for the first transaction on this payment.",
        waiting: "GST (UTC+4)"
      },
      variants: {
        paid: {
          headline: "Payment received",
          receipt: "Receipt",
          amountSent: "Amount sent",
          amountApplied: "Amount applied",
          time: "Time",
          credited: "Credited to the merchant"
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
          whatNext: "You will be contacted if anything is needed.",
          slow: "Checks are taking longer than usual. Nothing is needed from you."
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
          surplus: "Amount received exceeds the request by {amount}. The merchant will apply it to the next instalment or refund it."
        },
        returned: {
          headline: "Payment returned",
          body: "This payment could not be accepted and has been returned to the sending wallet.",
          returned: "Amount returned",
          fee: "Network fee deducted",
          sentOwn: "Refund sent to your sending address.",
          sentTo: "Refund sent to {address}.",
          rescreening: "The sending address is screened again before the refund is sent."
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
        available: "Available",
        inReview: "In review",
        collected: "Collected this month",
        availableHint: "Excludes in-review and frozen amounts",
        inReviewHint: "AED equivalent at the current rate",
        collectedHint: "Credited this calendar month (GST)"
      },
      exportCsv: "Export CSV",
      csvDone: "Exported {rows} rows as CSV",
      csvEmpty: "Nothing to export",
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
      overdue: "Overdue",
      txCount: "{n} transactions",
      txSeparator: " · "
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
      paymentDetails: "Payment details",
      backToPayments: "Back to payments",
      transactionsTitle: "Transactions",
      transactionsHint: "Each payment can arrive in several transactions, screened one by one.",
      noTransactions: "No transactions have arrived yet.",
      explorer: "View on explorer",
      explorerTooltip: "Explorer link is illustrative",
      ledgerTitle: "Ledger breakdown",
      rateApplied: "Rate applied",
      rateWaiting: "Not yet applied. Funds convert when released.",
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
        apply: "Apply surplus to the next instalment",
        refund: "Refund the surplus",
        applied: "Surplus applied to the next instalment",
        refunded: "Surplus refunded",
        noNext: "No later instalment on file to apply it to."
      },
      late: { notice: "Late payment matched", detail: "Arrived after the link expired on {expiry}; matched automatically to this checkout." }
    },

    // S5 Compliance case (screen removed in phase 3a; strings kept for the
    // demo-bar compliance panel in phase 3b).
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

    /* --- Phase 1b: transaction model --- */

    // On-chain lifecycle (followup §3.2). confirming takes {n} and {total}.
    transactions: {
      title: "Transactions",
      subtitle: "Each payment can arrive in several transactions, screened one by one.",
      amount: "Amount",
      hash: "Transaction hash",
      network: "Network",
      walletType: "Sent from",
      confirmations: "{n} of {total} confirmations",
      confirming: "Confirming ({n} of {total})",
      status: {
        detected: "Detected",
        confirming: "Confirming",
        checks: "Checks",
        converted: "Converted",
        credited: "Credited",
        cleared: "Cleared",
        held: "In review",
        in_review: "In review",
        frozen: "Cannot be released"
      },
      wallet: { own: "Own wallet", exchange: "Exchange account" },
      splitTitle: "Partially credited, part in review",
      splitBody: "Part of this payment has cleared and been credited. The rest is still being checked."
    },

    // Derived payment status per seat (derive.js vocabulary). Kept separate
    // from statusLabels so legacy screens keep their existing keys.
    derivedStatus: {
      pending: { payer: "Awaiting payment", merchant: "Open", compliance: "Open" },
      paid: { payer: "Paid", merchant: "Credited", compliance: "Cleared" },
      partial: { payer: "Partially paid", merchant: "Partially paid", compliance: "Partial" },
      overpaid: { payer: "Overpaid", merchant: "Overpaid", compliance: "Overpaid" },
      in_review: { payer: "Under review", merchant: "On hold", compliance: "In review" },
      partially_credited_in_review: {
        payer: "Partially credited, part in review",
        merchant: "Partially credited, part in review",
        compliance: "Partially credited, part in review"
      },
      frozen: { payer: "Pending", merchant: "Cannot be released", compliance: "Cannot be released" }
    },

    // Travel Rule questions on S1 (followup §3.3).
    travelRule: {
      heading: "Payer details",
      buyerQuestion: "Are you the buyer named on the sale agreement?",
      yes: "Yes, I am the buyer",
      no: "No, I am paying for the buyer",
      relationshipLabel: "Relationship to the buyer",
      relationships: {
        spouse: "Spouse",
        parent: "Parent",
        company: "The buyer's company",
        other: "Other"
      },
      needsReview: "A No does not block payment. It routes the transaction to review.",
      sendingFrom: "Sending from",
      exchangeOption: "An exchange account",
      ownWallet: "My own wallet",
      ownWalletNote: "Gate may ask you to confirm that you control this wallet.",
      exchangeNote: "Choose the exchange you will withdraw from.",
      thresholdNote: "Travel Rule information is required above AED 3,500 for the UAE entity and for all amounts for the Bahrain entity.",
      required: "Answer this question to continue."
    },

    // Refunds (followup §3.4).
    refund: {
      heading: "Refund address",
      exchangeExplanation: "Payments from exchanges come from the exchange's shared wallet, so we need an address in your own account.",
      addressPrompt: "Refund address in your own exchange account",
      addressPlaceholder: "Paste the address from your exchange account",
      ownWalletNote: "The refund goes back to the wallet that sent the payment, after that wallet is screened again.",
      amountNote: "The {fee} USDT network fee is deducted. No conversion takes place.",
      frozenNeverRefunded: "Frozen funds are never refunded.",
      submit: "Confirm refund address",
      submitted: "Refund address received (simulated)",
      addressRequired: "Enter the refund address from your own exchange account.",
      screeningNote: "Refunds are sent only to an address that passes screening."
    },

    // Compliance decision panel in the demo bar (followup §4.2).
    compliancePanel: {
      title: "Compliance decision (simulated)",
      open: "Open case",
      caseSummary: "Case summary",
      amount: "Amount",
      payer: "Payer",
      country: "Country",
      buyerAnswer: "Buyer answer",
      walletType: "Wallet type",
      screening: "Screening summary (illustrative)",
      walletHistory: "Wallet history",
      actions: {
        approve: "Approve",
        request: "Request information",
        decline: "Decline and refund",
        freeze: "Freeze"
      },
      internalReason: "Internal reason",
      note: "Note",
      notePlaceholder: "Why this decision was taken (analyst only)",
      reasonRequired: "Choose an internal reason.",
      noteRequired: "A note is required.",
      preview: "Preview — what will be shown",
      payerPreview: "Payer sees",
      merchantPreview: "Merchant sees",
      eventPreview: "Event sent",
      caseLabels: {
        internalReason: "Internal reason (analyst only)",
        externalStatus: "External status",
        infoRequested: "Information requested",
        deadline: "Decision deadline",
        decisionLog: "Decision log",
        txId: "Transaction"
      },
      footer: "In the product this is the analyst's case screen. Out of scope for this demo."
    },

    // Merchant-facing events on S4 (followup §3.6).
    events: {
      title: "Events sent to your system",
      subtitle: "The same payloads your integration would receive.",
      signature: "Gate-Signature: demo",
      toggle: "Show events ({n})",
      payload: "Payload",
      empty: "No events yet.",
      viewOnExplorer: "View on explorer",
      explorerDisabled: "Explorer links are disabled in this prototype.",
      explorerTooltip: "Explorer link is illustrative",
      copyPayload: "Copy payload"
    },

    // Address safety (followup §3.7).
    address: {
      copyEveryTime: "Copy the address from this page every time, never from your wallet's history.",
      network: "Network",
      qrLabel: "QR placeholder (not scannable) · {network}",
      groupsHint: "Shown in groups of four. Check the first and last six characters.",
      copied: "Copied {asset} address on {network}",
      copiedShort: "Copied {asset} on {network}",
      copy: "Copy",
      copiedBtn: "Copied",
      copyManual: "Copy manually",
      networkName: { tron: "Tron", ethereum: "Ethereum" },
      networkLabel: { tron: "TRON", ethereum: "ETHEREUM" }
    },

    // Instalment schedule (followup §3.8).
    schedule: {
      title: "Instalment schedule",
      subtitle: "Illustrative schedule for this unit.",
      instalment: "Instalment",
      dueDate: "Due date",
      amount: "Amount due",
      status: "Status",
      paid: "Paid",
      current: "Due now",
      upcoming: "Upcoming",
      reducedBy: "Reduced by {amount} from an applied surplus",
      none: "No instalments on file for this unit.",
      noUnit: "This payment is not linked to a unit."
    },

    // Ledger breakdown (followup §3.5).
    ledger: {
      title: "Ledger breakdown",
      received: "Received (AED equivalent)",
      fee: "Gate fee",
      credited: "Credited to available",
      inReview: "In review",
      refunded: "Refunded",
      frozen: "Frozen",
      empty: "No ledger entries yet."
    },

    // Today versus Proposed (followup §4.3) and time labelling (§3.9).
    view: {
      label: "View",
      today: "Today",
      proposed: "Proposed",
      gst: "GST (UTC+4)"
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
