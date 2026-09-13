/*
 * Find a club's FFBB org id (and its env config) by name.
 *
 *   npm run find-club "villeneuve loubet"
 *
 * Copy the NEXT_PUBLIC_CLUB_* lines into your .env.local (or Vercel env) to run this
 * assistant for that club. Only NEXT_PUBLIC_CLUB_ORG_ID is strictly required.
 */
import { FFBB_HEADERS, FFBB_HOST } from "@/config";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('Usage: npm run find-club "<club name>"');
  process.exit(1);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 5);
}

async function main() {
  const cfg = (await fetch(`${FFBB_HOST}/items/configuration`, { headers: FFBB_HEADERS }).then((r) => r.json())) as {
    data?: { key_dh?: string };
  };
  const token = cfg.data?.key_dh;
  if (!token) throw new Error("FFBB bootstrap failed (no key_dh)");

  const url =
    `${FFBB_HOST}/items/ffbbserver_organismes` +
    `?filter[nom][_icontains]=${encodeURIComponent(query)}&fields=id,code,nom&limit=15`;
  const res = await fetch(url, { headers: { ...FFBB_HEADERS, Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as { data?: { id: string; code: string; nom: string }[] };
  const hits = json.data ?? [];

  if (hits.length === 0) {
    console.log(`Aucun club trouvé pour « ${query} ».`);
    return;
  }

  console.log(`${hits.length} club(s) trouvé(s) :\n`);
  for (const h of hits) {
    const code = String(h.code ?? "");
    const ligue = code.slice(0, 3).toLowerCase();
    const comite = code.slice(3, 7);
    const clubCode = code.toLowerCase();
    console.log(`• ${h.nom}  (org id ${h.id}, code ${code})`);
    console.log(`    NEXT_PUBLIC_CLUB_ORG_ID=${h.id}`);
    console.log(`    NEXT_PUBLIC_CLUB_SHORT=${initials(h.nom)}`);
    console.log(`    NEXT_PUBLIC_CLUB_NAME=${h.nom}`);
    console.log(`    NEXT_PUBLIC_CLUB_LIGUE=${ligue}  NEXT_PUBLIC_CLUB_COMITE=${comite}  NEXT_PUBLIC_CLUB_CODE=${clubCode}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
