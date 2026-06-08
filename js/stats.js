/* ============================================
   CASSA — Stats pane rendering
   ============================================ */

let _statsCurrentYM = "";

const STATS_MONTH_NAMES = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
];

document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  _statsCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  document.getElementById("stats-month-prev").addEventListener("click", () => _stepStatsMonth(-1));
  document.getElementById("stats-month-next").addEventListener("click", () => _stepStatsMonth(+1));
});

function _stepStatsMonth(delta) {
  const [y, m] = _statsCurrentYM.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  _statsCurrentYM = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  _updateStatsMonthLabel();
  _loadStatsForMonth(_statsCurrentYM);
}

function _updateStatsMonthLabel() {
  const [y, m] = _statsCurrentYM.split("-").map(Number);
  const label = `${STATS_MONTH_NAMES[m-1]} ${y}`;
  document.getElementById("stats-month-label").textContent = label;
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const sub = document.getElementById("stat-month-sub");
  if (sub) sub.textContent = _statsCurrentYM === curYM ? "questo mese" : label;
}

async function _loadStatsForMonth(ym) {
  try {
    const data = await apiGet("finance_filter_month", { ym });
    if (!data) return;
    let spent = 0, income = 0;
    const cats = {};
    (data || []).forEach(t => {
      const amt = parseFloat(t.amt) || 0;
      const cat = String(t.cat || "ALTRO").toUpperCase();
      if (cat === "SET_BALANCE" || cat === "TRASFERIMENTO") return;
      if (amt > 0 && cat !== "RIMBORSO") income += amt;
      else if (amt < 0) {
        spent += Math.abs(amt);
        cats[cat] = (cats[cat] || 0) + Math.abs(amt);
      }
    });
    _renderStatsMonth({ spent, income, categories: cats });
    _renderStatsAnnual(); // update highlighted row
  } catch(e) {
    // silently ignore
  }
}

function renderStats(data) {
  if (!data || !data.currentMonth) return;

  // Init month label + YM if not set
  const now = new Date();
  if (!_statsCurrentYM) {
    _statsCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  }
  _updateStatsMonthLabel();

  const month    = data.currentMonth;
  const balances = data.balances;
  const total    = parseFloat(balances?.total) || 0;

  _renderStatsMonth(month, total);
  _renderTrendBars(month);
  _renderGas(month);
  _renderStatsAnnual();
}

function _renderStatsMonth(month, totalOverride) {
  const income = parseFloat(month.income) || 0;
  const spent  = parseFloat(month.spent)  || 0;
  const total  = totalOverride != null ? totalOverride : (parseFloat(_cachedData?.balances?.total) || 0);

  // KPI cards
  document.getElementById("stat-total-spent").textContent  = spent.toFixed(2)  + "€";
  document.getElementById("stat-total-income").textContent = income.toFixed(2) + "€";

  // Survival (based on current total balance, not per-month)
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
}

function _renderTrendBars(currentMonth) {
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

function _renderStatsAnnual() {
  const months  = window._budgetMonths;
  const card    = document.getElementById("stats-annual-card");
  const list    = document.getElementById("stats-annual-list");
  if (!card || !list) return;

  if (!months || months.length === 0) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");

  const maxSpent = Math.max(...months.map(m => m.spent || 0), 1);
  list.innerHTML = months.map(m => {
    const ym    = m.ym || "";
    const isCur = ym === _statsCurrentYM;
    const pct   = ((m.spent || 0) / maxSpent * 100).toFixed(0);
    return `
      <div class="log-annual-row stats-annual-row" data-ym="${escapeAttr(ym)}">
        <span class="log-annual-month${isCur ? " current" : ""}">${escapeHtml(m.labelFull || m.label || ym)}</span>
        <div class="log-annual-bar-wrap">
          <div class="log-annual-bar${isCur ? " current" : ""}" style="width:${pct}%"></div>
        </div>
        <span class="log-annual-amt">${parseFloat(m.spent || 0).toFixed(2)}€</span>
      </div>`;
  }).join("");

  list.querySelectorAll(".stats-annual-row[data-ym]").forEach(row => {
    row.addEventListener("click", () => {
      _statsCurrentYM = row.dataset.ym;
      _updateStatsMonthLabel();
      _loadStatsForMonth(_statsCurrentYM);
    });
  });
}

function _renderGas(month) {
  const gasSpent    = parseFloat(month.gasSpent)    || 0;
  const gasLiters   = parseFloat(month.gasLiters)   || 0;
  const gasAvg      = parseFloat(month.gasAvgPrice)  || 0;
  document.getElementById("gas-spent").textContent     = gasSpent   > 0 ? gasSpent.toFixed(2)  + "€"   : "—";
  document.getElementById("gas-liters").textContent    = gasLiters  > 0 ? gasLiters.toFixed(1) + " L"  : "—";
  document.getElementById("gas-avg-price").textContent = gasAvg     > 0 ? gasAvg.toFixed(3)    + "€/L" : "—";
  document.getElementById("gas-card").classList.toggle("hidden", gasSpent === 0);
}
