import type { Match, TeamForm } from "@/lib/ffbb";

/** Google Maps search link for a gym, or null when we don't know where it is. */
export function mapsUrl(venue: string | null, city: string | null): string | null {
  if (!venue) return null;
  const q = [venue, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function homeAwayLabel(home: boolean): "domicile" | "extérieur" {
  return home ? "domicile" : "extérieur";
}

/** One human line summarizing an opponent's season form. */
export function formLine(form: TeamForm): string {
  if (form.played === 0) return "Nouvelle saison, pas encore de match joué.";
  const avgFor = Math.round(form.pointsFor / form.played);
  const avgAgainst = Math.round(form.pointsAgainst / form.played);
  const recent = form.recent.join(" ");
  return `Forme : ${form.wins}V-${form.losses}D · moy. ${avgFor}-${avgAgainst}${recent ? ` · récents ${recent}` : ""}`;
}

const SIGNATURE = "— brief auto · données FFBB · non officiel";

/** Build the WhatsApp-ready weekend brief for one fixture (item ① of the plan). */
export function fixtureMessage(opts: {
  clubTeam: string;
  match: Match;
  clubRank: number | null;
  opponentRank: number | null;
  opponentForm: string | null;
}): string {
  const { clubTeam, match, clubRank, opponentRank, opponentForm } = opts;
  const lines: string[] = [];

  const round = match.round ? ` (J${match.round})` : "";
  lines.push(`🏀 ${clubTeam}${round}`);
  lines.push(`${match.home ? "🆚 Reçoit" : "🚌 Se déplace à"} ${match.opponent}`);

  const when = [match.dateLabel, match.timeLabel ? `à ${match.timeLabel}` : null].filter(Boolean).join(" ");
  if (when) lines.push(`📅 ${when}`);

  if (match.venue) {
    lines.push(`📍 ${[match.venue, match.venueCity].filter(Boolean).join(", ")}`);
    const url = mapsUrl(match.venue, match.venueCity);
    if (url) lines.push(`🗺️ ${url}`);
  }

  if (clubRank || opponentRank) {
    const a = clubRank ? `${clubTeam} ${clubRank}e` : clubTeam;
    const b = opponentRank ? `${match.opponent} ${opponentRank}e` : match.opponent;
    lines.push(`📊 Classement : ${a} · ${b}`);
  }

  if (opponentForm) lines.push(`ℹ️ ${match.opponent} — ${opponentForm}`);

  lines.push("");
  lines.push(SIGNATURE);
  return lines.join("\n");
}

const OUTCOME_EMOJI: Record<"W" | "L" | "D", string> = { W: "🟢", L: "🔴", D: "⚪" };

/** Build the Sunday recap post from the club's latest results (item ② of the plan). */
export function recapPost(club: string, results: Match[]): { post: string; hasResults: boolean } {
  if (results.length === 0) {
    return {
      hasResults: false,
      post: `🏀 ${club}\nPas encore de résultats cette saison — rendez-vous après la première journée !\n\n${SIGNATURE}`,
    };
  }
  const lines = [`🏀 Résultats — ${club}`, ""];
  for (const m of results) {
    const emoji = m.outcome ? OUTCOME_EMOJI[m.outcome] : "•";
    const score = m.score ? `${m.score.esvl}-${m.score.opponent}` : "—";
    const loc = m.home ? "dom." : "ext.";
    lines.push(`${emoji} ${m.team} ${score} vs ${m.opponent} (${loc})`);
  }
  lines.push("", SIGNATURE);
  return { post: lines.join("\n"), hasResults: true };
}
