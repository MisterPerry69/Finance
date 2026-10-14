/* ============================================
   TIDE — Pagina Carburante (Mese / Anno)
   Si apre dall'icona ⛽ del Logbook, sullo stesso periodo.
   ============================================ */

let _fuelMode = "month";   // "month" | "year"
let _fuelYM   = "";

const _dec = (n, d) => n.toFixed(d).replace(".", ",");

document.addEventListener("DOMContentLoaded", () => {
  _fuelYM = currentYM();
  document.getElementById("fuel-close-btn").addEventListener("click", closeFuelPage);
  document.getElementById("fuel-add-btn").addEventListener("click", () => openEntryModal("fuel"));
  document.getElementById("fuel-mode-month").addEventListener("click", () => { _fuelMode = "month"; renderFuel(); });
  document.getElementById("fuel-mode-year").addEventListener("click",  () => { _fuelMode = "year";  renderFuel(); });
  document.getElementById("fuel-prev").addEventListener("click", () => _stepFuel(-1));
  document.getElementById("fuel-next").addEventListener("click", () => _stepFuel(+1));
  // Tap su un mese del grafico → vista di quel mese
  document.getElementById("fuel-chart").addEventListener("click", e => {
    const col = e.target.closest("[data-ym]");
    if (!col || col.disabled) return;
    _fuelMode = "month";
    _fuelYM   = col.dataset.ym;
    renderFuel();
  });
});

function openFuelPage(mode, ym) {
  _fuelMode = mode === "year" ? "year" : "month";
  _fuelYM   = ym || currentYM();
  document.getElementById("fuel-page").classList.remove("hidden");
  renderFuel();
}

function closeFuelPage() {
  document.getElementById("fuel-page").classList.add("hidden");
}

function isFuelOpen() {
  return !document.getElementById("fuel-page").classList.contains("hidden");
}

function _stepFuel(delta) {
  if (_fuelMode === "month") {
    const next = addMonths(_fuelYM, delta);
    if (next > currentYM()) return;
    _fuelYM = next;
  } else {
    const y = parseInt(_fuelYM.slice(0, 4), 10) + delta;
    if (y > new Date().getFullYear()) return;
    const ym = `${y}-${_fuelYM.slice(5, 7)}`;
    _fuelYM = ym > currentYM() ? currentYM() : ym;
  }
  renderFuel();
}

function _fuelOf(filter) {
  return fuelStats(_tx.filter(filter));
}

function renderFuel() {
  if (!_dataReady || !isFuelOpen()) return;
  const isMonth = _fuelMode === "month";
  const year    = parseInt(_fuelYM.slice(0, 4), 10);
  const curYM   = currentYM();
  const first   = firstDataYM();

  // Navigazione
  document.getElementById("fuel-mode-month").classList.toggle("active", isMonth);
  document.getElementById("fuel-mode-year").classList.toggle("active", !isMonth);
  document.getElementById("fuel-label").textContent = isMonth ? ymLabel(_fuelYM) : String(year);
  document.getElementById("fuel-prev").disabled = !first || (isMonth ? _fuelYM <= first : year <= parseInt(first.slice(0, 4), 10));
  document.getElementById("fuel-next").disabled = isMonth ? _fuelYM >= curYM : year >= new Date().getFullYear();

  const inPeriod = isMonth ? (t => t.ym === _fuelYM) : (t => t.year === year);
  const f        = _fuelOf(inPeriod);
  const allSpent = _statsOf(_tx.filter(inPeriod)).spent;

  // Riquadri
  document.getElementById("fuel-ppl").textContent    = f.ppl ? _dec(f.ppl, 3) : "—";
  document.getElementById("fuel-liters").textContent = f.liters > 0 ? _dec(f.liters, 1) : "—";
  document.getElementById("fuel-liters-sub").textContent =
    `litri · ${f.count} rifornimen${f.count === 1 ? "to" : "ti"}`;
  document.getElementById("fuel-spent").textContent  = f.spent > 0 ? fmtEur(f.spent, 0) : "—";
  document.getElementById("fuel-spent-sub").textContent = allSpent > 0 && f.spent > 0
    ? `speso · ${fmtPct(f.spent / allSpent * 100)} delle spese` : "speso";

  // Grafico: spesa carburante per mese, da gennaio a dicembre
  const items = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    const mf = _fuelOf(t => t.ym === ym);
    items.push({ ym, label: MONTH_SHORT[m - 1], value: mf.spent, hasData: mf.count > 0, full: ymLabel(ym) });
  }
  renderBarChart(document.getElementById("fuel-chart"), document.getElementById("fuel-caption"),
                 items, isMonth ? _fuelYM : (ym => ym === curYM));

  _renderFuelList(f);
  _renderFuelInsight(f, allSpent, isMonth, year);
  refreshIcons();
}

function _renderFuelList(f) {
  const list = document.getElementById("fuel-list");
  if (!f.fills.length) {
    list.innerHTML = '<div class="gas-empty">Nessun rifornimento nel periodo</div>';
    return;
  }
  const withYear = _fuelMode === "year";
  list.innerHTML = [...f.fills].reverse().map(x => `
    <div class="gas-fill" data-row-index="${x.rowIndex}">
      <span class="gas-fill-date">${formatDate(x.date, withYear)}</span>
      <span class="gas-fill-liters">${x.liters ? _dec(x.liters, 1) + " L" : "— L"}</span>
      <span class="gas-fill-ppl">${x.liters ? _dec(x.amt / x.liters, 3) + " €/L" : ""}</span>
      <span class="gas-fill-amt">${fmtEur(x.amt)}</span>
    </div>`).join("");
}

function _renderFuelInsight(f, allSpent, isMonth, year) {
  const lines  = [];
  const priced = f.fills.filter(x => x.liters);
  const ppl    = x => x.amt / x.liters;

  if (!f.count) {
    lines.push(isMonth ? "Nessun rifornimento in questo mese." : `Nessun rifornimento nel ${year}.`);
  } else {
    const avgFill = priced.length ? f.liters / priced.length : 0;
    lines.push(`<b>${f.count}</b> rifornimen${f.count === 1 ? "to" : "ti"} per <b>${fmtEur(f.spent, 0)}</b>` +
      (f.liters > 0 ? `, ${_dec(f.liters, 1)} litri in tutto (in media ${_dec(avgFill, 1)} L a volta).` : "."));

    if (isMonth) {
      // Prezzo rispetto ai 3 mesi precedenti
      const prevYMs = [1, 2, 3].map(i => addMonths(_fuelYM, -i));
      const prev = _fuelOf(t => prevYMs.includes(t.ym));
      if (f.ppl && prev.ppl) {
        const d = (f.ppl - prev.ppl) / prev.ppl * 100;
        lines.push(`Prezzo medio <b>${_dec(f.ppl, 3)} €/L</b>, ${Math.abs(d) < 0.5 ? "in linea con i" : `${fmtPct(Math.abs(d))} ${d > 0 ? "più caro" : "più economico"} dei`} 3 mesi precedenti (${_dec(prev.ppl, 3)} €/L).`);
      }
    } else {
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, "0")}`;
        if (ym <= currentYM() && (!firstDataYM() || ym >= firstDataYM())) months.push(ym);
      }
      if (months.length) lines.push(`Spesa media <b>${fmtEur(f.spent / months.length, 0)}</b> al mese.`);
      // Ogni quanti giorni fai rifornimento
      if (f.fills.length >= 3) {
        const d0 = new Date(f.fills[0].date), d1 = new Date(f.fills[f.fills.length - 1].date);
        const days = (d1 - d0) / 86400000 / (f.fills.length - 1);
        lines.push(`Fai rifornimento in media ogni <b>${Math.round(days)} giorni</b>.`);
      }
      const prevY = _fuelOf(t => t.year === year - 1);
      if (f.ppl && prevY.ppl) {
        const d = (f.ppl - prevY.ppl) / prevY.ppl * 100;
        lines.push(`Prezzo medio dell'anno ${_dec(f.ppl, 3)} €/L, ` +
          (Math.abs(d) < 0.5 ? `in linea con il ${year - 1}.` : `${fmtPct(Math.abs(d))} ${d > 0 ? "in più" : "in meno"} del ${year - 1}.`));
      }
    }

    if (priced.length >= 2) {
      const cheap = priced.reduce((a, b) => ppl(b) < ppl(a) ? b : a);
      const dear  = priced.reduce((a, b) => ppl(b) > ppl(a) ? b : a);
      lines.push(`Il più conveniente il ${formatDate(cheap.date, !isMonth)} a <b>${_dec(ppl(cheap), 3)} €/L</b>, ` +
                 `il più caro il ${formatDate(dear.date, !isMonth)} a ${_dec(ppl(dear), 3)} €/L.`);
    }
    if (allSpent > 0) lines.push(`Il carburante è il <b>${fmtPct(f.spent / allSpent * 100)}</b> delle spese del periodo.`);

    const noLiters = f.count - priced.length;
    if (noLiters > 0) {
      lines.push(`${noLiters} rifornimen${noLiters === 1 ? "to non ha" : "ti non hanno"} i litri nella nota, quindi non ${noLiters === 1 ? "entra" : "entrano"} nel prezzo al litro. ` +
                 `Toccali qui sotto per aggiungerli (es. "35,4 L").`);
    }
  }
  document.getElementById("fuel-insight").innerHTML = lines.map(l => `<p>${l}</p>`).join("");
}
