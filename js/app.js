/* Gate Prototype — app entry.
 * Classic deferred script; no modules, no fetch (R5). */
(function () {
  "use strict";

  function boot() {
    var store = window.GATE_STORE;
    store.init();

    /* Build the app shell bits that screens depend on. */
    var proto = document.getElementById("proto-label");
    if (proto) proto.textContent = window.GATE_STRINGS.protoLabel;

    /* Parse any deep link: ?scenario=E2&step=3 */
    var q = parseQuery();
    var st = store.get();
    /* Capture the deep link before anything can reset navigation state. */
    var targetHash = window.location.hash;
    var linkSeat = seatFromHash(targetHash);
    var seat = (q.seat && ["payer","merchant","compliance"].indexOf(q.seat) !== -1) ? q.seat : linkSeat;
    if (seat) st.seat = seat;
    if (q.scenario) {
      var sc = window.GATE_SCENARIOS.byId(q.scenario);
      if (sc) {
        var keepSeat = seat || st.seat;
        if (sc.paymentId) store.reset();
        st = store.get();
        st.seat = keepSeat;
        st.scenarioId = sc.id;
        var stepTo = Math.min(parseInt(q.step || "0", 10) || 0, sc.events.length);
        for (var i = 0; i < stepTo; i++) window.GATE_DEMO.applyEvent(sc.events[i]);
        st.step = stepTo;
      }
    }

    /* reset() no longer touches the hash; restore the deep link regardless. */
    if (targetHash && targetHash !== "#" && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }

    /* If the deep link points at a specific payment/case, jump there. */
    var hash = window.location.hash || "";
    var home = { payer: "#/payer/checkout", merchant: "#/merchant/payments", compliance: "#/compliance/cases" }[st.seat];
    if (!hash || hash === "#") window.location.hash = home;

    window.GATE_DEMO.observe();
    window.GATE_DEMO.build();
    window.GATE_DEMO.keys();
    window.GATE_ROUTER.start();

    /* Toast host */
    var toastHost = document.getElementById("toast-host");
    store.subscribe(function () {
      if (!toastHost) return;
      toastHost.innerHTML = "";
      st.toasts.forEach(function (t) {
        var d = document.createElement("div");
        d.className = "toast tone-" + t.tone;
        d.textContent = t.text;
        toastHost.appendChild(d);
      });
    });
  }

  /* "#/merchant/..." -> "merchant"; null when the hash is not a seat route. */
  function seatFromHash(hash) {
    var m = /^#\/(payer|merchant|compliance)(\/|$|\?)/.exec(hash || "");
    return m ? m[1] : null;
  }

  function parseQuery() {
    var out = {};
    var q = (window.location.hash.split("?")[1] || "").split("&");
    q.forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      out[p[0]] = decodeURIComponent(p[1] || "");
    });
    return out;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
