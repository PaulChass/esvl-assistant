import type { NextRequest } from "next/server";
import { ESVL } from "@/config";
import { buildWeekend } from "@/lib/brief/weekend";
import { warmCatalog } from "@/lib/ffbb";

export const runtime = "nodejs";
export const maxDuration = 30;

function orgOf(req: NextRequest): string {
  const raw = req.nextUrl.searchParams.get("org") ?? "";
  return /^[0-9]{1,15}$/.test(raw) ? raw : ESVL.orgId;
}

export async function GET(req: NextRequest) {
  const org = orgOf(req);
  try {
    const catalog = await warmCatalog(org);
    const weekend = await buildWeekend(catalog);
    return Response.json(weekend);
  } catch (e) {
    console.error("[weekend]", e);
    return Response.json({ error: "Impossible de charger les rencontres." }, { status: 502 });
  }
}
