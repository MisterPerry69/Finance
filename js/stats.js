/* ============================================
   TIDE — Logbook (stats pane): vista Mese / Anno
   Tutto calcolato dalla cache locale: cambiare periodo è istantaneo.
   ============================================ */

let _statsMode = "month";   // "month" | "year"
let _statsYM   = "";
let _statsYear = 0;

document.addEventListener("DOMContentLoaded", () => {
  _statsYM   = currentYM();
  _statsYear = new Date().getFullYear();

  document.getElementById("stats-mode-month").addEventListener("click", () => _setStatsMode("month"));
  document.getElementById("stats-mode-year").addEventListener("click",  () => _setStatsMode("year"));
  document.getElementById("stats-month-prev").addEventListener("click", () => _stepStats(-1));
  document.getElementById("stats-month-next").addEventListener("click", () => _stepStats(+1));

  // Carburante: pagina dedicata, aperta sullo stesso periodo del Logbook
  document.getElementById("stats-fuel-btn").addEventListener("click", () =>
    openFuelPage(_statsMode, _statsYM));

  // Tap su una barra dell'andamento o su una riga "mese per mese" → apre quel mese
  document.getElementById("pane-stats").addEventListener("click", e => {
    const target = e.target.closest("[data-ym]");
    if (!target || target.disabled) return;
    _statsMode = "month";
    _statsYM   = target.dataset.ym;
    _statsYear = parseInt(_statsYM.slice(0, 4), 10);
    renderStats();
  });
});

function _setStatsMode(mode) {
  _statsMode = mode;
  if (mode === "year") _statsYear = parseInt(_statsYM.slice(0, 4), 10);
  renderStats();
}

function _stepStats(delta) {
  if (_statsMode === "month") {
    const next = addMonths(_statsYM, delta);
    if (next > currentYM()) return;
    _statsYM = next;
    _statsYear = parseInt(next.slice(0, 4), 10);
  } else {
    const next = _statsYear + delta;
    if (next > new Date().getFullYear()) return;
    _statsYear = next;
    // il mese selezionato segue l'anno (stesso mese, senza andare nel futuro)
    const ym = `${next}-${_statsYM.slice(5, 7)}`;
    _statsYM = ym > currentYM() ? currentYM() : ym;
  }
  renderStats();
}

function renderStats() {
  if (!_dataReady) return;
  _updateStatsNav();
  if (_statsMode === "month") _renderStatsMonth();
  else                        _renderStatsYear();
  _renderAutonomy();
  refreshIcons();
}

function _updateStatsNav() {
  const isMonth = _statsMode === "month";
  document.getElementById("stats-mode-month").classList.toggle("active", isMonth);
  document.getElementById("stats-mode-year").classList.toggle("active", !isMonth);
  document.getElementById("stats-month-label").textContent = isMonth ? ymLabel(_statsYM) : String(_statsYear);

  const first = firstDataYM();
  const prevBtn = document.getElementById("stats-month-prev");
  const nextBtn = document.getElementById("stats-month-next");
  if (isMonth) {
    prevBtn.disabled = !first || _statsYM <= first;
    nextBtn.disabled = _statsYM >= currentYM();
  } else {
    prevBtn.disabled = !first || _statsYear <= parseInt(first.slice(0, 4), 10);
    nextBtn.disabled = _statsYear >= new Date().getFullYear();
  }
}

// Mesi con dati prima di ym (al massimo n)
function _prevMonths(ym, n) {
  const first = firstDataYM();
  const out = [];
  let cur = addMonths(ym, -1);
  while (out.length < n && first && cur >= first) { out.push(cur); cur = addMonths(cur, -1); }
  return out;
}

// ---- MESE ----
function _renderStatsMonth() {
  const ym    = _statsYM;
  const s     = monthStats(ym);
  const isCur = ym === currentYM();
  const day   = new Date().getDate();
  const prev  = _prevMonths(ym, 3);
  const prevAvg = prev.length ? prev.reduce((a, p) => a + monthStats(p).spent, 0) / prev.length : 0;
  const proj  = isCur && day >= 3 ? projectCurrentMonth() : null;

  let spentSub = "";
  if (isCur) spentSub = proj !== null ? `proiezione ${fmtEur(proj, 0)}` : "mese in corso";
  else if (prevAvg > 0) {
    const d = (s.spent - prevAvg) / prevAvg * 100;
    spentSub = `${d >= 0 ? "+" : "−"}${fmtPct(Math.abs(d))} vs media 3 mesi`;
  }
  const prevIncome = prev.length ? prev.reduce((a, p) => a + monthStats(p).income, 0) / prev.length : 0;
  _renderKpis(s, spentSub, prevIncome > 0 ? `media ${fmtEur(prevIncome, 0)}` : "");

  // Andamento: da gennaio a dicembre dell'anno del mese selezionato
  _renderTrend(_yearItems(parseInt(ym.slice(0, 4), 10)), ym);

  document.getElementById("cats-heading").textContent = "Per categoria";
  _renderCats(s.cats, s.spent, 0);
  document.getElementById("stats-annual-card").classList.add("hidden");

  // Sintesi
  const lines = [];
  if (!s.count) {
    lines.push("Nessun movimento registrato in questo mese.");
  } else {
    if (isCur && proj !== null) {
      lines.push(`Al ritmo attuale chiuderai il mese a circa <b>${fmtEur(proj, 0)}</b> di spese` +
        (prevAvg > 0 ? ` (media dei mesi precedenti: ${fmtEur(prevAvg, 0)}).` : "."));
    } else if (!isCur && prevAvg > 0) {
      const d = (s.spent - prevAvg) / prevAvg * 100;
      lines.push(`Hai speso <b>${fmtEur(s.spent, 0)}</b>, il ${fmtPct(Math.abs(d))} ${d >= 0 ? "in più" : "in meno"} della media dei 3 mesi precedenti (${fmtEur(prevAvg, 0)}).`);
    }
    if (!isCur && prev.length) {
      let worst = null;
      Object.entries(s.cats).forEach(([c, v]) => {
        const avg = prev.reduce((a, p) => a + (monthStats(p).cats[c] || 0), 0) / prev.length;
        const delta = v - avg;
        if (delta > 20 && (!worst || delta > worst.delta)) worst = { c, delta };
      });
      if (worst) lines.push(`La voce cresciuta di più è <b>${escapeHtml(catLabel(worst.c))}</b>: +${fmtEur(worst.delta, 0)} rispetto al solito.`);
    }
    if (s.income > 0) {
      const rate = s.net / s.income * 100;
      lines.push(rate >= 0
        ? `Hai messo da parte il <b>${fmtPct(rate)}</b> delle entrate (${fmtEur(s.net, 0)}).`
        : `Hai speso <b>${fmtEur(-s.net, 0)}</b> più di quanto è entrato (${pctOver(-s.net, s.income)} oltre le entrate).`);
    } else {
      lines.push("Nessuna entrata registrata in questo mese.");
    }
    const pending = _tx.filter(t => t.ym === ym && t.cat === "AI_PENDING").length;
    if (pending) lines.push(`${pending} moviment${pending === 1 ? "o" : "i"} da categorizzare.`);
  }
  _renderInsight(lines);
}

// ---- ANNO ----
function _renderStatsYear() {
  const y     = _statsYear;
  const s     = yearStats(y);
  const curYM = currentYM();
  const first = firstDataYM();

  // Mesi dell'anno che contano: da quando ci sono dati fino ad oggi
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym > curYM || !first || ym < first) continue;
    months.push(ym);
  }
  // Il mese in corso conta solo per la parte trascorsa, così la media non si abbassa
  const n = Math.max(1, months.length - (months.includes(curYM)
    ? 1 - new Date().getDate() / daysInMonth(curYM) : 0));

  _renderKpis(s, `media ${fmtEur(s.spent / n, 0)}/mese`, `media ${fmtEur(s.income / n, 0)}/mese`);

  _renderTrend(_yearItems(y), ym => ym === curYM);

  document.getElementById("cats-heading").textContent = `Per categoria · ${y}`;
  _renderCats(s.cats, s.spent, n);
  _renderMonthList(months);

  // Sintesi
  const lines = [];
  if (!s.count) {
    lines.push(`Nessun movimento registrato nel ${y}.`);
  } else {
    lines.push(`Spesa media <b>${fmtEur(s.spent / n, 0)}</b> al mese (${months.length} mes${months.length === 1 ? "e" : "i"} con dati).`);

    const full = months.filter(ym => ym !== curYM && monthStats(ym).count > 0);
    if (full.length >= 2) {
      const sorted = [...full].sort((a, b) => monthStats(b).spent - monthStats(a).spent);
      const hi = sorted[0], lo = sorted[sorted.length - 1];
      lines.push(`Mese più caro: <b>${ymLabel(hi).split(" ")[0]}</b> (${fmtEur(monthStats(hi).spent, 0)}), più leggero: ${ymLabel(lo).split(" ")[0]} (${fmtEur(monthStats(lo).spent, 0)}).`);
    }

    if (s.income > 0) {
      const rate = s.net / s.income * 100;
      lines.push(rate >= 0
        ? `Tasso di risparmio dell'anno: <b>${fmtPct(rate)}</b> (${fmtEur(s.net, 0)}).`
        : `Nell'anno hai speso <b>${fmtEur(-s.net, 0)}</b> più di quanto è entrato (${pctOver(-s.net, s.income)} oltre le entrate).`);
    }

    // Confronto con gli stessi mesi dell'anno prima
    const prevSame = months.map(ym => `${y - 1}-${ym.slice(5)}`).filter(ym => first && ym >= first);
    if (prevSame.length === months.length && prevSame.length > 0) {
      const prevSpent = prevSame.reduce((a, ym) => a + monthStats(ym).spent, 0);
      if (prevSpent > 0) {
        const d = (s.spent - prevSpent) / prevSpent * 100;
        lines.push(`Rispetto agli stessi mesi del ${y - 1} spendi il ${fmtPct(Math.abs(d))} ${d >= 0 ? "in più" : "in meno"}.`);
      }
    }

    const top = Object.entries(s.cats).sort((a, b) => b[1] - a[1])[0];
    if (top && s.spent > 0) {
      lines.push(`La voce principale è <b>${escapeHtml(catLabel(top[0]))}</b>, il ${fmtPct(top[1] / s.spent * 100)} delle spese.`);
    }
  }
  _renderInsight(lines);
}

// ---- Blocchi condivisi ----
function _renderKpis(s, spentSub, incomeSub) {
  document.getElementById("stat-total-spent").textContent  = fmtEur(s.spent);
  document.getElementById("stat-total-income").textContent = fmtEur(s.income);
  document.getElementById("stat-spent-sub").textContent    = spentSub || "";
  document.getElementById("stat-income-sub").textContent   = incomeSub || "";

  const netEl = document.getElementById("stat-net");
  netEl.textContent = fmtSigned(s.net);
  netEl.className   = "period-net " + (s.net >= 0 ? "pos" : "neg");

  const chip = document.getElementById("stat-net-chip");
  if (s.income <= 0 && s.spent <= 0) {
    chip.textContent = "nessun movimento";
    chip.className   = "period-chip";
  } else if (s.income <= 0) {
    chip.textContent = "nessuna entrata";
    chip.className   = "period-chip";
  } else if (s.net >= 0) {
    chip.textContent = `${fmtPct(s.net / s.income * 100)} delle entrate`;
    chip.className   = "period-chip pos";
  } else {
    chip.textContent = `${pctOver(-s.net, s.income)} oltre le entrate`;
    chip.className   = "period-chip neg";
  }
}

function _trendItem(ym, label) {
  const ms = monthStats(ym);
  return { ym, label, value: ms.spent, hasData: ms.count > 0, full: ymLabel(ym) };
}

function _yearItems(y) {
  const items = [];
  for (let m = 1; m <= 12; m++) items.push(_trendItem(`${y}-${String(m).padStart(2, "0")}`, MONTH_SHORT[m - 1]));
  return items;
}

function _renderTrend(items, highlight) {
  renderBarChart(document.getElementById("trend-chart"), document.getElementById("trend-caption"), items, highlight);
}

// monthsDivisor > 0 → mostra anche la media mensile per categoria
function _renderCats(cats, total, monthsDivisor) {
  const list   = document.getElementById("top-expenses-list");
  const sorted = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    list.innerHTML = '<div class="empty-state">Nessuna spesa nel periodo</div>';
    return;
  }
  const maxAmt = sorted[0][1];
  list.innerHTML = sorted.map(([cat, amt]) => {
    const color = catColor(cat);
    const share = total > 0 ? fmtPct(amt / total * 100) : "";
    const sub   = monthsDivisor > 0 ? `${share} · ${fmtEur(amt / monthsDivisor, 0)}/mese` : share;
    return `
      <div class="cat-breakdown-row">
        <div class="cat-dot" style="background:${color}"></div>
        <div class="cat-breakdown-name">
          ${escapeHtml(catLabel(cat))}
          <span class="cat-breakdown-sub">${sub}</span>
        </div>
        <div class="cat-breakdown-bar-wrap">
          <div class="cat-breakdown-bar" style="width:${(amt / maxAmt * 100).toFixed(0)}%;background:${color}"></div>
        </div>
        <span class="cat-breakdown-amount">${fmtEur(amt)}</span>
      </div>`;
  }).join("");
}

function _renderMonthList(months) {
  const card = document.getElementById("stats-annual-card");
  const list = document.getElementById("stats-annual-list");
  if (!months.length) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");

  const curYM = currentYM();
  const maxSpent = Math.max(...months.map(ym => monthStats(ym).spent), 1);
  list.innerHTML = months.map(ym => {
    const ms  = monthStats(ym);
    const cur = ym === curYM;
    return `
      <button class="log-annual-row stats-annual-row" data-ym="${ym}">
        <span class="log-annual-month${cur ? " current" : ""}">${MONTH_NAMES[parseInt(ym.slice(5), 10) - 1]}</span>
        <div class="log-annual-bar-wrap">
          <div class="log-annual-bar${cur ? " current" : ""}" style="width:${(ms.spent / maxSpent * 100).toFixed(0)}%"></div>
        </div>
        <span class="log-annual-amt">
          ${fmtEur(ms.spent, 0)}
          <span class="log-annual-net ${ms.net >= 0 ? "pos" : "neg"}">${fmtSigned(ms.net, 0)}</span>
        </span>
      </button>`;
  }).join("");
}

function _renderAutonomy() {
  const a = autonomy();
  document.getElementById("survival-percentage").textContent =
    isFinite(a.months) ? a.months.toFixed(1) + " mesi" : "∞";
  document.getElementById("survival-bar-fill").style.width =
    (isFinite(a.months) ? Math.min(100, a.months / 12 * 100) : 100) + "%";
  document.getElementById("survival-sub").textContent =
    `Patrimonio ÷ spesa media degli ultimi 3 mesi (${fmtEur(a.avg, 0)}/mese)`;
}

function _renderInsight(lines) {
  document.getElementById("stats-eval").innerHTML = lines.map(l => `<p>${l}</p>`).join("");
}
