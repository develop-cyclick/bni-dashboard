/**
 * Fetch BNI Slips data from Google Drive folder
 *
 * WORKFLOW:
 * 1. ทีมงาน upload .xls จาก BNI Connect ไปที่ Google Drive folder (สัปดาห์ละ 1 ไฟล์)
 * 2. ระบบจะ list ไฟล์ทั้งหมดใน folder → เปิดแต่ละไฟล์เป็น Google Sheet → ดึงข้อมูล
 *
 * FILE NAMING CONVENTION:
 * ชื่อไฟล์ควรมีวันที่อยู่ เช่น:
 *   - "Slips_Report_2026_02_11.xls"
 *   - "slips-audit-report_11-02-2026_10-31_AM.xls"
 *   - "Silps_Report_2026_02_18.xls"
 * ระบบจะพยายาม parse วันที่จากชื่อไฟล์ หรือใช้ modified date แทน
 */

import * as XLSX from "xlsx";

export interface SlipRecord {
  /** Report period label e.g. "11 ก.พ. 2569" */
  r: string;
  /** From member */
  f: string;
  /** To member */
  t: string;
  /** Slip type: "One to One" | "Referral" | "TYFCB" */
  s: string;
  /** TYFCB amount (0 if not TYFCB) */
  a: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}


const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.",
  "02": "ก.พ.",
  "03": "มี.ค.",
  "04": "เม.ย.",
  "05": "พ.ค.",
  "06": "มิ.ย.",
  "07": "ก.ค.",
  "08": "ส.ค.",
  "09": "ก.ย.",
  "10": "ต.ค.",
  "11": "พ.ย.",
  "12": "ธ.ค.",
};

/**
 * Parse date from filename or modified time
 * Supports:
 *  - "Slips_Report_2026_02_11.xls"     → 2026-02-11
 *  - "slips-audit-report_11-02-2026..." → 2026-02-11
 *  - "Silps_Report_2026_02_18.xls"     → 2026-02-18
 *  - Fallback: modifiedTime from Drive API
 */
function parseDateFromFilename(filename: string, modifiedTime: string): { sortKey: string; label: string } {
  // Pattern 1: YYYY_MM_DD or YYYY-MM-DD in filename
  const p1 = filename.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (p1) {
    const [, y, m, d] = p1;
    const thaiYear = parseInt(y) + 543;
    return {
      sortKey: `${y}-${m}-${d}`,
      label: `${parseInt(d)} ${THAI_MONTHS[m] || m} ${thaiYear}`,
    };
  }

  // Pattern 2: DD-MM-YYYY or DD_MM_YYYY in filename
  const p2 = filename.match(/(\d{2})[_-](\d{2})[_-](\d{4})/);
  if (p2) {
    const [, d, m, y] = p2;
    const thaiYear = parseInt(y) + 543;
    return {
      sortKey: `${y}-${m}-${d}`,
      label: `${parseInt(d)} ${THAI_MONTHS[m] || m} ${thaiYear}`,
    };
  }

  // Fallback: use modifiedTime
  const dt = new Date(modifiedTime);
  const y = dt.getFullYear().toString();
  const m = (dt.getMonth() + 1).toString().padStart(2, "0");
  const d = dt.getDate().toString().padStart(2, "0");
  const thaiYear = dt.getFullYear() + 543;
  return {
    sortKey: `${y}-${m}-${d}`,
    label: `${parseInt(d)} ${THAI_MONTHS[m] || m} ${thaiYear}`,
  };
}

/**
 * Parse a Google Drive folder ID from a shared folder URL.
 * Accepts:
 *   https://drive.google.com/drive/folders/{ID}
 *   https://drive.google.com/drive/folders/{ID}?usp=sharing
 *   https://drive.google.com/drive/folders/{ID}?usp=drive_link
 */
export function parseFolderIdFromUrl(url: string): string {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error(`Invalid Google Drive folder URL: ${url}`);
  return match[1];
}

/**
 * List all spreadsheet files in a Google Drive folder
 */
async function listFilesInFolder(
  folderId: string,
  apiKey: string
): Promise<DriveFile[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=100&key=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list Drive files: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const files: DriveFile[] = data.files || [];

  // Filter to only spreadsheet-like files
  // Uploaded .xls files become application/vnd.google-apps.spreadsheet when converted,
  // or remain as application/vnd.ms-excel if not converted
  return files.filter(
    (f) =>
      f.mimeType === "application/vnd.google-apps.spreadsheet" ||
      f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      f.mimeType === "application/vnd.ms-excel" ||
      f.name.endsWith(".xls") ||
      f.name.endsWith(".xlsx")
  );
}

/**
 * Fetch data from a single file (by file ID and MIME type)
 * - Native Google Sheets: export as xlsx via Drive export API
 * - Excel (.xls/.xlsx): download binary via Drive API
 * Both parsed with the xlsx library (no Sheets API required)
 */
async function fetchSheetData(
  fileId: string,
  mimeType: string,
  apiKey: string
): Promise<string[][]> {
  let url: string;
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    // Export native Google Sheet as xlsx — does not require Sheets API
    const exportMime = encodeURIComponent("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMime}&key=${apiKey}`;
  } else {
    // Direct download URL — works for publicly shared .xls/.xlsx files
    url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`Failed to fetch file ${fileId}: ${res.status}`);
    return [];
  }

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return rows;
}

/**
 * Parse rows from a BNI Slips report into SlipRecords
 *
 * BNI Connect export format:
 * Row 0: "Slips Audit Report for DD/MM/YYYY"
 * Row 1: Running User | _ | Run At | ...
 * Row 2: [name] | _ | [datetime] | ...
 * Row 3: From | To | _ | Slip Type | _ | Inside/Outside | $ if TYFCB | ...
 * Row 4+: data
 */
function parseSlipRows(rows: string[][], periodLabel: string): SlipRecord[] {
  const records: SlipRecord[] = [];

  // Find header row (the one starting with "From")
  let dataStart = 4; // default
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (String(rows[i]?.[0] ?? "").trim() === "From") {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const from = String(row[0] ?? "").trim();
    const to = String(row[1] ?? "").trim();
    const slipType = String(row[3] ?? "").trim();
    const rawAmount = row[6];
    const amount = typeof rawAmount === "number"
      ? rawAmount
      : parseFloat(String(rawAmount || "0").replace(/,/g, "")) || 0;

    if (!from || !to || !slipType) continue;
    if (!["One to One", "Referral", "TYFCB"].includes(slipType)) continue;

    records.push({
      r: periodLabel,
      f: from,
      t: to,
      s: slipType,
      a: amount,
    });
  }

  return records;
}

/**
 * Main: fetch all BNI slip data from all files in the Drive folder
 */
export async function fetchAllSlips(
  folderId: string,
  apiKey: string
): Promise<{ records: SlipRecord[]; periods: string[]; updatedAt: string; fileCount: number }> {
  // 1. List all spreadsheet files in the folder
  const files = await listFilesInFolder(folderId, apiKey);

  if (files.length === 0) {
    return { records: [], periods: [], updatedAt: new Date().toISOString(), fileCount: 0 };
  }

  // 2. Parse dates from filenames and sort
  const filesWithDates = files.map((f) => ({
    ...f,
    ...parseDateFromFilename(f.name, f.modifiedTime),
  }));
  filesWithDates.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // 3. Fetch data from each file in parallel
  const results = await Promise.allSettled(
    filesWithDates.map(async (f) => {
      const rows = await fetchSheetData(f.id, f.mimeType, apiKey);
      return parseSlipRows(rows, f.label);
    })
  );

  // 4. Combine results
  const records: SlipRecord[] = [];
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      records.push(...result.value);
    }
  });

  const periods = filesWithDates.map((f) => f.label);
  // Deduplicate periods (in case multiple files map to same date)
  const uniquePeriods = [...new Set(periods)];

  return {
    records,
    periods: uniquePeriods,
    updatedAt: new Date().toISOString(),
    fileCount: files.length,
  };
}
