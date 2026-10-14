/* ============================================
   TIDE — Budget pane
   Niente AI: spendibile = entrate tipiche − obiettivo di risparmio.
   La logica di calcolo è in data.js (computeBudget).
   ============================================ */

let _budgetScope = "month";

const SAVINGS_OPTIONS = [0, 10, 15, 20, 25, 30, 40];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scope-month").addEventListener("click", () => _setScope("month"));
  document.getElementById("scope-year").addEventListener("click",  () => _setScope("year"));

  const chips = document.getElementById("savings-chips");
  chips.innerHTML = SAVINGS_OPTIONS.map(p =>
    `<button class="savings-chip" data-pct="${p}">${p}%</button>`).join("");
  chips.addEventListener("click", e => {
    const btn = e.target.closest(".savings-chip");
    if (!btn) return;
    saveBudgetSettings({ savingsPct: parseInt(btn.dataset.pct, 10) });
    renderAll();
  });

  const incomeInput = document.getElementById("budget-income-input");
  incomeInput.addEventListener("change", () => {
    const v = parseFloat(String(incomeInput.value).replace(",", "."));
    saveBudgetSettings({ income: v > 0 ? v : 0 });
    renderAll();
  });
  document.getElementById("budget-income-auto").addEventListener("click", () => {
    incomeInput.value = "";
    saveBudgetSettings({ income: 0 });
    renderAll();
  });
});

// Tocco su una categoria → registro filtrato (mese corrente o anno corrente)
document.addEventListener("DOMContentLoaded", () => {
  ["budget-categories-list", "budget-year-cats-list"].forEach(id =>
    document.getElementById(id).addEventListener("click", e => {
      const row = e.target.closest("[data-cat]");
      if (row) openLogModal({ cat: row.dataset.cat, period: _budgetScope, ym: currentYM() });
    }));
});

function _setScope(scope) {
  _budgetScope = scope;
  document.getElementById("scope-month").classList.toggle("active", scope === "month");
  document.getElementById("scope-year").classList.toggle("active",  scope === "year");
  document.getElementById("budget-monthly-view").classList.toggle("hidden", scope !== "month");
  document.getElementById("budget-yearly-view").classList.toggle("hidden",  scope !== "year");
  renderBudget();
}

function renderBudget() {
  if (!_dataReady) return;
  const b = computeBudget();
  _renderSettings(b);
  if (_budgetScope === "month") _renderMonthly(b);
  else                          _renderYearly(b);
  refreshIcons();
}

function _heroClass(spent, expected, limit) {
  if (spent > limit)            return "danger";
  if (spent > expected * 1.1)   return "warn";
  return "ok";
}
const HERO_COLORS = { ok: "#25B7BB", warn: "#f59e0b", danger: "#ef4444" };

// ---- MENSILE ----
function _renderMonthly(b) {
  const ym      = currentYM();
  const s       = monthStats(ym);
  // Gli imprevisti non consumano il budget: escono dal risparmio
  const oneoff  = oneoffSpent(s);
  const spent   = s.spent - oneoff;
  const day     = new Date().getDate();
  const dim     = daysInMonth(ym);
  const left    = dim - day + 1;
  // Ritmo atteso basato su come spendi di solito (affitto a inizio mese ecc.)
  const paceFrac = typicalMonthShare(day);

  const numEl  = document.getElementById("budget-remaining");
  const subEl  = document.getElementById("budget-hero-sub");
  const footEl = document.getElementById("budget-hero-foot");
  const bar    = document.getElementById("budget-main-bar");
  const pace   = document.getElementById("budget-main-pace");

  if (b.spendable <= 0) {
    numEl.textContent = "—";
    numEl.className   = "budget-hero-num ok";
    subEl.textContent = "Nessuna entrata negli ultimi mesi: impostale qui sotto";
    footEl.textContent = `Speso finora: ${fmtEur(spent, 0)}`;
    bar.style.width = "0%";
    pace.classList.add("hidden");
  } else {
    const remaining = b.spendable - spent;
    const cls = _heroClass(spent, b.spendable * paceFrac, b.spendable);
    numEl.textContent = fmtEur(remaining, 0);
    numEl.className   = "budget-hero-num " + cls;
    subEl.textContent = `su ${fmtEur(b.spendable, 0)} spendibili a ${MONTH_NAMES[new Date().getMonth()].toLowerCase()} · spesi ${fmtEur(spent, 0)}`;
    footEl.textContent = remaining > 0
      ? `≈ ${fmtEur(remaining / left, 0)} al giorno per ${left === 1 ? "oggi" : `i prossimi ${left} giorni`}`
      : `Budget del mese superato di ${fmtEur(-remaining, 0)}`;
    bar.style.width      = Math.max(0, Math.min(100, remaining / b.spendable * 100)) + "%";
    bar.style.background = HERO_COLORS[cls];
    // Tacca: dove "dovrebbe" essere il residuo oggi se spendessi in modo uniforme
    pace.classList.remove("hidden");
    pace.style.left = ((1 - paceFrac) * 100).toFixed(1) + "%";
  }

  // Categorie: target da storico + spesa del mese
  const rows = _catRows(b.targets, s.cats, 1);
  _renderCatList("budget-categories-list", rows, null);

  const notes = [];
  if (b.essentialsOver) {
    notes.push(`Le sole spese essenziali (${fmtEur(b.essentials, 0)}) superano lo spendibile: abbassa l'obiettivo di risparmio o rivedi le entrate.`);
  } else if (b.factor < 1) {
    const ess = expenseCategories().filter(c => c.type === "essential").map(c => catTitle(c.name).toLowerCase());
    notes.push(`Per risparmiare il ${b.savingsPct}%, le spese variabili sono ridotte al ${fmtPct(b.factor * 100)} della tua media.` +
      (ess.length ? ` Restano intere le essenziali: ${ess.join(", ")}.` : ""));
  }
  if (b.margin >= 5) notes.push(`Margine libero non assegnato a nessuna categoria: ${fmtEur(b.margin, 0)}.`);
  if (oneoff > 0) notes.push(`<b>Imprevisti</b> questo mese: ${fmtEur(oneoff, 0)}. Sono fuori dal budget e pesano sul risparmio.`);
  document.getElementById("budget-cats-note").innerHTML = notes.map(n => `<p>${n}</p>`).join("");

  // Sintesi
  const lines = [];
  if (!b.hasHistory) {
    lines.push("Serve almeno un mese completo di dati per calcolare medie e target per categoria.");
  } else {
    lines.push(`Negli ultimi ${b.histMonths} mesi hai speso in media <b>${fmtEur(b.typical, 0)}</b> al mese` +
      (b.income > 0 ? ` su ${fmtEur(b.income, 0)} di entrate.` : "."));
    if (b.spendable > 0) {
      const gap = b.typical - b.spendable;
      lines.push(gap > 0
        ? `Per mettere da parte il ${b.savingsPct}% (${fmtEur(b.savings, 0)}) devi spendere circa <b>${fmtEur(gap, 0)} in meno</b> al mese rispetto alle tue abitudini.`
        : `Le tue abitudini sono compatibili con un risparmio del ${b.savingsPct}%: ti avanzano circa ${fmtEur(-gap, 0)} in più al mese.`);
    }
  }
  if (b.oneoffAvg >= 1) {
    lines.push(`Gli imprevisti degli ultimi ${b.histMonths} mesi valgono in media ${fmtEur(b.oneoffAvg, 0)} al mese: sono esclusi dai target e riducono il risparmio reale.`);
  }
  if (day >= 3 && day < dim && b.spendable > 0) {
    const proj = projectCurrentMonth() - oneoff;
    lines.push(`Al ritmo attuale chiuderai il mese a circa <b>${fmtEur(proj, 0)}</b>` +
      (proj > b.spendable ? `, ${fmtEur(proj - b.spendable, 0)} oltre il budget.` : ", dentro il budget."));
  }
  const over = rows.filter(r => r.target > 0 && r.spent > r.target);
  if (over.length) {
    lines.push("Categorie già sforate: " + over.map(r =>
      `<b>${escapeHtml(catLabel(r.cat))}</b> (+${fmtEur(r.spent - r.target, 0)})`).join(", ") + ".");
  }
  document.getElementById("budget-summary").innerHTML = lines.map(l => `<p>${l}</p>`).join("");
}

// ---- ANNUALE ----
function _renderYearly(b) {
  const now    = new Date();
  const y      = now.getFullYear();
  const curIdx = now.getMonth();
  const ym     = currentYM();
  const day    = now.getDate();
  const dim    = daysInMonth(ym);
  const ys     = yearStats(y);
  const yOne   = oneoffSpent(ys);
  const ySpent = ys.spent - yOne;
  const first  = firstDataYM();

  // Se i dati partono a metà anno, il budget copre solo i mesi da lì in poi
  const startIdx = first && first.startsWith(String(y)) ? parseInt(first.slice(5), 10) - 1 : 0;
  const totalMonths = 12 - startIdx;
  const elapsed     = Math.max(0.03, (curIdx - startIdx) + day / dim);
  const elapsedFrac = elapsed / totalMonths;

  // Entrate previste: mesi passati reali, mese corrente almeno quanto il tipico, futuri al tipico
  let expIncome = 0;
  for (let m = startIdx; m < 12; m++) {
    const mym = `${y}-${String(m + 1).padStart(2, "0")}`;
    const real = monthStats(mym).income;
    if (m < curIdx)       expIncome += real;
    else if (m === curIdx) expIncome += Math.max(real, b.income);
    else                  expIncome += b.income;
  }
  const savingsTarget = expIncome * b.savingsPct / 100;
  const spendableYear = Math.max(0, expIncome - savingsTarget);
  const remaining     = spendableYear - ySpent;
  const monthsLeft    = Math.max(0.5, totalMonths - elapsed);

  document.getElementById("budget-year-label").textContent = `Spendibile ${y}`;
  const numEl = document.getElementById("budget-year-available");
  const bar   = document.getElementById("budget-year-bar");
  const pace  = document.getElementById("budget-year-pace");

  if (spendableYear <= 0) {
    numEl.textContent = "—";
    numEl.className   = "budget-hero-num ok";
    document.getElementById("budget-year-sub").textContent = "Nessuna entrata prevista: impostale qui sotto";
    document.getElementById("budget-year-foot").textContent = `Speso nel ${y}: ${fmtEur(ySpent, 0)}`;
    bar.style.width = "0%";
    pace.classList.add("hidden");
  } else {
    const cls = _heroClass(ySpent, spendableYear * elapsedFrac, spendableYear);
    numEl.textContent = fmtEur(remaining, 0);
    numEl.className   = "budget-hero-num " + cls;
    document.getElementById("budget-year-sub").textContent =
      `su ${fmtEur(spendableYear, 0)}: entrate previste ${fmtEur(expIncome, 0)} − risparmio ${b.savingsPct}%`;
    document.getElementById("budget-year-foot").textContent = remaining > 0
      ? `≈ ${fmtEur(remaining / monthsLeft, 0)} al mese per il resto dell'anno`
      : `Budget annuale superato di ${fmtEur(-remaining, 0)}`;
    bar.style.width      = Math.max(0, Math.min(100, remaining / spendableYear * 100)) + "%";
    bar.style.background = HERO_COLORS[cls];
    pace.classList.remove("hidden");
    pace.style.left = ((1 - elapsedFrac) * 100).toFixed(1) + "%";
  }

  const rows = _catRows(b.targets, ys.cats, totalMonths);
  rows.forEach(r => { r.proj = elapsed >= 1 ? r.spent / elapsed * totalMonths : null; });
  _renderCatList("budget-year-cats-list", rows, elapsedFrac);

  // Sintesi
  const lines = [];
  if (elapsed >= 1) {
    const proj = ySpent / elapsed * totalMonths + yOne;
    const projSave = expIncome - proj;
    lines.push(`Al ritmo attuale nel ${y} spenderai circa <b>${fmtEur(proj, 0)}</b>.`);
    if (expIncome > 0) {
      lines.push(`Risparmio previsto a fine anno: <b>${fmtEur(projSave, 0)}</b> (${fmtPct(projSave / expIncome * 100)}), obiettivo ${b.savingsPct}% = ${fmtEur(savingsTarget, 0)}.`);
    }
  }
  if (ys.income > 0) {
    lines.push(`Finora: entrate ${fmtEur(ys.income, 0)}, spese ${fmtEur(ys.spent, 0)}` +
      (yOne > 0 ? ` (di cui imprevisti ${fmtEur(yOne, 0)})` : "") + `, messo da parte ${fmtSigned(ys.net, 0)}.`);
  }
  const ahead = rows
    .filter(r => r.target > 0 && r.spent > r.target * elapsedFrac * 1.1)
    .sort((a, b2) => (b2.spent - b2.target * elapsedFrac) - (a.spent - a.target * elapsedFrac))
    .slice(0, 3);
  if (ahead.length) {
    lines.push("Sopra il ritmo previsto: " + ahead.map(r =>
      `<b>${escapeHtml(catLabel(r.cat))}</b> (+${fmtEur(r.spent - r.target * elapsedFrac, 0)})`).join(", ") + ".");
  }
  if (!lines.length) lines.push("Dati insufficienti per una proiezione annuale.");
  document.getElementById("budget-year-summary").innerHTML = lines.map(l => `<p>${l}</p>`).join("");
}

// ---- Impostazioni / spiegazione del calcolo ----
function _renderSettings(b) {
  document.querySelectorAll(".savings-chip").forEach(c =>
    c.classList.toggle("active", parseInt(c.dataset.pct, 10) === b.savingsPct));

  const input = document.getElementById("budget-income-input");
  if (document.activeElement !== input) input.value = b.manual ? String(b.income) : "";
  input.placeholder = b.autoIncome > 0 ? `auto: ${fmtEur(b.autoIncome, 0)}` : "es. 1300";
  document.getElementById("budget-income-auto").classList.toggle("hidden", !b.manual);
  document.getElementById("budget-income-hint").textContent = b.manual
    ? "Valore impostato a mano. Premi Auto per tornare al calcolo dallo storico."
    : `Mediana delle entrate degli ultimi ${b.histMonths || 0} mesi completi (ignora bonus una tantum).`;

  document.getElementById("budget-calc").innerHTML = `
    <div class="budget-calc-row"><span>Entrate tipiche</span><span>${fmtEur(b.income, 0)}</span></div>
    <div class="budget-calc-row minus"><span>Risparmio ${b.savingsPct}%</span><span>−${fmtEur(b.savings, 0)}</span></div>
    <div class="budget-calc-row total"><span>Spendibile al mese</span><span>${fmtEur(b.spendable, 0)}</span></div>`;
}

// ---- Righe categoria ----
// targets mensili × months = target del periodo
function _catRows(targets, spentCats, months) {
  const cats = new Set([...Object.keys(targets), ...Object.keys(spentCats)].filter(c => catType(c) !== "oneoff"));
  const rows = [];
  cats.forEach(cat => {
    rows.push({ cat, spent: spentCats[cat] || 0, target: (targets[cat] || 0) * months });
  });
  return rows.sort((a, b) => (b.target - a.target) || (b.spent - a.spent));
}

function _renderCatList(id, rows, paceFrac) {
  const el = document.getElementById(id);
  el.innerHTML = rows.length
    ? rows.map(r => _catRow(r, paceFrac)).join("")
    : '<div class="empty-state">Nessuna spesa</div>';
}

// Barra piena che si svuota man mano che spendi
function _catRow(r, paceFrac) {
  const hasTarget = r.target > 0;
  const usedPct   = hasTarget ? r.spent / r.target * 100 : 0;
  const color     = !hasTarget ? catColor(r.cat)
                  : usedPct < 80  ? "#25B7BB"
                  : usedPct < 100 ? "#f59e0b"
                  : "#ef4444";
  const remain = r.target - r.spent;

  let info;
  if (!hasTarget) info = "non prevista negli ultimi 6 mesi";
  else if (remain >= 0) info = `rimasti ${fmtEur(remain, 0)}`;
  else info = `sforato di ${fmtEur(-remain, 0)}`;
  if (r.proj != null && hasTarget) info += ` · previsione ${fmtEur(r.proj, 0)}`;

  const tick = paceFrac != null && hasTarget
    ? `<span class="budget-cat-pace" style="left:${((1 - paceFrac) * 100).toFixed(1)}%"></span>` : "";

  return `
    <button class="budget-cat-row" data-cat="${escapeAttr(r.cat)}">
      <div class="budget-cat-icon"><i data-lucide="${catIcon(r.cat)}"></i></div>
      <div class="budget-cat-body">
        <div class="budget-cat-name">${escapeHtml(catLabel(r.cat))}</div>
        <div class="budget-cat-bar-track">
          <div class="budget-cat-bar-fill" style="width:${hasTarget ? Math.max(0, 100 - usedPct) : 0}%;background:${color}"></div>
          ${tick}
        </div>
        <div class="budget-cat-remain${hasTarget && remain < 0 ? " over" : ""}">${info}</div>
      </div>
      <span class="budget-cat-amount">${fmtEur(r.spent, 0)}${hasTarget ? `<span class="budget-cat-target"> / ${fmtEur(r.target, 0)}</span>` : ""}</span>
    </button>`;
}
