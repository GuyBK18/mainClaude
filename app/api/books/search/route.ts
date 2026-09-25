import { NextResponse, type NextRequest } from "next/server";
import { searchCatalogs } from "@/lib/metadata/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ candidates: [], notes: [] });

  try {
    return NextResponse.json(await searchCatalogs(q.slice(0, 200)));
  } catch (error) {
    const notes = (error as { notes?: string[] }).notes ?? [];
    return NextResponse.json({ error: "No book catalog answered. Check your connection and try again.", notes }, { status: 502 });
  }
}
