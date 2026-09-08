import type { NextRequest } from "next/server";
import { incr } from "@/lib/metrics";

export const runtime = "nodejs";

const EVENTS = new Set(["share", "copy", "recap_copy", "weekend_view", "recap_view"]);
const clean = (s: unknown) =>
  typeof s === "string" ? s.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "";

/** Records a lightweight adoption event (the "Share" click is metric #1). Fire-and-forget. */
export async function POST(req: NextRequest) {
  let body: { event?: string; org?: string; label?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const event = clean(body.event);
  if (!EVENTS.has(event)) return Response.json({ ok: false }, { status: 400 });

  const org = clean(body.org);
  const label = clean(body.label);

  await incr(`m:${event}:total`);
  if (org) await incr(`m:${event}:${org}`);
  if (org && label) await incr(`m:${event}:${org}:${label}`);

  return Response.json({ ok: true });
}
