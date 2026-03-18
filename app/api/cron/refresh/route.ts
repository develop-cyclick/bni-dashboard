import { NextResponse } from "next/server";
import { fetchAllSlips, parseFolderIdFromUrl } from "@/lib/google-sheets";

/**
 * GET /api/cron/refresh
 *
 * Vercel Cron job — runs every Thursday at 09:00 ICT (02:00 UTC)
 * Warms the cache by fetching fresh data from Google Drive folder.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderUrl = process.env.GOOGLE_DRIVE_FOLDER_URL;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!folderUrl || !apiKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  let folderId: string;
  try {
    folderId = parseFolderIdFromUrl(folderUrl);
  } catch {
    return NextResponse.json({ error: "Invalid GOOGLE_DRIVE_FOLDER_URL" }, { status: 500 });
  }

  try {
    const data = await fetchAllSlips(folderId, apiKey);

    // Trigger revalidation of the main API endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    await fetch(`${baseUrl}/api/slips`, { cache: "no-store" });

    return NextResponse.json({
      success: true,
      recordCount: data.records.length,
      fileCount: data.fileCount,
      periods: data.periods,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error("Cron refresh failed:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
