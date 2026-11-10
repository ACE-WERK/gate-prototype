# Gate Prototype — Decisions Log

## 1. Screening per transaction
**Decision:** Screening, holds, and crediting happen per transaction, not per payment.
**Why:** Real payments arrive in multiple transactions, each screened independently. A top-up can land while the first part is held (scenario E15).
**Roadmap:** Quarter 1 · Hold workflow (18% of quarter 1 effort)

## 2. Conversion at release
**Decision:** Funds convert when released, at that moment's rate. While held, they stay in stablecoin.
**Alternative:** Convert on receipt.
**Trade-off:** Converting on receipt removes depeg exposure while held, but frozen funds may not be converted, and a refund would need converting back. Converting at release keeps held funds in stablecoin and only locks the rate at the moment of release.
**Roadmap:** Quarter 1 · Conversion service

## 3. Third-party payer route
**Decision:** If the payer answers "No" to "Are you the buyer named on the sale agreement?", the transaction is routed to review with "Information requested." The payment is not blocked.
**Why:** Third-party payment is the classic real-estate AML risk. The relationship (spouse, parent, buyer's company, other) determines what information is needed.
**Roadmap:** Quarter 1 · Hold workflow

## 4. Refund address rule
**Decision:** Payments from exchanges come from the exchange's shared wallet. Refunds are sent to an address in the payer's own exchange account, not the sending address.
**Why:** Refunds sent to the exchange's shared wallet are often lost or unattributable. The payer must provide an address in their own account.
**Roadmap:** Quarter 2 · Refund automation

## 5. Payloads without reasons
**Decision:** Event payloads carry the external status only. No internal reason, risk score, or screening result, ever.
**Why:** Compliance-safe wording (R7). Payers and merchants must never see screening results or internal reasons. Only merchant-safe reason categories appear in events.
**Roadmap:** Quarter 1 · Integration surface

## 6. Working-day deadline
**Decision:** The 24-hour hold deadline is counted on working days only. Working week: Monday to Friday for the UAE entity, Sunday to Thursday for the Bahrain entity.
**Why:** Compliance teams operate on local working weeks. A weekend hold does not advance the clock.
**Assumption:** Both working weeks are fixtures for Compliance to confirm.
**Roadmap:** Quarter 1 · Hold workflow

## 7. Status derivation as pure function
**Decision:** Payment status is derived from transactions by one pure function (`js/derive.js`), called by the store after every transaction mutation.
**Why:** R1.1 — statuses defined once. Screens never compute status themselves. The same inputs always produce the same output. No DOM access, no globals, no mutation.
**Roadmap:** Quarter 1 · Core engine

## 8. Four screens, not five
**Decision:** S5 (Compliance analyst screen) removed. Compliance decisions move to the demo bar's Compliance panel, which is demo tooling, not a product screen.
**Why:** The case allows 3 to 5 screens. Four leaves room and keeps the story tight. The panel demonstrates the decision workflow without a full product screen.
**Roadmap:** Out of scope for this demo
