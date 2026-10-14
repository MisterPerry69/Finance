/* ============================================
   TIDE — Impostazioni (⚙️ in home): schede Categorie e Ricorrenti
   + modal di modifica categoria
   ============================================ */

const CATEGORY_ICONS = [
  "house", "shopping-cart", "utensils", "coffee", "car", "fuel", "wrench", "heart",
  "pill", "dumbbell", "gamepad-2", "film", "music", "plane", "gift", "shirt",
  "shopping-bag", "cpu", "smartphone", "book", "graduation-cap", "paw-print", "baby", "scissors",
  "triangle-alert", "receipt", "briefcase", "tag", "layers",
];
const CATEGORY_TYPE_HINTS = {
  essential: "Il budget non la riduce mai, anche se serve risparmiare.",
  variable:  "Se non ci stai col risparmio, il budget la riduce in proporzione.",
  oneoff:    "Conta come spesa, ma resta fuori dalle medie e dal budget del mese: pesa sul risparmio.",
};
const CATEGORY_GROUPS = [
  ["essential", "Essenziali"],
  ["variable",  "Variabili"],
  ["oneoff",    "Imprevisti"],
];

let _catEditing = null;   // categoria in modifica (null = nuova)
let _catType    = "variable";
let _catIcon    = "tag";

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("category-modal");
  const settings = document.getElementById("settings-modal");
  document.getElementById("open-settings-btn").addEventListener("click", () => openSettings("categories"));
  document.getElementById("settings-modal-close").addEventListener("click", () => settings.classList.add("hidden"));
  settings.addEventListener("click", e => { if (e.target === settings) settings.classList.add("hidden"); });
  settings.querySelectorAll("[data-settings-tab]").forEach(b =>
    b.addEventListener("click", () => _setSettingsTab(b.dataset.settingsTab)));
  document.getElementById("category-add-btn").addEventListener("click", () => openCategoryModal(null));
  document.getElementById("category-modal-close").addEventListener("click", closeCategoryModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeCategoryModal(); });
  document.getElementById("cat-save").addEventListener("click", _saveCategory);
  document.getElementById("cat-delete").addEventListener("click", _deleteCategory);

  document.getElementById("cat-type-picker").addEventListener("click", e => {
    const b = e.target.closest("[data-type]");
    if (b) { _catType = b.dataset.type; _syncCategoryForm(); }
  });
  document.getElementById("cat-icon-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-icon]");
    if (b) { _catIcon = b.dataset.icon; _syncCategoryForm(); }
  });
  document.getElementById("category-groups").addEventListener("click", e => {
    const b = e.target.closest("[data-cat-name]");
    if (b) openCategoryModal(categoryDef(b.dataset.catName));
  });
});

function openSettings(tab) {
  renderCategories();
  renderRecurring();
  _setSettingsTab(tab || "categories");
  document.getElementById("settings-modal").classList.remove("hidden");
  refreshIcons();
}

function _setSettingsTab(tab) {
  document.querySelectorAll("#settings-modal [data-settings-tab]").forEach(b =>
    b.classList.toggle("active", b.dataset.settingsTab === tab));
  document.getElementById("settings-categories").classList.toggle("hidden", tab !== "categories");
  document.getElementById("settings-recurring").classList.toggle("hidden", tab !== "recurring");
}

function renderCategories() {
  const el = document.getElementById("category-groups");
  if (!el) return;
  const cats = expenseCategories();
  el.innerHTML = CATEGORY_GROUPS.map(([type, title]) => {
    const list = cats.filter(c => c.type === type);
    return `
      <div class="cat-group">
        <div class="cat-group-head">${title}<span>${CATEGORY_TYPE_HINTS[type]}</span></div>
        <div class="cat-chips">
          ${list.length ? list.map(c => `
            <button class="cat-chip" data-cat-name="${escapeAttr(c.name)}">
              <i data-lucide="${escapeAttr(c.icon)}" style="color:${c.color}"></i>${escapeHtml(catTitle(c.name))}
            </button>`).join("") : '<span class="cat-chip-empty">nessuna</span>'}
        </div>
      </div>`;
  }).join("");
}

function openCategoryModal(def) {
  _catEditing = def;
  _catType    = def ? def.type : "variable";
  _catIcon    = def ? def.icon : "tag";
  document.getElementById("category-modal-title").textContent = def ? catTitle(def.name) : "Nuova categoria";
  const name = document.getElementById("cat-name");
  name.value    = def ? catTitle(def.name) : "";
  name.disabled = !!def;   // rinominare cambierebbe tutte le voci: per ora si modificano tipo e icona
  document.getElementById("cat-error").textContent = "";

  const del = document.getElementById("cat-delete");
  del.classList.toggle("hidden", !def || (def.builtin && !def.customized));
  del.textContent = def && def.builtin ? "Ripristina" : "Elimina";

  document.getElementById("cat-icon-grid").innerHTML = CATEGORY_ICONS.map(i =>
    `<button class="cat-icon-btn" data-icon="${i}" aria-label="${i}"><i data-lucide="${i}"></i></button>`).join("");
  _syncCategoryForm();
  document.getElementById("category-modal").classList.remove("hidden");
  refreshIcons();
}

function closeCategoryModal() {
  document.getElementById("category-modal").classList.add("hidden");
}

function _syncCategoryForm() {
  document.querySelectorAll("#cat-type-picker [data-type]").forEach(b =>
    b.classList.toggle("active", b.dataset.type === _catType));
  document.querySelectorAll("#cat-icon-grid [data-icon]").forEach(b =>
    b.classList.toggle("active", b.dataset.icon === _catIcon));
  document.getElementById("cat-type-hint").textContent = CATEGORY_TYPE_HINTS[_catType];
}

async function _saveCategory() {
  const err  = document.getElementById("cat-error");
  const name = (_catEditing ? _catEditing.name : document.getElementById("cat-name").value).trim().toUpperCase();
  if (!/^[A-ZÀ-Ü0-9 ]{2,20}$/.test(name)) { err.textContent = "Nome: 2-20 lettere o numeri"; return; }
  if (!_catEditing && categoryDef(name)) { err.textContent = "Esiste già una categoria con questo nome"; return; }

  const btn = document.getElementById("cat-save");
  btn.disabled = true;
  btn.textContent = "Salvataggio...";
  try {
    const res = await apiPost("finance_save_category", { name, icon: _catIcon, type: _catType });
    if (!res || res.status !== "SUCCESS") throw new Error((res && res.message) || "Salvataggio non riuscito");
    closeCategoryModal();
    await loadData();
  } catch (e) {
    err.textContent = e.message || "Errore di connessione";
  }
  btn.disabled = false;
  btn.textContent = "Salva";
}

async function _deleteCategory() {
  const def = _catEditing;
  if (!def) return;
  const msg = def.builtin
    ? `Ripristinare tipo e icona originali di ${catTitle(def.name)}?`
    : `Eliminare la categoria ${catTitle(def.name)}?`;
  if (!confirm(msg)) return;
  const btn = document.getElementById("cat-delete");
  btn.disabled = true;
  try {
    const res = await apiPost("finance_delete_category", { name: def.name });
    if (!res || res.status !== "SUCCESS") throw new Error((res && res.message) || "Operazione non riuscita");
    closeCategoryModal();
    await loadData();
  } catch (e) {
    document.getElementById("cat-error").textContent = e.message || "Errore di connessione";
  }
  btn.disabled = false;
}
