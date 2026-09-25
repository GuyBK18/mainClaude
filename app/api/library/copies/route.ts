import { NextResponse, type NextRequest } from "next/server";
import { backupDir, describeDir, listCopies, readCopy } from "@/lib/backup/store";

/** Daily copies of the backup. Without `id` it lists them; with `id` it returns that copy. */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dir = await backupDir();
  const id = request.nextUrl.searchParams.get("id");
  try {
    if (id) return NextResponse.json({ library: await readCopy(dir, id) });
    return NextResponse.json({ where: describeDir(dir), copies: await listCopies(dir) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
