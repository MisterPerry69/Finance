/* ============================================
   FINANCE — API wrapper
   ============================================ */

const GAS_URL = "YOUR_GAS_URL_HERE"; // sostituire con URL del deploy GAS

async function apiGet(action, params) {
  const url = new URL(GAS_URL);
  url.searchParams.set("action", action);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(action, payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  return res.json();
}

async function apiPostText(action, payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  return res.text();
}
