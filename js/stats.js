/* ============================================
   CASSA — Stats pane rendering
   ============================================ */

let _chartInstance = null;

function renderStats(data) {
  if (!data || !data.currentMonth) return;
  const month    = data.currentMonth;
  const balances = data.balances;

  const income = parseFloat(month.income) || 0;
  const spent  = parseFloat(month.spent)  || 0;
  const total  = parseFloat(balances.total) || 0;

  // KPI cards
  document.getElementById("stat-total-spent").textContent  = spent.toFixed(2) + "€";
  document.getElementById("stat-total-income").textContent = income.toFixed(2) + "€";

  // Survival
  const survivalMonths = spent > 0 ? total / spent : Infinity;
  const survivalPct    = spent > 0 ? Math.min(100, (survivalMonths / 12) * 100) : 100;
  document.getElementById("survival-percentage").textContent = isFinite(survivalMonths)
    ? survivalMonths.toFixed(1) + " mesi"
    : "∞";
  document.getElementById("survival-bar-fill").style.width = survivalPct + "%";

  // Top categories
  const cats   = month.categories || {};
  const sorted = Object.entries(cats)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const maxAmt  = sorted.length > 0 ? sorted[0][1] : 1;
  const topList = document.getElementById("top-expenses-list");

  if (sorted.length === 0) {
    topList.innerHTML = '<div class="empty-state">Nessuna spesa questo mese</div>';
  } else {
    topList.innerHTML = sorted.slice(0, 5).map(([cat, amt]) => {
      const pct   = ((amt / maxAmt) * 100).toFixed(0);
      const color = catColor(cat);
      return `
        <div class="cat-breakdown-row">
          <div class="cat-dot" style="background:${color}"></div>
          <span class="cat-breakdown-name">${escapeHtml(cat)}</span>
          <div class="cat-breakdown-bar-wrap">
            <div class="cat-breakdown-bar" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="cat-breakdown-amount">${parseFloat(amt).toFixed(2)}€</span>
        </div>`;
    }).join("");
  }

  // Trend bars (uses allMonths from budget data if available, else placeholder)
  _renderTrendBars(month);

  // Gas
  const gasSpent = parseFloat(month.gasSpent)    || 0;
  const gasLiters = parseFloat(month.gasLiters)  || 0;
  const gasAvg   = parseFloat(month.gasAvgPrice) || 0;
  document.getElementById("gas-spent").textContent     = gasSpent   > 0 ? gasSpent.toFixed(2)   + "€"   : "—";
  document.getElementById("gas-liters").textContent    = gasLiters  > 0 ? gasLiters.toFixed(1)  + " L"   : "—";
  document.getElementById("gas-avg-price").textContent = gasAvg     > 0 ? gasAvg.toFixed(3)     + "€/L" : "—";
  document.getElementById("gas-card").classList.toggle("hidden", gasSpent === 0);
}

function _renderTrendBars(currentMonth) {
  // Try to use allMonths from cached budget data; fallback to single bar
  const container = document.getElementById("trend-bars");
  if (!container) return;

  const allMonths = window._budgetMonths;
  if (!allMonths || allMonths.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:var(--sp-3)">Dati non ancora disponibili</div>';
    return;
  }

  const recent = allMonths.slice(-6);
  const maxSpent = Math.max(...recent.map(m => m.spent || 0), 1);

  container.innerHTML = recent.map((m, i) => {
    const pct = ((m.spent || 0) / maxSpent * 100).toFixed(0);
    const isCurrent = i === recent.length - 1;
    return `
      <div class="trend-bar-col">
        <div class="trend-bar${isCurrent ? " current" : ""}" style="height:${pct}%"></div>
        <div class="trend-bar-label">${escapeHtml((m.label || "").slice(0, 3))}</div>
      </div>`;
  }).join("");
}
