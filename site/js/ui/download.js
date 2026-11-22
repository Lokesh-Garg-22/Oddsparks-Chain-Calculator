// @ts-check
/** Hand the viewer a file to save (library backups now, Excel workbooks in step 11). */

/** @param {Blob} blob @param {string} name file name, e.g. "oddsparks-library-2026-11-22.json" */
export function downloadFile(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "2026-11-22", for file names. */
export const today = () => new Date().toISOString().slice(0, 10);
