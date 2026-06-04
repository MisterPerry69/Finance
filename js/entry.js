/* ============================================
   FINANCE — Entry modal
   ============================================ */

let _activeWallet = "BANK";
let _entrySign    = -1; // -1 = spesa, +1 = entrata

document.addEventListener("DOMContentLoaded", () => {
  // Modal open/close
  document.getElementById("modal-close-btn").addEventListener("click", closeEntryModal);
  document.getElementById("entry-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("entry-modal")) closeEntryModal();
  });

  // Wallet buttons
  document.querySelectorAll(".wallet-btn[data-wallet]").forEach(btn => {
    btn.addEventListener("click", () => setWallet(btn.dataset.wallet));
  });

  // Entry type tabs
  document.querySelectorAll(".entry-tab[data-tab]").forEach(tab => {
    tab.addEventListener("click", () => switchEntryTab(tab.dataset.tab));
  });

  // Sign buttons (single form)
  document.getElementById("fin-sign-btn").addEventListener("click", () => setSign(-1));
  document.getElementById("fin-sign-btn-plus").addEventListener("click", () => setSign(1));

  // Submit buttons
  document.getElementById("submit-single").addEventListener("click", submitSingle);
  document.getElementById("submit-multi").addEventListener("click", submitMulti);
  document.getElementById("submit-transfer").addEventListener("click", submitTransfer);
  document.getElementById("add-row-btn").addEventListener("click", addMultiRow);
});

function openEntryModal() {
  _entrySign = -1;
  updateSignButtons();
  document.getElementById("fin-multi-rows").innerHTML = "";
  addMultiRow();
  switchEntryTab("single");
  setWallet("BANK");
  document.getElementById("entry-modal").classList.remove("hidden");
  // auto-focus amount field
  setTimeout(() => {
    const input = document.getElementById("fin-amount");
    if (input) input.focus();
  }, 100);
}

function closeEntryModal() {
  document.getElementById("entry-modal").classList.add("hidden");
  // reset form
  document.getElementById("fin-amount").value = "";
  document.getElementById("fin-desc").value   = "";
  document.getElementById("fin-note").value   = "";
}

function setWallet(wallet) {
  _activeWallet = wallet;
  document.querySelectorAll(".wallet-btn[data-wallet]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wallet === wallet);
  });
}

function switchEntryTab(tab) {
  document.querySelectorAll(".entry-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("form-single").classList.toggle("hidden",   tab !== "single");
  document.getElementById("form-multi").classList.toggle("hidden",    tab !== "multi");
  document.getElementById("form-transfer").classList.toggle("hidden", tab !== "transfer");
}

function setSign(sign) {
  _entrySign = sign;
  updateSignButtons();
}

function updateSignButtons() {
  const negBtn = document.getElementById("fin-sign-btn");
  const posBtn = document.getElementById("fin-sign-btn-plus");
  if (_entrySign === -1) {
    negBtn.classList.add("negative");
    negBtn.classList.remove("positive");
    posBtn.style.opacity = "0.5";
  } else {
    negBtn.classList.remove("negative");
    negBtn.classList.add("positive");
    posBtn.style.opacity = "1";
  }
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
  btn.textContent = "SALVATAGGIO...";
  btn.disabled = true;

  try {
    await apiPost("finance_smart_entry", { text, wallet: _activeWallet });
    btn.textContent = "✓ SALVATO";
    btn.style.background = "var(--color-positive)";
    btn.style.color = "#000";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "SALVA";
      btn.style.background = "";
      btn.style.color = "";
      btn.disabled = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "ERRORE — RIPROVA";
    btn.disabled = false;
  }
}

// ---- Submit: multi ----
async function submitMulti() {
  const rows   = document.querySelectorAll(".multi-row");
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
  btn.textContent = "SALVATAGGIO...";
  btn.disabled = true;

  try {
    for (const e of entries) {
      const sign = e.amount >= 0 ? "+" : "";
      await apiPost("finance_smart_entry", {
        text: `${sign}${e.amount} ${e.desc}`,
        wallet: e.wallet
      });
    }
    btn.textContent = "✓ SALVATO";
    btn.style.background = "var(--color-positive)";
    btn.style.color = "#000";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "SALVA TUTTO";
      btn.style.background = "";
      btn.style.color = "";
      btn.disabled = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "ERRORE — RIPROVA";
    btn.disabled = false;
  }
}

// ---- Submit: transfer ----
async function submitTransfer() {
  const amount = parseFloat(document.getElementById("fin-transfer-amount").value);
  const from   = document.getElementById("fin-transfer-from").value;
  const to     = document.getElementById("fin-transfer-to").value;
  if (!amount || from === to) return;

  const btn = document.getElementById("submit-transfer");
  btn.textContent = "ESECUZIONE...";
  btn.disabled = true;

  try {
    await apiPost("finance_transfer", { amount, from, to });
    btn.textContent = "✓ ESEGUITO";
    btn.style.background = "var(--color-positive)";
    btn.style.color = "#000";
    setTimeout(() => {
      closeEntryModal();
      btn.textContent = "ESEGUI TRASFERIMENTO";
      btn.style.background = "";
      btn.style.color = "";
      btn.disabled = false;
      loadData();
    }, 700);
  } catch(e) {
    btn.textContent = "ERRORE — RIPROVA";
    btn.disabled = false;
  }
}

// ---- Multi row ----
function addMultiRow() {
  const container = document.getElementById("fin-multi-rows");
  const row = document.createElement("div");
  row.className = "multi-row";
  row.innerHTML = `
    <button class="multi-row-sign negative" data-sign="-1">−</button>
    <input type="number" class="field-input multi-row-amount" placeholder="15.00" min="0" step="0.01" inputmode="decimal" />
    <input type="text" class="field-input multi-row-desc" placeholder="causale" autocomplete="off" />
    <select class="field-select multi-row-wallet">
      <option>BANK</option><option>TINABA</option><option>PAYPAL</option><option>CASH</option>
    </select>
    <button class="multi-row-del" aria-label="Rimuovi riga">✕</button>
  `;
  // Toggle sign
  row.querySelector(".multi-row-sign").addEventListener("click", e => {
    const btn = e.currentTarget;
    const sign = parseInt(btn.dataset.sign) * -1;
    btn.dataset.sign = sign;
    if (sign === -1) { btn.textContent = "−"; btn.classList.add("negative"); btn.classList.remove("positive"); }
    else             { btn.textContent = "+"; btn.classList.remove("negative"); btn.classList.add("positive"); }
  });
  // Delete row
  row.querySelector(".multi-row-del").addEventListener("click", () => row.remove());
  container.appendChild(row);
}
