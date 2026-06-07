/* ============================================
   CASSA — Entry modal
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

// ---- Submit: single ----
async function submitSingle() {
  const rawAmount = parseFloat(document.getElementById("fin-amount").value);
  const desc      = document.getElementById("fin-desc").value.trim();
  const note      = document.getElementById("fin-note").value.trim();
  if (!rawAmount || !desc) return;

  const amount = _entrySign * Math.abs(rawAmount);
  const sign   = amount >= 0 ? "+" : "";
  const text   = `${sign}${amount} ${desc}${note ? ", " + note : ""}`;

  const btn = document.getElementById("submit-single");
  btn.textContent = "Salvataggio...";
  btn.disabled    = true;

  try {
    await apiPost("finance_smart_entry", { text, wallet: _activeWallet });
    btn.textContent = "✓ Salvato";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "Salva";
      btn.disabled    = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "Errore — riprova";
    btn.disabled    = false;
  }
}

// ---- Submit: multi ----
async function submitMulti() {
  const rows    = document.querySelectorAll(".multi-row");
  const entries = [];
  rows.forEach(row => {
    const signBtn = row.querySelector(".multi-row-sign");
    const sign    = parseInt(signBtn.dataset.sign);
    const amt     = parseFloat(row.querySelector(".multi-row-amount").value);
    const desc    = row.querySelector(".multi-row-desc").value.trim();
    const wallet  = row.querySelector(".multi-row-wallet").value;
    if (amt && desc) entries.push({ amount: sign * Math.abs(amt), desc, wallet });
  });
  if (entries.length === 0) return;

  const btn = document.getElementById("submit-multi");
  btn.textContent = "Salvataggio...";
  btn.disabled    = true;

  try {
    for (const e of entries) {
      const s = e.amount >= 0 ? "+" : "";
      await apiPost("finance_smart_entry", { text: `${s}${e.amount} ${e.desc}`, wallet: e.wallet });
    }
    btn.textContent = "✓ Salvato";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "Salva tutto";
      btn.disabled    = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "Errore — riprova";
    btn.disabled    = false;
  }
}

// ---- Submit: transfer ----
async function submitTransfer() {
  const amount = parseFloat(document.getElementById("fin-transfer-amount").value);
  const from   = document.getElementById("fin-transfer-from").value;
  const to     = document.getElementById("fin-transfer-to").value;
  if (!amount || from === to) return;

  const btn = document.getElementById("submit-transfer");
  btn.textContent = "Esecuzione...";
  btn.disabled    = true;

  try {
    await apiPost("finance_transfer", { amount, from, to });
    btn.textContent = "✓ Eseguito";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "Esegui trasferimento";
      btn.disabled    = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "Errore — riprova";
    btn.disabled    = false;
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
    <input type="text" class="field-input multi-row-desc" placeholder="causale" autocomplete="off" />
    <select class="field-select multi-row-wallet">
      <option>BANK</option><option>TINABA</option><option>PAYPAL</option><option>CASH</option>
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
