import { NextResponse, type NextRequest } from "next/server";
import type { CoverQuery } from "@/lib/metadata/types";
import { moreCovers } from "@/lib/metadata/covers";

/** Body: `{ query, page, known }`. Answers with the next page of covers for the book. */
export async function POST(request: NextRequest) {
  let body: { query?: CoverQuery; page?: number; known?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const { query, page, known } = body;
  if (!query?.title || !Number.isInteger(page) || page! < 2 || page! > 20) {
    return NextResponse.json({ error: "Send a query and a page from 2 to 20." }, { status: 400 });
  }
  const lang = query.lang === "he" ? "he" : "en";
  return NextResponse.json(await moreCovers({ ...query, lang }, page!, (known ?? []).slice(0, 200)));
}
