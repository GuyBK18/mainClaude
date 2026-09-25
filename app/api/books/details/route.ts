import { NextResponse, type NextRequest } from "next/server";
import type { BookCandidate } from "@/lib/metadata/types";
import { getBookDetails, lookupUrl } from "@/lib/metadata/details";

/** Body: `{ candidate }` from a search result, or `{ url }` for a pasted link. */
export async function POST(request: NextRequest) {
  let body: { candidate?: BookCandidate; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    if (body.url) return NextResponse.json(await lookupUrl(body.url));
    if (body.candidate?.title) return NextResponse.json({ details: await getBookDetails(body.candidate) });
    return NextResponse.json({ error: "Send a candidate or a url." }, { status: 400 });
  } catch (error) {
    const message = error instanceof TypeError && /URL/i.test(error.message) ? "That link is not a valid URL." : (error as Error).message;
    return NextResponse.json({ error: message || "The lookup failed." }, { status: 502 });
  }
}
