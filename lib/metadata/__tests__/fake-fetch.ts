import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

export const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

type Reply = { status?: number; body?: string; type?: string; finalUrl?: string } | Error;
export type Route = readonly [RegExp, Reply | ((url: URL) => Reply)];

/**
 * Replaces global fetch with a router over fixtures. Unmatched URLs return 404,
 * and every requested URL is recorded so tests can check what was called.
 */
export function fakeFetch(routes: readonly Route[]) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url.toString());
    const route = routes.find(([re]) => re.test(url.toString()));
    const reply = route ? (typeof route[1] === "function" ? route[1](url) : route[1]) : { status: 404, body: "" };
    if (reply instanceof Error) throw reply;
    const res = new Response(reply.body ?? "", {
      status: reply.status ?? 200,
      headers: { "content-type": reply.type ?? (reply.body?.trim().startsWith("<") ? "text/html" : "application/json") },
    });
    Object.defineProperty(res, "url", { value: reply.finalUrl ?? url.toString() });
    return res;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export const json = (name: string): Reply => ({ body: fixture(name), type: "application/json" });
export const html = (name: string, finalUrl?: string): Reply => ({ body: fixture(name), type: "text/html", finalUrl });
