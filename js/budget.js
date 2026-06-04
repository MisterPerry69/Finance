/* ============================================
   FINANCE — Budget view
   ============================================ */

const BUDGET_LIMIT = 1500; // € budget mensile — aggiornare manualmente

function loadBudget() {
  document.getElementById("budget-ai-comment").textContent      = "ANALISI_IN_ATTESA...";
  document.getElementById("budget-ai-comment-year").textContent = "ANALISI_IN_ATTESA...";
  apiGet("finance_get_budget").then(data => {
    renderBudgetMonthly(data.currentMonth);
    renderBudgetYearly(data.allMonths, data.yearIncome);
    if (data.aiComment)     document.getElementById("budget-ai-comment").textContent = data.aiComment;
    if (data.aiCommentYear) document.getElementById("budget-ai-comment-year").textContent = data.aiCommentYear;
  }).catch(e => console.error("loadBudget error:", e));
}

function renderBudgetMonthly(monthData) {
  if (!monthData) return;
  const spent     = parseFloat(monthData.spent) || 0;
  const remaining = BUDGET_LIMIT - spent;
  const pct       = Math.min(100, (spent / BUDGET_LIMIT) * 100);

  document.getElementById("budget-remaining").textContent       = remaining.toFixed(2) + "€";
  document.getElementById("budget-total-monthly").textContent   = BUDGET_LIMIT.toFixed(2) + "€";
  document.getElementById("budget-main-bar").style.width        = pct + "%";

  // Color bar by usage
  const bar = document.getElementById("budget-main-bar");
  if (pct < 60)       bar.style.background = "var(--color-positive)";
  else if (pct < 85)  bar.style.background = "var(--color-gas)";
  else                bar.style.background = "var(--color-negative)";

  const catList = document.getElementById("budget-categories-list");
  const cats = monthData.categories || {};
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessuna spesa</div>';
    return;
  }
  catList.innerHTML = sorted.map(([cat, amt]) =>
    `<div class="budget-cat-row">
      <span class="budget-cat-name">${escapeHtml(cat)}</span>
      <span class="budget-cat-amount">${parseFloat(amt).toFixed(2)}€</span>
    </div>`
  ).join("");
}

function renderBudgetYearly(months, yearIncome) {
  if (!months || months.length === 0) return;
  const totalSpent = months.reduce((a, m) => a + (m.spent || 0), 0);
  const projected  = months.length > 0 ? (totalSpent / months.length) * 12 : 0;

  document.getElementById("budget-year-projection").textContent = projected.toFixed(2) + "€";
  document.getElementById("budget-year-income").textContent     = parseFloat(yearIncome).toFixed(2) + "€";

  const list = document.getElementById("budget-months-breakdown");
  list.innerHTML = months.map(m =>
    `<div class="budget-month-row">
      <span>${escapeHtml(m.label)}</span>
      <span class="budget-month-amount">${parseFloat(m.spent).toFixed(2)}€</span>
    </div>`
  ).join("");
}

// ---- Tabs ----
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".budget-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const t = tab.dataset.tab;
      document.querySelectorAll(".budget-tab").forEach(b => b.classList.toggle("active", b === tab));
      document.getElementById("budget-monthly-view").classList.toggle("hidden", t !== "month");
      document.getElementById("budget-yearly-view").classList.toggle("hidden", t !== "year");
    });
  });

  document.getElementById("btn-budget-ai-month").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "ANALISI_IN_CORSO...";
    try {
      const text = await apiPostText("finance_budget_ai", { type: "month" });
      document.getElementById("budget-ai-comment").textContent = text || "Analisi completata.";
    } catch(err) { console.error(err); }
    btn.textContent = "AGGIORNA_ANALISI";
    btn.disabled = false;
  });

  document.getElementById("btn-budget-ai-year").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "ANALISI_IN_CORSO...";
    try {
      const text = await apiPostText("finance_budget_ai", { type: "year" });
      document.getElementById("budget-ai-comment-year").textContent = text || "Analisi completata.";
    } catch(err) { console.error(err); }
    btn.textContent = "AGGIORNA_ANALISI";
    btn.disabled = false;
  });
});
