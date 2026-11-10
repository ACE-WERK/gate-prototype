/* S3. Merchant: Payments (#/merchant/payments) */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render(app, params, query) {
    var st = window.GATE_STORE.get();
    var m = S().merchant;

    app.appendChild(el("h1", "screen-title", m.paymentsTitle));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    /* Summary tiles */
    var tiles = el("div", "tiles");
    var collected = st.payments.reduce(function (sum, p) {
      return sum + (p.status === "paid" ? (p.creditedAED || 0) : 0);
    }, 0);
    tiles.appendChild(tile(m.tiles.collected, window.GATE_STORE.fmtAED(collected)));
    var inReview = 0, actionNeeded = 0;
    st.payments.forEach(function (p) {
      if (p.status === "held" || p.status === "overdueHeld" || p.status === "checks") inReview++;
      if (p.status === "action") actionNeeded++;
    });
    tiles.appendChild(tile(m.tiles.inReview, String(inReview)));
    tiles.appendChild(tile(m.tiles.actionNeeded, String(actionNeeded)));
    app.appendChild(tiles);

    /* Controls */
    var controls = el("div", "list-controls");
    var filter = document.createElement("select");
    filter.className = "select small";
    ["all","paid","held","overdueHeld","action","partial","overpaid","declined","frozen","expired","needsManual","pending"].forEach(function (s) {
      var o = document.createElement("option");
      o.value = s;
      o.textContent = s === "all" ? m.filters.all : window.GATE_STATUSES.label(s, "merchant");
      filter.appendChild(o);
    });
    filter.addEventListener("change", function () { drawList(); });
    var search = document.createElement("input");
    search.type = "search"; search.className = "text-input small";
    search.placeholder = m.filters.placeholder;
    search.setAttribute("aria-label", m.filters.placeholder);
    search.addEventListener("input", function () { drawList(); });
    controls.appendChild(filter);
    controls.appendChild(search);
    app.appendChild(controls);

    /* List container (table or stacked cards via CSS) */
    var listWrap = el("div", "payments-list");
    listWrap.id = "payments-list";
    /* Fallback containment for wide content above the stacking breakpoint. */
    listWrap.style.overflowX = "auto";
    app.appendChild(listWrap);

    function rows() {
      /* Real fixture records only, so every value is derived and every row
         link opens a payment that exists (broker P-1005 included). */
      var all = st.payments.slice();
      var volume = st.volume;
      if (volume === 0 || all.length === 0) return [];
      if (volume === 1) {
        var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
        var active = sc && sc.paymentId ? all.find(function (p) { return p.id === sc.paymentId; }) : null;
        return active ? [active] : all.slice(0, 1);
      }
      /* 200 rows: cycle the fixtures instead of inventing amounts. */
      var out = [];
      for (var i = 0; i < 200; i++) out.push(all[i % all.length]);
      return out;
    }

    function drawList() {
      var fVal = filter.value;
      var q = (search.value || "").trim().toLowerCase();
      var data = rows().filter(function (p) {
        if (fVal !== "all" && p.status !== fVal) return false;
        if (q && p.id.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      listWrap.innerHTML = "";
      if (data.length === 0) {
        var empty = el("div", "empty-state");
        empty.appendChild(el("div", "empty-icon", "▢"));
        empty.appendChild(el("div", "empty-title", m.empty));
        empty.appendChild(el("div", "empty-hint", m.emptyHint));
        listWrap.appendChild(empty);
        return;
      }
      /* Desktop: table. Mobile: stacked cards (CSS handles display). */
      var table = el("table", "data-table");
      var thead = el("thead");
      var hr = el("tr");
      ["ref","customer","payer","requested","received","credited","status","age"].forEach(function (k) {
        hr.appendChild(el("th", "th-" + k, m.table[k]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      var proj = F().projects;
      var payers = F().payers;
      data.forEach(function (p) {
        var tr = el("tr", "row");
        tr.tabIndex = 0;
        var project = proj.find(function (x) { return x.id === p.projectId; });
        var payer = payers.find(function (x) { return x.id === p.payerId; });
        var requestedAED = p.requestedFiatAED;
        var receivedSc = p.receivedSc || 0;
        var credited = p.creditedAED || 0;
        var held = p.status === "held" || p.status === "overdueHeld";
        var age = p.timeline.length ? window.GATE_STORE.fmtClock(new Date(p.timeline[0].ts)) : "—";

        var tdRef = el("td", "");
        tdRef.dataset.label = m.table.ref;
        var a = el("a", "row-link", p.id);
        a.href = "#/merchant/payments/" + p.id;
        a.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); });
        tdRef.appendChild(a);
        tr.appendChild(tdRef);
        var tdCust = el("td", "cell-wrap", project ? project.name : (payer ? payer.name : "—")); tdCust.dataset.label = m.table.customer; tr.appendChild(tdCust);
        var tdPayer = el("td", "cell-wrap", payer ? payer.name : "—"); tdPayer.dataset.label = m.table.payer; tr.appendChild(tdPayer);
        var tdReq = el("td", "num", requestedAED ? window.GATE_STORE.fmtAED(requestedAED) : "—"); tdReq.dataset.label = m.table.requested; tr.appendChild(tdReq);
        var tdRec = el("td", "num", receivedSc ? window.GATE_STORE.fmtSC(receivedSc, p.asset || "USDT") : "—"); tdRec.dataset.label = m.table.received; tr.appendChild(tdRec);
        var tdCred = el("td", "num", credited ? window.GATE_STORE.fmtAED(credited) : "—"); tdCred.dataset.label = m.table.credited; tr.appendChild(tdCred);
        var tdStatus = el("td", "");
        tdStatus.dataset.label = m.table.status;
        var chip = el("span", "chip tone-" + window.GATE_STATUSES.config[p.status].tone, window.GATE_STATUSES.label(p.status, "merchant"));
        tdStatus.appendChild(chip);
        if (held) {
          var dueNote = el("div", "cell-sub");
          if (p.decisionDueBy) {
            var due = new Date(p.decisionDueBy);
            var leftMs = due.getTime() - new Date(st.clock).getTime();
            if (leftMs < 0) {
              dueNote.textContent = m.overdue;
              dueNote.className = "cell-sub overdue";
            } else {
              var hh = Math.floor(leftMs / 3600000), mm = Math.floor((leftMs % 3600000) / 60000);
              dueNote.textContent = m.heldCountdown.replace("{time}", hh + "h " + mm + "m");
            }
          } else {
            /* No decision deadline recorded: never let new Date(null) read as
               overdue since the epoch. */
            dueNote.textContent = "—";
          }
          tdStatus.appendChild(dueNote);
        }
        tr.appendChild(tdStatus);
        var tdAge = el("td", "muted", age); tdAge.dataset.label = m.table.age; tr.appendChild(tdAge);
        tr.addEventListener("click", function () { window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); });
        tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); } });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      listWrap.appendChild(table);
    }
    drawList();

    function tile(k, v) {
      var t = el("div", "tile");
      t.appendChild(el("div", "tile-value", v));
      t.appendChild(el("div", "tile-label", k));
      return t;
    }
  }

  window.GATE_ROUTER.register("merchant/payments", render, "merchant-payments");
})();
