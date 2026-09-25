import { NextResponse, type NextRequest } from "next/server";
import { backupDir, describeDir, isSnapshot, readLibrary, writeLibrary } from "@/lib/backup/store";

/** The library backup on this computer. GET reads it, PUT replaces it. */

export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Only this app's own pages may write. The server listens on this computer only (see the dev
 * script), and a page on another site that tries to write sends its own Origin and is refused.
 */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function GET() {
  const dir = await backupDir();
  try {
    return NextResponse.json({ where: describeDir(dir), library: await readLibrary(dir) });
  } catch (error) {
    return NextResponse.json({ where: describeDir(dir), error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Writes are only accepted from this app." }, { status: 403 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "The library is too large to save." }, { status: 413 });

  let library: unknown;
  try {
    library = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!isSnapshot(library)) return NextResponse.json({ error: "That is not a LuminaRead library." }, { status: 400 });

  const dir = await backupDir();
  try {
    const restore = request.nextUrl.searchParams.get("restore") === "1";
    const { created } = await writeLibrary(dir, library, { restore });
    return NextResponse.json({ where: describeDir(dir), created, savedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ where: describeDir(dir), error: `Could not write the backup: ${(error as Error).message}` }, { status: 500 });
  }
}
