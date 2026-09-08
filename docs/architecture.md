# Architecture

## Overview

```
src/
  app/
    page.tsx            chat UI (client)
    api/chat/route.ts   agent endpoint (server)
  lib/
    ffbb/               FFBB data layer (own client + domain model)
    llm/                provider-agnostic LLM interface (Anthropic + Google)
    agent/              tools, system prompt, tool-use loop
    cost.ts             pricing table + cost accounting
    cache.ts            TTL cache with stale-while-revalidate
  evals/                behavioural eval + cost/latency benchmark
scripts/smoke.ts        live check of the data layer (no API key)
```

## FFBB data layer

`competitions.ffbb.com` is a Next.js app backed by an undocumented **Directus** REST API at `api.ffbb.com` (plus a Meilisearch index for search, unused here). This project reads it directly with a small typed client.

### Authentication

Read access is public through a two-token bootstrap: `GET /items/configuration` returns `key_dh` (the Directus bearer). There is no signup and no personal key. Tokens rotate, so the client never hardcodes them — it caches the token for ~25 minutes and re-bootstraps on an auth failure.

The API is served behind a CDN + WAF that **requires** `Origin` and `Referer` headers matching `competitions.ffbb.com`; the client sends them on every request (including the bootstrap), or the WAF returns a 403 HTML page instead of JSON.

### Entity

ES Villeneuve-Loubet Basket is organisme `10135` (code `SUD0006003`, ligue `sud`, comité `0006`). The id is resolved once and pinned in `src/config.ts`.

### The four operations

All hang off one cached **team catalog** — the club's engagements for the active season, joined to their competitions:

| Tool | Directus call (shape) |
|---|---|
| catalog | `ffbbserver_saisons?filter[actif][_eq]=true` → active season; `ffbbserver_engagements?filter[idOrganisme][_eq]=10135&filter[idCompetition][saison][_eq]=<season>` joined to `idCompetition` |
| `get_schedule` | `ffbbserver_rencontres?filter[idPoule][_eq]=<poule>&filter[joue][_eq]=false` (per team) or an `_or` over the club |
| `get_results` | same collection with `joue=true`, scoped by `saison`, sorted `-date` |
| `get_standing` | `ffbbserver_poules/<poule>?fields=nom,classements.*&deep[classements][_limit]=100` |

Notes learned from the live API:

- Some fields/collections are forbidden for the public role (`libelle` on organismes/poules; the top-level `ffbbserver_classements`). The queries avoid them and use `nom` / the nested `poule.classements`.
- Numerics are strings (`position`, `points`, scores) — always coerced with `Number()`.
- There is no explicit home/away flag: `idOrganismeEquipe1` is the receiver by convention.
- Match datetime is `date_rencontre` (`YYYY-MM-DDTHH:MM:SS`, naive local time); dates are formatted timezone-stably so the server's UTC clock never shifts the calendar day.
- FFBB occasionally stores a fixture twice; the layer de-duplicates on `(team, datetime, opponent, home)`.
- Personal contact fields on engagements (correspondent email/phone/address) are **never requested**.

### Team resolution

`resolveTeam` maps a fuzzy French query to a concrete team entirely in code (`src/lib/ffbb/resolve.ts`): normalize accents, extract gender / age-category / level / explicit code / "équipe N", score the candidates, and return a single match, a short candidate list to disambiguate, or nothing. No network and no LLM tokens.

## Agent loop

`src/lib/agent/run.ts` is a provider-agnostic tool-use loop: generate → if tool calls, execute them and feed results back → repeat (capped), then force a final answer. It maintains a neutral `LlmTurn[]` transcript that each provider translates to its own SDK shape.

The system prompt is split into a **stable cacheable head** (role, rules, the team catalog) and a **volatile tail** (today's date), so prompt caching is reused across turns.

## LLM providers

`src/lib/llm` exposes one `LlmProvider` interface. `anthropic.ts` uses `@anthropic-ai/sdk` with `cache_control` on the system head; `gemini.ts` uses `@google/genai` function calling and normalizes token accounting (Gemini's prompt token count includes cached tokens, Anthropic's does not) so cost is computed uniformly. `getProvider(vendor)` selects one from config/env.

## Cost model

`src/lib/cost.ts` holds per-model prices (verified from vendor pricing pages) and computes the USD cost of a turn from token usage, distinguishing uncached input, output, cache-read and cache-write. The UI shows it per answer; the benchmark aggregates it.

## Caching

`src/lib/cache.ts` is an in-memory TTL cache with stale-while-revalidate and in-flight de-duplication. TTLs (in `src/config.ts`): tokens ~25 min, season 24 h, team catalog 6 h, fixtures/results/standings ~30 min. It is per serverless instance; swapping the `Map` for Vercel KV / Upstash behind the same interface would make it shared across cold starts (worth it for token-bootstrap reuse; left out of v1 to avoid extra infra).

## Risks

The backend is undocumented and its behaviour (endpoints, fields, tokens, WAF rules) can change without notice. The client wraps everything in typed errors and retries transient failures; the agent surfaces "I don't have that" rather than guessing. The data is covered by the FFBB's database rights — see the README's data/ethics section; this project is a free, non-commercial, attributed demonstration.
