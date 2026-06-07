/* ============================================
   TIDE — Log full-page
   ============================================ */

let _aiSearchActive  = false;
let _logCurrentYM    = "";   // "YYYY-MM" del mese visualizzato
let _logSearchActive = false;
let _annualVisible   = false;

const MONTH_NAMES = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
];

document.addEventListener("DOMContentLoaded", () => {
  const input      = document.getElementById("finance-search");
  const clearBtn   = document.getElementById("search-clear");
  const aiToggle   = document.getElementById("ai-search-toggle");
  const aiStatus   = document.getElementById("ai-status");
  const catSelect  = document.getElementById("log-cat-filter");
  const annualBtn  = document.getElementById("log-annual-toggle");

  // Init current month
  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  // Close log on X
  document.getElementById("log-close-btn").addEventListener("click", closeLogModal);

  // Annual toggle (header left)
  annualBtn.addEventListener("click", () => {
    _annualVisible = !_annualVisible;
    annualBtn.classList.toggle("active", _annualVisible);
    _toggleAnnualView(_annualVisible);
  });

  // Month navigation
  document.getElementById("log-month-prev").addEventListener("click", () => _stepMonth(-1));
  document.getElementById("log-month-next").addEventListener("click", () => _stepMonth(+1));

  // Search input
  input.addEventListener("input", () => {
    clearBtn.classList.toggle("hidden", !input.value);
    // Reset category dropdown when typing
    if (input.value) catSelect.value = "";
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
    catSelect.value = "";
    catSelect.classList.remove("has-value");
    _logSearchActive = false;
    _showMonthView();
  });

  // AI toggle (inside search bar)
  aiToggle.addEventListener("click", () => {
    _aiSearchActive = !_aiSearchActive;
    aiStatus.textContent = _aiSearchActive ? "ON" : "OFF";
    aiToggle.classList.toggle("active", _aiSearchActive);
  });

  // Category dropdown
  catSelect.addEventListener("change", () => {
    const cat = catSelect.value;
    input.value = "";
    clearBtn.classList.add("hidden");
    catSelect.classList.toggle("has-value", !!cat);
    if (cat) {
      _logSearchActive = true;
      runSearch(cat);
    } else {
      _logSearchActive = false;
      _showMonthView();
    }
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
  document.getElementById("log-cat-filter").value = "";
  document.getElementById("log-cat-filter").classList.remove("has-value");
  document.getElementById("log-annual-toggle").classList.remove("active");
  document.getElementById("log-annual-wrap").classList.add("hidden");
  document.getElementById("filtered-results").classList.remove("hidden");
  _aiSearchActive  = false;
  _logSearchActive = false;
  _annualVisible   = false;

  // Init to current month
  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("log-annual-year").textContent = String(now.getFullYear());

  _updateMonthLabel();
  _showMonthView();
}

function closeLogModal() {
  document.getElementById("log-modal").classList.add("hidden");
}

function _toggleAnnualView(show) {
  const results    = document.getElementById("filtered-results");
  const annualWrap = document.getElementById("log-annual-wrap");
  if (show) {
    results.classList.add("hidden");
    annualWrap.classList.remove("hidden");
    _loadAnnualSummary();
  } else {
    annualWrap.classList.add("hidden");
    results.classList.remove("hidden");
  }
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
  // If annual is open, close it first
  if (_annualVisible) {
    _annualVisible = false;
    document.getElementById("log-annual-toggle").classList.remove("active");
    _toggleAnnualView(false);
  }
  const container  = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">Caricamento...</div>';
  try {
    const data = await apiGet("finance_filter_month", { ym: _logCurrentYM });
    _renderLogResults(data);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">Errore connessione</div>';
  }
}

async function _loadAnnualSummary() {
  const months = window._budgetMonths;
  const annualList = document.getElementById("log-annual-list");
  if (!months || months.length === 0) {
    annualList.innerHTML = '<div class="empty-state">Dati non disponibili — visita Budget prima</div>';
    return;
  }

  const maxSpent = Math.max(...months.map(m => m.spent || 0), 1);
  const curYM = _logCurrentYM;

  annualList.innerHTML = months.map(m => {
    const ym    = m.ym || "";
    const isCur = ym === curYM;
    const pct   = ((m.spent || 0) / maxSpent * 100).toFixed(0);
    return `
      <div class="log-annual-row" data-ym="${escapeAttr(ym)}">
        <span class="log-annual-month${isCur ? " current" : ""}">${escapeHtml(m.labelFull || m.label || ym)}</span>
        <div class="log-annual-bar-wrap">
          <div class="log-annual-bar${isCur ? " current" : ""}" style="width:${pct}%"></div>
        </div>
        <span class="log-annual-amt">${parseFloat(m.spent || 0).toFixed(2)}€</span>
      </div>`;
  }).join("");

  document.querySelectorAll(".log-annual-row[data-ym]").forEach(row => {
    row.addEventListener("click", () => {
      _logCurrentYM = row.dataset.ym;
      _updateMonthLabel();
      _logSearchActive = false;
      document.getElementById("log-cat-filter").value = "";
      document.getElementById("log-cat-filter").classList.remove("has-value");
      document.getElementById("finance-search").value = "";
      document.getElementById("search-clear").classList.add("hidden");
      _showMonthView();
    });
  });
}

// ---- Search ----
async function runSearch(query) {
  if (!query) return;
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
}
