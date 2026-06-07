/* ============================================
   CASSA — Budget pane rendering
   ============================================ */

const BUDGET_LIMIT = 1500; // € mensile — da aggiornare
let _budgetScope = "month";

window._budgetMonths = null; // shared with stats trend

function loadBudget() {
  document.getElementById("budget-ai-comment").textContent = "Analisi in attesa...";
  apiGet("finance_get_budget").then(data => {
    window._budgetMonths = data.allMonths || null;
    renderBudgetMonthly(data.currentMonth);
    renderBudgetYearly(data.allMonths, data.yearIncome);
    if (data.aiComment) document.getElementById("budget-ai-comment").textContent = data.aiComment;
  }).catch(e => console.error("loadBudget error:", e));
}

function renderBudgetMonthly(monthData) {
  if (!monthData) return;
  const spent     = parseFloat(monthData.spent) || 0;
  const remaining = BUDGET_LIMIT - spent;
  const pct       = Math.min(100, (spent / BUDGET_LIMIT) * 100);

  const remainEl = document.getElementById("budget-remaining");
  remainEl.textContent = remaining.toFixed(2) + "€";
  remainEl.className = "budget-hero-num " + (pct < 60 ? "ok" : pct < 85 ? "warn" : "danger");

  document.getElementById("budget-total-monthly").textContent = BUDGET_LIMIT.toFixed(2) + "€";

  const bar = document.getElementById("budget-main-bar");
  bar.style.width      = pct + "%";
  bar.style.background = pct < 60 ? "#25B7BB" : pct < 85 ? "#f59e0b" : "#ef4444";

  // Category list
  const cats   = monthData.categories || {};
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxAmt = sorted.length > 0 ? sorted[0][1] : 1;
  const catList = document.getElementById("budget-categories-list");

  if (sorted.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessuna spesa</div>';
    return;
  }
  catList.innerHTML = sorted.map(([cat, amt]) => {
    const barPct = ((amt / maxAmt) * 100).toFixed(0);
    return `
      <div class="budget-cat-row">
        <div class="budget-cat-icon"><i data-lucide="${catIcon(cat)}"></i></div>
        <div class="budget-cat-body">
          <div class="budget-cat-name">${escapeHtml(cat)}</div>
          <div class="budget-cat-bar-mini" style="width:${barPct}%"></div>
        </div>
        <span class="budget-cat-amount">${parseFloat(amt).toFixed(2)}€</span>
      </div>`;
  }).join("");
  if (lucide) lucide.createIcons({ nodes: [catList] });
}

function renderBudgetYearly(months, yearIncome) {
  if (!months || months.length === 0) return;
  const totalSpent = months.reduce((a, m) => a + (m.spent || 0), 0);
  const projected  = months.length > 0 ? (totalSpent / months.length) * 12 : 0;

  document.getElementById("budget-year-projection").textContent = projected.toFixed(2) + "€";
  document.getElementById("budget-year-income").textContent     = parseFloat(yearIncome || 0).toFixed(2) + "€";

  const list = document.getElementById("budget-months-breakdown");
  list.innerHTML = months.map((m, i) => {
    const isCurrent = i === months.length - 1;
    return `
      <div class="year-month-row${isCurrent ? " current" : ""}">
        <span class="year-month-label">${escapeHtml(m.label || "")}</span>
        <span class="year-month-val">${parseFloat(m.spent || 0).toFixed(2)}€</span>
      </div>`;
  }).join("");
}

// ---- Scope toggle ----
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scope-month").addEventListener("click", () => _setScope("month"));
  document.getElementById("scope-year").addEventListener("click",  () => _setScope("year"));

  document.getElementById("btn-budget-ai").addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader"></i> Analisi...';
    if (lucide) lucide.createIcons({ nodes: [btn] });
    try {
      const text = await apiPostText("finance_budget_ai", { type: _budgetScope });
      document.getElementById("budget-ai-comment").textContent = text || "Analisi completata.";
    } catch(err) { console.error(err); }
    btn.innerHTML = origHTML;
    if (lucide) lucide.createIcons({ nodes: [btn] });
    btn.disabled = false;
  });
});

function _setScope(scope) {
  _budgetScope = scope;
  document.getElementById("scope-month").classList.toggle("active", scope === "month");
  document.getElementById("scope-year").classList.toggle("active",  scope === "year");

  document.getElementById("budget-monthly-view").classList.toggle("hidden", scope !== "month");
  document.getElementById("budget-yearly-view").classList.toggle("hidden",  scope !== "year");
  document.getElementById("budget-monthly-cats").classList.toggle("hidden", scope !== "month");
  document.getElementById("budget-yearly-months").classList.toggle("hidden", scope !== "year");
}
