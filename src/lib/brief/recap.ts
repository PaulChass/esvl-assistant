import type { Catalog, Match } from "@/lib/ffbb";
import { getResults } from "@/lib/ffbb";
import { recapPost } from "./format";

export interface Recap {
  orgId: string;
  club: string;
  season: string;
  hasResults: boolean;
  /** Ready-to-publish post text (item ②). */
  post: string;
  results: Match[];
}

/** Item ②: the club's latest results as one ready-to-publish post + the rows for a visual. */
export async function buildRecap(catalog: Catalog, limit = 15): Promise<Recap> {
  const res = await getResults(catalog, null, limit);
  const results = res.status === "ok" ? res.data : [];
  const { post, hasResults } = recapPost(catalog.clubName, results);
  return { orgId: catalog.orgId, club: catalog.clubName, season: catalog.season.label, hasResults, post, results };
}
