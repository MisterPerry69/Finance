/* ============================================
   FINANCE — App init, navigation, shared utils
   ============================================ */

// ---- State ----
let _currentView = "home";
let _cachedData = null;
let _balanceHidden = false;

// ---- Init ----
window.addEventListener("DOMContentLoaded", async () => {
  setupNav();
  setupAnalystBubble();

  // Load data and splash run in parallel; splash waits for both before fading
  const [_, dataResult] = await Promise.all([
    _animateSplashBar(),
    loadData().then(() => "ok").catch(() => "ok"),
  ]);

  const splash = document.getElementById("splash");
  const bar = document.getElementById("splash-bar");
  bar.style.width = "100%";
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => {
      splash.style.display = "none";
      document.getElementById("app").classList.remove("hidden");
    }, 480);
  }, 160);
});

function _animateSplashBar() {
  return new Promise(resolve => {
    const bar = document.getElementById("splash-bar");
    let pct = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 14 + 4;
      if (pct >= 88) { pct = 88; clearInterval(iv); resolve(); }
      bar.style.width = pct + "%";
    }, 90);
  });
}

// ---- Navigation ----
function setupNav() {
  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });
  document.getElementById("nav-entry-btn").addEventListener("click", openEntryModal);
}

function switchView(viewName) {
  if (_currentView === viewName) return;
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
    v.classList.add("hidden");
  });
  const target = document.getElementById("view-" + viewName);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }
  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  _currentView = viewName;
  if (viewName === "stats" && _cachedData) renderStats(_cachedData);
  if (viewName === "budget") loadBudget();
}

// ---- Data loading ----
async function loadData() {
  try {
    const data = await apiGet("finance_get_data");
    _cachedData = data;
    renderHome(data);
  } catch(e) {
    console.error("loadData error:", e);
  }
}

// ---- Analyst bubble ----
function setupAnalystBubble() {
  const bubble = document.getElementById("analyst-bubble");
  bubble.addEventListener("click", () => bubble.classList.remove("active"));
}

function showAnalyst(html, autoDismissMs) {
  const bubble = document.getElementById("analyst-bubble");
  const text = document.getElementById("analyst-text");
  bubble.classList.remove("active");
  void bubble.offsetWidth;
  text.innerHTML = html;
  bubble.classList.add("active");
  if (lucide) lucide.createIcons({ nodes: [bubble] });
  if (autoDismissMs) setTimeout(() => bubble.classList.remove("active"), autoDismissMs);
}

// ---- Shared utils ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CAT_ICONS = {
  CIBO:        "utensils",
  SPESA:       "shopping-cart",
  SVAGO:       "gamepad-2",
  CASA:        "home",
  SALUTE:      "heart",
  TRASPORTI:   "car",
  TECH:        "cpu",
  LAVORO:      "briefcase",
  ENTRATE:     "trending-up",
  RIMBORSO:    "corner-down-left",
  TRASFERIMENTO: "arrow-right-left",
  SET_BALANCE: "refresh-cw",
};

function catIcon(cat) {
  return CAT_ICONS[String(cat).toUpperCase()] || "arrow-right-left";
}

function renderTransactionRows(transactions) {
  if (!transactions || transactions.length === 0) {
    return '<div class="empty-state">Nessuna transazione</div>';
  }
  return transactions.map(t => {
    const amt = parseFloat(t.amt);
    const isPos = amt >= 0;
    const hasNote = t.note && t.note.trim();
    const noteData = encodeURIComponent(JSON.stringify({ note: t.note || "", desc: t.desc || "" }));
    return `
      <div class="trans-row">
        <span class="trans-date">${escapeHtml(t.date)}</span>
        <span class="trans-icon"><i data-lucide="${catIcon(t.cat)}"></i></span>
        <div class="trans-body">
          <div class="trans-desc">${escapeHtml(t.desc)}</div>
          ${hasNote ? `<div class="trans-note">${escapeHtml(t.note)}</div>` : ""}
        </div>
        ${hasNote ? `<button class="trans-info-btn" data-note="${escapeAttr(noteData)}" aria-label="Mostra nota"><i data-lucide="info"></i></button>` : ""}
        <span class="trans-amount ${isPos ? "positive" : "negative"}">${isPos ? "+" : ""}${amt.toFixed(2)}€</span>
      </div>`;
  }).join("");
}

function bindTransactionInfoBtns(container) {
  container.querySelectorAll(".trans-info-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      try {
        const data = JSON.parse(decodeURIComponent(btn.dataset.note));
        const cleanNote = data.note || "NESSUNA NOTA";
        const cleanDesc = data.desc || "TRANSAZIONE";
        showAnalyst(`
          <div class="analyst-note-label">Nota su</div>
          <div class="analyst-note-desc">${escapeHtml(cleanDesc.toUpperCase())}</div>
          <div class="analyst-note-text">"${escapeHtml(cleanNote.toUpperCase())}"</div>
        `, 8000);
      } catch(ex) {}
    });
  });
}
