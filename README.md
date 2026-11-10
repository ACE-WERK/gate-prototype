# Gate — Payment Workflow Prototype

A clickable HTML/CSS/JS prototype for **Gate**, a stablecoin payment gateway for UAE real-estate developers. Built as a case-study exercise (ARP Digital interview). Three user seats — **payer**, **merchant**, **compliance** — share one live state across 14 scripted demo scenarios.

No build step, no server, no dependencies. Open `index.html` and click.

---

## Quick start

```bash
# Option 1: open directly
open index.html          # macOS
xdg-open index.html      # Linux

# Option 2: serve locally (optional)
python3 -m http.server 8080
# → http://localhost:8080
```

Works over `file://` and any static host (GitHub Pages, Netlify, S3). Zero network requests after the initial page load — fonts are self-hosted.

---

## What it demos

| Seat | Screens | What you can do |
|------|---------|-----------------|
| **Payer** | Checkout, Payment status | Fill the form, select USDT/USDC + network, submit, watch the payment progress through detected → checks → confirmed → paid (or flagged, overpaid, partial, etc.) |
| **Merchant** | Payments list, Payment detail | Browse the ledger (0/1/200 row volumes), open any payment, see the timeline, apply or refund surpluses, see compliance-safe status labels |
| **Compliance** | Case queue, Case detail | Review flagged cases, approve / decline / freeze / request info, see internal screening labels and risk context |

All three seats read the **same store**. When compliance approves a held case, the merchant's detail page updates in the same session.

---

## Demo controls (the bar at the top)

| Control | What it does |
|---------|-------------|
| **Seat** (Payer / Merchant / Compliance) | Switch the active user role. Each seat only sees its own screens. |
| **Scenario** dropdown | 14 presets: `H1` happy path + `E1`–`E13` edge cases (underpaid, flagged, overpaid, frozen, expired, wrong network, split view, volume states, etc.) |
| **Step / Back / Next** | Advance or rewind through the scenario's events one at a time. The counter shows `Step N / M`. |
| **Reset** | Returns to step 1 of the **current scenario** (state is preserved, not wiped). This is the primary "start over" control for presenters. |
| **Advance 1 hour / 1 day** | Push the demo clock forward for time-based scenarios (pool expiry, decision deadlines). |
| **Volume** (0 / 1 / 200) | Merchant list density: empty state, single row, or 200 rows with pagination. |
| **Split view** | Shows two seats side by side (e.g. payer + merchant) so the presenter can demonstrate cross-seat reactivity without clicking. |

### Presenter workflow

1. Pick a scenario from the dropdown.
2. Click **Next** to step through events, or **Reset** to go back to step 1.
3. Toggle seats to show the same state from different perspectives.
4. Use **Split view** to show payer + merchant reacting simultaneously.
5. **Reset** at any point restarts the current scenario from step 1 without losing the seat or scenario selection.

---

## The 14 scenarios

| ID | Priority | Name | Terminal state |
|----|----------|------|---------------|
| H1 | P0 | Happy path: exact payment clears | paid |
| E1 | P0 | Underpaid, then topped up | partial → paid |
| E2 | P0 | Flagged, info requested, approved | action → paid |
| E3 | P1 | Flagged, declined and refunded | declined |
| E4 | P1 | Flagged, frozen | frozen |
| E5 | P1 | Overpaid | overpaid (surplus 270.59 USDT) |
| E6 | P1 | Shortfall within tolerance | partial |
| E7 | P1 | Hold passes its deadline | overdueHeld |
| E8 | P1 | Pooled link expires unpaid | expired |
| E9 | P1 | Late payment after expiry | partial |
| E10 | P1 | Form validation | pending (client-side validation demo) |
| E11 | P1 | List volume states | volume toggle (0/1/200) |
| E12 | P2 | Wrong network / unsupported asset | needsManual |
| E13 | P2 | Split view demo | held |

Each scenario is a sequence of typed events (`send`, `advance`, `flag`, `note`, `volume`, `advanceClock`) applied to the shared store. The handoff spec (`GATE_PROTOTYPE_HANDOFF.md` in the parent `Case Study/` directory) documents the exact expected values per scenario.

---

## Architecture

```
index.html                  Single entry point
├── design-system.css       All design tokens + components (CSS custom properties)
├── css/app.css             Layout-only (grid, flex, positioning) — no tokens
├── design-system.html      Token/component specimen page (for design review)
│
└── js/
    ├── app.js              Bootstrap: imports, store init, router start
    ├── store.js            State store, fixtures, formatters (fmtAED/fmtSC), toasts, G() accessor
    ├── scenarios.js        14 scenario definitions (typed event lists)
    ├── demo-bar.js         Demo controls: seat, scenario, step, clock, volume, split view
    ├── router.js           Hash-based router (#/payer/checkout, #/merchant/payments/:id, …)
    ├── fixtures.js         Payment + project fixture data
    ├── strings.js          All user-facing copy (compliance-safe labels)
    ├── statuses.js         Status → label/colour/timeline mapping
    │
    └── screens/
        ├── payer-checkout.js     S1: Form + stablecoin/network select
        ├── payer-status.js       S2: Timeline + status variants (paid, overpaid, partial, held, …)
        ├── merchant-payments.js  S3: Ledger (0/1/200 volumes, monthly total, deep-links)
        ├── merchant-payment-detail.js  S4: Payment detail + timeline + surplus actions
        └── compliance-case.js    S5: Case queue + detail + action dialog (approve/decline/freeze/request)
```

### Key design decisions

- **Single store, no framework.** `window.GATE_STORE` is a plain object with `get()`, `set()`, `notify()` (DOM re-render on change). No React, no Vue, no framework. ~2,200 lines of JS total.
- **Compliance-safe wording (R1.5).** Payers and merchants never see screening results, risk scores, or internal reasons. The store stores `internal: true` on timeline entries; screens filter them by seat. Merchant sees "Payment is above the review threshold" — not "Enhanced due diligence / AML screening".
- **Design tokens in one file (R1.6).** All colours, spacing, type sizes, radii, shadows live in `design-system.css` as `--*` custom properties. `css/app.css` contains layout rules only. `design-system.html` is a specimen page showing every token.
- **No external dependencies (R5).** No `fetch()`, no ES modules, no CDN links. Classic `<script defer>` tags only. Works offline, over `file://`.
- **Self-hosted variable fonts (R2).** Readex Pro (display) + Google Sans Flex (body), single woff2 per family, latin subset. ~170 KB total.
- **Hash routing.** `#/seat/screen` with optional `?scenario=X&step=N` for deep-linking. The demo bar, router, and store stay in sync.

---

## Compliance safety

The prototype enforces a hard rule: **internal compliance data never leaks to payer or merchant screens.**

- Timeline entries carry an `internal: true` flag. Merchant/payer screens filter them out; compliance sees everything.
- Status labels are translated: `Screening` → `Payment is above the review threshold` (merchant), `Held for review` (payer).
- The QA check: load H1, switch to merchant, scan the page text for "screening", "risk", "AML", "sanction" → **zero matches**. Switch to compliance → **visible**.

---

## File formats and constraints honoured

| Constraint | How it's met |
|-----------|-------------|
| R1.3 — One screen = one file | Each screen is a standalone `.js` in `js/screens/`, registered with the router |
| R1.4 — Real calculated values | All amounts computed from the rate (3.6 AED/USDT) + fee (2.4% AED), verified against the handoff QA table |
| R1.5 — Compliance-safe wording | Internal timeline entries redacted per seat; status labels translated |
| R1.6 — Tokens in one file | `design-system.css` is the only source of design token values |
| R2 — Self-hosted variable fonts | Two woff2 files in `assets/fonts/`, latin subset, `@font-face` in `design-system.css` |
| R4 — Single token+component file | `design-system.css` (tokens + components); `css/app.css` (layout only) |
| R5 — No fetch/modules/CDN | Classic `<script defer>`, zero network requests after load |
| R7 — Compliance screen isolation | Compliance sees internal labels; payer/merchant see safe labels |

---

## Design system specimen

Open `design-system.html` for a full token reference: every colour (with contrast ratios), spacing step, type size, radius, shadow, and component variant rendered as a specimen. Useful for design review and token handoff.

---

## Browser support

Tested in Chrome and Firefox (desktop). Uses:
- CSS custom properties, grid, flexbox, `clamp()`
- `IntersectionObserver` (merchant list pagination)
- `navigator.clipboard` (copy with fallback)
- No polyfills needed for modern evergreen browsers.

---

## File inventory

```
assets/fonts/
  GoogleSansFlex-Variable.woff2      32 KB (body, variable weight 300–800)
  ReadexPro-Variable.woff2           136 KB (display, variable weight 400–700)
css/
  app.css                            Layout-only (grid, flex, positioning)
js/
  app.js                             Bootstrap
  demo-bar.js                        Demo controls
  fixtures.js                        Payment/project fixtures
  router.js                          Hash router
  scenarios.js                       14 scenario definitions
  store.js                           State + formatters + toasts
  statuses.js                        Status mappings
  strings.js                         All user-facing copy
  screens/
    compliance-case.js               S5
    merchant-payment-detail.js       S4
    merchant-payments.js             S3
    payer-checkout.js                S1
    payer-status.js                  S2
design-system.css                    Tokens + components
design-system.html                   Specimen page
index.html                           Entry point
README.md                            This file
```

**20 files · ~3,300 lines (JS + CSS + HTML) · ~372 KB total**
