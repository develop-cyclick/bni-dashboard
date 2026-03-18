import { NextResponse } from "next/server";
import { fetchAllSlips, parseFolderIdFromUrl } from "@/lib/google-sheets";

/**
 * GET /api/slips
 *
 * Fetches BNI Slips data from all files in Google Drive folder.
 * Cached via ISR — revalidates every 6 hours.
 * Vercel Cron triggers this every Thursday to warm the cache.
 */
export const revalidate = 21600; // 6 hours

export async function GET() {
  const folderUrl = process.env.GOOGLE_DRIVE_FOLDER_URL;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!folderUrl || !apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_DRIVE_FOLDER_URL or GOOGLE_API_KEY" },
      { status: 500 }
    );
  }

  let folderId: string;
  try {
    folderId = parseFolderIdFromUrl(folderUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid GOOGLE_DRIVE_FOLDER_URL" },
      { status: 500 }
    );
  }

  try {
    const data = await fetchAllSlips(folderId, apiKey);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    console.error("Failed to fetch slips:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from Google Drive" },
      { status: 500 }
    );
  }
}
