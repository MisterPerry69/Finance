/* ============================================
   TIDE — Log full-page
   ============================================ */

let _aiSearchActive  = false;
let _logCurrentYM    = "";
let _logSearchActive = false;
let _lastLogData     = [];  // cache per filtro wallet lato client

const MONTH_NAMES = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
];

document.addEventListener("DOMContentLoaded", () => {
  const input        = document.getElementById("finance-search");
  const clearBtn     = document.getElementById("search-clear");
  const aiToggle     = document.getElementById("ai-search-toggle");
  const aiStatus     = document.getElementById("ai-status");
  const catSelect    = document.getElementById("log-cat-filter");
  const walletSelect = document.getElementById("log-wallet-filter");

  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  document.getElementById("log-close-btn").addEventListener("click", closeLogModal);

  // Month navigation
  document.getElementById("log-month-prev").addEventListener("click", () => _stepMonth(-1));
  document.getElementById("log-month-next").addEventListener("click", () => _stepMonth(+1));

  // Search input
  input.addEventListener("input", () => {
    clearBtn.classList.toggle("hidden", !input.value);
    if (input.value) { catSelect.value = ""; catSelect.classList.remove("has-value"); }
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
    catSelect.value = ""; catSelect.classList.remove("has-value");
    walletSelect.value = ""; walletSelect.classList.remove("has-value");
    _logSearchActive = false;
    _showMonthView();
  });

  // AI toggle
  aiToggle.addEventListener("click", () => {
    _aiSearchActive = !_aiSearchActive;
    aiStatus.textContent = _aiSearchActive ? "ON" : "OFF";
    aiToggle.classList.toggle("active", _aiSearchActive);
  });

  // Category dropdown — server search
  catSelect.addEventListener("change", () => {
    const cat = catSelect.value;
    input.value = ""; clearBtn.classList.add("hidden");
    catSelect.classList.toggle("has-value", !!cat);
    if (cat) { _logSearchActive = true; runSearch(cat); }
    else     { _logSearchActive = false; _showMonthView(); }
  });

  // Wallet dropdown — client-side filter on cached results
  walletSelect.addEventListener("change", () => {
    walletSelect.classList.toggle("has-value", !!walletSelect.value);
    _applyWalletFilter();
  });
});

function _applyWalletFilter() {
  const wallet = document.getElementById("log-wallet-filter").value;
  const filtered = wallet
    ? _lastLogData.filter(t => String(t.wallet).toUpperCase() === wallet)
    : _lastLogData;
  _renderLogResults(filtered, false);
}

// ---- Open / Close ----
function openLogModal() {
  const modal = document.getElementById("log-modal");
  modal.classList.remove("hidden");
  if (lucide) lucide.createIcons({ nodes: [modal] });

  document.getElementById("finance-search").value = "";
  document.getElementById("search-clear").classList.add("hidden");
  document.getElementById("ai-search-toggle").classList.remove("active");
  document.getElementById("ai-status").textContent = "OFF";
  document.getElementById("log-cat-filter").value = "";
  document.getElementById("log-cat-filter").classList.remove("has-value");
  document.getElementById("log-wallet-filter").value = "";
  document.getElementById("log-wallet-filter").classList.remove("has-value");
  _aiSearchActive  = false;
  _logSearchActive = false;
  _lastLogData     = [];

  const now = new Date();
  _logCurrentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  _updateMonthLabel();
  _showMonthView();
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
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">Caricamento...</div>';
  try {
    const data = await apiGet("finance_filter_month", { ym: _logCurrentYM });
    _renderLogResults(data, true);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">Errore connessione</div>';
  }
}

// ---- Search ----
async function runSearch(query) {
  if (!query) return;
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">Ricerca in corso...</div>';
  try {
    const action = _aiSearchActive ? "finance_search_ai" : "finance_search";
    const data   = await apiGet(action, { q: query });
    _renderLogResults(data, true);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">Errore connessione</div>';
  }
}

function _renderLogResults(items, updateCache) {
  if (updateCache) _lastLogData = items || [];
  const wallet = document.getElementById("log-wallet-filter").value;
  const toShow = wallet
    ? (items || []).filter(t => String(t.wallet).toUpperCase() === wallet)
    : (items || []);

  const container = document.getElementById("filtered-results");
  if (!toShow || toShow.length === 0) {
    container.innerHTML = '<div class="empty-state">Nessun risultato</div>';
    return;
  }
  container.innerHTML = renderTransactionRows(toShow);
  if (lucide) lucide.createIcons({ nodes: [container] });
}
