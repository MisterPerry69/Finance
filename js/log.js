/* ============================================
   FINANCE — Log / search view
   ============================================ */

let _aiSearchActive = false;

document.addEventListener("DOMContentLoaded", () => {
  const input     = document.getElementById("finance-search");
  const clearBtn  = document.getElementById("search-clear");
  const aiToggle  = document.getElementById("ai-search-toggle");
  const aiStatus  = document.getElementById("ai-status");
  const monthPicker = document.getElementById("month-picker");
  const monthBtn    = document.getElementById("month-picker-btn");

  // Search on Enter
  input.addEventListener("keyup", e => {
    clearBtn.classList.toggle("hidden", !input.value);
    if (e.key === "Enter") runSearch(input.value.trim());
  });

  // Clear search
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

  // Category quick filters
  document.querySelectorAll(".cat-btn[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      input.value = cat;
      clearBtn.classList.remove("hidden");
      runSearch(cat);
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
  container.innerHTML = `<div class="loading-text">QUERYING${_aiSearchActive ? "_NEURAL" : ""}_DATABASE...</div>`;
  try {
    const action = _aiSearchActive ? "finance_search_ai" : "finance_search";
    const data = await apiGet(action, { q: query });
    renderFilteredResults(data);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">ERRORE_CONNESSIONE_DATABASE</div>';
  }
}

async function runMonthFilter(ym) {
  const container = document.getElementById("filtered-results");
  container.innerHTML = '<div class="loading-text">QUERYING_DATABASE...</div>';
  try {
    const data = await apiGet("finance_filter_month", { ym });
    renderFilteredResults(data);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">ERRORE_CONNESSIONE_DATABASE</div>';
  }
}

function renderFilteredResults(items) {
  const container = document.getElementById("filtered-results");
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">NESSUN_RISULTATO_TROVATO</div>';
    return;
  }
  container.innerHTML = renderTransactionRows(items);
  if (lucide) lucide.createIcons({ nodes: [container] });
  bindTransactionInfoBtns(container);
}
