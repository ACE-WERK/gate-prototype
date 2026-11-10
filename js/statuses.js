/* Gate Prototype — status config (R1.1).
 * Adding a status touches this file and strings.js only. */
(function () {
  "use strict";

  var S = window.GATE_STRINGS;

  /* Chip tones: success, warning, danger, info, neutral.
   * Each status defines: per-seat label (falls back to statusLabels),
   * tone, allowed transitions, which fields are external vs internal. */
  var CONFIG = {
    pending: {
      tone: "neutral",
      next: ["detected"],
      external: ["amountDue", "reference", "expiry"],
      internal: []
    },
    detected: {
      tone: "info",
      next: ["checks", "expired"],
      external: ["amountReceived"],
      internal: ["txHash"]
    },
    checks: {
      tone: "info",
      next: ["confirmed", "held", "expired"],
      external: [],
      internal: ["screening"]
    },
    confirmed: {
      tone: "success",
      next: ["paid", "partial", "overpaid", "held"],
      external: ["amountReceived"],
      internal: ["txHash"]
    },
    paid: {
      tone: "success",
      next: [],
      external: ["amountSent", "amountApplied", "time", "reference"],
      internal: ["txHash", "fee", "rate"]
    },
    partial: {
      tone: "warning",
      next: ["paid", "held", "expired"],
      external: ["amountReceived", "amountRemaining", "address"],
      internal: ["txHash"]
    },
    held: {
      tone: "warning",
      next: ["action", "paid", "declined", "frozen", "overdueHeld"],
      external: ["reasonCategory", "decisionDueBy"],
      internal: ["internalReason", "note", "screening", "txHash"]
    },
    action: {
      tone: "warning",
      next: ["paid", "declined", "frozen"],
      external: ["requestInfo", "decisionDueBy"],
      internal: ["internalReason", "note", "screening"]
    },
    overpaid: {
      tone: "info",
      next: ["paid"],
      external: ["amountReceived", "surplus"],
      internal: []
    },
    declined: {
      tone: "danger",
      next: [],
      external: ["amountReturned", "networkFee"],
      internal: ["internalReason", "note"]
    },
    frozen: {
      tone: "neutral",
      next: [],
      external: ["neutralWording"],
      internal: ["internalReason", "note"]
    },
    expired: {
      tone: "neutral",
      next: ["paid"], // late-payment matching (E9)
      external: ["expiredAt"],
      internal: []
    },
    overdueHeld: {
      tone: "danger",
      next: ["paid", "declined", "frozen"],
      external: ["reasonCategory", "decisionDueBy", "escalation"],
      internal: ["internalReason", "note", "screening"]
    },
    needsManual: {
      tone: "warning",
      next: ["paid", "declined"],
      external: ["guidance"],
      internal: ["txHash", "wrongNetwork"]
    }
  };

  /* Merchant-safe reason categories (external). */
  var REASON_CATEGORIES = [
    "Additional checks on the source of funds",
    "Payer details need confirming",
    "Payment is above the review threshold",
    "Sending wallet needs verification"
  ];

  /* Internal reasons (analyst only). */
  var INTERNAL_REASONS = [
    "Screening alert: indirect exposure",
    "Payer name mismatch",
    "Enhanced due diligence threshold",
    "Travel Rule information missing",
    "Other (note required)"
  ];

  function statusLabel(status, seat) {
    var base = S.statusLabels[status];
    if (!base) return status;
    return base[seat] || base.payer || status;
  }

  function canTransition(from, to) {
    var s = CONFIG[from];
    return !!(s && s.next.indexOf(to) !== -1);
  }

  function visibleFields(status, seat) {
    var s = CONFIG[status];
    if (!s) return [];
    /* External fields are visible to payer and merchant;
     * internal fields only to compliance. */
    if (seat === "compliance") {
      return s.external.concat(s.internal);
    }
    return s.external.slice();
  }

  window.GATE_STATUSES = {
    config: CONFIG,
    reasonCategories: REASON_CATEGORIES,
    internalReasons: INTERNAL_REASONS,
    label: statusLabel,
    canTransition: canTransition,
    visibleFields: visibleFields
  };
})();
