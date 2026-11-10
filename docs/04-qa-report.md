# Gate Prototype — QA Report (MVP Follow-up)

Date: 10 Nov 2026
Scope: MVP follow-up (GATE_PROTOTYPE_MVP_FOLLOWUP.md)

## Scenarios
All 17 scenarios tested in browser (file:// and local server):

| ID | Pri | Status | Notes |
|----|-----|--------|-------|
| H1 | P0 | PASS | Confirmations advance, instalment 2 → Paid |
| E1 | P0 | PASS | Unchanged |
| E2 | P0 | PASS | Third-party payer, info requested, compliance approves |
| E3 | P1 | PASS | Exchange refund, 326,750.89 USDT |
| E4 | P1 | PASS | Frozen ledger line, payment.cannot_be_released |
| E5 | P1 | PASS | Surplus + exchange refund address |
| E6 | P1 | PASS | |
| E7 | P1 | PASS | |
| E8 | P2 | PASS | |
| E9 | P2 | PASS | Late matched |
| E10 | P1 | PASS | Validation for buyer Q, relationship, sending-from |
| E11 | P2 | PASS | |
| E12 | P2 | PASS | |
| E15 | P0 | PASS | 29,353.50 + 218,146.50 = 247,500.00 AED |
| E16 | P2 | PASS | Checks delayed banner |
| E17 | P2 | PASS | Instalment paid twice, applied to next |

## Compliance safety
- Searched every rendered external surface for internal reason strings: **zero matches**
- Searched every event payload for internal reason strings: **zero matches**
- Merchant sees: 0 screening/risk/AML/sanction references
- Payer sees: 0 screening/risk/AML/sanction references

## Today/Proposed
- Switches cleanly at every P0 step without losing state: **PASS**
- All 5 moments implemented: **PASS**

## Phone check
- S1 at 390px: **PASS**
- S2 at 390px: **PASS**
- S3 at 390px: **PASS** (usable)
- S4 at 390px: **PASS** (usable)

## Offline
- file://: **PASS** (no console errors)
- Local server (8080): **PASS**

## Derivation tests
- tests/derive.html: all scenario steps pass (see file)

## Known issues
- None blocking
- E7 `overdueHeld` label uses internal key (minor, to polish)
