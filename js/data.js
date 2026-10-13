/* ============================================
   TIDE — Data layer
   Una sola chiamata scarica tutte le transazioni; saldi, statistiche
   e budget sono calcolati qui, una volta, e usati da tutte le schermate.
   ============================================ */

let _tx       = [];          // [{rowIndex, date, ym, year, amt, wallet, cat, desc, note}]
let _txByRow  = new Map();
let _monthMemo = new Map();

const MONTH_NAMES = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
];
const MONTH_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

// Né spese né entrate: spostano soldi o correggono un saldo
const NEUTRAL_CATS   = new Set(["SET_BALANCE", "TRASFERIMENTO", "RIMBORSO"]);
// Spese difficili da comprimere: nel budget non vengono tagliate
const ESSENTIAL_CATS = new Set(["CASA", "SPESA", "SALUTE", "TRASPORTI"]);

// ---- Caricamento ----
async function fetchAllTransactions() {
  const res = await apiPost("finance_get_all");
  if (!res || res.status !== "OK" || !Array.isArray(res.rows)) {
    throw new Error((res && res.message) || "Risposta del backend non valida");
  }
  _tx = res.rows.map(r => {
    const date = r[1] || "";
    return {
      rowIndex: r[0],
      date,
      ym:   date.slice(0, 7),
      year: date ? parseInt(date.slice(0, 4), 10) : null,
      amt:  parseFloat(r[2]) || 0,
      wallet: r[3] || "",
      cat:  r[4] || "",
      desc: r[5] || "",
      note: r[6] || "",
    };
  });
  _txByRow  = new Map(_tx.map(t => [t.rowIndex, t]));
  _monthMemo = new Map();
}

// ---- Date helpers (tutte su stringhe "yyyy-MM", niente fusi orari) ----
function ymOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYM() { return ymOf(new Date()); }
function addMonths(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  return ymOf(new Date(y, m - 1 + delta, 1));
}
function ymLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function firstDataYM() {
  let min = "";
  for (const t of _tx) if (t.ym && (!min || t.ym < min)) min = t.ym;
  return min;
}
function formatDate(iso, withYear) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

// ---- Classificazione ----
function txKind(t) {
  if (NEUTRAL_CATS.has(t.cat)) return "neutral";
  if (t.amt < 0) return "expense";
  if (t.amt > 0) return "income";
  return "neutral";
}

const GAS_LITERS_RE = /(\d+(?:[.,]\d+)?)\s*(?:l|lt|litri)\b/i;

function _statsOf(list) {
  const s = { spent: 0, income: 0, cats: {}, count: list.length, gasSpent: 0, gasLiters: 0, gasFills: [] };
  for (const t of list) {
    const kind = txKind(t);
    if (kind === "income") s.income += t.amt;
    else if (kind === "expense") {
      const v = -t.amt;
      s.spent += v;
      s.cats[t.cat || "ALTRO"] = (s.cats[t.cat || "ALTRO"] || 0) + v;
      if (t.cat === "TRASPORTI") {
        const m = (t.note + " " + t.desc).match(GAS_LITERS_RE);
        if (m) {
          const liters = parseFloat(m[1].replace(",", "."));
          s.gasSpent += v;
          s.gasLiters += liters;
          s.gasFills.push({ date: t.date, liters, amt: v });
        }
      }
    }
  }
  s.net = s.income - s.spent;
  return s;
}

function monthStats(ym) {
  if (!_monthMemo.has(ym)) _monthMemo.set(ym, _statsOf(_tx.filter(t => t.ym === ym)));
  return _monthMemo.get(ym);
}
function yearStats(year) {
  return _statsOf(_tx.filter(t => t.year === year));
}

function balances() {
  const b = { BANK: 0, CASH: 0, IFIS: 0, PAYPAL: 0 };
  for (const t of _tx) if (t.wallet in b) b[t.wallet] += t.amt;
  b.total = b.BANK + b.CASH + b.IFIS + b.PAYPAL;
  return b;
}

// Ultimi n mesi COMPLETI (escluso quello in corso) da quando ci sono dati
function historyMonths(n) {
  const first = firstDataYM();
  const out = [];
  if (!first) return out;
  let ym = addMonths(currentYM(), -1);
  while (out.length < n && ym >= first) { out.push(ym); ym = addMonths(ym, -1); }
  return out;
}

function avgMonthlySpend(n) {
  const hist = historyMonths(n);
  if (hist.length > 0) return hist.reduce((a, ym) => a + monthStats(ym).spent, 0) / hist.length;
  // Nessun mese completo: proietta il mese in corso
  const ym = currentYM();
  const day = new Date().getDate();
  return monthStats(ym).spent / day * daysInMonth(ym);
}

function _spentUntilDay(ym, day) {
  let s = 0;
  for (const t of _tx) {
    if (t.ym !== ym || txKind(t) !== "expense") continue;
    if (parseInt(t.date.slice(8, 10), 10) <= day) s += -t.amt;
  }
  return s;
}

// Quota della spesa mensile che di solito è già uscita entro il giorno `day`
// (affitto e bollette a inizio mese pesano subito). Fallback: lineare.
function typicalMonthShare(day) {
  const hist = historyMonths(3);
  const shares = hist.map(ym => {
    const tot = monthStats(ym).spent;
    return tot > 0 ? _spentUntilDay(ym, day) / tot : null;
  }).filter(v => v !== null);
  if (!shares.length) return day / daysInMonth(currentYM());
  return shares.reduce((a, b) => a + b, 0) / shares.length;
}

// Proiezione di fine mese: speso finora + quanto si spende di solito
// nei giorni rimanenti (media degli ultimi 3 mesi completi).
function projectCurrentMonth() {
  const ym   = currentYM();
  const day  = new Date().getDate();
  const spent = monthStats(ym).spent;
  const hist = historyMonths(3);
  if (!hist.length) return spent / day * daysInMonth(ym);
  const rest = hist.reduce((a, h) => a + (monthStats(h).spent - _spentUntilDay(h, day)), 0) / hist.length;
  return spent + Math.max(0, rest);
}

// Mesi di autonomia: patrimonio / spesa media degli ultimi 3 mesi completi
function autonomy() {
  const avg = avgMonthlySpend(3);
  const total = balances().total;
  return { avg, months: avg > 0 ? Math.max(0, total) / avg : Infinity };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function round5(n) { return Math.round(n / 5) * 5; }

// ---- Impostazioni budget (per dispositivo) ----
const BUDGET_SETTINGS_KEY = "tide.budget.v1";
const BUDGET_DEFAULTS = { savingsPct: 20, income: 0 };

function budgetSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDGET_SETTINGS_KEY) || "{}");
    return Object.assign({}, BUDGET_DEFAULTS, raw);
  } catch (e) {
    return Object.assign({}, BUDGET_DEFAULTS);
  }
}
function saveBudgetSettings(patch) {
  const next = Object.assign(budgetSettings(), patch);
  try { localStorage.setItem(BUDGET_SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}

/* ---- Budget: solo matematica ----
   1. Entrate tipiche = mediana delle entrate degli ultimi 6 mesi completi
      (oppure il valore impostato a mano). La mediana ignora bonus una tantum.
   2. Spendibile = entrate − obiettivo di risparmio (%).
   3. Target per categoria = media mensile degli ultimi 6 mesi.
      Le essenziali (casa, spesa, salute, trasporti) restano intere;
      se non ci si sta, le variabili vengono ridotte in proporzione.
   4. Quello che avanza è margine libero. */
const BUDGET_HISTORY = 6;

function computeBudget() {
  const s = budgetSettings();
  const hist = historyMonths(BUDGET_HISTORY);
  const histStats = hist.map(monthStats);

  const autoIncome = median(histStats.map(m => m.income));
  const manual = parseFloat(s.income) > 0;
  const income = manual ? parseFloat(s.income) : autoIncome;
  const savingsPct = Math.min(90, Math.max(0, parseFloat(s.savingsPct) || 0));
  const savings = income * savingsPct / 100;
  const spendable = Math.max(0, income - savings);

  const catAvg = {};
  histStats.forEach(m => Object.entries(m.cats).forEach(([c, v]) => {
    if (c === "AI_PENDING") return;
    catAvg[c] = (catAvg[c] || 0) + v;
  }));
  Object.keys(catAvg).forEach(c => { catAvg[c] /= hist.length; });

  let essTotal = 0, flexTotal = 0;
  Object.entries(catAvg).forEach(([c, v]) => {
    if (ESSENTIAL_CATS.has(c)) essTotal += v; else flexTotal += v;
  });
  const room   = spendable - essTotal;
  const factor = flexTotal > 0 ? Math.min(1, Math.max(0, room / flexTotal)) : 1;

  const targets = {};
  Object.entries(catAvg).forEach(([c, v]) => {
    const t = round5(ESSENTIAL_CATS.has(c) ? v : v * factor);
    if (t > 0) targets[c] = t;
  });
  const allocated = Object.values(targets).reduce((a, b) => a + b, 0);

  return {
    hasHistory: hist.length > 0,
    histMonths: hist.length,
    income, autoIncome, manual,
    savingsPct, savings, spendable,
    typical: essTotal + flexTotal,
    essentials: essTotal,
    factor,
    essentialsOver: room < 0,
    targets, catAvg, allocated,
    margin: spendable - allocated,
  };
}

// ---- Formattazione ----
// useGrouping "always": in it-IT altrimenti 1234 non avrebbe il punto delle migliaia
const _eur0 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: "always" });
const _eur2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });

function fmtEur(n, decimals) {
  const v = Number(n) || 0;
  return (decimals === 0 ? _eur0 : _eur2).format(v) + " €"; // spazio non separabile
}
function fmtSigned(n, decimals) {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtEur(Math.abs(n), decimals);
}
function fmtPct(n) {
  return Math.round(n) + "%";
}
