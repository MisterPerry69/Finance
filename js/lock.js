/* ============================================
   TIDE — Sblocco con impronta (WebAuthn, solo su questo dispositivo)
   È un blocco dell'interfaccia: l'impronta non lascia mai il telefono,
   l'app riceve solo "verificato sì/no". Configurazione in localStorage.
   ============================================ */

const LOCK_KEY      = "tide.lock.v1";
const LOCK_AFTER_MS = 5 * 60 * 1000;   // richiede l'impronta dopo 5 minuti in background

let _hiddenAt  = 0;
let _unlocking = false;

function _lockCfg() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); } catch (e) { return null; }
}
function _saveLockCfg(cfg) {
  try {
    if (cfg) localStorage.setItem(LOCK_KEY, JSON.stringify(cfg));
    else     localStorage.removeItem(LOCK_KEY);
  } catch (e) {}
}
function isLockEnabled() { return !!(_lockCfg() && _lockCfg().credId); }

const _b64u = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0)),
};
const _rand = n => crypto.getRandomValues(new Uint8Array(n));

async function biometricAvailable() {
  try {
    return !!(window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) {
    return false;
  }
}

// Crea una chiave legata a questo dispositivo, confermata con impronta/volto
async function _registerBiometric() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: _rand(32),
      rp: { name: "Tide" },
      user: { id: _rand(16), name: "tide", displayName: "Tide" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000,
    },
  });
  if (!cred) throw new Error("Registrazione annullata");
  _saveLockCfg({ credId: _b64u.enc(cred.rawId) });
}

// true solo se il telefono ha davvero verificato l'utente (flag UP + UV)
async function _verifyBiometric() {
  const cfg = _lockCfg();
  if (!cfg) return true;
  const a = await navigator.credentials.get({
    publicKey: {
      challenge: _rand(32),
      allowCredentials: [{ type: "public-key", id: _b64u.dec(cfg.credId), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!a) return false;
  const flags = new Uint8Array(a.response.authenticatorData)[32];
  return (flags & 0x05) === 0x05;
}

// ---- Schermata di blocco ----
function _showLock() {
  document.getElementById("lock-error").textContent = "";
  document.getElementById("lock-screen").classList.remove("hidden");
  document.body.classList.add("locked");
  refreshIcons();
}
function _hideLock() {
  document.getElementById("lock-screen").classList.add("hidden");
  document.body.classList.remove("locked");
}

async function unlockApp() {
  if (_unlocking) return;
  _unlocking = true;
  const err = document.getElementById("lock-error");
  err.textContent = "";
  try {
    if (await _verifyBiometric()) _hideLock();
    else err.textContent = "Non riconosciuto, riprova";
  } catch (e) {
    // NotAllowedError: annullato o serve un tocco (Safari) → resta il pulsante
    err.textContent = e && e.name === "NotAllowedError" ? "Tocca per sbloccare" : "Impronta non disponibile, riprova";
  } finally {
    _unlocking = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("lock-unlock-btn").addEventListener("click", unlockApp);

  if (isLockEnabled()) {
    _showLock();
    setTimeout(unlockApp, 400);   // prova da sola; su iPhone potrebbe servire il tocco
  }

  // In background: copre i saldi (anche nell'anteprima delle app recenti);
  // al ritorno chiede l'impronta solo se sono passati più di 5 minuti
  document.addEventListener("visibilitychange", () => {
    if (!isLockEnabled()) return;
    if (document.hidden) {
      if (document.getElementById("lock-screen").classList.contains("hidden")) {
        _hiddenAt = Date.now();
        _showLock();
      }
      return;
    }
    if (_hiddenAt && Date.now() - _hiddenAt < LOCK_AFTER_MS) {
      _hiddenAt = 0;
      _hideLock();
    } else {
      _hiddenAt = 0;
      setTimeout(unlockApp, 300);
    }
  });

  document.getElementById("lock-toggle").addEventListener("click", _toggleLock);
});

// ---- Impostazioni → Sicurezza ----
async function renderSecurity() {
  const toggle = document.getElementById("lock-toggle");
  const status = document.getElementById("lock-status");
  const on = isLockEnabled();
  toggle.setAttribute("aria-checked", String(on));
  toggle.classList.toggle("on", on);
  if (on) { status.textContent = "Attivo su questo dispositivo"; toggle.disabled = false; return; }
  const ok = await biometricAvailable();
  toggle.disabled = !ok;
  status.textContent = ok ? "Disattivato" : "Questo dispositivo o browser non supporta lo sblocco biometrico";
}

async function _toggleLock() {
  const err = document.getElementById("lock-setting-error");
  err.textContent = "";
  try {
    if (isLockEnabled()) {
      // Per disattivarlo serve l'impronta
      if (!(await _verifyBiometric())) { err.textContent = "Non riconosciuto"; return; }
      _saveLockCfg(null);
    } else {
      await _registerBiometric();
    }
  } catch (e) {
    err.textContent = e && e.name === "NotAllowedError" ? "Operazione annullata" : "Errore: " + (e && e.message || e);
  }
  renderSecurity();
}
