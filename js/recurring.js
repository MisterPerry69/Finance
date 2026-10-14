/* ============================================
   TIDE — Uscite ricorrenti (card nella tab Budget + modal)
   Il backend le registra da solo alla scadenza: qui si gestisce l'elenco.
   ============================================ */

const EVERY_LABELS = { 1: "ogni mese", 2: "ogni 2 mesi", 3: "ogni 3 mesi", 6: "ogni 6 mesi", 12: "ogni anno" };

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("recurring-modal");
  document.getElementById("recurring-add-btn").addEventListener("click", () => openRecurringModal(null));
  document.getElementById("recurring-modal-close").addEventListener("click", closeRecurringModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeRecurringModal(); });
  document.getElementById("rec-save").addEventListener("click", _saveRecurring);
  document.getElementById("rec-delete").addEventListener("click", _deleteRecurring);
  ["rec-day", "rec-every"].forEach(id =>
    document.getElementById(id).addEventListener("input", _updateRecurringHint));

  document.getElementById("recurring-list").addEventListener("click", e => {
    const row = e.target.closest("[data-rec-id]");
    if (!row) return;
    const it = _recurring.find(r => r.id === row.dataset.recId);
    if (it) openRecurringModal(it);
  });
});

function renderRecurring() {
  const list  = document.getElementById("recurring-list");
  const total = document.getElementById("recurring-total");
  const items = [..._recurring].sort((a, b) => (a.next || "").localeCompare(b.next || ""));

  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Nessuna uscita ricorrente. Aggiungi abbonamenti, bollette e addebiti automatici: verranno registrati da soli.</div>';
    total.innerHTML = "";
    return;
  }
  list.innerHTML = items.map(it => `
    <button class="recurring-row" data-rec-id="${escapeAttr(it.id)}">
      <div class="budget-cat-icon"><i data-lucide="${catIcon(it.cat)}"></i></div>
      <div class="recurring-body">
        <div class="recurring-desc">${escapeHtml(it.desc)}${it.note ? ` <span class="recurring-note">${escapeHtml(it.note)}</span>` : ""}</div>
        <div class="recurring-sub">${EVERY_LABELS[it.every] || "ogni mese"} il ${it.day} · ${escapeHtml(walletLabel(it.wallet))} · prossimo ${formatDate(it.next, true)}</div>
      </div>
      <span class="recurring-amt">${fmtEur(it.amount)}</span>
    </button>`).join("");

  const monthly = items.reduce((a, it) => a + it.amount / (it.every || 1), 0);
  total.innerHTML = `<p>Totale: circa <b>${fmtEur(monthly)}</b> al mese, registrati in automatico alla scadenza.</p>`;
}

function openRecurringModal(it) {
  document.getElementById("recurring-modal-title").textContent = it ? "Modifica ricorrente" : "Nuova ricorrente";
  document.getElementById("rec-id").value     = it ? it.id : "";
  document.getElementById("rec-desc").value   = it ? it.desc : "";
  document.getElementById("rec-amount").value = it ? it.amount : "";
  document.getElementById("rec-day").value    = it ? it.day : new Date().getDate();
  document.getElementById("rec-every").value  = it ? String(it.every) : "1";
  document.getElementById("rec-wallet").value = it ? it.wallet : "BANK";
  document.getElementById("rec-cat").value    = it ? it.cat : "ALTRO";
  document.getElementById("rec-note").value   = it ? it.note : "";
  document.getElementById("rec-error").textContent = "";
  document.getElementById("rec-delete").classList.toggle("hidden", !it);
  _updateRecurringHint();
  document.getElementById("recurring-modal").classList.remove("hidden");
  refreshIcons();
}

function closeRecurringModal() {
  document.getElementById("recurring-modal").classList.add("hidden");
}

function _updateRecurringHint() {
  const id   = document.getElementById("rec-id").value;
  const it   = _recurring.find(r => r.id === id);
  const day  = parseInt(document.getElementById("rec-day").value, 10);
  const hint = document.getElementById("rec-hint");
  if (!(day >= 1 && day <= 31)) { hint.textContent = ""; return; }
  hint.textContent = it && it.day === day
    ? `Prossimo addebito registrato il ${formatDate(it.next, true)}. Cambiare l'importo vale solo per i prossimi.`
    : "Verrà registrata da sola a partire dalla prossima scadenza, senza toccare i mesi passati.";
}

async function _saveRecurring() {
  const err = document.getElementById("rec-error");
  const payload = {
    id:     document.getElementById("rec-id").value || undefined,
    desc:   document.getElementById("rec-desc").value.trim(),
    amount: parseFloat(String(document.getElementById("rec-amount").value).replace(",", ".")),
    day:    parseInt(document.getElementById("rec-day").value, 10),
    every:  parseInt(document.getElementById("rec-every").value, 10),
    wallet: document.getElementById("rec-wallet").value,
    cat:    document.getElementById("rec-cat").value,
    note:   document.getElementById("rec-note").value.trim(),
  };
  if (!payload.desc || !(payload.amount > 0) || !(payload.day >= 1 && payload.day <= 31)) {
    err.textContent = "Servono descrizione, importo e giorno (1–31)";
    return;
  }
  const btn = document.getElementById("rec-save");
  btn.disabled = true;
  btn.textContent = "Salvataggio...";
  try {
    const res = await apiPost("finance_save_recurring", payload);
    if (!res || res.status !== "SUCCESS") throw new Error((res && res.message) || "Salvataggio non riuscito");
    closeRecurringModal();
    await loadData();
  } catch (e) {
    err.textContent = e.message || "Errore di connessione";
  }
  btn.disabled = false;
  btn.textContent = "Salva";
}

async function _deleteRecurring() {
  const id = document.getElementById("rec-id").value;
  if (!id || !confirm("Eliminare questa uscita ricorrente? Le registrazioni passate restano.")) return;
  const btn = document.getElementById("rec-delete");
  btn.disabled = true;
  try {
    const res = await apiPost("finance_delete_recurring", { id });
    if (!res || res.status !== "SUCCESS") throw new Error((res && res.message) || "Eliminazione non riuscita");
    closeRecurringModal();
    await loadData();
  } catch (e) {
    document.getElementById("rec-error").textContent = e.message || "Errore di connessione";
  }
  btn.disabled = false;
}
