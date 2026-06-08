/* ============================================
   CASSA — Budget pane
   ============================================ */

let _budgetScope = "month";
let _budgetData  = null;

window._budgetMonths = null;

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
  const data     = _budgetData;
  const month    = data.currentMonth || {};
  const spent    = parseFloat(month.spent) || 0;
  const cats     = month.categories || {};
  const budgetAI = data.budgetTargets || {};  // {CAT: targetMensile}
  const totalTarget = data.monthlyTarget || 0;

  // Hero
  const remaining = totalTarget > 0 ? totalTarget - spent : 0;
  const pct = totalTarget > 0 ? Math.min(100, (spent / totalTarget) * 100) : 0;

  const remainEl = document.getElementById("budget-remaining");
  if (totalTarget > 0) {
    remainEl.textContent = remaining.toFixed(2) + "€";
    remainEl.className   = "budget-hero-num " + (pct < 60 ? "ok" : pct < 85 ? "warn" : "danger");
  } else {
    remainEl.textContent = "—";
    remainEl.className   = "budget-hero-num ok";
  }
  document.getElementById("budget-total-monthly").textContent =
    totalTarget > 0 ? totalTarget.toFixed(2) + "€" : "nessun target";

  const bar = document.getElementById("budget-main-bar");
  bar.style.width      = pct + "%";
  bar.style.background = pct < 60 ? "#25B7BB" : pct < 85 ? "#f59e0b" : "#ef4444";

  // AI insight
  if (data.aiComment) {
    document.getElementById("budget-ai-comment").textContent = data.aiComment;
  }

  // Categories
  const catList = document.getElementById("budget-categories-list");
  const allCats = new Set([...Object.keys(cats), ...Object.keys(budgetAI)]);
  const rows    = [];

  allCats.forEach(cat => {
    const spentAmt  = parseFloat(cats[cat] || 0);
    const target    = parseFloat(budgetAI[cat] || 0);
    rows.push({ cat, spentAmt, target });
  });
  rows.sort((a, b) => (b.spentAmt + b.target) - (a.spentAmt + a.target));

  if (rows.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessuna spesa questo mese</div>';
    if (lucide) lucide.createIcons({ nodes: [catList] });
    return;
  }

  catList.innerHTML = rows.map(({ cat, spentAmt, target }) => {
    const hasTarget = target > 0;
    const pctSpent  = hasTarget ? Math.min(100, (spentAmt / target) * 100) : 100;
    const barColor  = !hasTarget ? catColor(cat)
      : pctSpent < 70  ? "#25B7BB"
      : pctSpent < 90  ? "#f59e0b"
      : "#ef4444";
    const remainAmt = hasTarget ? (target - spentAmt) : null;
    return `
      <div class="budget-cat-row">
        <div class="budget-cat-icon"><i data-lucide="${catIcon(cat)}"></i></div>
        <div class="budget-cat-body">
          <div class="budget-cat-name">${escapeHtml(cat)}</div>
          <div class="budget-cat-bar-track">
            <div class="budget-cat-bar-fill" style="width:${pctSpent}%;background:${barColor}"></div>
          </div>
          ${hasTarget ? `<div class="budget-cat-remain${remainAmt < 0 ? " over" : ""}">${remainAmt >= 0 ? "rimasti " + remainAmt.toFixed(0) + "€" : "sforato di " + Math.abs(remainAmt).toFixed(0) + "€"}</div>` : ""}
        </div>
        <span class="budget-cat-amount">${spentAmt.toFixed(2)}€${hasTarget ? '<span class="budget-cat-target"> / ' + target.toFixed(0) + '€</span>' : ""}</span>
      </div>`;
  }).join("");
  if (lucide) lucide.createIcons({ nodes: [catList] });
}

// ---- ANNUALE ----
function _renderYearly() {
  const data       = _budgetData;
  const allMonths  = data.allMonths || [];
  const yearTargets = data.yearTargets || {};   // {CAT: targetAnnuale}
  const yearTotal  = data.yearlyTarget || 0;

  // Somma spese anno per categoria
  const yearCats = {};
  allMonths.forEach(m => {
    Object.entries(m.categories || {}).forEach(([cat, amt]) => {
      yearCats[cat] = (yearCats[cat] || 0) + (amt || 0);
    });
  });
  const totalYearSpent = Object.values(yearCats).reduce((a, b) => a + b, 0);

  // Hero
  const available = yearTotal > 0 ? yearTotal - totalYearSpent : 0;
  const pct = yearTotal > 0 ? Math.min(100, (totalYearSpent / yearTotal) * 100) : 0;

  const availEl = document.getElementById("budget-year-available");
  if (yearTotal > 0) {
    availEl.textContent = available.toFixed(2) + "€";
    availEl.className   = "budget-hero-num " + (pct < 60 ? "ok" : pct < 85 ? "warn" : "danger");
  } else {
    availEl.textContent = "—";
    availEl.className   = "budget-hero-num ok";
  }
  document.getElementById("budget-year-total").textContent =
    yearTotal > 0 ? yearTotal.toFixed(0) + "€" : "nessun target";

  const bar = document.getElementById("budget-year-bar");
  bar.style.width      = pct + "%";
  bar.style.background = pct < 60 ? "#25B7BB" : pct < 85 ? "#f59e0b" : "#ef4444";

  // AI comment annuale
  if (data.aiCommentYear) {
    document.getElementById("budget-ai-year-comment").textContent = data.aiCommentYear;
  }

  // Per categoria annuale
  const catList = document.getElementById("budget-year-cats-list");
  const allCats = new Set([...Object.keys(yearCats), ...Object.keys(yearTargets)]);
  const rows = [];
  allCats.forEach(cat => {
    rows.push({ cat, spentAmt: parseFloat(yearCats[cat] || 0), target: parseFloat(yearTargets[cat] || 0) });
  });
  rows.sort((a, b) => (b.spentAmt + b.target) - (a.spentAmt + a.target));

  if (rows.length === 0) {
    catList.innerHTML = '<div class="empty-state">Nessun dato</div>';
    if (lucide) lucide.createIcons({ nodes: [catList] });
    return;
  }

  catList.innerHTML = rows.map(({ cat, spentAmt, target }) => {
    const hasTarget = target > 0;
    const pctSpent  = hasTarget ? Math.min(100, (spentAmt / target) * 100) : 100;
    const barColor  = !hasTarget ? catColor(cat)
      : pctSpent < 70 ? "#25B7BB" : pctSpent < 90 ? "#f59e0b" : "#ef4444";
    const remainAmt = hasTarget ? target - spentAmt : null;
    return `
      <div class="budget-cat-row">
        <div class="budget-cat-icon"><i data-lucide="${catIcon(cat)}"></i></div>
        <div class="budget-cat-body">
          <div class="budget-cat-name">${escapeHtml(cat)}</div>
          <div class="budget-cat-bar-track">
            <div class="budget-cat-bar-fill" style="width:${pctSpent}%;background:${barColor}"></div>
          </div>
          ${hasTarget ? `<div class="budget-cat-remain${remainAmt < 0 ? " over" : ""}">${remainAmt >= 0 ? "rimasti " + remainAmt.toFixed(0) + "€" : "sforato di " + Math.abs(remainAmt).toFixed(0) + "€"}</div>` : ""}
        </div>
        <span class="budget-cat-amount">${spentAmt.toFixed(2)}€${hasTarget ? '<span class="budget-cat-target"> / ' + target.toFixed(0) + '€</span>' : ""}</span>
      </div>`;
  }).join("");
  if (lucide) lucide.createIcons({ nodes: [catList] });
}

// ---- Scope toggle + AI buttons ----
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scope-month").addEventListener("click", () => _setScope("month"));
  document.getElementById("scope-year").addEventListener("click",  () => _setScope("year"));

  document.getElementById("btn-budget-ai").addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader"></i>';
    if (lucide) lucide.createIcons({ nodes: [btn] });
    try {
      const text = await apiPostText("finance_budget_ai", { type: "month" });
      document.getElementById("budget-ai-comment").textContent = text || "Analisi completata.";
      // Reload budget to get updated targets
      await new Promise(resolve => {
        apiGet("finance_get_budget").then(data => {
          _budgetData = data;
          window._budgetMonths = data.allMonths || null;
          _renderBudget();
          resolve();
        }).catch(resolve);
      });
    } catch(err) { console.error(err); }
    btn.innerHTML = orig;
    if (lucide) lucide.createIcons({ nodes: [btn] });
    btn.disabled = false;
  });

  document.getElementById("btn-budget-ai-year").addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader"></i>';
    if (lucide) lucide.createIcons({ nodes: [btn] });
    try {
      const text = await apiPostText("finance_budget_ai", { type: "year" });
      document.getElementById("budget-ai-year-comment").textContent = text || "Analisi completata.";
      await new Promise(resolve => {
        apiGet("finance_get_budget").then(data => {
          _budgetData = data;
          window._budgetMonths = data.allMonths || null;
          _renderBudget();
          resolve();
        }).catch(resolve);
      });
    } catch(err) { console.error(err); }
    btn.innerHTML = orig;
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
  if (_budgetData) _renderBudget();
}
