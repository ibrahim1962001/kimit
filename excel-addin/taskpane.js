/* global Office */

const urlInput = document.getElementById("dashboardUrl");
const frame = document.getElementById("dashboardFrame");
const reloadBtn = document.getElementById("reloadBtn");
const openExternalBtn = document.getElementById("openExternalBtn");
const importSheetBtn = document.getElementById("importSheetBtn");
const pushToDashBtn = document.getElementById("pushToDashBtn");
const pullFromDashBtn = document.getElementById("pullFromDashBtn");
const applyToSheetBtn = document.getElementById("applyToSheetBtn");
const statusBox = document.getElementById("statusBox");

let cachedRows = [];
let cachedFilename = "Excel_Data.xlsx";

function setStatus(message) {
  if (statusBox) statusBox.textContent = message;
}

function loadFrame() {
  const url = (urlInput?.value || "").trim();
  if (!url) return;
  frame.src = url;
  localStorage.setItem("kimit_excel_embed_url", url);
  setStatus(`Dashboard loaded: ${url}`);
}

function openExternal() {
  const url = (urlInput?.value || "").trim();
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function readActiveSheetRows() {
  return Excel.run(async context => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const used = sheet.getUsedRangeOrNullObject();
    used.load(["values", "rowCount", "columnCount"]);
    sheet.load("name");
    await context.sync();

    if (used.isNullObject || used.rowCount < 2 || used.columnCount === 0) {
      return { rows: [], sheetName: sheet.name };
    }

    const values = used.values;
    const headers = (values[0] || []).map(v => String(v ?? "").trim());
    const dataRows = values.slice(1).filter(r => r.some(v => v !== null && v !== ""));
    const rows = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        obj[h] = r[i] ?? null;
      });
      return obj;
    });
    return { rows, sheetName: sheet.name };
  });
}

async function writeRowsToActiveSheet(rows) {
  return Excel.run(async context => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    if (!rows.length) {
      setStatus("No rows to apply.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const matrix = [headers, ...rows.map(r => headers.map(h => r[h] ?? null))];

    const used = sheet.getUsedRangeOrNullObject();
    used.load("address");
    await context.sync();
    if (!used.isNullObject) {
      used.clear();
    }

    const target = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
    target.values = matrix;
    target.format.autofitColumns();
    await context.sync();
  });
}

function postToDashboard(type, payload) {
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({ type, payload }, "*");
}

function importSheet() {
  setStatus("Reading active sheet...");
  readActiveSheetRows()
    .then(({ rows, sheetName }) => {
      cachedRows = rows;
      cachedFilename = `${sheetName || "Excel"}_Data.xlsx`;
      setStatus(`Imported ${rows.length} rows from sheet "${sheetName}".`);
    })
    .catch(err => setStatus(`Import failed: ${err.message || err}`));
}

function pushToDashboard() {
  if (!cachedRows.length) {
    setStatus("No imported rows. Click 'Import Active Sheet' first.");
    return;
  }
  postToDashboard("KIMIT_EXCEL_IMPORT_ROWS", { rows: cachedRows, filename: cachedFilename });
  setStatus(`Pushed ${cachedRows.length} rows to dashboard.`);
}

function pullFromDashboard() {
  postToDashboard("KIMIT_EXCEL_REQUEST_ROWS");
  setStatus("Requested rows from dashboard...");
}

function applyToSheet() {
  if (!cachedRows.length) {
    setStatus("No rows available. Pull from dashboard first.");
    return;
  }
  setStatus("Writing rows back to Excel sheet...");
  writeRowsToActiveSheet(cachedRows)
    .then(() => setStatus(`Applied ${cachedRows.length} rows to active sheet.`))
    .catch(err => setStatus(`Apply failed: ${err.message || err}`));
}

window.addEventListener("message", event => {
  const msg = event.data;
  if (!msg || typeof msg !== "object" || !msg.type) return;

  if (msg.type === "KIMIT_APP_READY") {
    setStatus("Dashboard bridge ready.");
    return;
  }

  if (msg.type === "KIMIT_APP_IMPORTED") {
    setStatus(`Dashboard imported ${msg.payload?.rows ?? 0} rows.`);
    return;
  }

  if (msg.type === "KIMIT_APP_ROWS") {
    cachedRows = Array.isArray(msg.payload?.rows) ? msg.payload.rows : [];
    cachedFilename = msg.payload?.filename || cachedFilename;
    setStatus(`Pulled ${cachedRows.length} rows from dashboard.`);
    return;
  }

  if (msg.type === "KIMIT_APP_ERROR") {
    setStatus(`Dashboard error: ${msg.payload?.message || "Unknown error"}`);
  }
});

Office.onReady(() => {
  const saved = localStorage.getItem("kimit_excel_embed_url");
  if (saved && urlInput) {
    urlInput.value = saved;
  }
  loadFrame();

  reloadBtn?.addEventListener("click", loadFrame);
  openExternalBtn?.addEventListener("click", openExternal);
  importSheetBtn?.addEventListener("click", importSheet);
  pushToDashBtn?.addEventListener("click", pushToDashboard);
  pullFromDashBtn?.addEventListener("click", pullFromDashboard);
  applyToSheetBtn?.addEventListener("click", applyToSheet);
});
