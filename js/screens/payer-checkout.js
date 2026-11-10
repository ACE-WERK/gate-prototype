/* S1. Payer: Checkout (#/payer/checkout)
 *
 * Phase 3a rework (followup §3.3, §3.7, §3.8):
 *  - Travel Rule questions are collected BEFORE the address is shown:
 *    name + country, the buyer question (with relationship when "No"), and
 *    where the funds are sent from (exchange or own wallet).
 *  - The deposit address is shown in groups of four, with the first and last
 *    six characters emphasised, the network as a large label beside it, and a
 *    copy button that repeats asset + network in the toast.
 *  - Reserved-address checkouts show the unit's instalment schedule.
 *  - E10 validation: every Travel Rule answer is required before the address
 *    is revealed. A "No" is an answer, not a block.
 *
 * Answers are stored on the payment object so they survive re-renders (the
 * screen re-renders on asset/network switches) and are visible to the
 * merchant's detail screen, never to screening.
 */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function G() { return window.GATE_STORE; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var COUNTRIES = ["United Arab Emirates","Bahrain","Saudi Arabia","Qatar","Kuwait","Oman","Jordan","Egypt","United Kingdom","United States","Singapore","United States of America"];
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* All displayed times are Gulf Standard Time, UTC+4 (followup §3.9). */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function gstParts(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + 4 * 3600000);
  }
  /* Pure dates (schedule due dates) are built at UTC midnight: read UTC parts. */
  function fmtDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function fmtGST(value) {
    var d = gstParts(value);
    if (!d) return "—";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() +
      ", " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " GST";
  }

  function netKey(network) {
    return String(network || "").indexOf("TRC-20") === 0 ? "tron" : "ethereum";
  }

  /* "Unit 1204, instalment 2 of 4" -> {unit, n, total} */
  function parseLabel(label) {
    var m = /^\s*(Unit [^,]+),\s*instalment\s+(\d+)\s+of\s+(\d+)/i.exec(label || "");
    if (!m) return null;
    return { unit: m[1].trim(), n: parseInt(m[2], 10), total: parseInt(m[3], 10) };
  }

  /* The unit's schedule, derived from the payments on file for the same
   * project and unit (no new fixture amounts are invented). Due dates are
   * monthly from a fixed anchor at the demo's "now" (10 Nov 2026), so they do
   * not drift as the demo clock advances. */
  function buildSchedule(p) {
    var parsed = parseLabel(p.label);
    if (!parsed) return null;
    var rows = [];
    F().payments.forEach(function (q) {
      var qp = parseLabel(q.label);
      if (q.projectId !== p.projectId || !qp || qp.unit !== parsed.unit) return;
      rows.push({ payment: q, n: qp.n, total: qp.total });
    });
    rows.sort(function (a, b) { return a.n - b.n; });

    function paid(q) { return q.status === "paid" || q.scheduleStatus === "paid"; }

    var currentN = null;
    for (var i = 0; i < rows.length; i++) {
      if (!paid(rows[i].payment)) { currentN = rows[i].n; break; }
    }
    if (currentN == null) currentN = parsed.n;

    rows.forEach(function (row) {
      var offset = row.n - currentN;
      row.due = new Date(Date.UTC(2026, 10 + offset, 10));
      row.adjust = Number(row.payment.scheduleAdjustSc) || 0;
      row.amountSc = Math.max(0, (Number(row.payment.requestedSc) || 0) - row.adjust);
      row.status = paid(row.payment) ? "paid" : (row.n === currentN ? "current" : "upcoming");
    });
    return { unit: parsed.unit, total: parsed.total, rows: rows };
  }

  /* Address in groups of four, first and last six characters emphasised. */
  function addressGroups(addr) {
    var wrap = el("span", "addr-groups");
    var len = addr.length;
    for (var i = 0; i < len; i += 4) {
      var group = el("span", "addr-group");
      for (var j = i; j < Math.min(i + 4, len); j++) {
        var ch = addr.charAt(j);
        if (j < 6 || j >= len - 6) {
          var b = el("b", "addr-em", ch);
          b.style.fontWeight = "700";
          b.style.fontSize = "1.2em";
          group.appendChild(b);
        } else {
          group.appendChild(document.createTextNode(ch));
        }
      }
      wrap.appendChild(group);
      if (i + 4 < len) wrap.appendChild(document.createTextNode(" "));
    }
    return wrap;
  }

  function render(app, params, query) {
    var st = G().get();
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId || "H1");
    var p = G().byId((sc && sc.paymentId) || "P-1001");
    if (!p) return;
    var c = S().checkout;
    var tr = S().travelRule;
    var M = F().math;

    /* Demo support: E2's trigger is the payer answering "No" (parent). */
    if (p.buyerAnswer == null && st.scenarioId === "E2") {
      p.buyerAnswer = "no";
      if (!p.payerRelationship) p.payerRelationship = "parent";
    }

    app.appendChild(el("h1", "screen-title", c.title));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    var card = el("div", "card");
    var kv = el("div", "kv");
    var merchant = F().merchants.filter(function (m) { return m.id === p.merchantId; })[0];
    var project = F().projects.filter(function (x) { return x.id === p.projectId; })[0];
    if (merchant) kv.appendChild(kvRow(c.merchant, merchant.name));
    if (project) kv.appendChild(kvRow(c.project, project.name));
    kv.appendChild(kvRow(c.reference, p.id));
    kv.appendChild(kvRow(c.forLabel, p.label));
    kv.appendChild(kvRow(c.amountDue, G().fmtAED(p.requestedFiatAED)));
    card.appendChild(kv);
    if (p.model === "reserved") {
      card.appendChild(el("div", "notice neutral", c.noExpiry));
    } else {
      /* Expiry is anchored to the simulated clock, never wall-clock time (R3). */
      if (!p.linkExpiresAt) {
        p.linkExpiresAt = p.expiredAt
          ? new Date(p.expiredAt).getTime()
          : st.clock.getTime() + F().rules.pooledTimerMinutes * 60000;
      }
      var left = Math.max(0, p.linkExpiresAt - st.clock.getTime());
      var mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
      card.appendChild(el("div", "notice warning", c.expiryCountdown.replace("{time}", mm + "m " + (ss < 10 ? "0" : "") + ss + "s")));
    }
    app.appendChild(card);

    /* ---------- Step 1: details + Travel Rule ---------- */
    var formCard = el("div", "card");
    formCard.id = "checkout-form";
    formCard.appendChild(el("h2", "card-title", tr.heading));

    var nameErr = el("div", "field-error");
    nameErr.id = "name-err";
    var countryErr = el("div", "field-error");
    var nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.className = "text-input";
    nameInput.id = "payer-name"; nameInput.setAttribute("aria-describedby", "name-err");
    if (p.payerName) nameInput.value = p.payerName;
    var countrySel = document.createElement("select");
    countrySel.className = "select";
    countrySel.id = "payer-country";
    var ph = document.createElement("option"); ph.value = ""; ph.textContent = "—";
    countrySel.appendChild(ph);
    COUNTRIES.forEach(function (ct) {
      var o = document.createElement("option"); o.value = ct; o.textContent = ct;
      if (p.payerCountry === ct) o.selected = true;
      countrySel.appendChild(o);
    });

    formCard.appendChild(fieldWrap(c.yourName, nameInput, nameErr));
    formCard.appendChild(fieldWrap(c.yourCountry, countrySel, countryErr));

    /* Buyer question */
    var buyerErr = el("div", "field-error");
    var buyerField = el("div", "field");
    buyerField.appendChild(el("div", "field-label", tr.buyerQuestion));
    var buyerRow = el("div", "selectable-row");
    function buyerButton(value, label) {
      var b = el("button", "selectable-card" + (p.buyerAnswer === value ? " selected" : ""), label);
      b.type = "button";
      b.setAttribute("aria-pressed", p.buyerAnswer === value ? "true" : "false");
      b.addEventListener("click", function () { setBuyerAnswer(value, buyerRow); });
      return b;
    }
    buyerRow.appendChild(buyerButton("yes", tr.yes));
    buyerRow.appendChild(buyerButton("no", tr.no));
    buyerField.appendChild(buyerRow);
    buyerField.appendChild(buyerErr);
    formCard.appendChild(buyerField);

    /* Relationship (only when the payer is not the buyer) */
    var relField = el("div", "field");
    var relSel = document.createElement("select");
    relSel.className = "select";
    relSel.id = "payer-relationship";
    var relPh = document.createElement("option"); relPh.value = ""; relPh.textContent = "—";
    relSel.appendChild(relPh);
    [["spouse", tr.relationships.spouse], ["parent", tr.relationships.parent], ["company", tr.relationships.company], ["other", tr.relationships.other]].forEach(function (pair) {
      var o = document.createElement("option"); o.value = pair[0]; o.textContent = pair[1];
      if (p.payerRelationship === pair[0]) o.selected = true;
      relSel.appendChild(o);
    });
    var relErr = el("div", "field-error");
    relSel.addEventListener("change", function () {
      p.payerRelationship = relSel.value || null;
      relErr.textContent = "";
      relSel.classList.remove("invalid");
    });
    relField.appendChild(fieldLabel(tr.relationshipLabel, relSel.id));
    relField.appendChild(relSel);
    relField.appendChild(relErr);
    formCard.appendChild(relField);

    var buyerNotice = el("div", "banner info", tr.needsReview);

    /* Sending from */
    var sendErr = el("div", "field-error");
    var sendField = el("div", "field");
    sendField.appendChild(el("div", "field-label", tr.sendingFrom));
    sendField.appendChild(el("div", "muted", tr.exchangeNote));
    var sendRow = el("div", "selectable-row");
    var SEND_OPTIONS = [
      { value: "exchangeA", label: F().exchangeNames[0] },
      { value: "exchangeB", label: F().exchangeNames[1] },
      { value: "otherExchange", label: F().exchangeNames[2] },
      { value: "own", label: tr.ownWallet }
    ];
    SEND_OPTIONS.forEach(function (opt) {
      var b = el("button", "selectable-card" + (p.sendingFrom === opt.value ? " selected" : ""), opt.label);
      b.type = "button";
      b.setAttribute("aria-pressed", p.sendingFrom === opt.value ? "true" : "false");
      b.addEventListener("click", function () { setSendingFrom(opt.value, sendRow); });
      sendRow.appendChild(b);
    });
    sendField.appendChild(sendRow);
    var ownNote = el("div", "banner neutral", tr.ownWalletNote);
    sendField.appendChild(ownNote);
    sendField.appendChild(sendErr);
    formCard.appendChild(sendField);

    if (p.requestedFiatAED >= F().travelRuleThresholdAED.uae) {
      formCard.appendChild(el("div", "muted", tr.thresholdNote));
    }

    buyerField.appendChild(buyerNotice);

    /* Asset and network */
    formCard.appendChild(el("h2", "card-title", c.chooseAsset));
    var assetRow = el("div", "selectable-row");
    ["USDT", "USDC"].forEach(function (a) {
      var b = el("button", "selectable-card" + (p.asset === a ? " selected" : ""), a);
      b.type = "button";
      b.setAttribute("aria-pressed", p.asset === a ? "true" : "false");
      b.addEventListener("click", function () { switchAsset(a); });
      assetRow.appendChild(b);
    });
    formCard.appendChild(assetRow);

    formCard.appendChild(el("h2", "card-title", c.chooseNetwork));
    var netRow = el("div", "selectable-row");
    F().rules.networks[p.asset].forEach(function (n) {
      var b = el("button", "selectable-card" + (p.network === n ? " selected" : ""), n);
      b.type = "button";
      b.setAttribute("aria-pressed", p.network === n ? "true" : "false");
      b.addEventListener("click", function () {
        persistForm();
        p.network = n;
        p.address = netKey(n) === "tron" ? F().addresses.tron : F().addresses.eth;
        app.innerHTML = "";
        render(app, params, query);
      });
      netRow.appendChild(b);
    });
    formCard.appendChild(netRow);

    var cont = el("button", "btn primary", c.continueBtn);
    cont.type = "button";
    cont.addEventListener("click", function () { submit(); });
    formCard.appendChild(cont);
    app.appendChild(formCard);

    /* ---------- Step 2: amount, address, schedule ---------- */
    var details = el("div", "card hidden");
    details.id = "checkout-details";
    app.appendChild(details);

    function fieldLabel(label, id) {
      var l = el("label", "field-label", label);
      l.htmlFor = id;
      return l;
    }
    function fieldWrap(label, input, err) {
      var w = el("div", "field");
      w.appendChild(fieldLabel(label, input.id));
      w.appendChild(input);
      w.appendChild(err);
      return w;
    }
    function kvRow(k, v) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v", v));
      return r;
    }
    function persistForm() {
      if (nameInput.value.trim()) p.payerName = nameInput.value.trim();
      if (countrySel.value) p.payerCountry = countrySel.value;
    }
    function clearSelectable(row) {
      Array.prototype.forEach.call(row.children, function (b) {
        b.className = "selectable-card";
        b.setAttribute("aria-pressed", "false");
      });
    }
    function setBuyerAnswer(value, row) {
      p.buyerAnswer = value;
      clearSelectable(row);
      Array.prototype.forEach.call(row.children, function (b, i) {
        var active = (i === 0 && value === "yes") || (i === 1 && value === "no");
        if (active) b.className = "selectable-card selected";
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      buyerErr.textContent = "";
      relField.classList.toggle("hidden", value !== "no");
      buyerNotice.classList.toggle("hidden", value !== "no");
      if (value !== "no") { p.payerRelationship = null; relSel.value = ""; }
    }
    function setSendingFrom(value, row) {
      p.sendingFrom = value;
      clearSelectable(row);
      SEND_OPTIONS.forEach(function (opt, i) {
        var active = opt.value === value;
        if (active) row.children[i].className = "selectable-card selected";
        row.children[i].setAttribute("aria-pressed", active ? "true" : "false");
      });
      sendErr.textContent = "";
      ownNote.classList.toggle("hidden", value !== "own");
    }

    /* Show relationship + notes for the stored answer. */
    relField.classList.toggle("hidden", p.buyerAnswer !== "no");
    buyerNotice.classList.toggle("hidden", p.buyerAnswer !== "no");
    ownNote.classList.toggle("hidden", p.sendingFrom !== "own");

    function submit() {
      persistForm();
      var firstInvalid = null;
      var nameOk = !!nameInput.value.trim();
      nameErr.textContent = nameOk ? "" : c.nameRequired;
      nameInput.classList.toggle("invalid", !nameOk);
      if (!nameOk) firstInvalid = nameInput;

      var countryOk = !!countrySel.value;
      countryErr.textContent = countryOk ? "" : c.countryRequired;
      countrySel.classList.toggle("invalid", !countryOk);
      if (!countryOk && !firstInvalid) firstInvalid = countrySel;

      var buyerOk = p.buyerAnswer === "yes" || p.buyerAnswer === "no";
      buyerErr.textContent = buyerOk ? "" : tr.required;
      if (!buyerOk && !firstInvalid) firstInvalid = buyerRow;

      var relOk = p.buyerAnswer !== "no" || !!p.payerRelationship;
      relErr.textContent = relOk ? "" : c.relationshipRequired;
      relSel.classList.toggle("invalid", !relOk);
      if (!relOk && !firstInvalid) firstInvalid = relSel;

      var sendOk = !!p.sendingFrom;
      sendErr.textContent = sendOk ? "" : c.sendingFromRequired;
      if (!sendOk && !firstInvalid) firstInvalid = sendRow;

      if (!nameOk || !countryOk || !buyerOk || !relOk || !sendOk) {
        if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
        return;
      }
      p.payerName = nameInput.value.trim();
      p.payerCountry = countrySel.value;
      if (p.buyerAnswer === "no") p.payerRelationship = relSel.value;
      reveal();
    }

    /* Switching stablecoin replaces the screen, never appends a second form. */
    function switchAsset(asset) {
      if (p.asset === asset) return;
      persistForm();
      p.asset = asset;
      /* USDC settles on ERC-20 only: force a valid network and its address. */
      var nets = F().rules.networks[asset];
      if (nets.indexOf(p.network) === -1) p.network = nets[0];
      p.address = netKey(p.network) === "tron" ? F().addresses.tron : F().addresses.eth;
      p.requestedSc = M.stablecoinAmount(p.requestedFiatAED, asset);
      app.innerHTML = "";
      render(app, params, query);
    }

    function reveal() {
      formCard.classList.add("hidden");
      details.classList.remove("hidden");
      details.innerHTML = "";
      buildDetails();
    }

    function buildDetails() {
      var back = el("button", "btn ghost", c.backToForm);
      back.type = "button";
      back.addEventListener("click", function () {
        formCard.classList.remove("hidden");
        details.classList.add("hidden");
      });
      details.appendChild(back);

      var amt = M.stablecoinAmount(p.requestedFiatAED, p.asset);
      details.appendChild(el("h2", "card-title", c.exactAmount));
      details.appendChild(copyField(G().fmtSC(amt, p.asset), "copy-amt", "Copied " + G().fmtSC(amt, p.asset) + ". Check the amount before sending."));

      /* Address block: groups of four, network label beside it. */
      details.appendChild(el("h2", "card-title", c.sendTo));
      var netk = netKey(p.network);
      var block = el("div", "address-block");
      block.style.display = "flex";
      block.style.alignItems = "center";
      block.style.gap = "var(--sp-3)";
      block.style.flexWrap = "wrap";
      block.style.marginBlockEnd = "var(--sp-3)";

      var code = el("code", "copy-value");
      code.style.flex = "1 1 18rem";
      code.style.minWidth = "0";
      code.style.wordBreak = "break-all";
      code.style.letterSpacing = "0.06em";
      code.appendChild(addressGroups(p.address));
      block.appendChild(code);

      var pill = el("span", "chip tone-info", S().address.networkLabel[netk]);
      pill.style.fontSize = "var(--fs-md)";
      pill.style.padding = "var(--sp-1) var(--sp-3)";
      pill.style.letterSpacing = "0.08em";
      pill.style.fontWeight = "var(--fw-bold)";
      block.appendChild(pill);

      var copyAddr = el("button", "btn small", S().address.copy);
      copyAddr.type = "button";
      copyAddr.id = "copy-addr";
      copyAddr.addEventListener("click", function () {
        copyText(p.address, function (ok) {
          copyAddr.textContent = ok ? S().address.copiedBtn : S().address.copyManual;
          setTimeout(function () { copyAddr.textContent = S().address.copy; }, 1500);
        });
        G().addToast(S().address.copiedShort.replace("{asset}", p.asset).replace("{network}", S().address.networkName[netk]), "success");
      });
      block.appendChild(copyAddr);
      details.appendChild(block);

      var safety = el("div", "muted", S().address.copyEveryTime);
      safety.style.marginBlockEnd = "var(--sp-2)";
      details.appendChild(safety);
      details.appendChild(el("div", "addr-note", S().demoAddressLabel));

      details.appendChild(el("div", "qr-placeholder", "▦▦ ▣▣ ▦▦  " + S().address.qrLabel.replace("{network}", S().address.networkName[netk]) + "  ▦▣ ▣▣ ▦▦"));

      var w = el("div", "banner info");
      S().checkout.warnings.forEach(function (line) {
        var div = el("div", "warn-line");
        div.textContent = line.replace("{asset}", p.asset).replace("{network}", p.network);
        w.appendChild(div);
      });
      details.appendChild(w);

      if (p.requestedFiatAED >= 100000) {
        details.appendChild(el("div", "badge success", "✓ " + S().buyerVerified));
      }

      /* What was collected, in the words the merchant will see. */
      var sum = el("div", "card");
      sum.style.marginBlockStart = "var(--sp-4)";
      sum.appendChild(el("h3", "card-subtitle", c.summary));
      var skv = el("div", "kv");
      skv.appendChild(kvRow(c.yourName, p.payerName || "—"));
      skv.appendChild(kvRow(c.yourCountry, p.payerCountry || "—"));
      skv.appendChild(kvRow(c.buyerAnswer, p.buyerAnswer === "no" ? c.buyerNoShort : c.buyerYesShort));
      if (p.buyerAnswer === "no") {
        skv.appendChild(kvRow(S().travelRule.relationshipLabel, S().travelRule.relationships[p.payerRelationship] || "—"));
      }
      skv.appendChild(kvRow(c.sendingFromShort, sendingLabel(p.sendingFrom)));
      sum.appendChild(skv);
      details.appendChild(sum);

      if (p.model === "reserved") {
        var sch = buildSchedule(p);
        if (sch) details.appendChild(scheduleCard(sch, p.asset));
      }

      var status = el("button", "btn", c.viewStatus);
      status.type = "button";
      status.style.marginBlockStart = "var(--sp-3)";
      status.addEventListener("click", function () { window.GATE_ROUTER.navigate("#/payer/status"); });
      details.appendChild(status);
    }

    function sendingLabel(value) {
      if (value === "own") return S().travelRule.ownWallet;
      if (value === "exchangeA") return F().exchangeNames[0];
      if (value === "exchangeB") return F().exchangeNames[1];
      if (value === "otherExchange") return F().exchangeNames[2];
      return "—";
    }
  }

  /* Instalment schedule card (followup §3.8). Shared shape with S4. */
  function scheduleCard(sch, asset) {
    var st = S().schedule;
    var card = el("div", "card");
    card.appendChild(el("h2", "card-title", st.title));
    card.appendChild(el("div", "muted", st.subtitle));
    var table = el("table", "data-table");
    var thead = el("thead");
    var hr = el("tr");
    hr.appendChild(el("th", "", st.instalment));
    hr.appendChild(el("th", "", st.dueDate));
    hr.appendChild(el("th", "num", st.amount));
    hr.appendChild(el("th", "", st.status));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    sch.rows.forEach(function (row) {
      var tr = el("tr", "row");
      if (row.status === "current") tr.style.background = "var(--color-warning-soft)";
      var tdN = el("td", "", "Instalment " + row.n + " of " + row.total);
      tdN.dataset.label = st.instalment;
      tr.appendChild(tdN);
      var tdD = el("td", "", fmtDate(row.due));
      tdD.dataset.label = st.dueDate;
      tr.appendChild(tdD);
      var tdA = el("td", "num", G().fmtSC(row.amountSc, asset));
      tdA.dataset.label = st.amount;
      if (row.adjust > 0) {
        var note = el("div", "cell-sub", st.reducedBy.replace("{amount}", G().fmtSC(row.adjust, asset)));
        tdA.appendChild(note);
      }
      tr.appendChild(tdA);
      var tdS = el("td", "");
      tdS.dataset.label = st.status;
      var tone = row.status === "paid" ? "success" : row.status === "current" ? "warning" : "neutral";
      var label = row.status === "paid" ? st.paid : row.status === "current" ? st.current : st.upcoming;
      tdS.appendChild(el("span", "chip tone-" + tone, label));
      tr.appendChild(tdS);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  function copyText(value, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(value).then(function () { done(true); }).catch(function () { done(false); });
        return;
      } catch (err) { /* fall through */ }
    }
    done(false);
  }

  /* Shared by the amount and address copy fields. */
  function copyField(value, id, toastText) {
    var w = el("div", "copy-field");
    var out = el("code", "copy-value");
    out.textContent = value;
    var b = el("button", "btn small", window.GATE_STRINGS.address.copy);
    b.type = "button";
    b.id = id;
    b.addEventListener("click", function () {
      copyText(value, function (ok) {
        b.textContent = ok ? window.GATE_STRINGS.address.copiedBtn : window.GATE_STRINGS.address.copyManual;
        setTimeout(function () { b.textContent = window.GATE_STRINGS.address.copy; }, 1500);
      });
      window.GATE_STORE.addToast(toastText || ("Copied " + value), "success");
    });
    w.appendChild(out);
    w.appendChild(b);
    return w;
  }

  window.GATE_ROUTER.register("payer/checkout", render, "payer-checkout");
})();
