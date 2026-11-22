// @ts-check
/**
 * Writes a workbook (site/js/export/workbook.js) to an .xlsx file with ExcelJS, which is loaded the
 * first time someone exports (about 860 KB, from site/vendor/exceljs/, never from a CDN).
 */
import { downloadFile } from '../ui/download.js';

/** @type {Promise<any> | null} */
let loading = null;

/** ExcelJS ships as a classic script that sets window.ExcelJS. */
function loadExcelJS() {
  loading ??= new Promise((resolve, reject) => {
    const g = /** @type {any} */ (globalThis);
    if (g.ExcelJS) return resolve(g.ExcelJS);
    // Relative to this module, not the page, so it loads from any page of the site.
    const src = new URL('../../vendor/exceljs/exceljs.bare.min.js', import.meta.url).href;
    const script = Object.assign(document.createElement('script'), { src, async: true });
    script.onload = () => resolve(g.ExcelJS);
    script.onerror = () => {
      loading = null; // let a later click try again
      script.remove();
      reject(new Error("the Excel library didn't load; check your connection and try again"));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * @param {{ sheets: import('./workbook.js').Sheet[] }} model
 * @param {string} fileName ends in .xlsx
 */
export async function saveWorkbook(model, fileName) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Oddsparks Chain Calculator';
  for (const sheet of model.sheets) {
    const ws = wb.addWorksheet(sheet.name, sheet.frozenRows ? { views: [{ state: 'frozen', ySplit: sheet.frozenRows }] } : {});
    sheet.widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    sheet.rows.forEach((row, r) => row.forEach((c, col) => {
      if (!c) return;
      const cell = ws.getCell(r + 1, col + 1);
      cell.value = c.f ? { formula: c.f, result: c.v ?? undefined } : c.v;
      if (typeof c.v === 'number' || c.f) cell.numFmt = '0.00';
      if (c.bold) cell.font = { bold: true };
    }));
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadFile(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

/** A file name without characters Windows or macOS refuse. @param {string} name */
export const fileNameFor = (name) => `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'oddsparks'}.xlsx`;
