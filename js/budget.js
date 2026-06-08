/* ============================================
   CASSA — Budget pane
   ============================================ */

let _budgetScope = "month";
let _budgetData  = null;

window._budgetMonths = null;

// Categorie escluse dal budget (non sono spese reali)
const BUDGET_EXCLUDE = new Set(["RIMBORSO", "TRASFERIMENTO", "SET_BALANCE", "ENTRATE"]);

function loadBudget() {
  apiGet("finance_get_budget").then(data => {
    _budgetData = data;
    window._budgetMonths = data.allMonths || null;
    _renderBudget();
  }).catch(e => console.error("loadBudget error:", e));
}

function _renderBudget() {
  if (!_budgetData) return;
  if (_budgetScope === "month") _renderMonthly();
  else                          _renderYearly();
}

// ---- MENSILE ----
function _renderMonthly() {
  const data        = _budgetData;
  const month       = data.currentMonth || {};
  const spent       = parseFloat(month.spent) || 0;
  const rawCats     = month.categories || {};
  const budgetAI    = data.budgetTargets || {};
  const totalTarget = data.monthlyTarget || 0;

  // Escludi categorie non-spesa
  const cats = {};
  Object.entries(rawCats).forEach(([cat, amt]) => {
    if (!BUDGET_EXCLUDE.has(cat)) cats[cat] = amt;
  });

  // Hero residuo
  const remaining = totalTarget > 0 ? totalTarget - spent : 0;
  const pct       = totalTarget > 0 ? Math.min(100, (spent / totalTarget) * 100) : 0;
  const remainPct = 100 - pct; // barra piena che si svuota

  const remainEl = document.getElementById("budget-remaining");
  if (totalTarget > 0) {
    remainEl.textContent = remaining.toFixed(2) + "€";
    remainEl.className   = "budget-hero-num " + (pct < 60 ? "ok" : pct < 85 ? "warn" : "danger");
  } else {
    remainEl.textContent = "—";
    remainEl.className   = "budget-hero-num ok";
  }
  document.getElementById("budget-total-monthly").textContent =
    totalTarget > 0 ? totalTarget.toFixed(2) + "€" : "nessun target — premi Ricalcola";

  // Barra hero: piena che si svuota (rimasto = 100 - pct_speso)
  const heroBar = document.getElementById("budget-main-bar");
  heroBar.style.width      = remainPct + "%";
  heroBar.style.background = pct < 60 ? "#25B7BB" : pct < 85 ? "#f59e0b" : "#ef4444";

  if (data.aiComment) {
    document.getElementById("budget-ai-comment").textContent = data.aiComment;
  }

  // Categorie
  const catList = document.getElementById("budget-categories-list");
  const allCats = new Set([
    ...Object.keys(cats),
    ...Object.keys(budgetAI).filter(c => !BUDGET_EXCLUDE.has(c))
  ]);
  const rows = [];
  allCats.forEach(cat => {
    rows.push({ cat, spentAmt: parseFloat(cats[cat] || 0), target: parseFloat(budgetAI[cat] || 0) });
  });
  rows.sort((a, b) => (b.target || b.spentAmt) - (a.target || a.spentAmt));

  if (rows.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessuna spesa questo mese</div>';
    if (lucide) lucide.createIcons({ nodes: [catList] });
    return;
  }
  catList.innerHTML = rows.map(r => _catRow(r.cat, r.spentAmt, r.target)).join("");
  if (lucide) lucide.createIcons({ nodes: [catList] });
}

// ---- ANNUALE ----
function _renderYearly() {
  const data        = _budgetData;
  const allMonths   = data.allMonths || [];
  const yearTargets = data.yearTargets || {};
  const yearTotal   = data.yearlyTarget || 0;

  // Somma spese anno per categoria (escludi non-spese)
  const yearCats = {};
  allMonths.forEach(m => {
    Object.entries(m.categories || {}).forEach(([cat, amt]) => {
      if (!BUDGET_EXCLUDE.has(cat)) yearCats[cat] = (yearCats[cat] || 0) + (amt || 0);
    });
  });
  const totalYearSpent = Object.values(yearCats).reduce((a, b) => a + b, 0);

  // Hero
  const available = yearTotal > 0 ? yearTotal - totalYearSpent : 0;
  const pct       = yearTotal > 0 ? Math.min(100, (totalYearSpent / yearTotal) * 100) : 0;
  const remainPct = 100 - pct;

  const availEl = document.getElementById("budget-year-available");
  if (yearTotal > 0) {
    availEl.textContent = available.toFixed(2) + "€";
    availEl.className   = "budget-hero-num " + (pct < 60 ? "ok" : pct < 85 ? "warn" : "danger");
  } else {
    availEl.textContent = "—";
    availEl.className   = "budget-hero-num ok";
  }
  document.getElementById("budget-year-total").textContent =
    yearTotal > 0 ? yearTotal.toFixed(0) + "€" : "nessun target — premi Ricalcola";

  const bar = document.getElementById("budget-year-bar");
  bar.style.width      = yearTotal > 0 ? remainPct + "%" : "0%";
  bar.style.background = pct < 60 ? "#25B7BB" : pct < 85 ? "#f59e0b" : "#ef4444";

  if (data.aiCommentYear) {
    document.getElementById("budget-ai-year-comment").textContent = data.aiCommentYear;
  }

  const catList = document.getElementById("budget-year-cats-list");
  const allCats = new Set([
    ...Object.keys(yearCats),
    ...Object.keys(yearTargets).filter(c => !BUDGET_EXCLUDE.has(c))
  ]);
  const rows = [];
  allCats.forEach(cat => {
    rows.push({ cat, spentAmt: parseFloat(yearCats[cat] || 0), target: parseFloat(yearTargets[cat] || 0) });
  });
  rows.sort((a, b) => (b.target || b.spentAmt) - (a.target || a.spentAmt));

  if (rows.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessun dato</div>';
    if (lucide) lucide.createIcons({ nodes: [catList] });
    return;
  }
  catList.innerHTML = rows.map(r => _catRow(r.cat, r.spentAmt, r.target)).join("");
  if (lucide) lucide.createIcons({ nodes: [catList] });
}

// ---- Riga categoria: barra piena che si svuota ----
function _catRow(cat, spentAmt, target) {
  const hasTarget = target > 0;
  // pctSpent = quanto della barra è stata consumata
  const pctSpent  = hasTarget ? Math.min(100, (spentAmt / target) * 100) : 0;
  // La barra mostra il RIMASTO (piena = 100%, si svuota da destra)
  const pctRemain = Math.max(0, 100 - pctSpent);

  const color = !hasTarget
    ? catColor(cat)
    : pctSpent < 70  ? "#25B7BB"
    : pctSpent < 90  ? "#f59e0b"
    : "#ef4444";

  const remainAmt = hasTarget ? target - spentAmt : null;
  const remainTxt = remainAmt === null ? ""
    : remainAmt >= 0
      ? `rimasti ${remainAmt.toFixed(0)}€`
      : `sforato di ${Math.abs(remainAmt).toFixed(0)}€`;

  return `
    <div class="budget-cat-row">
      <div class="budget-cat-icon"><i data-lucide="${catIcon(cat)}"></i></div>
      <div class="budget-cat-body">
        <div class="budget-cat-name">${escapeHtml(cat)}</div>
        <div class="budget-cat-bar-track">
          <div class="budget-cat-bar-fill" style="width:${hasTarget ? pctRemain : 0}%;background:${color}"></div>
        </div>
        ${hasTarget ? `<div class="budget-cat-remain${remainAmt < 0 ? " over" : ""}">${remainTxt}</div>` : ""}
      </div>
      <span class="budget-cat-amount">${spentAmt.toFixed(2)}€${hasTarget ? `<span class="budget-cat-target"> / ${target.toFixed(0)}€</span>` : ""}</span>
    </div>`;
}

// ---- Scope toggle + AI buttons ----
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scope-month").addEventListener("click", () => _setScope("month"));
  document.getElementById("scope-year").addEventListener("click",  () => _setScope("year"));

  document.getElementById("btn-budget-ai").addEventListener("click", async e => {
    await _runBudgetAI(e.currentTarget, "month", "budget-ai-comment");
  });

  document.getElementById("btn-budget-ai-year").addEventListener("click", async e => {
    await _runBudgetAI(e.currentTarget, "year", "budget-ai-year-comment");
  });
});

async function _runBudgetAI(btn, type, commentId) {
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="loader"></i>';
  if (lucide) lucide.createIcons({ nodes: [btn] });
  try {
    const text = await apiPostText("finance_budget_ai", { type });
    document.getElementById(commentId).textContent = text || "Analisi completata.";
    const data = await apiGet("finance_get_budget");
    _budgetData = data;
    window._budgetMonths = data.allMonths || null;
    _renderBudget();
  } catch(err) { console.error(err); }
  btn.innerHTML = orig;
  if (lucide) lucide.createIcons({ nodes: [btn] });
  btn.disabled = false;
}

function _setScope(scope) {
  _budgetScope = scope;
  document.getElementById("scope-month").classList.toggle("active", scope === "month");
  document.getElementById("scope-year").classList.toggle("active",  scope === "year");
  document.getElementById("budget-monthly-view").classList.toggle("hidden", scope !== "month");
  document.getElementById("budget-yearly-view").classList.toggle("hidden",  scope !== "year");
  if (_budgetData) _renderBudget();
}
