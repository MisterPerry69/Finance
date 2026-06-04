/* ============================================
   FINANCE — Stats view
   ============================================ */

let _chartInstance = null;

const CAT_COLORS = {
  CIBO:       "#f0b429",
  CASA:       "#00c9a7",
  TECH:       "#00d4ff",
  SVAGO:      "#a78bfa",
  TRASPORTI:  "#fb923c",
  SALUTE:     "#f472b6",
  ENTRATE:    "#4ade80",
  ALTRO:      "#6b7280",
  RIMBORSO:   "#34d399",
};

function renderStats(data) {
  if (!data || !data.currentMonth) return;
  const month = data.currentMonth;
  const balances = data.balances;

  const income  = parseFloat(month.income);
  const spent   = parseFloat(month.spent);
  const total   = parseFloat(balances.total);

  document.getElementById("stat-total-spent").textContent  = spent.toFixed(2) + "€";
  document.getElementById("stat-total-income").textContent = income.toFixed(2) + "€";

  // Survival index: months left at current burn rate
  const survivalMonths = spent > 0 ? total / spent : Infinity;
  const survivalPct = spent > 0 ? Math.min(100, (survivalMonths / 12) * 100) : 100;
  document.getElementById("survival-percentage").textContent = isFinite(survivalMonths)
    ? survivalMonths.toFixed(1) + " mesi"
    : "∞";
  document.getElementById("survival-bar-fill").style.width = survivalPct + "%";

  // Top 3 expenses
  const cats = month.categories || {};
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const topList = document.getElementById("top-expenses-list");
  if (sorted.length === 0) {
    topList.innerHTML = '<div class="empty-state">Nessuna spesa questo mese</div>';
  } else {
    topList.innerHTML = sorted.slice(0, 3).map(([cat, amt]) =>
      `<div class="top-expense-row">
        <span class="top-expense-name">${escapeHtml(cat)}</span>
        <span class="top-expense-amount">${parseFloat(amt).toFixed(2)}€</span>
      </div>`
    ).join("");
  }

  // Category chart
  renderCategoryChart(cats);

  // Gas
  const gasSpent = parseFloat(month.gasSpent) || 0;
  const gasLiters = parseFloat(month.gasLiters) || 0;
  const gasAvg = parseFloat(month.gasAvgPrice) || 0;
  document.getElementById("gas-spent").textContent     = gasSpent > 0   ? gasSpent.toFixed(2) + "€"   : "—";
  document.getElementById("gas-liters").textContent    = gasLiters > 0  ? gasLiters.toFixed(1) + " L"  : "—";
  document.getElementById("gas-avg-price").textContent = gasAvg > 0     ? gasAvg.toFixed(3) + "€/L"    : "—";
}

function renderCategoryChart(categories) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;
  const entries = Object.entries(categories || {}).filter(([, v]) => v > 0);
  if (entries.length === 0) return;

  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => parseFloat(v));
  const colors = labels.map(k => CAT_COLORS[k] || "#555");

  if (_chartInstance) {
    _chartInstance.data.labels = labels;
    _chartInstance.data.datasets[0].data = values;
    _chartInstance.data.datasets[0].backgroundColor = colors;
    _chartInstance.update();
    return;
  }

  _chartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "transparent",
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#888",
            font: { family: "Ubuntu", size: 10 },
            boxWidth: 10,
            padding: 8,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.toFixed(2)}€`
          }
        }
      }
    }
  });
}
