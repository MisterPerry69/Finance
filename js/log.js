/* ============================================
   TIDE — Registro (log full-page)
   Filtri e ricerca lavorano sulla cache locale: nessuna attesa.
   ============================================ */

let _aiSearchActive = false;
let _logPeriod      = "month";  // "month" | "year"
let _logYM          = "";
let _logQuery       = "";       // testo cercato (su tutti i periodi)
let _searchTimer    = null;

document.addEventListener("DOMContentLoaded", () => {
  const input        = document.getElementById("finance-search");
  const clearBtn     = document.getElementById("search-clear");
  const aiToggle     = document.getElementById("ai-search-toggle");
  const catSelect    = document.getElementById("log-cat-filter");
  const walletSelect = document.getElementById("log-wallet-filter");

  _logYM = currentYM();

  document.getElementById("log-close-btn").addEventListener("click", closeLogModal);
  document.getElementById("log-month-prev").addEventListener("click", () => _stepLogPeriod(-1));
  document.getElementById("log-month-next").addEventListener("click", () => _stepLogPeriod(+1));
  document.getElementById("log-period-toggle").addEventListener("click", () => {
    _logPeriod = _logPeriod === "month" ? "year" : "month";
    renderLog();
  });

  // Ricerca: istantanea sulla cache; con AI attiva parte solo con Invio
  input.addEventListener("input", () => {
    clearBtn.classList.toggle("hidden", !input.value);
    if (_aiSearchActive) return;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => { _logQuery = input.value.trim(); renderLog(); }, 150);
  });
  input.addEventListener("keyup", e => {
    if (e.key !== "Enter") return;
    const q = input.value.trim();
    if (_aiSearchActive && q) _runAiSearch(q);
    else { _logQuery = q; renderLog(); }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.add("hidden");
    _logQuery = "";
    renderLog();
  });

  aiToggle.addEventListener("click", () => {
    _aiSearchActive = !_aiSearchActive;
    document.getElementById("ai-status").textContent = _aiSearchActive ? "ON" : "OFF";
    aiToggle.classList.toggle("active", _aiSearchActive);
    input.placeholder = _aiSearchActive ? "Chiedi, poi premi Invio..." : "Cerca...";
  });

  catSelect.addEventListener("change", () => {
    catSelect.classList.toggle("has-value", !!catSelect.value);
    renderLog();
  });
  walletSelect.addEventListener("change", () => {
    walletSelect.classList.toggle("has-value", !!walletSelect.value);
    renderLog();
  });
});

// ---- Open / Close ----
// opts (facoltativo): { cat, period: "month" | "year", ym } → registro già filtrato
function openLogModal(opts) {
  opts = opts && opts.cat !== undefined ? opts : {};
  const modal = document.getElementById("log-modal");
  modal.classList.remove("hidden");

  const input = document.getElementById("finance-search");
  input.value = "";
  input.placeholder = "Cerca...";
  document.getElementById("search-clear").classList.add("hidden");
  document.getElementById("ai-search-toggle").classList.remove("active");
  document.getElementById("ai-status").textContent = "OFF";
  ["log-cat-filter", "log-wallet-filter"].forEach(id => {
    const el = document.getElementById(id);
    el.value = "";
    el.classList.remove("has-value");
  });
  _aiSearchActive = false;
  _logQuery  = "";
  _logPeriod = opts.period === "year" ? "year" : "month";
  _logYM     = opts.ym || currentYM();

  if (opts.cat) {
    const sel = document.getElementById("log-cat-filter");
    if (![...sel.options].some(o => o.value === opts.cat)) {
      sel.add(new Option(catLabel(opts.cat), opts.cat));
    }
    sel.value = opts.cat;
    sel.classList.add("has-value");
  }

  renderLog();
}

function closeLogModal() {
  document.getElementById("log-modal").classList.add("hidden");
}

function isLogOpen() {
  return !document.getElementById("log-modal").classList.contains("hidden");
}

// ---- Periodo ----
function _stepLogPeriod(delta) {
  if (_logPeriod === "month") {
    const next = addMonths(_logYM, delta);
    if (next > currentYM()) return;
    _logYM = next;
  } else {
    const y = parseInt(_logYM.slice(0, 4), 10) + delta;
    if (y > new Date().getFullYear()) return;
    const ym = `${y}-${_logYM.slice(5, 7)}`;
    _logYM = ym > currentYM() ? currentYM() : ym;
  }
  renderLog();
}

// ---- Ricerca ----
function _searchText(t) {
  const [y, m] = t.date ? t.date.split("-") : ["", ""];
  const monthName = m ? MONTH_NAMES[parseInt(m, 10) - 1] : "";
  return [formatDate(t.date, true), monthName, y, t.cat, catLabel(t.cat), t.desc, t.note,
          walletLabel(t.wallet), Math.abs(t.amt).toFixed(2), Math.abs(t.amt).toFixed(2).replace(".", ",")]
    .join(" ").toLowerCase();
}

// Tutte le parole devono comparire (in qualsiasi ordine)
function _matches(t, query) {
  const text = _searchText(t);
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(w => text.includes(w));
}

async function _runAiSearch(q) {
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">L\'AI sta interpretando la richiesta...</div>';
  try {
    const res = await apiPost("finance_search_ai", { q });
    _logQuery = (res && res.q) || q;
  } catch (e) {
    _logQuery = q;
  }
  renderLog();
}

// ---- Render ----
function renderLog() {
  const searching = !!_logQuery;
  const year      = parseInt(_logYM.slice(0, 4), 10);
  const cat       = document.getElementById("log-cat-filter").value;
  const wallet    = document.getElementById("log-wallet-filter").value;

  // Navigazione periodo
  const nav = document.querySelector(".log-month-nav");
  nav.classList.toggle("is-searching", searching);
  const label = document.getElementById("log-month-label");
  if (searching) label.textContent = `Ricerca: "${_logQuery}" · tutti i periodi`;
  else label.textContent = _logPeriod === "month" ? ymLabel(_logYM) : `Anno ${year}`;
  const toggle = document.getElementById("log-period-toggle");
  toggle.classList.toggle("active", _logPeriod === "year");
  document.getElementById("log-period-toggle-text").textContent = _logPeriod === "year" ? "Mese" : "Anno";

  const first = firstDataYM();
  document.getElementById("log-month-next").disabled = _logPeriod === "month"
    ? _logYM >= currentYM() : year >= new Date().getFullYear();
  document.getElementById("log-month-prev").disabled = !first || (_logPeriod === "month"
    ? _logYM <= first : year <= parseInt(first.slice(0, 4), 10));

  let items;
  if (searching)                  items = _tx.filter(t => t.date && _matches(t, _logQuery));
  else if (_logPeriod === "month") items = _tx.filter(t => t.ym === _logYM);
  else                             items = _tx.filter(t => t.year === year);
  if (cat)    items = items.filter(t => t.cat === cat);
  if (wallet) items = items.filter(t => t.wallet === wallet);

  // Più recenti prima (a parità di giorno, ultimo inserito prima)
  items.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.rowIndex - a.rowIndex);

  const s = _statsOf(items);
  document.getElementById("log-summary").innerHTML = items.length
    ? `<span>${items.length} moviment${items.length === 1 ? "o" : "i"}</span>
       <span class="neg">−${fmtEur(s.spent)}</span>
       <span class="pos">+${fmtEur(s.income)}</span>`
    : "";

  const container = document.getElementById("filtered-results");
  container.innerHTML = items.length
    ? renderTransactionRows(items, { withYear: searching || _logPeriod === "year" })
    : '<div class="empty-state">Nessun risultato</div>';
  refreshIcons();
}
