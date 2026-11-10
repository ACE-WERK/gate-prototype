/* Gate Prototype — demo bar (not product UI).
 * Seat switch, scenario picker, step controls, demo clock, keyboard. */
(function () {
  "use strict";

  var STR;
  var stepRefs = { back: null, next: null };
  /* Collapse state lives outside the DOM: build() rebuilds the bar on every
     store notification, so a class on #demo-bar would not survive. */
  var _collapsed = false;
  function S() { return window.GATE_STRINGS; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function build() {
    var bar = document.getElementById("demo-bar");
    if (!bar) return;
    var st = window.GATE_STORE.get();
    var d = S().demoBar;

    bar.innerHTML = "";
    bar.classList.toggle("collapsed", _collapsed);

    var head = el("div", "db-head");
    var title = el("button", "db-toggle", (_collapsed ? "▸ " : "▾ ") + d.collapsed);
    title.type = "button";
    title.setAttribute("aria-expanded", _collapsed ? "false" : "true");
    title.addEventListener("click", function () {
      _collapsed = !_collapsed;
      bar.classList.toggle("collapsed", _collapsed);
      title.setAttribute("aria-expanded", _collapsed ? "false" : "true");
      title.textContent = (_collapsed ? "▸ " : "▾ ") + d.collapsed;
    });
    head.appendChild(title);
    var seatWrap = el("div", "db-seats");
    ["payer", "merchant", "compliance"].forEach(function (seat) {
      var b = el("button", "db-seat" + (st.seat === seat ? " active" : ""), S().seats[seat]);
      b.dataset.seat = seat;
      b.addEventListener("click", function () { switchSeat(seat); });
      seatWrap.appendChild(b);
    });
    head.appendChild(seatWrap);
    bar.appendChild(head);

    var body = el("div", "db-body");

    /* Scenario picker */
    var scRow = el("div", "db-row");
    var scLabel = el("label", "db-label", d.scenario);
    scLabel.htmlFor = "demo-scenario";
    scRow.appendChild(scLabel);
    var sel = document.createElement("select");
    sel.className = "db-select";
    sel.id = "demo-scenario";
    window.GATE_SCENARIOS.list.forEach(function (sc) {
      var o = document.createElement("option");
      o.value = sc.id;
      o.textContent = "[" + sc.priority + "] " + sc.id + " — " + sc.name;
      if (st.scenarioId === sc.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { loadScenario(sel.value, 0); });
    scRow.appendChild(sel);
    body.appendChild(scRow);

    /* Step controls */
    var stepRow = el("div", "db-row db-steps");
    var stepLabel = el("span", "db-stepnum");
    updateStepLabel(stepLabel);
    stepRow.appendChild(stepLabel);
    var back = el("button", "db-btn", d.back);
    back.addEventListener("click", function () { step(-1); });
    var next = el("button", "db-btn primary", d.next);
    next.addEventListener("click", function () { step(1); });
    stepRefs.back = back;
    stepRefs.next = next;
    var reset = el("button", "db-btn", d.reset);
    reset.addEventListener("click", function () { window.GATE_STORE.reset(); loadScenario(st.scenarioId || window.GATE_SCENARIOS.list[0].id, 0); });
    stepRow.appendChild(back);
    stepRow.appendChild(next);
    stepRow.appendChild(reset);
    body.appendChild(stepRow);
    syncStepControls();

    /* Demo clock */
    var clockRow = el("div", "db-row");
    var st2 = window.GATE_STORE.get();
    clockRow.appendChild(el("span", "db-label", d.clock + ": " + window.GATE_STORE.fmtClock(st2.clock)));
    var h1 = el("button", "db-btn", d.advanceHour);
    h1.addEventListener("click", function () { window.GATE_STORE.advanceClock(1, "hours"); window.GATE_STORE.notify(); refreshClock(clockRow); });
    var d1 = el("button", "db-btn", d.advanceDay);
    d1.addEventListener("click", function () { window.GATE_STORE.advanceClock(1, "days"); window.GATE_STORE.notify(); refreshClock(clockRow); });
    clockRow.appendChild(h1);
    clockRow.appendChild(d1);
    body.appendChild(clockRow);

    /* Volume + split */
    var optRow = el("div", "db-row");
    optRow.appendChild(el("label", "db-label", d.listVolume));
    ["0", "1", "200"].forEach(function (v) {
      var b = el("button", "db-btn" + (String(st.volume) === v ? " active" : ""), v === "0" ? d.vol0 : v === "1" ? d.vol1 : d.vol200);
      b.addEventListener("click", function () {
        st.volume = parseInt(v, 10);
        window.GATE_STORE.notify();
      });
      optRow.appendChild(b);
    });
    var splitB = el("button", "db-btn" + (st.split ? " active" : ""), d.splitView);
    splitB.addEventListener("click", function () {
      st.split = !st.split;
      document.body.classList.toggle("split-on", st.split);
      window.GATE_STORE.notify();
    });
    optRow.appendChild(splitB);
    body.appendChild(optRow);

    body.appendChild(el("div", "db-keys", d.keys));
    bar.appendChild(body);
  }

  function refreshClock(row) {
    var label = row.querySelector(".db-label");
    if (label) label.textContent = S().demoBar.clock + ": " + window.GATE_STORE.fmtClock(window.GATE_STORE.get().clock);
  }

  function updateStepLabel(span) {
    var st = window.GATE_STORE.get();
    if (!st.scenarioId) { span.textContent = ""; return; }
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
    var total = sc.events.length;
    /* st.step is the number of replayed events; the label is 1-based and never
       runs past the total, so terminal reads "Step 4 / 4", not "Step 5 / 4". */
    var current = Math.min(st.step + 1, total);
    span.textContent = "Step " + current + " / " + total + " — " + sc.name;
  }

  /* Disable Back at the first step and Next at the last one (no dead clicks). */
  function syncStepControls() {
    var st = window.GATE_STORE.get();
    var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
    var total = sc ? sc.events.length : 0;
    if (stepRefs.back) stepRefs.back.disabled = !sc || st.step <= 0;
    if (stepRefs.next) stepRefs.next.disabled = !sc || st.step >= total;
  }

  function switchSeat(seat) {
    var st = window.GATE_STORE.get();
    st.seat = seat;
    var home = { payer: "#/payer/checkout", merchant: "#/merchant/payments", compliance: "#/compliance/cases" }[seat];
    window.GATE_ROUTER.navigate(home);
    window.GATE_STORE.notify();
  }

  function loadScenario(id, startStep) {
    var sc = window.GATE_SCENARIOS.byId(id);
    if (!sc) return;
    /* reset() reinitializes `state`, so capture the fresh object AFTER it. */
    window.GATE_STORE.reset();
    var st = window.GATE_STORE.get();
    st.scenarioId = id;
    st.step = 0;
    if (startStep > 0) {
      for (var i = 0; i < startStep; i++) applyEvent(sc.events[i]);
      st.step = startStep;
    }
    window.GATE_STORE.notify();
  }

  function step(dir) {
    var st = window.GATE_STORE.get();
    if (!st.scenarioId) return;
    var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
    var next = st.step + dir;
    if (next < 0) next = 0;
    if (next > sc.events.length) next = sc.events.length;
    if (next === st.step) { syncStepControls(); return; }
    /* Rewind: reset reinitializes state; re-assert identity on the fresh object. */
    if (dir < 0) {
      window.GATE_STORE.reset();
      var fresh = window.GATE_STORE.get();
      fresh.scenarioId = sc.id;
      fresh.step = 0;
      for (var i = 0; i < next; i++) applyEvent(sc.events[i]);
      fresh.step = next;
    } else {
      while (st.step < next) {
        applyEvent(sc.events[st.step]);
        st.step++;
      }
    }
    syncStepControls();
    window.GATE_STORE.notify();
  }

  function applyEvent(ev) {
    var st = window.GATE_STORE.get();
    var P = window.GATE_STORE;
    switch (ev.type) {
      case "note":
        break;
      case "send": {
        var sc = window.GATE_SCENARIOS.byId(st.scenarioId);
        var p = P.byId(sc.paymentId);
        if (p && p.receivedSc == null) p.receivedSc = 0;
        P.setPaymentStatus(sc.paymentId, ev.status, { sc: ev.sc, wrongNetwork: ev.wrongNetwork, late: ev.late }, true);
        break;
      }
      case "advance":
      case "flag":
      case "requestInfo":
      case "approve":
      case "decline":
      case "freeze": {
        var sc2 = window.GATE_SCENARIOS.byId(st.scenarioId);
        var extra = {};
        if (ev.category) extra.category = ev.category;
        if (ev.deadlineHours != null) extra.deadlineHours = ev.deadlineHours;
        if (ev.internal) extra.internal = ev.internal;
        if (ev.note != null) extra.note = ev.note;
        if (ev.info) extra.info = ev.info;
        if (ev.infoProvided) extra.infoProvided = true;
        if (ev.text) extra.text = ev.text;
        P.setPaymentStatus(sc2.paymentId, ev.status, extra, true);
        break;
      }
      case "advanceClock": {
        if (ev.minutes != null) P.advanceClock(ev.minutes, "minutes");
        if (ev.hours != null) P.advanceClock(ev.hours, "hours");
        if (ev.days != null) P.advanceClock(ev.days, "days");
        if (ev.status) {
          var sc3 = window.GATE_SCENARIOS.byId(st.scenarioId);
          var extra2 = {};
          if (ev.text) extra2.text = ev.text;
          P.setPaymentStatus(sc3.paymentId, ev.status, extra2, true);
        } else {
          P.notify();
        }
        break;
      }
      case "volume":
        st.volume = ev.value;
        break;
    }
  }

  /* Keyboard: 1/2/3 seat, → next, R reset */
  function keys() {
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      var st = window.GATE_STORE.get();
      if (e.key === "1") switchSeat("payer");
      else if (e.key === "2") switchSeat("merchant");
      else if (e.key === "3") switchSeat("compliance");
      else if (e.key === "ArrowRight") step(1);
      else if (e.key.toLowerCase() === "r") {
        window.GATE_STORE.reset();
        loadScenario(st.scenarioId || window.GATE_SCENARIOS.list[0].id, 0);
      }
    });
  }

  /* Re-render demo bar + screens on store changes. */
  function observe() {
    window.GATE_STORE.subscribe(function () {
      build();
      window.GATE_ROUTER.render();
    });
  }

  window.GATE_DEMO = {
    build: build,
    switchSeat: switchSeat,
    loadScenario: loadScenario,
    step: step,
    applyEvent: applyEvent,
    keys: keys,
    observe: observe
  };
})();
