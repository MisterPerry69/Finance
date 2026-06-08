/* ============================================
   CASSA — Edit transaction modal
   ============================================ */

let _editRowData = null;

function openEditModal(rowData) {
  _editRowData = rowData;
  document.getElementById("edit-row-index").value = rowData.rowIndex || "";
  document.getElementById("edit-amount").value     = rowData.amt !== undefined ? rowData.amt : "";
  document.getElementById("edit-wallet").value     = rowData.wallet || "BANK";
  document.getElementById("edit-cat").value        = rowData.cat && rowData.cat !== "AI_PENDING" ? rowData.cat : "ALTRO";
  document.getElementById("edit-desc").value       = rowData.desc || "";
  document.getElementById("edit-note").value       = rowData.note || "";

  const modal = document.getElementById("edit-modal");
  modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("edit-amount").focus(), 80);
  if (lucide) lucide.createIcons({ nodes: [modal] });
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  _editRowData = null;
}

async function _saveEdit() {
  const rowIndex = parseInt(document.getElementById("edit-row-index").value);
  if (!rowIndex) return;

  const btn = document.getElementById("edit-save-btn");
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = "…";

  try {
    await apiPost("finance_update_transaction", {
      rowIndex,
      amount: parseFloat(document.getElementById("edit-amount").value),
      wallet: document.getElementById("edit-wallet").value,
      cat:    document.getElementById("edit-cat").value,
      desc:   document.getElementById("edit-desc").value,
      note:   document.getElementById("edit-note").value
    });
    closeEditModal();
    // Ricarica i risultati correnti
    if (typeof _refreshAfterEdit === "function") _refreshAfterEdit();
  } catch(err) {
    console.error("Edit save error:", err);
  }

  btn.textContent = orig;
  btn.disabled = false;
}

// Intercetta click sulle matite ovunque appaiano trans-rows
document.addEventListener("click", e => {
  const btn = e.target.closest(".trans-edit-btn");
  if (!btn) return;
  e.stopPropagation();
  const rowIndex = parseInt(btn.dataset.rowIndex);
  if (!rowIndex) return;

  // Recupera il nodo .trans-row per leggere i dati dal DOM
  const row = btn.closest(".trans-row");
  if (!row) return;

  const descEl   = row.querySelector(".trans-desc");
  const metaEl   = row.querySelector(".trans-meta");
  const noteEl   = row.querySelector(".trans-note-tag");
  const amtEl    = row.querySelector(".trans-amount");

  const descText = descEl ? descEl.textContent.trim() : "";
  const noteText = noteEl ? noteEl.textContent.trim() : "";
  const amtText  = amtEl  ? amtEl.textContent.replace(/[+€]/g, "").trim() : "0";
  const metaText = metaEl ? metaEl.textContent.trim() : "";

  // Parse cat e wallet dal meta text ("CAT · DD/MM/YYYY") — non sempre disponibili dal DOM
  // Ma possiamo usare _lastLogData se disponibile
  let rowData = { rowIndex, amt: parseFloat(amtText) || 0, desc: descText, note: noteText };

  if (window._lastLogData && Array.isArray(window._lastLogData)) {
    const found = window._lastLogData.find(t => t.rowIndex === rowIndex);
    if (found) rowData = found;
  }

  openEditModal(rowData);
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("edit-modal-close").addEventListener("click", closeEditModal);
  document.getElementById("edit-cancel-btn").addEventListener("click", closeEditModal);
  document.getElementById("edit-save-btn").addEventListener("click", _saveEdit);

  document.getElementById("edit-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("edit-modal")) closeEditModal();
  });
});
