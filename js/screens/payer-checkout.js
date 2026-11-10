/* S1. Payer: Checkout (#/payer/checkout) */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var COUNTRIES = ["United Arab Emirates","Bahrain","Saudi Arabia","Qatar","Kuwait","Oman","Jordan","Egypt","United Kingdom","United States","Singapore","United States of America"];

  function render(app, params, query) {
    var st = window.GATE_STORE.get();
    var scId = st.scenarioId || "H1";
    var sc = window.GATE_SCENARIOS.byId(scId);
    var payId = (sc && sc.paymentId) || "P-1001";
    var p = window.GATE_STORE.byId(payId);
    var c = S().checkout;
    var M = F().math;

    app.appendChild(el("h1", "screen-title", c.title));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    var card = el("div", "card");
    /* Context: merchant, project, reference, purpose, amount due */
    var kv = el("div", "kv");
    var merchant = F().merchants.find(function (m) { return m.id === p.merchantId; });
    var project = F().projects.find(function (x) { return x.id === p.projectId; });
    kv.appendChild(kvRow(c.merchant, merchant.name));
    if (project) kv.appendChild(kvRow(c.project, project.name));
    kv.appendChild(kvRow(c.reference, p.id));
    kv.appendChild(kvRow(c.forLabel, p.label));
    kv.appendChild(kvRow(c.amountDue, window.GATE_STORE.fmtAED(p.requestedFiatAED)));
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
      card.appendChild(el("div", "notice warning", c.expiryCountdown.replace("{time}", mm + "m " + (ss<10?"0":"")+ss + "s")));
    }
    app.appendChild(card);

    /* Form step */
    var formCard = el("div", "card");
    formCard.id = "checkout-form";
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
      b.addEventListener("click", function () { p.network = n; p.address = n.indexOf("TRC-20")===0 ? F().addresses.tron : F().addresses.eth; render(app, params, query); });
      netRow.appendChild(b);
    });
    formCard.appendChild(netRow);

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

    /* Switch stablecoin by replacing the screen, never appending a second form. */
    function switchAsset(asset) {
      if (p.asset === asset) return;
      /* Keep whatever the payer already typed (valid input survives the switch). */
      if (nameInput.value.trim()) p.payerName = nameInput.value.trim();
      if (countrySel.value) p.payerCountry = countrySel.value;
      p.asset = asset;
      /* USDC settles on ERC-20 only: force a valid network and its address. */
      var nets = F().rules.networks[asset];
      if (nets.indexOf(p.network) === -1) p.network = nets[0];
      p.address = p.network.indexOf("TRC-20") === 0 ? F().addresses.tron : F().addresses.eth;
      p.requestedSc = M.stablecoinAmount(p.requestedFiatAED, asset);
      app.innerHTML = "";
      render(app, params, query);
    }

    var f1 = fieldWrap(S().checkout.yourName, nameInput, nameErr);
    var f2 = fieldWrap(S().checkout.yourCountry, countrySel, countryErr);
    formCard.appendChild(f1);
    formCard.appendChild(f2);

    var cont = el("button", "btn primary", c.continueBtn);
    cont.addEventListener("click", function () {
      var ok = true;
      nameErr.textContent = nameInput.value.trim() ? "" : c.nameRequired;
      nameInput.classList.toggle("invalid", !nameInput.value.trim());
      if (!nameInput.value.trim()) ok = false;
      countryErr.textContent = countrySel.value ? "" : c.countryRequired;
      countrySel.classList.toggle("invalid", !countrySel.value);
      if (!countrySel.value) ok = false;
      if (!ok) return;
      p.payerName = nameInput.value.trim();
      p.payerCountry = countrySel.value;
      showDetails();
    });
    formCard.appendChild(cont);
    app.appendChild(formCard);

    var details = el("div", "card hidden", "checkout-details");
    details.id = "checkout-details";
    function showDetails() {
      formCard.classList.add("hidden");
      details.classList.remove("hidden");
      var amt = M.stablecoinAmount(p.requestedFiatAED, p.asset);
      var back = el("button", "btn ghost", c.backToForm);
      back.addEventListener("click", function () { formCard.classList.remove("hidden"); details.classList.add("hidden"); });
      details.appendChild(back);
      details.appendChild(el("h2", "card-title", c.exactAmount));
      details.appendChild(copyField(window.GATE_STORE.fmtSC(amt, p.asset), "copy-amt"));
      details.appendChild(el("h2", "card-title", c.sendTo));
      details.appendChild(copyField(p.address, "copy-addr"));
      details.appendChild(el("div", "addr-note", S().demoAddressLabel));
      details.appendChild(el("div", "qr-placeholder", "▦▦ ▣▣ ▦▦  " + c.qr + "  ▦▣ ▣▣ ▦▦"));
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
      details.appendChild(el("div", "muted", "Payer: " + p.payerName + " · " + p.payerCountry));
    }
    app.appendChild(details);

    function kvRow(k, v) {
      var r = el("div", "kv-row");
      r.appendChild(el("dt", "kv-k", k));
      r.appendChild(el("dd", "kv-v", v));
      return r;
    }
    function fieldWrap(label, input, err) {
      var w = el("div", "field");
      var l = el("label", "field-label", label);
      l.htmlFor = input.id;
      w.appendChild(l);
      w.appendChild(input);
      w.appendChild(err);
      return w;
    }
    function copyField(value, id) {
      var w = el("div", "copy-field");
      var out = el("code", "copy-value");
      out.textContent = value;
      var b = el("button", "btn small", "Copy");
      b.type = "button";
      b.id = id;
      b.addEventListener("click", function () {
        var reset = function () { b.textContent = "Copy"; };
        var done = function () {
          b.textContent = "Copied";
          window.GATE_STORE.addToast("Copied " + value, "success");
          setTimeout(reset, 1500);
        };
        var manual = function () {
          b.textContent = "Copy manually";
          setTimeout(reset, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            navigator.clipboard.writeText(value).then(done).catch(manual);
          } catch (err) {
            manual();
          }
        } else {
          manual();
        }
      });
      w.appendChild(out);
      w.appendChild(b);
      return w;
    }
  }

  window.GATE_ROUTER.register("payer/checkout", render, "payer-checkout");
})();
