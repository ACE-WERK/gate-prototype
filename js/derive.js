/* Gate Prototype — payment status derivation (followup §3.1, R1.1-adjacent).
 *
 * One pure function: same inputs always produce the same output.
 * No DOM access, no globals, no mutation of the argument objects, no clock.
 * The store calls this after every transaction mutation and copies the result
 * onto the payment; screens never compute status themselves.
 *
 * Derivation order (followup §3.1):
 *   1. Any transaction frozen              -> "frozen"
 *   2. Any transaction in review           -> "in_review",
 *      or "partially_credited_in_review" when another transaction cleared
 *   3. Otherwise, cleared total vs amount due:
 *        >= due * (1 + tolerancePct)      -> "overpaid"  (surplus)
 *        >= due * (1 - tolerancePct)      -> "paid"
 *        <  due                           -> "partial"   (shortfall)
 *      Nothing cleared and nothing in review -> "pending"
 *
 * Tolerance: the caller passes tolerancePct (fixtures: 0.005). The handoff's
 * second condition — shortfall at most 50.00 USDT — is optional through
 * options.toleranceAbsSc; the store passes RULES.underpaymentToleranceAbs so
 * the prototype follows the handoff rule while a plain three-argument call
 * follows the percentage rule written in the phase 1 spec.
 *
 * Credited AED is computed per cleared transaction, at the rate and fee given
 * in options (defaults: 1.00% real-estate fee, 3.6725 AED per USD — the
 * handoff's check values). The converted total is capped at the credit value
 * of the amount due, so an overpayment never inflates the credited figure.
 */
(function () {
  "use strict";

  var DEFAULT_FEE_PCT = 0.01;         // real-estate segment, the primary volume
  var DEFAULT_AED_PER_USD = 3.6725;   // handoff §8
  var DEFAULT_ASSET_USD = 1.00;       // USDT and USDC both 1.00 USD

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function round2(n) {
    return Math.round(num(n) * 100) / 100;
  }

  function isFrozen(tx) { return tx && tx.status === "frozen"; }
  function isInReview(tx) { return tx && tx.status === "in_review"; }
  function isCleared(tx) { return tx && tx.status === "cleared"; }

  /* AED value of a stablecoin amount, after the Gate fee. */
  function creditValue(amountSc, aedPerUsd, assetUsd, feePct) {
    return amountSc * aedPerUsd * assetUsd * (1 - feePct);
  }

  function derivePayment(transactions, amountDueSc, tolerancePct, options) {
    var txs = Array.isArray(transactions) ? transactions : [];
    var opts = options || {};

    var due = round2(amountDueSc);
    var tolerance = num(tolerancePct);
    var absCap = (opts.toleranceAbsSc == null) ? null : num(opts.toleranceAbsSc);
    var aedPerUsd = (opts.aedPerUsd == null) ? DEFAULT_AED_PER_USD : num(opts.aedPerUsd);
    var feePct = (opts.feePct == null) ? DEFAULT_FEE_PCT : num(opts.feePct);

    var clearedSc = 0;
    var inReviewSc = 0;
    var frozenSc = 0;
    var clearedCreditAed = 0;
    var anyFrozen = false;
    var anyInReview = false;
    var anyCleared = false;

    for (var i = 0; i < txs.length; i++) {
      var tx = txs[i];
      var amount = num(tx && tx.amountSc);
      var assetUsd = (opts.assetUsd == null) ? DEFAULT_ASSET_USD : num(opts.assetUsd);

      if (isFrozen(tx)) {
        frozenSc += amount;
        anyFrozen = true;
      } else if (isInReview(tx)) {
        inReviewSc += amount;
        anyInReview = true;
      } else if (isCleared(tx)) {
        clearedSc += amount;
        clearedCreditAed += creditValue(amount, aedPerUsd, assetUsd, feePct);
        anyCleared = true;
      }
    }

    clearedSc = round2(clearedSc);
    inReviewSc = round2(inReviewSc);
    frozenSc = round2(frozenSc);

    var status = "pending";
    var surplus = 0;
    var shortfall = 0;

    if (anyFrozen) {
      status = "frozen";
    } else if (anyInReview) {
      status = anyCleared ? "partially_credited_in_review" : "in_review";
    } else if (!anyCleared) {
      status = "pending";
    } else if (due <= 0) {
      status = "paid";
    } else if (clearedSc >= due * (1 + tolerance)) {
      status = "overpaid";
      surplus = round2(clearedSc - due);
    } else if (
      clearedSc >= due * (1 - tolerance) &&
      (absCap == null || due - clearedSc <= absCap)
    ) {
      status = "paid";
    } else {
      status = "partial";
      shortfall = round2(due - clearedSc);
    }

    var creditCap = round2(creditValue(due, aedPerUsd, DEFAULT_ASSET_USD, feePct));
    var creditedAED = anyCleared ? round2(Math.min(clearedCreditAed, creditCap)) : 0;

    return {
      status: status,
      clearedSc: clearedSc,
      inReviewSc: inReviewSc,
      frozenSc: frozenSc,
      creditedAED: creditedAED,
      surplus: surplus,
      shortfall: shortfall
    };
  }

  window.GATE_DERIVE = {
    derivePayment: derivePayment
  };
})();
