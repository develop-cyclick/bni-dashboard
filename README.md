# BNI Active — Network Dashboard

## Architecture

```
┌─────────────────┐  upload .xls ทุกสัปดาห์   ┌────────────────────────┐
│  BNI Connect    │ ────────────────────────>  │  Google Drive Folder   │
│  (Export .xls)  │                            │  📁 /2026              │
└─────────────────┘                            │    📄 Slips_2026_02_11 │
                                               │    📄 Slips_2026_02_18 │
                                               │    📄 ... (เพิ่มทุกสัปดาห์)│
                                               └───────────┬────────────┘
                                                           │
                                            Drive API (list files)
                                            Sheets API (read data)
                                                           │
                    ┌──────────────────────────────────────┘
                    │
                    ▼
          ┌────────────────────────┐
          │   Vercel (Next.js)     │
          │                        │
          │  /api/slips            │◄── ดึงข้อมูลจากทุกไฟล์ใน folder
          │  /api/cron/refresh     │◄── Vercel Cron (ทุกพฤหัส 09:00)
          │  Dashboard (React)     │◄── Heatmap + Rankings
          └────────────────────────┘
```

## Setup Guide

### 1. เตรียม Google Drive Folder

Folder: https://drive.google.com/drive/folders/1UVYlZ10vVSz-OX5Q8zAmTfTNaH_2Xlca

**Share folder (สำคัญ):**
คลิกขวาที่ folder → Share → General access → "Anyone with the link" → Viewer

**ตั้งชื่อไฟล์** ควรมีวันที่ เช่น:
- `Slips_Report_2026_02_11.xls` → ระบบอ่านเป็น "11 ก.พ. 2569"
- `Silps_Report_2026_02_18.xls` → ระบบอ่านเป็น "18 ก.พ. 2569"

**Upload .xls → ต้องแปลงเป็น Google Sheets:**
- คลิกขวาไฟล์ → Open with → Google Sheets → File → Save as Google Sheets
- หรือตั้ง Drive Settings → Convert uploads → ✅ "Convert uploaded files"

### 2. สร้าง Google API Key

1. Google Cloud Console → สร้าง/เลือก Project
2. เปิด APIs & Services → Library:
   - ✅ Google Drive API
   - ✅ Google Sheets API
3. Credentials → Create → API Key
4. จำกัด key: HTTP referrers + Drive API + Sheets API only

### 3. Vercel Environment Variables

| Variable | Value |
|----------|-------|
| `GOOGLE_DRIVE_FOLDER_ID` | `1UVYlZ10vVSz-OX5Q8zAmTfTNaH_2Xlca` |
| `GOOGLE_API_KEY` | `AIza...` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### 4. Deploy

```bash
npm install && vercel --prod
```

## Weekly Workflow

1. Export .xls จาก BNI Connect
2. Upload เข้า Google Drive folder → แปลงเป็น Google Sheets
3. Dashboard อัปเดตอัตโนมัติทุกพฤหัส 09:00

## File Structure

```
bni-dashboard/
├── app/
│   ├── layout.tsx, page.tsx
│   └── api/
│       ├── slips/route.ts         ← ดึงข้อมูลจาก Drive
│       └── cron/refresh/route.ts  ← Vercel Cron
├── components/
│   └── bni-dashboard.tsx          ← Dashboard UI
├── lib/
│   └── google-sheets.ts           ← Drive + Sheets API
├── vercel.json                    ← Cron: "0 2 * * 4"
└── .env.example
```
