/* Gate Prototype — route table (R1.3).
 * Adding a screen = one file (screens/<name>.js registering here) + one route entry.
 *
 * Phase 3a: four product screens and two seats (payer, merchant). `#/` belongs
 * to the demo map, which is demo tooling rather than a seat screen; the route
 * resolves to the "demo-map" registration as soon as phase 3b provides it and
 * falls back to the seat's home screen until then. */
(function () {
  "use strict";

  var routes = [];
  var screenRegistry = {};

  function register(pattern, handler, name) {
    routes.push({ pattern: pattern, handler: handler, name: name });
    screenRegistry[name] = { pattern: pattern, handler: handler };
  }

  function parse(hash) {
    var h = (hash || "").replace(/^#\/?/, "");
    var parts = h.split("?");
    var segs = parts[0].split("/").filter(Boolean);
    var query = {};
    if (parts[1]) {
      parts[1].split("&").forEach(function (kv) {
        var p = kv.split("=");
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
    }
    return { segs: segs, query: query, raw: hash };
  }

  function match(route, segs) {
    var r = route.pattern.split("/").filter(Boolean);
    if (r.length !== segs.length) return null;
    var params = {};
    for (var i = 0; i < r.length; i++) {
      if (r[i].charAt(0) === ":") params[r[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (r[i] !== segs[i]) return null;
    }
    return params;
  }

  /* Seat-scoped routes are named "<seat>-<screen>". Demo tooling (the demo
   * map) is named "demo-..." and is visible from any seat. */
  function seatOf(name) {
    if (String(name).indexOf("demo-") === 0) return null;
    return String(name).split("-")[0];
  }

  function render() {
    var app = document.getElementById("screen");
    if (!app) return;
    var parsed = parse(window.location.hash);
    var seat = window.GATE_STORE.get().seat;
    /* Phase 3a: only payer and merchant are seats. The demo bar still exposes
     * a "compliance" seat until phase 3b replaces it with its decision panel;
     * until then an unknown seat falls back to the payer rather than a blank
     * screen. */
    if (seat !== "payer" && seat !== "merchant") seat = "payer";

    /* Home: the demo map. Not a seat screen; phase 3b registers it. */
    if (!parsed.segs.length) {
      var demo = screenRegistry["demo-map"];
      if (demo) {
        app.innerHTML = "";
        demo.handler(app, {}, parsed.query);
        window.scrollTo(0, 0);
        return;
      }
    }

    /* Gate: a seat can only see its own screens. */
    for (var i = 0; i < routes.length; i++) {
      var m = match(routes[i], parsed.segs);
      if (!m) continue;
      var screenSeat = seatOf(routes[i].name);
      if (screenSeat && screenSeat !== seat) continue;
      app.innerHTML = "";
      routes[i].handler(app, m, parsed.query);
      window.scrollTo(0, 0);
      return;
    }

    /* No match for this seat: show its home screen. */
    var home = { payer: "payer-checkout", merchant: "merchant-payments" }[seat];
    var homeRoute = home ? screenRegistry[home] : null;
    if (homeRoute) {
      app.innerHTML = "";
      homeRoute.handler(app, {}, parsed.query);
    }
  }

  function navigate(hash) {
    if (window.location.hash === hash) render();
    else window.location.hash = hash;
  }

  function start() {
    window.addEventListener("hashchange", render);
    render();
  }

  window.GATE_ROUTER = {
    register: register,
    start: start,
    render: render,
    navigate: navigate,
    registry: screenRegistry
  };
})();
