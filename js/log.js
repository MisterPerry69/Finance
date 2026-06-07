/* ============================================
   CASSA — Log modal
   ============================================ */

let _aiSearchActive = false;

document.addEventListener("DOMContentLoaded", () => {
  const input      = document.getElementById("finance-search");
  const clearBtn   = document.getElementById("search-clear");
  const aiToggle   = document.getElementById("ai-search-toggle");
  const aiStatus   = document.getElementById("ai-status");
  const monthPicker = document.getElementById("month-picker");
  const monthBtn    = document.getElementById("month-picker-btn");

  // Close log modal by clicking outside (the overlay)
  document.getElementById("log-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("log-modal")) closeLogModal();
  });

  // Search on Enter
  input.addEventListener("keyup", e => {
    clearBtn.classList.toggle("hidden", !input.value);
    if (e.key === "Enter") runSearch(input.value.trim());
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.add("hidden");
    document.getElementById("filtered-results").innerHTML = "";
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
      if (!wasActive) {
        btn.classList.add("active");
        input.value = btn.dataset.cat;
        clearBtn.classList.remove("hidden");
        runSearch(btn.dataset.cat);
      } else {
        input.value = "";
        clearBtn.classList.add("hidden");
        document.getElementById("filtered-results").innerHTML = "";
      }
    });
  });

  // Month picker
  monthBtn.addEventListener("click", () => monthPicker.showPicker());
  monthPicker.addEventListener("change", () => {
    if (monthPicker.value) runMonthFilter(monthPicker.value);
  });
});

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

async function runMonthFilter(ym) {
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">Filtro per mese...</div>';
  try {
    const data = await apiGet("finance_filter_month", { ym });
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
  bindTransactionInfoBtns(container);
}
