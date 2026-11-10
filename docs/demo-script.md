# Gate Prototype — 12-Minute Demo Script

## Setup
- Open `https://ace-werk.github.io/gate-prototype/` (or local `http://localhost:8080`)
- 1440px wide, 125% zoom
- Demo bar visible (press `H` to toggle)

---

### 0:00–0:30 — Demo map
**Show:** The three groups of scenario cards.
**Say:** "This is the Gate prototype. Every scenario is here — everyday payments, held payments, and timing exceptions. Each card links to a live demo."
**Do:** Point at the roadmap lines on each card. "Each one maps to a specific roadmap item."

### 0:30–2:30 — H1: Happy path
**Start:** Click "Start" on H1.
**Show:**
1. Payer checkout: Travel Rule questions (name, country, buyer question, sending-from)
2. Address safety: grouped address, network label, "Copy from this page" warning
3. Confirmations advancing (Tron 19)
4. Credited: rate applied, time shown
5. Merchant: balance tiles move (Available increases)
**Say:** "The payer answers three questions before they see the address. The address is grouped and labelled — this prevents poisoning and wrong-network sends. Confirmations advance on the demo clock. When released, funds convert at the current rate. The merchant's available balance moves in real time."

### 2:30–4:30 — E15: Top-up while part is held
**Start:** Click "Start" on E15.
**Show:**
1. Two transactions: Tx1 (60,000 USDT) held, Tx2 (8,073.52 USDT) cleared
2. Merchant: "Partially credited, part in review" — AED 29,353.50 credited
3. Compliance panel: approve Tx1
4. AED 218,146.50 credited. Total: AED 247,500.00
**Say:** "This is the key scenario. A payment arrives in two parts. The first part is held for screening; the second clears. The merchant sees 'Partially credited, part in review' with the exact amount. When Compliance approves the first transaction, the rest is credited. Two credits, one payment."

### 4:30–7:00 — E2: Third-party payer
**Start:** Click "Start" on E2.
**Show:**
1. Payer: "No, I am paying for the buyer" → relationship: parent
2. Transaction routed to review
3. Compliance panel: "Information requested" — proof of relationship + source of funds
4. Payer uploads (simulated)
5. Compliance approves
6. Payment cleared
**Say:** "The payer is not the buyer. They answer 'No' and say they are the buyer's parent. This does not block the payment — it routes the transaction to review. Compliance requests proof of relationship and source of funds. The payer uploads. Compliance approves. The payment clears."

### 7:00–8:30 — E3: Decline and refund
**Start:** Click "Start" on E3.
**Show:**
1. Held payment from exchange
2. Compliance: "Decline and refund"
3. S2: asks for refund address in payer's own exchange account
4. Explanation: "Payments from exchanges come from the exchange's shared wallet..."
5. 326,750.89 USDT refunded (326,752.89 − 2.00 network fee)
**Say:** "The payment is declined. Because it came from an exchange, we ask the payer for an address in their own account — not the exchange's shared wallet. The refund is the received amount minus the network fee. No conversion."

### 8:30–9:30 — E9: Late payment
**Start:** Click "Start" on E9.
**Show:**
1. Payment arrives after expiry
2. Automatically matched to the correct payment
3. Event: `payment.late_matched`
**Say:** "A payment arrives late. Instead of sitting in 'Unallocated funds' for Operations to trace, it is matched automatically. The event is sent to the merchant's system."

### 9:30–10:30 — Today vs Proposed
**Do:** Press `T` to toggle.
**Show:**
1. Held payment: Today = "Pending" no time → Proposed = neutral status, deadline, what's needed
2. Late payment: Today = "Unallocated funds" → Proposed = matched automatically
**Say:** "This switch shows what changes. Today, a held payment shows 'Pending' with no time. Proposed: a neutral status, a deadline, and what is needed. Today, a late payment is 'Unallocated funds.' Proposed: matched automatically."

### 10:30–12:00 — Events + CSV
**Show:**
1. S4: "Events sent to your system" — expand a few events
2. JSON payload: external status only, `Gate-Signature: demo`
3. S3: "Export CSV" — click, file downloads
**Say:** "The merchant's system receives events. Each payload has the external status, the amounts, and an idempotency key. No internal reasons, no risk scores, no screening results. And the finance team can export a CSV to reconcile."

---

## Backup
If the live link fails:
1. Open `docs/screens/` — step-by-step screenshots of every P0/P1 scenario
2. Open `docs/demo-backup.webm` — recorded run of this script
3. Open `file://` from the `prototype/` folder
