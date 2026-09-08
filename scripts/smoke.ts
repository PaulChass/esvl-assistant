/* Live smoke test for the FFBB data layer. Run: npx tsx scripts/smoke.ts (no API key needed). */
import { warmCatalog, listTeams, getSchedule, getResults, getStanding } from "@/lib/ffbb";
import { resolveTeam } from "@/lib/ffbb/resolve";
import { buildWeekend } from "@/lib/brief/weekend";
import { buildRecap } from "@/lib/brief/recap";

function j(v: unknown) {
  return JSON.stringify(v, null, 2);
}

async function main() {
  const catalog = await warmCatalog();
  console.log("SEASON:", catalog.season.label, `(${catalog.season.id})`);
  console.log("TEAMS:", j(listTeams(catalog).teams));

  const queries = ["les seniors", "u18", "u21", "équipe 1", "féminines", "pré régionale", "rm3"];
  console.log("\n--- resolveTeam ---");
  for (const q of queries) {
    const r = resolveTeam(q, catalog.teams);
    const summary =
      r.kind === "match" ? `MATCH ${r.team.code}` :
      r.kind === "ambiguous" ? `AMBIGUOUS [${r.candidates.map((t) => t.code).join(", ")}]` :
      "NONE";
    console.log(`  "${q}" -> ${summary}`);
  }

  console.log("\n--- club next matches ---");
  console.log(j(await getSchedule(catalog, null, 4)));

  console.log("\n--- schedule: seniors régionale (rm3) ---");
  console.log(j(await getSchedule(catalog, "rm3", 3)));

  console.log("\n--- standing: u18 ---");
  console.log(j(await getStanding(catalog, "u18")));

  console.log("\n--- club results ---");
  const res = await getResults(catalog, null, 3);
  console.log(res.status, "count:", res.status === "ok" ? res.data.length : "-");

  console.log("\n--- weekend brief (① / ①bis) ---");
  const weekend = await buildWeekend(catalog);
  console.log(`club=${weekend.club} · fixtures=${weekend.fixtures.length}`);
  if (weekend.fixtures[0]) {
    console.log("first fixture row:", JSON.stringify({
      team: weekend.fixtures[0].team,
      homeAway: weekend.fixtures[0].homeAway,
      opponent: weekend.fixtures[0].opponent,
      when: `${weekend.fixtures[0].dateLabel} ${weekend.fixtures[0].timeLabel ?? ""}`,
      thisWeekend: weekend.fixtures[0].thisWeekend,
    }));
    console.log("\nWhatsApp message:\n" + weekend.fixtures[0].message);
  }

  console.log("\n--- sunday recap (②) ---");
  const recap = await buildRecap(catalog);
  console.log(`hasResults=${recap.hasResults}`);
  console.log(recap.post);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
