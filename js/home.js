/* ============================================
   FINANCE — Home view
   ============================================ */

function renderHome(data) {
  renderBalances(data.balances, data.currentMonth);
  renderTransactionLog(data.recentTransactions);
}

function renderBalances(balances, month) {
  if (!balances) return;
  const total = parseFloat(balances.total);
  const spent = parseFloat(month.spent);
  const income = parseFloat(month.income);

  if (!_balanceHidden) {
    document.getElementById("total-balance").textContent = total.toFixed(2) + " €";
  }

  document.getElementById("bank-val").textContent   = parseFloat(balances.bank).toFixed(2)   + " €";
  document.getElementById("tinaba-val").textContent  = parseFloat(balances.tinaba).toFixed(2)  + " €";
  document.getElementById("paypal-val").textContent  = parseFloat(balances.paypal).toFixed(2)  + " €";
  document.getElementById("cash-val").textContent    = parseFloat(balances.cash).toFixed(2)    + " €";

  // Efficiency bar: % spent of income this month
  const pct = income > 0 ? Math.min(100, (spent / income) * 100) : 0;
  document.getElementById("efficiency-fill").style.width = pct + "%";
  let label;
  if (income === 0) {
    label = "NESSUNA_ENTRATA";
  } else {
    const months = total > 0 && spent > 0 ? (total / spent).toFixed(1) : "∞";
    label = `${pct.toFixed(0)}% SPESO · AUTONOMIA ${months} MESI`;
  }
  document.getElementById("burn-info-text").textContent = label;

  // Toggle button icon
  const toggleBtn = document.getElementById("balance-toggle");
  toggleBtn.innerHTML = _balanceHidden
    ? '<i data-lucide="eye-off"></i>'
    : '<i data-lucide="eye"></i>';
  toggleBtn.onclick = toggleBalanceVisibility;
  if (lucide) lucide.createIcons({ nodes: [toggleBtn] });
}

function toggleBalanceVisibility() {
  _balanceHidden = !_balanceHidden;
  const el = document.getElementById("total-balance");
  if (_balanceHidden) {
    el.textContent = "***,** €";
  } else if (_cachedData) {
    el.textContent = parseFloat(_cachedData.balances.total).toFixed(2) + " €";
  }
  renderBalances(_cachedData ? _cachedData.balances : {}, _cachedData ? _cachedData.currentMonth : {});
}

function renderTransactionLog(transactions) {
  const log = document.getElementById("finance-log");
  if (!log) return;
  log.innerHTML = renderTransactionRows(transactions);
  if (lucide) lucide.createIcons({ nodes: [log] });
  bindTransactionInfoBtns(log);
}
