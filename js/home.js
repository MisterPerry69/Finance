/* ============================================
   CASSA — Home pane rendering
   ============================================ */

function renderHome(data) {
  if (!data) return;
  renderBalances(data.balances, data.currentMonth);
  renderTransactionLog(data.recentTransactions);
}

function renderBalances(balances, month) {
  if (!balances) return;
  const total  = parseFloat(balances.total)  || 0;
  const spent  = parseFloat(month?.spent)    || 0;
  const income = parseFloat(month?.income)   || 0;

  // Hero balance
  if (!_balanceHidden) {
    document.getElementById("total-balance").textContent = _formatAmt(total);
  }

  // Wallet strip
  const HIDDEN_VAL = "•••";
  document.getElementById("bank-val").textContent   = _balanceHidden ? HIDDEN_VAL : _formatAmt(parseFloat(balances.bank)   || 0);
  document.getElementById("tinaba-val").textContent = _balanceHidden ? HIDDEN_VAL : _formatAmt(parseFloat(balances.tinaba) || 0);
  document.getElementById("paypal-val").textContent = _balanceHidden ? HIDDEN_VAL : _formatAmt(parseFloat(balances.paypal) || 0);
  document.getElementById("cash-val").textContent   = _balanceHidden ? HIDDEN_VAL : _formatAmt(parseFloat(balances.cash)   || 0);

  // Month context
  document.getElementById("month-spent").textContent   = _formatAmt(spent);
  document.getElementById("month-income").textContent  = _formatAmt(income);
  const months = total > 0 && spent > 0 ? (total / spent).toFixed(1) + " m" : "∞";
  document.getElementById("month-autonomy").textContent = months;

  // Burn bar
  const pct = income > 0 ? Math.min(100, (spent / income) * 100) : 0;
  const fill = document.getElementById("burn-fill");
  fill.style.width = pct + "%";
  fill.className   = "prog-fill" + (pct >= 85 ? " danger" : pct >= 60 ? " warn" : "");
  document.getElementById("burn-label").textContent =
    income > 0 ? `${pct.toFixed(0)}% del reddito mensile speso` : "Nessuna entrata registrata";

  // Toggle btn
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
    el.textContent = "••• €";
  } else if (_cachedData) {
    el.textContent = _formatAmt(parseFloat(_cachedData.balances.total) || 0);
  }
  if (_cachedData) renderBalances(_cachedData.balances, _cachedData.currentMonth);
}

function renderTransactionLog(transactions) {
  const log = document.getElementById("finance-log");
  if (!log) return;
  log.innerHTML = renderTransactionRows(transactions);
  if (lucide) lucide.createIcons({ nodes: [log] });
}

function _formatAmt(n) {
  return n.toFixed(2) + " €";
}
