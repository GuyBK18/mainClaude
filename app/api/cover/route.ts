import { type NextRequest } from "next/server";
import { endpoints } from "@/lib/metadata/http";

/**
 * Same-origin copy of a cover image so the browser can read its pixels for the ambient
 * glow. Only known cover hosts are proxied; anything else gets a 400.
 */
const COVER_HOSTS = [
  /(^|\.)covers\.openlibrary\.org$/,
  /(^|\.)archive\.org$/,
  /(^|\.)books\.google\.com$/,
  /(^|\.)googleusercontent\.com$/,
  /(^|\.)gr-assets\.com$/,
  /(^|\.)goodreads\.com$/,
  /^images-na\.ssl-images-amazon\.com$/,
  /^m\.media-amazon\.com$/,
];

const MAX_BYTES = 6 * 1024 * 1024;

function allowed(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  // A local mock catalog (tests) is allowed through its configured base URL.
  const configured = [endpoints.openLibraryCovers, endpoints.goodreads, endpoints.googleBooks].map((u) => new URL(u).host);
  return COVER_HOSTS.some((re) => re.test(url.hostname)) || configured.includes(url.host);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (!allowed(target)) return new Response("Host not allowed", { status: 400 });

  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("Not an image", { status: 502 });
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > MAX_BYTES) return new Response("Too large", { status: 413 });
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return new Response("Too large", { status: 413 });
    return new Response(bytes, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
