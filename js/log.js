/* ============================================
   TIDE — Log full-page
   ============================================ */

let _aiSearchActive = false;
let _logCurrentYM   = "";   // "YYYY-MM" del mese visualizzato
let _logSearchActive = false; // true quando c'è una ricerca testo/cat attiva

const MONTH_NAMES = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
];

document.addEventListener("DOMContentLoaded", () => {
  const input    = document.getElementById("finance-search");
  const clearBtn = document.getElementById("search-clear");
  const aiToggle = document.getElementById("ai-search-toggle");
  const aiStatus = document.getElementById("ai-status");

  // Init current month
  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  // Close log on X
  document.getElementById("log-close-btn").addEventListener("click", closeLogModal);

  // Month navigation
  document.getElementById("log-month-prev").addEventListener("click", () => _stepMonth(-1));
  document.getElementById("log-month-next").addEventListener("click", () => _stepMonth(+1));

  // Search input
  input.addEventListener("input", () => {
    clearBtn.classList.toggle("hidden", !input.value);
  });
  input.addEventListener("keyup", e => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) { _logSearchActive = true; runSearch(q); }
      else   { _logSearchActive = false; _showMonthView(); }
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.add("hidden");
    _logSearchActive = false;
    document.querySelectorAll(".filter-chip[data-cat]").forEach(b => b.classList.remove("active"));
    _showMonthView();
  });

  // AI toggle
  aiToggle.addEventListener("click", () => {
    _aiSearchActive = !_aiSearchActive;
    aiStatus.textContent = _aiSearchActive ? "ON" : "OFF";
    aiToggle.classList.toggle("active", _aiSearchActive);
  });

  // Category filter chips
  document.querySelectorAll(".filter-chip[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const wasActive = btn.classList.contains("active");
      document.querySelectorAll(".filter-chip[data-cat]").forEach(b => b.classList.remove("active"));
      input.value = "";
      clearBtn.classList.add("hidden");
      if (!wasActive) {
        btn.classList.add("active");
        _logSearchActive = true;
        runSearch(btn.dataset.cat);
      } else {
        _logSearchActive = false;
        _showMonthView();
      }
    });
  });
});

// Called from app.js
function openLogModal() {
  const modal = document.getElementById("log-modal");
  modal.classList.remove("hidden");
  if (lucide) lucide.createIcons({ nodes: [modal] });

  // Reset state
  document.getElementById("finance-search").value = "";
  document.getElementById("search-clear").classList.add("hidden");
  document.getElementById("ai-search-toggle").classList.remove("active");
  document.getElementById("ai-status").textContent = "OFF";
  _aiSearchActive  = false;
  _logSearchActive = false;
  document.querySelectorAll(".filter-chip[data-cat]").forEach(b => b.classList.remove("active"));

  // Init to current month
  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  _updateMonthLabel();
  _showMonthView();
  _loadAnnualSummary();
}

function closeLogModal() {
  document.getElementById("log-modal").classList.add("hidden");
}

// ---- Month navigation ----
function _stepMonth(delta) {
  const [y, m] = _logCurrentYM.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  _logCurrentYM = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  _updateMonthLabel();
  if (!_logSearchActive) _showMonthView();
}

function _updateMonthLabel() {
  const [y, m] = _logCurrentYM.split("-").map(Number);
  document.getElementById("log-month-label").textContent = `${MONTH_NAMES[m-1]} ${y}`;
}

async function _showMonthView() {
  const container  = document.getElementById("filtered-results");
  const annualWrap = document.getElementById("log-annual-wrap");
  container.innerHTML = '<div class="loading-text">Caricamento...</div>';
  annualWrap.classList.add("hidden");
  try {
    const data = await apiGet("finance_filter_month", { ym: _logCurrentYM });
    _renderLogResults(data);
    // Show annual below results if we're in month mode
    annualWrap.classList.remove("hidden");
  } catch(e) {
    container.innerHTML = '<div class="empty-state">Errore connessione</div>';
  }
}

async function _loadAnnualSummary() {
  // Use cached budget allMonths if available, else request
  const months = window._budgetMonths;
  const annualList = document.getElementById("log-annual-list");
  if (!months || months.length === 0) { annualList.innerHTML = ""; return; }

  const maxSpent = Math.max(...months.map(m => m.spent || 0), 1);
  const curMonth = _logCurrentYM.slice(5,7); // "06"

  annualList.innerHTML = months.map(m => {
    const ym     = m.ym || "";
    const mNum   = ym.slice(5,7);
    const isCur  = mNum === curMonth;
    const pct    = ((m.spent || 0) / maxSpent * 100).toFixed(0);
    return `
      <div class="log-annual-row" data-ym="${escapeAttr(ym)}">
        <span class="log-annual-month${isCur ? " current" : ""}">${escapeHtml(m.labelFull || m.label || ym)}</span>
        <div class="log-annual-bar-wrap">
          <div class="log-annual-bar${isCur ? " current" : ""}" style="width:${pct}%"></div>
        </div>
        <span class="log-annual-amt">${parseFloat(m.spent || 0).toFixed(2)}€</span>
      </div>`;
  }).join("");

  // Click on annual row → navigate to that month
  document.querySelectorAll(".log-annual-row[data-ym]").forEach(row => {
    row.addEventListener("click", () => {
      _logCurrentYM = row.dataset.ym;
      _updateMonthLabel();
      _logSearchActive = false;
      _showMonthView();
      // Scroll results to top
      document.getElementById("filtered-results").scrollTop = 0;
    });
  });
}

// ---- Search ----
async function runSearch(query) {
  if (!query) return;
  document.getElementById("log-annual-wrap").classList.add("hidden");
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">Ricerca in corso...</div>';
  try {
    const action = _aiSearchActive ? "finance_search_ai" : "finance_search";
    const data   = await apiGet(action, { q: query });
    _renderLogResults(data);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">Errore connessione</div>';
  }
}

function _renderLogResults(items) {
  const container = document.getElementById("filtered-results");
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">Nessun risultato</div>';
    return;
  }
  container.innerHTML = renderTransactionRows(items);
  if (lucide) lucide.createIcons({ nodes: [container] });
  // No bindTransactionInfoBtns — tasto rimosso
}
