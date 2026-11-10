# Gate Prototype — Assumptions

All values below are illustrative fixtures for the demo. They are not live rates, fees, or thresholds.

## Confirmation counts
- Tron: 19 confirmations to finality
- Ethereum: 12 confirmations to finality
- Labelled "illustrative" in the UI.

## Travel Rule thresholds
- UAE entity: AED 3,500 (transactions above this trigger Travel Rule data collection)
- Bahrain entity: AED 0 (applies to all amounts)
- Owned by Compliance. To confirm.

## Working weeks
- UAE entity: Monday to Friday
- Bahrain entity: Sunday to Thursday
- Used for the 24-hour hold deadline (working days only). To confirm with Compliance.

## Network fee
- 2.00 USDT (Tron) per refund transaction
- Applied to all refunds. No conversion.

## Demo exchange names
- "Exchange A", "Exchange B", "Other exchange"
- Illustrative. Real exchange names would be configured per merchant.

## Fee rate
- 2.4% on real-estate segment payments
- Illustrative. Actual rate depends on merchant agreement.

## Exchange rate
- 3.6 AED per USDT (fixed for the demo)
- In production, the rate would be fetched at release time.

## Overpayment tolerance
- 0.5% (0.005) of the amount due, or 50.00 USDT, whichever is larger
- Above tolerance: "Overpaid" with surplus. Below: "Paid" (tolerance absorbed).

## Hold deadline
- 24 working days from detection
- Working days per entity working week (see above)
