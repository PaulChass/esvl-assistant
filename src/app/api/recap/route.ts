import type { NextRequest } from "next/server";
import { ESVL } from "@/config";
import { buildRecap } from "@/lib/brief/recap";
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
    const recap = await buildRecap(catalog);
    return Response.json(recap);
  } catch (e) {
    console.error("[recap]", e);
    return Response.json({ error: "Impossible de charger les résultats." }, { status: 502 });
  }
}
