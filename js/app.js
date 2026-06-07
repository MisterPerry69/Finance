/* ============================================
   CASSA — App init, swipe navigation, shared utils
   ============================================ */

// ---- State ----
let _currentPane = "home";
let _cachedData  = null;
let _balanceHidden = false;

const PANE_ORDER  = ["budget", "home", "stats"];
const PANE_ACCENT = {
  budget: "#143C51",
  home:   "#25B7BB",
  stats:  "#7E9BA5",
};

// ---- Init ----
window.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupSwipe();
  setupAnalystBubble();
  setupFAB();

  document.getElementById("open-log-btn").addEventListener("click", openLogModal);

  const [_bar, _data] = await Promise.all([
    _animateSplashBar(),
    loadData().catch(() => null),
  ]);

  const splash = document.getElementById("splash");
  document.getElementById("splash-bar").style.width = "100%";
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => {
      splash.style.display = "none";
      document.getElementById("app").classList.remove("hidden");
      // kick off icons after app is visible
      if (lucide) lucide.createIcons();
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

// ---- Data loading ----
async function loadData() {
  const data = await apiGet("finance_get_data");
  _cachedData = data;
  renderHome(data);
  return data;
}

// ---- Tab navigation ----
function setupTabs() {
  document.querySelectorAll(".section-tab[data-pane]").forEach(btn => {
    btn.addEventListener("click", () => navigateToPane(btn.dataset.pane, true));
  });
}

function navigateToPane(pane, animate) {
  if (pane === _currentPane) return;
  const deck   = document.getElementById("swipe-deck");
  const fromIdx = PANE_ORDER.indexOf(_currentPane);
  const toIdx   = PANE_ORDER.indexOf(pane);
  const dir     = toIdx > fromIdx ? -1 : 1; // -1 = slide left (go right), +1 = slide right (go left)

  if (animate) {
    deck.style.transition = "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
  } else {
    deck.style.transition = "none";
  }

  const offsetPct = toIdx * -100;
  deck.style.transform = `translateX(${offsetPct}%)`;

  _currentPane = pane;
  _updateTabUI();
  _updateAccent();

  if (pane === "stats" && _cachedData) renderStats(_cachedData);
  if (pane === "budget") loadBudget();
}

function _updateTabUI() {
  document.querySelectorAll(".section-tab[data-pane]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pane === _currentPane);
  });
}

function _updateAccent() {
  document.documentElement.style.setProperty("--accent", PANE_ACCENT[_currentPane]);
  // FAB color
  const fab = document.getElementById("fab-entry");
  if (_currentPane === "budget") {
    fab.style.background = PANE_ACCENT.budget;
  } else if (_currentPane === "stats") {
    fab.style.background = PANE_ACCENT.stats;
  } else {
    fab.style.background = "";
  }
}

// ---- Swipe gesture ----
function setupSwipe() {
  const deck = document.getElementById("swipe-deck");
  // Set initial position (home is center = index 1)
  deck.style.transform = "translateX(-100%)";
  deck.style.display   = "flex";
  deck.style.width     = `${PANE_ORDER.length * 100}%`;
  document.querySelectorAll(".pane").forEach(p => {
    p.style.width = `${100 / PANE_ORDER.length}%`;
  });

  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let isHorizontal = null;
  let baseOffset = -100; // home starts at -100%

  deck.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    isHorizontal = null;
    deck.style.transition = "none";
    baseOffset = PANE_ORDER.indexOf(_currentPane) * -100;
  }, { passive: true });

  deck.addEventListener("touchmove", e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (isHorizontal === null) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal) return;

    e.preventDefault();
    const pct = (dx / window.innerWidth) * 100;
    const idx = PANE_ORDER.indexOf(_currentPane);
    // Resist at edges
    let dampedPct = pct;
    if ((idx === 0 && pct > 0) || (idx === PANE_ORDER.length - 1 && pct < 0)) {
      dampedPct = pct * 0.2;
    }
    deck.style.transform = `translateX(${baseOffset + dampedPct}%)`;
  }, { passive: false });

  deck.addEventListener("touchend", e => {
    if (!isDragging || !isHorizontal) { isDragging = false; return; }
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const threshold = window.innerWidth * 0.22;
    const idx = PANE_ORDER.indexOf(_currentPane);

    if (dx < -threshold && idx < PANE_ORDER.length - 1) {
      navigateToPane(PANE_ORDER[idx + 1], true);
    } else if (dx > threshold && idx > 0) {
      navigateToPane(PANE_ORDER[idx - 1], true);
    } else {
      // Snap back
      deck.style.transition = "transform 0.22s ease";
      deck.style.transform  = `translateX(${baseOffset}%)`;
    }
  }, { passive: true });
}

// ---- FAB ----
function setupFAB() {
  document.getElementById("fab-entry").addEventListener("click", openEntryModal);
}

// ---- Analyst bubble ----
function setupAnalystBubble() {
  document.getElementById("analyst-bubble").addEventListener("click", () => {
    document.getElementById("analyst-bubble").classList.remove("active");
  });
}

function showAnalyst(html, autoDismissMs) {
  const bubble = document.getElementById("analyst-bubble");
  const text   = document.getElementById("analyst-text");
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
  CIBO:          "utensils",
  SPESA:         "shopping-cart",
  SVAGO:         "gamepad-2",
  CASA:          "home",
  SALUTE:        "heart",
  TRASPORTI:     "car",
  TECH:          "cpu",
  LAVORO:        "briefcase",
  ENTRATE:       "trending-up",
  RIMBORSO:      "corner-down-left",
  TRASFERIMENTO: "arrow-right-left",
  SET_BALANCE:   "refresh-cw",
  ALTRO:         "layers",
};

const CAT_COLORS = {
  CIBO:       "#f0b429",
  CASA:       "#25B7BB",
  TECH:       "#0891b2",
  SVAGO:      "#a78bfa",
  TRASPORTI:  "#fb923c",
  SALUTE:     "#f472b6",
  ENTRATE:    "#1aab7a",
  ALTRO:      "#7E9BA5",
  RIMBORSO:   "#34d399",
};

function catIcon(cat) {
  return CAT_ICONS[String(cat).toUpperCase()] || "circle";
}
function catColor(cat) {
  return CAT_COLORS[String(cat).toUpperCase()] || "#7E9BA5";
}

function renderTransactionRows(transactions) {
  if (!transactions || transactions.length === 0) {
    return '<div class="empty-state">Nessuna transazione</div>';
  }
  return transactions.map(t => {
    const amt    = parseFloat(t.amt);
    const isPos  = amt >= 0;
    const hasNote = t.note && t.note.trim();
    const noteData = encodeURIComponent(JSON.stringify({ note: t.note || "", desc: t.desc || "" }));
    return `
      <div class="trans-row">
        <div class="trans-icon-wrap"><i data-lucide="${catIcon(t.cat)}"></i></div>
        <div class="trans-body">
          <div class="trans-desc">${escapeHtml(t.desc)}</div>
          <div class="trans-meta">${escapeHtml(t.cat)}${t.date ? " · " + escapeHtml(t.date) : ""}</div>
          ${hasNote ? `<div class="trans-note-tag">${escapeHtml(t.note)}</div>` : ""}
        </div>
        <div class="trans-right">
          <span class="trans-amount ${isPos ? "positive" : "negative"}">${isPos ? "+" : ""}${amt.toFixed(2)}€</span>
          ${hasNote ? `<button class="trans-info-btn" data-note="${escapeAttr(noteData)}" aria-label="Mostra nota"><i data-lucide="info"></i></button>` : ""}
        </div>
      </div>`;
  }).join("");
}

function bindTransactionInfoBtns(container) {
  container.querySelectorAll(".trans-info-btn[data-note]").forEach(btn => {
    btn.addEventListener("click", () => {
      try {
        const data      = JSON.parse(decodeURIComponent(btn.dataset.note));
        const cleanNote = data.note || "Nessuna nota";
        const cleanDesc = data.desc || "Transazione";
        showAnalyst(`
          <div class="analyst-note-label">Nota su</div>
          <div class="analyst-note-desc">${escapeHtml(cleanDesc)}</div>
          <div class="analyst-note-text">"${escapeHtml(cleanNote)}"</div>
        `, 8000);
      } catch(ex) {}
    });
  });
}

// Log modal open/close
function openLogModal() {
  document.getElementById("log-modal").classList.remove("hidden");
  if (lucide) lucide.createIcons({ nodes: [document.getElementById("log-modal")] });
}
function closeLogModal() {
  document.getElementById("log-modal").classList.add("hidden");
}
