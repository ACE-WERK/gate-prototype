/* S5. Compliance analyst: Case (#/compliance/cases/:id) */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  /* Recovery link for empty states: a real anchor that also routes in-app. */
  function recoveryLink(label, hash) {
    var a = el("a", "btn ghost", label);
    a.href = hash;
    a.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate(hash); });
    return a;
  }

  function render(app, params, query) {
    var st = window.GATE_STORE.get();
    var c = S().compliance;
    app.appendChild(el("h1", "screen-title", c.title));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    /* Queue strip: open holds sorted by SLA time left; overdue first */
    var queue = el("div", "queue-strip");
    queue.appendChild(el("div", "queue-title", c.queue));
    var open = st.payments.filter(function (p) { return p.status === "held" || p.status === "overdueHeld" || p.status === "action"; });
    open.sort(function (a, b) {
      var la = a.decisionDueBy ? new Date(a.decisionDueBy) - new Date(st.clock) : Infinity;
      var lb = b.decisionDueBy ? new Date(b.decisionDueBy) - new Date(st.clock) : Infinity;
      return la - lb;
    });
    if (open.length === 0) {
      queue.appendChild(el("div", "muted", "No open holds."));
    }
    open.forEach(function (p) {
      var left = p.decisionDueBy ? new Date(p.decisionDueBy) - new Date(st.clock) : Infinity;
      var item = el("a", "queue-item" + (params.id === p.id ? " active" : "") + (left < 0 ? " overdue" : ""));
      item.href = "#/compliance/cases/" + p.id;
      item.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate("#/compliance/cases/" + p.id); });
      item.appendChild(el("span", "qi-id", p.id));
      item.appendChild(el("span", "qi-status", window.GATE_STATUSES.label(p.status, "compliance")));
      item.appendChild(el("span", "qi-time", left < 0 ? c.overdue : c.timeLeft.replace("{time}", Math.floor(left / 3600000) + "h")));
      queue.appendChild(item);
    });
    app.appendChild(queue);

    /* Case body */
    var payId = params.id || (st.scenarioId ? (window.GATE_SCENARIOS.byId(st.scenarioId).paymentId || "P-1001") : null);
    var p = payId ? window.GATE_STORE.byId(payId) : null;
    if (!p) {
      app.appendChild(el("p", "muted", "No case selected. Run a scenario to create a hold."));
      app.appendChild(recoveryLink("Back to compliance queue", "#/compliance/cases"));
      return;
    }

    var payer = F().payers.find(function (x) { return x.id === p.payerId; });
    var card = el("div", "card");
    card.appendChild(el("h2", "card-title", c.paymentFacts + " · " + p.id));
    card.appendChild(kv(c.payer, p.payerName || (payer ? payer.name : "—")));
    card.appendChild(kv(c.country, p.payerCountry || (payer ? payer.country : "—")));
    card.appendChild(kv(c.wallet, p.address));
    card.appendChild(el("div", "addr-note", S().demoAddressLabel));
    card.appendChild(kv("Amount", window.GATE_STORE.fmtSC(p.receivedSc, p.asset) + "  (" + p.requestedFiatAED.toFixed(2) + " AED requested)"));
    card.appendChild(kv("Network", p.network + (p.receivedNetwork && p.receivedNetwork !== p.network ? "  (received on " + p.receivedNetwork + ")" : "")));
    card.appendChild(kv("Reference", p.id));
    app.appendChild(card);

    /* Wallet history */
    if (p.priorCleared) {
      var wh = el("div", "card");
      wh.appendChild(el("h3", "card-subtitle", c.walletHistory));
      wh.appendChild(el("p", "", c.walletHistoryExample.replace("{date}", p.priorCleared)));
      app.appendChild(wh);
    }

    /* Screening summary (illustrative, internal only) */
    var sc = el("div", "card internal");
    sc.appendChild(el("h3", "card-subtitle", c.screening));
    var screenLines = [
      "Screening alert: " + (p.internalReason || "none recorded"),
      "Wallet history: " + (p.priorCleared ? "1 prior cleared instalment (" + p.priorCleared + ")" : "first payment from this wallet"),
      "Amount: " + window.GATE_STORE.fmtAED(p.requestedFiatAED) + " " + (p.requestedFiatAED >= 1000000 ? "(above the review threshold)" : "(below the review threshold)")
    ];
    screenLines.forEach(function (l) { sc.appendChild(el("div", "screen-line", l)); });
    app.appendChild(sc);

    /* Actions: only while a decision is still possible, and only when that
       decision is a legal transition. Closed/cancelled cases get a read-only
       summary instead of buttons that cannot commit. */
    var ACTIONABLE = ["detected", "checks", "held", "action", "overdueHeld", "needsManual"];
    var TARGETS = { approve: "paid", request: "action", decline: "declined", freeze: "frozen" };
    var defs = [
      ["approve", c.actions.approve, "success"],
      ["request", c.actions.request, "neutral"],
      ["decline", c.actions.decline, "danger"],
      ["freeze", c.actions.freeze, "warning"]
    ];
    var available = ACTIONABLE.indexOf(p.status) === -1 ? [] : defs.filter(function (a) {
      return TARGETS[a[0]] === p.status || window.GATE_STATUSES.canTransition(p.status, TARGETS[a[0]]);
    });
    if (available.length > 0) {
      var actions = el("div", "action-row");
      available.forEach(function (a) {
        var b = el("button", "btn " + a[2], a[1]);
        b.type = "button";
        b.addEventListener("click", function () { openDialog(a[0], a[1]); });
        actions.appendChild(b);
      });
      app.appendChild(actions);
    } else {
      var readonly = el("div", "card");
      readonly.appendChild(el("h2", "card-title", window.GATE_STATUSES.label(p.status, "compliance")));
      readonly.appendChild(el("p", "muted", "No actions are available for this case."));
      app.appendChild(readonly);
    }

    /* Internal timeline */
    var tl = el("div", "card");
    tl.appendChild(el("h2", "card-title", c.internalTimeline));
    var list = el("div", "timeline vertical");
    p.timeline.forEach(function (e) {
      var item = el("div", "timeline-item v");
      item.appendChild(el("div", "tl-label", e.text));
      item.appendChild(el("div", "tl-time", window.GATE_STORE.fmtClock(new Date(e.ts))));
      list.appendChild(item);
    });
    tl.appendChild(list);
    app.appendChild(tl);

    /* Dialog */
    function openDialog(action, actionLabel) {
      /* Remember what opened the dialog so focus can return there on close. */
      var opener = document.activeElement;
      var dlg = el("div", "dialog-backdrop");
      dlg.id = "case-dialog";
      var box = el("div", "dialog");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-labelledby", "dlg-title");
      var dlgTitle = el("h2", "dialog-title", c.dialog.title.replace("{action}", actionLabel));
      dlgTitle.id = "dlg-title";
      box.appendChild(dlgTitle);

      var reasonSel = document.createElement("select");
      reasonSel.className = "select";
      reasonSel.id = "dlg-reason";
      reasonSel.setAttribute("aria-label", c.dialog.internalReason);
      var ph = document.createElement("option"); ph.value = ""; ph.textContent = "— " + c.dialog.internalReason + " —";
      reasonSel.appendChild(ph);
      window.GATE_STATUSES.internalReasons.forEach(function (r) {
        var o = document.createElement("option"); o.value = r; o.textContent = r; reasonSel.appendChild(o);
      });
      var reasonErr = el("div", "field-error");
      var reasonLabel = el("label", "field-label", c.dialog.internalReason);
      reasonLabel.htmlFor = "dlg-reason";
      box.appendChild(reasonLabel);
      box.appendChild(reasonSel);
      box.appendChild(reasonErr);

      var note = document.createElement("textarea");
      note.className = "textarea";
      note.id = "dlg-note";
      note.rows = 3;
      note.setAttribute("aria-label", c.dialog.note);
      var noteErr = el("div", "field-error");
      var noteLabel = el("label", "field-label", c.dialog.note);
      noteLabel.htmlFor = "dlg-note";
      box.appendChild(noteLabel);
      box.appendChild(note);
      box.appendChild(noteErr);

      /* Preview: exactly what merchant and payer will see */
      var preview = el("div", "preview");
      preview.appendChild(el("div", "preview-title", c.dialog.preview));
      var merchantSee = "";
      var payerSee = "";
      if (action === "approve") {
        var previewSeg = p.merchantId === "M-002" ? "broker" : "realEstate";
        merchantSee = "Credited " + window.GATE_STORE.fmtAED(F().math.credited(p.requestedFiatAED, previewSeg));
        payerSee = "Payment received";
      } else if (action === "request") {
        merchantSee = (p.reasonCategory || "Payer details need confirming") + " — information requested from the payer";
        payerSee = "Action needed: " + (p.infoRequested || "please provide the requested information");
      } else if (action === "decline") {
        merchantSee = "Declined and refunded; nothing credited";
        payerSee = "This payment could not be accepted and has been returned to the sending wallet.";
      } else {
        merchantSee = "Frozen until further notice (neutral wording, no reason shown)";
        payerSee = "This payment cannot be released at this time. Our team will contact you if anything is needed.";
      }
      preview.appendChild(previewBox(c.dialog.merchantPreview, merchantSee));
      preview.appendChild(previewBox(c.dialog.payerPreview, payerSee));
      box.appendChild(preview);

      /* R8 focus management: initial focus, Tab trap, Escape to close,
         focus returned to the triggering button. */
      function focusables() {
        return Array.prototype.slice.call(box.querySelectorAll("select, textarea, input, button, a[href], [tabindex]:not([tabindex='-1'])"))
          .filter(function (n) { return !n.disabled; });
      }
      function close() {
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        document.removeEventListener("keydown", onKey, true);
        if (opener && opener !== document.body && typeof opener.focus === "function") opener.focus();
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (e.key !== "Tab") return;
        var f = focusables();
        if (f.length === 0) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      document.addEventListener("keydown", onKey, true);

      var btns = el("div", "dialog-actions");
      var cancel = el("button", "btn ghost", c.dialog.cancel);
      cancel.type = "button";
      cancel.addEventListener("click", function () { close(); });
      var confirm = el("button", "btn primary", c.dialog.confirm);
      confirm.type = "button";
      confirm.addEventListener("click", function () {
        var ok = true;
        reasonErr.textContent = reasonSel.value ? "" : c.dialog.reasonRequired;
        noteErr.textContent = note.value.trim() ? "" : c.dialog.noteRequired;
        if (!reasonSel.value || !note.value.trim()) ok = false;
        if (!ok) return;
        var newStatus = { approve: "paid", request: "action", decline: "declined", freeze: "frozen" }[action];
        var extra = { internal: reasonSel.value, note: note.value.trim() };
        if (action === "request") extra.info = p.infoRequested || "Proof of source of funds";
        /* Close first: subscribers rebuild #screen, which would detach the
           dialog and make a later removeChild throw. */
        close();
        window.GATE_STORE.setPaymentStatus(p.id, newStatus, extra);
        window.GATE_STORE.addToast(c.done[action], "success");
      });
      btns.appendChild(cancel);
      btns.appendChild(confirm);
      box.appendChild(btns);
      dlg.appendChild(box);
      dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
      app.appendChild(dlg);
      var firstFocus = focusables()[0];
      (firstFocus || reasonSel).focus();
    }

    function previewBox(label, text) {
      var b = el("div", "preview-box");
      b.appendChild(el("div", "preview-label", label));
      b.appendChild(el("div", "preview-text", text));
      return b;
    }
    function kv(k, v) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v", v));
      return r;
    }
  }

  window.GATE_ROUTER.register("compliance/cases", render, "compliance-case");
  window.GATE_ROUTER.register("compliance/cases/:id", render, "compliance-case-id");
})();
