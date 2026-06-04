# Finance — Setup

## 1. Google Sheet "Finance DB"

Crea un nuovo Spreadsheet Google. Aggiungi due fogli:

**`transactions`** — colonne in quest'ordine:
```
date | amount | wallet | category | description | advice | note
```

**`budget`** — colonne in quest'ordine:
```
key | label | (unused) | aiComment | timestamp
```

Prendi nota dell'**ID del foglio** (dalla URL: `.../spreadsheets/d/SPREADSHEET_ID/edit`).

## 2. Migrazione dati da LifeOS

Apri il vecchio Sheet LifeOS e copia manualmente:
- Tab "Finance" → tab `transactions` del nuovo sheet (le colonne sono identiche)
- Tab "Budget"  → tab `budget` del nuovo sheet (le colonne sono identiche)

## 3. Google Apps Script

1. Crea un nuovo progetto Apps Script su [script.google.com](https://script.google.com)
2. Copia i file dalla cartella `backend/`:
   - `Code.gs`
   - `Transactions.gs`
   - `Budget.gs`
   - `Stats.gs`
   - `AI.gs`
   - `Util.gs`
3. In `Code.gs` sostituisci `YOUR_SPREADSHEET_ID_HERE` con l'ID reale
4. Esegui `setupSecrets()` una volta dall'editor:
   - Prima metti la tua chiave Gemini in `setupSecrets()` al posto di `YOUR_GEMINI_API_KEY_HERE`
   - Esegui la funzione
   - **Rimuovi subito la chiave hardcoded** dal codice
5. Fai il **Deploy** come Web App:
   - Execute as: **Me**
   - Who has access: **Anyone** (o "Only myself" se vuoi più sicurezza)
6. Copia l'URL del deploy

## 4. Frontend

1. In `js/api.js` sostituisci `YOUR_GAS_URL_HERE` con l'URL del deploy GAS
2. (Opzionale) Aggiungi le icone PWA in `assets/icon-192.png` e `assets/icon-512.png`
3. Pubblica su GitHub Pages

## 5. Budget mensile

In `js/budget.js` riga 4, aggiorna `BUDGET_LIMIT` con il tuo budget mensile in €.

## Note

- Il campo `amount` nelle transazioni è **sempre con segno**: negativo per spese, positivo per entrate
- Il testo inserito nel form viene inviato al GAS che usa Gemini per parsare categoria e descrizione
- Se Gemini non è disponibile, la transazione viene salvata con categoria `AI_PENDING` e testo grezzo
