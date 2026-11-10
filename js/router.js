/* Gate Prototype — route table (R1.3).
 * Adding a screen = one file (screens/<name>.js registering here) + one route entry. */
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

  function render() {
    var app = document.getElementById("screen");
    if (!app) return;
    var parsed = parse(window.location.hash);
    var seat = window.GATE_STORE.get().seat;
    /* Gate: a seat can only see its own screens. */
    for (var i = 0; i < routes.length; i++) {
      var m = match(routes[i], parsed.segs);
      if (!m) continue;
      var screenSeat = routes[i].name.split("-")[0];
      if (screenSeat !== seat) continue;
      app.innerHTML = "";
      routes[i].handler(app, m, parsed.query);
      window.scrollTo(0, 0);
      return;
    }
    /* No match for this seat: show its home screen. */
    var home = { payer: "payer-checkout", merchant: "merchant-payments", compliance: "compliance-case" }[seat];
    var homeRoute = screenRegistry[home];
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
