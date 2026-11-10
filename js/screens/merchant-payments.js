/* S3. Merchant: Payments (#/merchant/payments)
 *
 * Phase 3a rework (followup §3.5, §3.6):
 *  - Balance tiles: Available (AED), In review (AED equivalent at the current
 *    rate) and Collected this month (AED). Available excludes in-review and
 *    frozen amounts.
 *  - Export CSV: builds a real file from current state in the browser (Blob,
 *    no network) with the reconciliation columns finance teams ask for.
 *  - The list keeps its 0/1/200 volume states, filter and search, and shows
 *    each transaction's own status where a payment arrived in several.
 */
(function () {
  "use strict";
  function S() { return window.GATE_STRINGS; }
  function F() { return window.GATE_FIXTURES; }
  function G() { return window.GATE_STORE; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function gstShift(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + 4 * 3600000); // GST = UTC+4
  }
  function fmtGST(value) {
    var d = gstShift(value);
    if (!d) return "—";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() +
      ", " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " GST (UTC+4)";
  }
  function csvTime(value) {
    var d = gstShift(value);
    if (!d) return "";
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
      " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " GST (UTC+4)";
  }
  function fmtElapsed(ms) {
    var mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 60) return mins + " min";
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + " h" + (m ? " " + m + " min" : "");
    var d = Math.floor(h / 24), hh = h % 24;
    return d + " d" + (hh ? " " + hh + " h" : "");
  }
  function parseLabel(label) {
    var m = /^\s*(Unit [^,]+),\s*instalment\s+(\d+)\s+of\s+(\d+)/i.exec(label || "");
    if (!m) return null;
    return { unit: m[1].trim(), n: parseInt(m[2], 10), total: parseInt(m[3], 10) };
  }

  function render(app, params, query) {
    var st = G().get();
    var m = S().merchant;

    app.appendChild(el("h1", "screen-title", m.paymentsTitle));
    app.appendChild(el("div", "proto-badge", S().protoLabel));

    /* ---------- Balance tiles ---------- */
    var tiles = el("div", "tiles");
    tiles.dataset.anchor = "s3-tiles";
    var available = sumLedger("available");
    var inReview = sumLedger("in_review");
    var collected = collectedThisMonth();
    tiles.appendChild(tile(m.tiles.available, G().fmtAED(available), m.tiles.availableHint));
    tiles.appendChild(tile(G().statusLabel("held", "merchant"), G().fmtAED(inReview), m.tiles.inReviewHint));
    tiles.appendChild(tile(m.tiles.collected, G().fmtAED(collected), m.tiles.collectedHint));
    app.appendChild(tiles);

    /* ---------- Controls ---------- */
    var controls = el("div", "list-controls");
    var filter = document.createElement("select");
    filter.className = "select small";
    filter.setAttribute("aria-label", "Filter by status");
    ["all","paid","held","overdueHeld","action","partial","overpaid","declined","frozen","expired","needsManual","pending"].forEach(function (s) {
      var o = document.createElement("option");
      o.value = s;
      o.textContent = s === "all" ? m.filters.all : G().statusLabel(s, "merchant");
      filter.appendChild(o);
    });
    filter.addEventListener("change", function () { drawList(); });
    var search = document.createElement("input");
    search.type = "search"; search.className = "text-input small";
    search.placeholder = m.filters.placeholder;
    search.setAttribute("aria-label", m.filters.placeholder);
    search.addEventListener("input", function () { drawList(); });

    var exportBtn = el("button", "btn small", m.exportCsv);
    exportBtn.type = "button";
    exportBtn.id = "export-csv";
    exportBtn.addEventListener("click", exportCsv);

    controls.appendChild(filter);
    controls.appendChild(search);
    controls.appendChild(exportBtn);
    app.appendChild(controls);

    /* ---------- List ---------- */
    var listWrap = el("div", "payments-list");
    listWrap.id = "payments-list";
    listWrap.dataset.anchor = "s3-list";
    /* Fallback containment for wide content above the stacking breakpoint. */
    listWrap.style.overflowX = "auto";
    app.appendChild(listWrap);

    function sumLedger(type) {
      var n = 0;
      (st.ledger || []).forEach(function (l) {
        if (l.type === type) n += Number(l.amountAED) || 0;
      });
      return F().math.round2(n);
    }

    /* "Collected this month": available credits whose payment was credited in
     * the current GST calendar month. The demo clock is the source of truth. */
    function collectedThisMonth() {
      var now = gstShift(st.clock);
      var ym = now.getUTCFullYear() + "-" + now.getUTCMonth();
      var n = 0;
      st.payments.forEach(function (p) {
        var credited = (st.events || []).some(function (e) {
          if (e.paymentId !== p.id || e.type !== "payment.credited") return false;
          var d = gstShift(e.time || (e.payload && e.payload.created_at));
          return d && (d.getUTCFullYear() + "-" + d.getUTCMonth()) === ym;
        });
        if (!credited) return;
        (st.ledger || []).forEach(function (l) {
          if (l.paymentId === p.id && l.type === "available") n += Number(l.amountAED) || 0;
        });
      });
      return F().math.round2(n);
    }

    /* The filtered set without the 200-row repetition: what CSV exports. */
    function filteredPayments() {
      var fVal = filter.value;
      var q = (search.value || "").trim().toLowerCase();
      return st.payments.filter(function (p) {
        if (fVal !== "all" && p.status !== fVal) return false;
        if (q && p.id.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function drawList() {
      /* Real fixture records only: every value is derived and every row link
       * opens a payment that exists (broker P-1005 included). */
      var data = filteredPayments();
      if (st.volume === 0) {
        data = [];
      } else if (st.volume === 1) {
        var sc = st.scenarioId ? window.GATE_SCENARIOS.byId(st.scenarioId) : null;
        var active = sc && sc.paymentId ? data.filter(function (p) { return p.id === sc.paymentId; })[0] : null;
        data = active ? [active] : data.slice(0, 1);
      } else if (st.volume === 200 && data.length) {
        /* Keep the volume state visible: cycle the filtered set to 200 rows. */
        var pool = data;
        data = [];
        for (var i = 0; i < 200; i++) data.push(pool[i % pool.length]);
      }
      listWrap.innerHTML = "";
      if (data.length === 0) {
        var empty = el("div", "empty-state");
        empty.appendChild(el("div", "empty-icon", "▢"));
        empty.appendChild(el("div", "empty-title", m.empty));
        empty.appendChild(el("div", "empty-hint", m.emptyHint));
        listWrap.appendChild(empty);
        return;
      }
      /* Desktop: table. Mobile: stacked cards (CSS handles display). */
      var table = el("table", "data-table");
      var thead = el("thead");
      var hr = el("tr");
      ["ref","customer","payer","requested","received","credited","status","age"].forEach(function (k) {
        hr.appendChild(el("th", "th-" + k, m.table[k]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      data.forEach(function (p) {
        var tr = el("tr", "row");
        tr.tabIndex = 0;
        var project = F().projects.filter(function (x) { return x.id === p.projectId; })[0];
        var payerFixture = F().payers.filter(function (x) { return x.id === p.payerId; })[0];
        var payerName = p.payerName || (payerFixture ? payerFixture.name : null);
        var requestedAED = p.requestedFiatAED;
        var receivedSc = p.receivedSc || 0;
        var credited = p.creditedAED || 0;
        var held = p.status === "held" || p.status === "overdueHeld";
        var firstAt = firstActivity(p);
        var age = firstAt ? fmtElapsed(st.clock.getTime() - new Date(firstAt).getTime()) : "—";
        var txs = G().getTransactions(p.id);

        var tdRef = el("td", "");
        tdRef.dataset.label = m.table.ref;
        var a = el("a", "row-link", p.id);
        a.href = "#/merchant/payments/" + p.id;
        a.addEventListener("click", function (e) { e.preventDefault(); window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); });
        tdRef.appendChild(a);
        tr.appendChild(tdRef);
        var tdCust = el("td", "cell-wrap", project ? project.name : (payerName || "—")); tdCust.dataset.label = m.table.customer; tr.appendChild(tdCust);
        var tdPayer = el("td", "cell-wrap", payerName || "—"); tdPayer.dataset.label = m.table.payer; tr.appendChild(tdPayer);
        var tdReq = el("td", "num", requestedAED ? G().fmtAED(requestedAED) : "—"); tdReq.dataset.label = m.table.requested; tr.appendChild(tdReq);
        var tdRec = el("td", "num", receivedSc ? G().fmtSC(receivedSc, p.asset || "USDT") : "—"); tdRec.dataset.label = m.table.received; tr.appendChild(tdRec);
        var tdCred = el("td", "num", credited ? G().fmtAED(credited) : "—"); tdCred.dataset.label = m.table.credited; tr.appendChild(tdCred);
        var tdStatus = el("td", "");
        tdStatus.dataset.label = m.table.status;
        var chip = el("span", "chip tone-" + window.GATE_STATUSES.config[p.status].tone, G().statusLabel(p.status, "merchant"));
        tdStatus.appendChild(chip);
        if (txs.length > 1) {
          var txNote = el("div", "cell-sub", m.txCount.replace("{n}", String(txs.length)) + m.txSeparator + txs.map(txLabel).join(", "));
          tdStatus.appendChild(txNote);
        }
        if (held && G().variant("held").showDeadline) {
          var dueNote = el("div", "cell-sub");
          if (p.decisionDueBy) {
            var due = new Date(p.decisionDueBy);
            var leftMs = due.getTime() - new Date(st.clock).getTime();
            if (leftMs < 0) {
              dueNote.textContent = m.overdue;
              dueNote.className = "cell-sub overdue";
            } else {
              var hh = Math.floor(leftMs / 3600000), mm = Math.floor((leftMs % 3600000) / 60000);
              dueNote.textContent = m.heldCountdown.replace("{time}", hh + "h " + mm + "m");
            }
          } else {
            /* No decision deadline recorded: never let new Date(null) read as
               overdue since the epoch. */
            dueNote.textContent = "—";
          }
          tdStatus.appendChild(dueNote);
        }
        tr.appendChild(tdStatus);
        var tdAge = el("td", "muted", age); tdAge.dataset.label = m.table.age; tr.appendChild(tdAge);
        tr.addEventListener("click", function () { window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); });
        tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.GATE_ROUTER.navigate("#/merchant/payments/" + p.id); } });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      listWrap.appendChild(table);
    }

    function txLabel(tx) {
      var labels = S().transactions.status;
      return labels[tx.status] || tx.status;
    }

    function firstActivity(p) {
      var times = [];
      (st.events || []).forEach(function (e) {
        if (e.paymentId === p.id) times.push(e.time || (e.payload && e.payload.created_at));
      });
      if (times.length) {
        times.sort();
        return times[0];
      }
      if (p.timeline && p.timeline.length) return p.timeline[0].ts;
      return null;
    }

    /* ---------- CSV export (Blob, no network) ---------- */
    function exportCsv() {
      var list = filteredPayments();
      var header = ["reference","project","unit","instalment","payer","network","asset","transaction hash","received","rate","fee","credited AED","status","created_at","credited_at"];
      var out = [header];
      list.forEach(function (p) {
        var project = F().projects.filter(function (x) { return x.id === p.projectId; })[0];
        var payerFixture = F().payers.filter(function (x) { return x.id === p.payerId; })[0];
        var parsed = parseLabel(p.label);
        var created = firstActivity(p);
        var creditedEv = null;
        (st.events || []).forEach(function (e) {
          if (e.paymentId === p.id && e.type === "payment.credited") creditedEv = e.time || (e.payload && e.payload.created_at);
        });
        var status = p.externalStatus || p.derivedStatus || p.status;
        var txs = G().getTransactions(p.id);
        var base = [
          p.id,
          project ? project.name : "",
          parsed ? parsed.unit : "",
          parsed ? parsed.n + " of " + parsed.total : "",
          p.payerName || (payerFixture ? payerFixture.name : ""),
          p.network || "",
          p.asset || "",
          "",
          "",
          F().rates.AED_PER_USD.toFixed(4),
          "",
          "",
          status,
          csvTime(created),
          csvTime(creditedEv)
        ];
        if (!txs.length) {
          out.push(base);
          return;
        }
        txs.forEach(function (tx) {
          var fee = ledgerFor(p.id, tx.id, "fee");
          var credit = ledgerFor(p.id, tx.id, "available");
          var row = base.slice();
          row[5] = tx.network || p.network || "";
          row[6] = tx.asset || p.asset || "";
          row[7] = tx.hash || "";
          row[8] = Number(tx.amountSc) || 0;
          row[10] = fee == null ? "" : fee;
          row[11] = credit == null ? "" : credit;
          out.push(row);
        });
      });

      if (!list.length) {
        G().addToast(m.csvEmpty, "warning");
        return;
      }

      var csv = out.map(function (row) {
        return row.map(csvCell).join(",");
      }).join("\r\n");
      /* BOM so Excel opens the AED columns as UTF-8. */
      var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      var now = gstShift(st.clock);
      var name = "gate-payments-" + now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + "-gst.csv";
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      G().addToast(m.csvDone.replace("{rows}", String(out.length - 1)), "success");
    }

    function ledgerFor(paymentId, txId, type) {
      var found = null;
      (st.ledger || []).forEach(function (l) {
        if (l.paymentId === paymentId && l.txId === txId && l.type === type) found = Number(l.amountAED) || 0;
      });
      return found;
    }

    function csvCell(value) {
      var s = value == null ? "" : String(value);
      if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    drawList();

    function tile(k, v, hint) {
      var t = el("div", "tile");
      t.appendChild(el("div", "tile-value", v));
      t.appendChild(el("div", "tile-label", k));
      if (hint) t.appendChild(el("div", "cell-sub", hint));
      return t;
    }
  }

  window.GATE_ROUTER.register("merchant/payments", render, "merchant-payments");
})();
