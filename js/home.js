/* ============================================
   TIDE — Home pane rendering
   ============================================ */

const HIDDEN_VAL = "•••";

function renderHome() {
  _renderBalances();
  _renderRecent();
}

function _renderBalances() {
  const b      = balances();
  const month  = monthStats(currentYM());
  const budget = computeBudget();
  const auto   = autonomy();
  const hide   = v => _balanceHidden ? HIDDEN_VAL : fmtEur(v);

  document.getElementById("total-balance").textContent = _balanceHidden ? HIDDEN_VAL + " €" : fmtEur(b.total);
  document.getElementById("bank-val").textContent   = hide(b.BANK);
  document.getElementById("paypal-val").textContent = hide(b.PAYPAL);
  document.getElementById("cash-val").textContent   = hide(b.CASH);
  document.getElementById("ifis-val").textContent   = hide(b.IFIS);

  // Month context
  document.getElementById("month-spent").textContent  = fmtEur(month.spent);
  document.getElementById("month-income").textContent = fmtEur(month.income);
  document.getElementById("month-autonomy").textContent =
    isFinite(auto.months) ? auto.months.toFixed(1) + " m" : "∞";

  // Barra: quanto del budget mensile (spendibile) è già stato usato
  const fill  = document.getElementById("burn-fill");
  const label = document.getElementById("burn-label");
  if (budget.spendable > 0) {
    const pct  = (month.spent / budget.spendable) * 100;
    const left = budget.spendable - month.spent;
    fill.style.width = Math.min(100, pct) + "%";
    fill.className   = "prog-fill" + (pct >= 100 ? " danger" : pct >= 80 ? " warn" : "");
    label.textContent = left >= 0
      ? `${fmtPct(pct)} del budget mensile · restano ${fmtEur(left, 0)}`
      : `Budget mensile superato di ${fmtEur(-left, 0)}`;
  } else {
    fill.style.width = "0%";
    fill.className   = "prog-fill";
    label.textContent = "Budget non disponibile: imposta le entrate nella tab Budget";
  }

  const toggleBtn = document.getElementById("balance-toggle");
  toggleBtn.innerHTML = _balanceHidden ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
  toggleBtn.onclick = toggleBalanceVisibility;
  refreshIcons();
}

function toggleBalanceVisibility() {
  _balanceHidden = !_balanceHidden;
  _renderBalances();
}

function _renderRecent() {
  const log = document.getElementById("finance-log");
  if (!log) return;
  // Ultime 10 righe del foglio (ordine di inserimento)
  const recent = _tx.filter(t => t.date).slice(-10).reverse();
  log.innerHTML = renderTransactionRows(recent);
  refreshIcons();
}
