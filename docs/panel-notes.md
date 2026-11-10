# Gate Prototype — Panel Notes

For each screen: the two questions a panellist is most likely to ask, and the answer.

## S1 — Payer Checkout

**Q1: Why do you ask the buyer question before showing the address?**
**A:** Third-party payment is the classic real-estate AML risk. If the payer is not the buyer, we need to know the relationship before the money moves. The question routes the transaction to review — it does not block the payment. This is the Travel Rule, designed in rather than added as a warning.

**Q2: How does the address display prevent losses?**
**A:** Address poisoning and wrong-network sends are real loss vectors on Tron. We group the address in 4-character blocks, emphasise the first and last 6 characters, show the network as a large label, and tell the payer to copy from this page every time — never from their wallet's history. The copy toast repeats the asset and network.

## S2 — Payer Status

**Q1: Why is the "In review" wording so neutral?**
**A:** Compliance-safe wording (R7). The payer never sees a screening result, a risk score, or an internal reason. They see a neutral status, a deadline, and what is needed from them. The wording is owned by Compliance, not the product team.

**Q2: Why do you ask for a refund address for exchange payments?**
**A:** Payments from exchanges come from the exchange's shared wallet, not the payer's account. A refund sent to the shared wallet is often lost or unattributable. We ask the payer for an address in their own exchange account. The refund goes only to an address that passes screening.

## S3 — Merchant Payments

**Q1: What does "Available" mean versus "In review"?**
**A:** Available is cleared, converted, and ready to use. In review is the AED equivalent of held transactions at the current rate — not yet available. Frozen amounts appear in neither. This is the ledger move from the roadmap: pending versus available.

**Q2: How does the merchant reconcile?**
**A:** Two ways. The CSV export has every field a finance team needs: reference, project, unit, instalment, payer, network, asset, hash, received, rate, fee, credited AED, status, timestamps. And the events panel shows exactly what was sent to their system, with idempotency keys.

## S4 — Merchant Payment Detail

**Q1: Why is screening per transaction, not per payment?**
**A:** Real payments arrive in multiple transactions, each screened on its own. A top-up can land while the first part is held (E15). Screening per transaction is how the hold workflow actually works in production.

**Q2: Why no internal reasons in the event payloads?**
**A:** Compliance-safe wording. Payers and merchants see the external status, the amounts, and the idempotency key. They never see a risk score, a screening result, or an internal reason. This is UAE tipping-off rules, to confirm with Legal. The internal reason lives in the case, which is Compliance tooling.
