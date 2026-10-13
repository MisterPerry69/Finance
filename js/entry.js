/* ============================================
   TIDE — Entry modal
   ============================================ */

let _activeWallet = "BANK";
let _entrySign    = -1;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("modal-close-btn").addEventListener("click", closeEntryModal);
  document.getElementById("entry-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("entry-modal")) closeEntryModal();
  });

  document.querySelectorAll(".wallet-btn[data-wallet]").forEach(btn => {
    btn.addEventListener("click", () => _setWallet(btn.dataset.wallet));
  });

  document.querySelectorAll(".entry-type-tab[data-tab]").forEach(tab => {
    tab.addEventListener("click", () => _switchEntryTab(tab.dataset.tab));
  });

  // Sign buttons — toggle selected state
  document.getElementById("fin-sign-btn").addEventListener("click", () => _setSign(-1));
  document.getElementById("fin-sign-btn-plus").addEventListener("click", () => _setSign(1));

  document.getElementById("submit-single").addEventListener("click", submitSingle);
  document.getElementById("submit-multi").addEventListener("click", submitMulti);
  document.getElementById("submit-transfer").addEventListener("click", submitTransfer);
  document.getElementById("add-row-btn").addEventListener("click", addMultiRow);
});

function openEntryModal() {
  _entrySign = -1;
  _updateSignButtons();
  document.getElementById("fin-multi-rows").innerHTML = "";
  addMultiRow();
  _switchEntryTab("single");
  _setWallet("BANK");
  document.getElementById("fin-amount").value = "";
  document.getElementById("fin-desc").value   = "";
  document.getElementById("fin-note").value   = "";
  document.getElementById("fin-transfer-amount").value = "";
  document.getElementById("entry-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("fin-amount").focus(), 120);
}

function closeEntryModal() {
  document.getElementById("entry-modal").classList.add("hidden");
}

function _setWallet(wallet) {
  _activeWallet = wallet;
  document.querySelectorAll(".wallet-btn[data-wallet]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wallet === wallet);
  });
}

function _switchEntryTab(tab) {
  document.querySelectorAll(".entry-type-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("form-single").classList.toggle("hidden",   tab !== "single");
  document.getElementById("form-multi").classList.toggle("hidden",    tab !== "multi");
  document.getElementById("form-transfer").classList.toggle("hidden", tab !== "transfer");
}

function _setSign(sign) {
  _entrySign = sign;
  _updateSignButtons();
}

function _updateSignButtons() {
  document.getElementById("fin-sign-btn").classList.toggle("selected",      _entrySign === -1);
  document.getElementById("fin-sign-btn-plus").classList.toggle("selected", _entrySign === 1);
}

// Errore esplicito se il backend risponde ERROR (prima veniva mostrato "Salvato" comunque)
async function _post(action, payload) {
  const res = await apiPost(action, payload);
  if (!res || (res.status !== "SUCCESS" && res.status !== "AI_PENDING")) {
    throw new Error((res && res.message) || "Salvataggio non riuscito");
  }
  return res;
}

function _splitDescNote(text) {
  const i = text.indexOf(",");
  return i === -1 ? [text.trim(), ""] : [text.slice(0, i).trim(), text.slice(i + 1).trim()];
}

async function _afterSave(btn, label, pending) {
  btn.textContent = "✓ Salvato";
  if (pending) showAnalyst("Salvato. L'AI non ha potuto assegnare la categoria: correggila dal registro.", 4000);
  try { await loadData(); } catch (e) { showAnalyst("Salvato, ma non riesco ad aggiornare i dati."); }
  setTimeout(() => {
    closeEntryModal();
    btn.textContent = label;
    btn.disabled    = false;
  }, 400);
}

function _fail(btn, err) {
  console.error(err);
  btn.textContent = "Errore — riprova";
  btn.disabled    = false;
  showAnalyst(escapeHtml(err.message || "Errore di connessione"), 4000);
}

// ---- Submit: single ----
async function submitSingle() {
  const rawAmount = parseFloat(String(document.getElementById("fin-amount").value).replace(",", "."));
  const desc      = document.getElementById("fin-desc").value.trim();
  const note      = document.getElementById("fin-note").value.trim();
  if (!rawAmount || !desc) return;

  const btn = document.getElementById("submit-single");
  btn.textContent = "Salvataggio...";
  btn.disabled    = true;

  try {
    const res = await _post("finance_smart_entry", {
      amount: _entrySign * Math.abs(rawAmount), desc, note, wallet: _activeWallet,
    });
    await _afterSave(btn, "Salva", res.status === "AI_PENDING");
  } catch (e) {
    _fail(btn, e);
  }
}

// ---- Submit: multi ----
async function submitMulti() {
  const rows    = document.querySelectorAll(".multi-row");
  const entries = [];
  rows.forEach(row => {
    const sign   = parseInt(row.querySelector(".multi-row-sign").dataset.sign, 10);
    const amt    = parseFloat(String(row.querySelector(".multi-row-amount").value).replace(",", "."));
    const [desc, note] = _splitDescNote(row.querySelector(".multi-row-desc").value);
    const wallet = row.querySelector(".multi-row-wallet").value;
    if (amt && desc) entries.push({ row, amount: sign * Math.abs(amt), desc, note, wallet });
  });
  if (entries.length === 0) return;

  const btn = document.getElementById("submit-multi");
  btn.disabled = true;

  let pending = false;
  try {
    for (let i = 0; i < entries.length; i++) {
      btn.textContent = `Salvataggio ${i + 1}/${entries.length}...`;
      const { row, ...payload } = entries[i];
      const res = await _post("finance_smart_entry", payload);
      if (res.status === "AI_PENDING") pending = true;
      row.remove(); // se una riga successiva fallisce, quelle già salvate non vengono ripetute
    }
    await _afterSave(btn, "Salva tutto", pending);
  } catch (e) {
    _fail(btn, e);
    if (!document.querySelector(".multi-row")) addMultiRow();
  }
}

// ---- Submit: transfer ----
async function submitTransfer() {
  const amount = parseFloat(String(document.getElementById("fin-transfer-amount").value).replace(",", "."));
  const from   = document.getElementById("fin-transfer-from").value;
  const to     = document.getElementById("fin-transfer-to").value;
  if (!amount || amount <= 0) return;
  if (from === to) { showAnalyst("Scegli due conti diversi.", 2500); return; }

  const btn = document.getElementById("submit-transfer");
  btn.textContent = "Esecuzione...";
  btn.disabled    = true;

  try {
    await _post("finance_transfer", { amount, from, to });
    await _afterSave(btn, "Esegui trasferimento", false);
  } catch (e) {
    _fail(btn, e);
  }
}

// ---- Multi row ----
function addMultiRow() {
  const container = document.getElementById("fin-multi-rows");
  const row       = document.createElement("div");
  row.className   = "multi-row";
  row.innerHTML = `
    <button class="multi-row-sign negative" data-sign="-1">−</button>
    <input type="number" class="field-input multi-row-amount" placeholder="0.00" min="0" step="0.01" inputmode="decimal" />
    <input type="text" class="field-input multi-row-desc" placeholder="causale, note..." autocomplete="off" />
    <select class="field-select multi-row-wallet">
      <option value="BANK">Bank</option>
      <option value="PAYPAL">PayPal</option>
      <option value="CASH">Cash</option>
      <option value="IFIS">Deposito</option>
    </select>
    <button class="multi-row-del" aria-label="Rimuovi">✕</button>
  `;
  row.querySelector(".multi-row-sign").addEventListener("click", e => {
    const b  = e.currentTarget;
    const s  = parseInt(b.dataset.sign) * -1;
    b.dataset.sign = s;
    if (s === -1) { b.textContent = "−"; b.classList.add("negative"); b.classList.remove("positive"); }
    else          { b.textContent = "+"; b.classList.remove("negative"); b.classList.add("positive"); }
  });
  row.querySelector(".multi-row-del").addEventListener("click", () => row.remove());
  container.appendChild(row);
}
