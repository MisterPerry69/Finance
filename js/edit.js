/* ============================================
   TIDE — Edit transaction modal
   ============================================ */

function openEditModal(tx) {
  document.getElementById("edit-row-index").value = tx.rowIndex;
  document.getElementById("edit-amount").value    = tx.amt;
  const dateEl = document.getElementById("edit-date");
  dateEl.value = tx.date || "";
  dateEl.max   = _todayISO();
  document.getElementById("edit-wallet").value    = tx.wallet || "BANK";
  // AI_PENDING non è selezionabile: si propone ALTRO e l'utente sceglie
  document.getElementById("edit-cat").value       = tx.cat && tx.cat !== "AI_PENDING" ? tx.cat : "ALTRO";
  document.getElementById("edit-desc").value      = tx.desc || "";
  document.getElementById("edit-note").value      = tx.note || "";
  document.getElementById("edit-error").textContent = "";

  const modal = document.getElementById("edit-modal");
  modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("edit-amount").focus(), 80);
  refreshIcons();
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

async function _saveEdit() {
  const rowIndex = parseInt(document.getElementById("edit-row-index").value, 10);
  const amount   = parseFloat(String(document.getElementById("edit-amount").value).replace(",", "."));
  const errEl    = document.getElementById("edit-error");
  if (!rowIndex) return;
  if (isNaN(amount)) { errEl.textContent = "Importo non valido"; return; }

  const btn = document.getElementById("edit-save-btn");
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = "…";

  try {
    const res = await apiPost("finance_update_transaction", {
      rowIndex,
      amount,
      date:   document.getElementById("edit-date").value,
      wallet: document.getElementById("edit-wallet").value,
      cat:    document.getElementById("edit-cat").value,
      desc:   document.getElementById("edit-desc").value.trim(),
      note:   document.getElementById("edit-note").value.trim(),
    });
    if (!res || res.status !== "SUCCESS") throw new Error((res && res.message) || "Salvataggio non riuscito");
    closeEditModal();
    await loadData();
  } catch (err) {
    console.error("Edit save error:", err);
    errEl.textContent = err.message || "Errore di connessione";
  }

  btn.textContent = orig;
  btn.disabled = false;
}

// Tap su una riga transazione (home, registro, rifornimenti) → modifica.
// Su desktop compare anche la matita in hover.
document.addEventListener("click", e => {
  const row = e.target.closest("[data-row-index]");
  if (!row) return;
  const tx = _txByRow.get(parseInt(row.dataset.rowIndex, 10));
  if (tx) openEditModal(tx);
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("edit-modal-close").addEventListener("click", closeEditModal);
  document.getElementById("edit-cancel-btn").addEventListener("click", closeEditModal);
  document.getElementById("edit-save-btn").addEventListener("click", _saveEdit);

  document.getElementById("edit-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("edit-modal")) closeEditModal();
  });
});
