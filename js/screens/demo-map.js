/* Demo map (#/) — demo tooling, not a product screen (followup §4.1).
 *
 * Three groups of scenario cards. Each card reads its scenario name and
 * priority from GATE_SCENARIOS, so adding a scenario stays one data entry;
 * only the one-line description, the seat and the roadmap line live here.
 *
 * Start opens the seat where the behaviour is easiest to see, at step 1:
 * the scenario is loaded at the first step (the demo bar labels it
 * "Step 1 / n"), then the seat is set on the fresh state object
 * (loadScenario resets it) and the router navigates.
 *
 * Phase 3b note: followup §4.1 lists 14 scenarios in the three groups and
 * omits E10 (form validation), E11 (list volume) and E13 (split view), which
 * are demo-tooling checks rather than payment states. The phase brief asks
 * for all 17, so the three are appended to the groups they exercise.
 */
(function () {
  "use strict";

  function S() { return window.GATE_STRINGS; }
  function G() { return window.GATE_STORE; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var GROUPS = [
    {
      id: "everyday",
      cards: [
        {
          id: "H1", seat: "payer", href: "#/payer/status",
          blurb: "Exact amount on TRC-20; confirmations advance, then the instalment clears.",
          roadmap: "Quarter 1 · Checkout and crediting"
        },
        {
          id: "E1", seat: "payer", href: "#/payer/status",
          blurb: "8,073.52 USDT short, then topped up to the same address and paid in full.",
          roadmap: "Quarter 1 · Partial payments and top-ups"
        },
        {
          id: "E5", seat: "merchant", href: "#/merchant/payments/P-1004",
          blurb: "270.59 USDT surplus shown to both sides, then refunded to the payer's own account.",
          roadmap: "Quarter 1 · Overpayment and surplus"
        },
        {
          id: "E6", seat: "merchant", href: "#/merchant/payments/P-1002",
          blurb: "25.00 USDT short, inside the 0.5% and 50 USDT tolerance, so it clears as Paid.",
          roadmap: "Quarter 1 · Underpayment tolerance"
        },
        {
          id: "E10", seat: "payer", href: "#/payer/checkout",
          blurb: "Submitting without the Travel Rule answers shows inline errors and withholds the address.",
          roadmap: "Quarter 1 · Travel Rule capture"
        }
      ]
    },
    {
      id: "held",
      cards: [
        {
          id: "E2", seat: "payer", href: "#/payer/status",
          blurb: "Payer answers No (parent); information is requested, then approved in the panel.",
          roadmap: "Quarter 1 · Hold workflow, 18%"
        },
        {
          id: "E15", seat: "merchant", href: "#/merchant/payments/P-1015",
          blurb: "60,000 USDT held while 8,073.52 clears; approved and credited in two parts.",
          roadmap: "Quarter 1 · Ledger states, 20%"
        },
        {
          id: "E3", seat: "payer", href: "#/payer/status",
          blurb: "Held payment from an exchange; declined and refunded to the payer's own account.",
          roadmap: "Quarter 1 · Hold workflow, 18% · Refund address"
        },
        {
          id: "E4", seat: "merchant", href: "#/merchant/payments/P-1004",
          blurb: "Freeze after a screening alert; payer and merchant see neutral wording only.",
          roadmap: "Quarter 1 · Hold workflow, 18% · Neutral wording"
        },
        {
          id: "E7", seat: "merchant", href: "#/merchant/payments/P-1003",
          blurb: "The 24-hour decision deadline passes and the case is escalated as overdue.",
          roadmap: "Quarter 1 · Hold workflow, 18% · Deadline SLA"
        },
        {
          id: "E13", seat: "merchant", href: "#/merchant/payments/P-1003",
          blurb: "Two seats side by side while a payment is held, using the split view.",
          roadmap: "Quarter 1 · Hold workflow, 18%"
        }
      ]
    },
    {
      id: "timing",
      cards: [
        {
          id: "E8", seat: "payer", href: "#/payer/status",
          blurb: "The pooled link timer runs out with nothing sent and the address returns to the pool.",
          roadmap: "Quarter 1 · Pooled checkout expiry"
        },
        {
          id: "E9", seat: "payer", href: "#/payer/status",
          blurb: "500 USDT arrives four minutes after expiry and is matched automatically.",
          roadmap: "Quarter 1 · Late payment matching"
        },
        {
          id: "E12", seat: "payer", href: "#/payer/status",
          blurb: "136,147.04 USDT sent on ERC-20 to a TRC-20 checkout; flagged for manual review.",
          roadmap: "Quarter 1 · Address safety"
        },
        {
          id: "E16", seat: "merchant", href: "#/merchant/payments/P-1004",
          blurb: "The screening provider is delayed; no case opens and checks clear with the clock.",
          roadmap: "Quarter 1 · Checks SLA"
        },
        {
          id: "E17", seat: "merchant", href: "#/merchant/payments/P-1001",
          blurb: "Instalment 2 paid twice; the extra is applied to instalment 3 and the schedule updates.",
          roadmap: "Quarter 1 · Instalment schedule"
        },
        {
          id: "E11", seat: "merchant", href: "#/merchant/payments",
          blurb: "Merchant list at 0, 1 and 200 rows for layout and empty-state checks.",
          roadmap: "Quarter 1 · Merchant list"
        }
      ]
    }
  ];

  function render(app) {
    var d = S().demoMap;

    var header = el("header", "dm-header");
    var titleRow = el("div", "dm-title-row");
    titleRow.appendChild(el("h1", "dm-title", d.title));
    titleRow.appendChild(el("span", "dm-label", d.label));
    header.appendChild(titleRow);
    header.appendChild(el("p", "dm-intro", d.intro));
    app.appendChild(header);

    GROUPS.forEach(function (group) {
      var section = el("section", "dm-group");
      section.setAttribute("aria-labelledby", "dm-group-" + group.id);
      var h2 = el("h2", "dm-group-title", d.groups[group.id]);
      h2.id = "dm-group-" + group.id;
      section.appendChild(h2);

      var grid = el("div", "dm-cards");
      group.cards.forEach(function (card) {
        grid.appendChild(cardEl(card));
      });
      section.appendChild(grid);
      app.appendChild(section);
    });

    app.appendChild(el("p", "dm-foot", "Demo map · step controls and the simulated Compliance decision live in the demo bar above."));
  }

  function cardEl(card) {
    var sc = window.GATE_SCENARIOS.byId(card.id);
    var name = sc ? sc.name : card.id;
    var priority = sc ? sc.priority : "";

    var article = el("article", "dm-card");
    article.dataset.scenario = card.id;

    var head = el("div", "dm-card-head");
    head.appendChild(el("span", "dm-id", card.id));
    if (priority) head.appendChild(el("span", "dm-priority", priority));
    article.appendChild(head);

    article.appendChild(el("h3", "dm-card-title", name));
    article.appendChild(el("p", "dm-card-blurb", card.blurb));

    var foot = el("div", "dm-card-foot");
    foot.appendChild(el("span", "dm-roadmap", card.roadmap));
    var btn = el("button", "btn small dm-start", S().demoMap.start);
    btn.type = "button";
    btn.setAttribute("aria-label", S().demoMap.start + " " + card.id + " — " + name);
    btn.addEventListener("click", function () { start(card); });
    foot.appendChild(btn);
    article.appendChild(foot);

    return article;
  }

  function start(card) {
    var sc = window.GATE_SCENARIOS.byId(card.id);
    if (!sc) return;
    /* Step 1 is the first step in the bar's 1-based label (nothing applied
     * yet). loadScenario resets state, so the seat is set on the object it
     * leaves behind. */
    window.GATE_DEMO.loadScenario(card.id, 0);
    var st = G().get();
    st.seat = card.seat;
    G().notify();
    window.GATE_ROUTER.navigate(card.href);
  }

  window.GATE_ROUTER.register("/", render, "demo-map");
})();
