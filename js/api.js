/* ============================================
   FINANCE — API layer
   ============================================ */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxcua77YxGBLgbbRxUybLGL1zjhTlVl9KmfwfOcYxV5bCrl8fGqRezrjYpJOvp7nbq-gw/exec";

// GAS risponde con un redirect a googleusercontent: parsare sempre come testo poi JSON.parse
async function _parse(res) {
  const txt = await res.text();
  if (txt.trim().startsWith("<")) {
    throw new Error("Il backend ha risposto con HTML invece di JSON. Verifica che il deploy GAS sia 'Chiunque' con accesso.");
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error("Risposta non JSON: " + txt.slice(0, 120));
  }
}

async function apiGet(action, params) {
  // GAS redirige le GET cross-origin bloccando il CORS — usiamo POST anche per le letture
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action }, params || {})),
  });
  return _parse(res);
}

async function apiPost(action, payload) {
  // text/plain evita il preflight CORS con GAS
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action }, payload || {})),
  });
  return _parse(res);
}

async function apiPostText(action, payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action }, payload || {})),
  });
  return res.text();
}
