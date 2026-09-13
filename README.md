# ESVL Basket Assistant

A small, finished assistant for an amateur basketball club — **ES Villeneuve-Loubet Basket** — grounded on public [FFBB](https://www.ffbb.com/) (French Basketball Federation) data. It turns the federation's clunky data into **ready-to-paste WhatsApp messages** for the people who actually run a club.

It is also a **template**: point it at any FFBB club with one environment variable (see [Run it for your own club](#run-it-for-your-own-club)).

Three surfaces:

- **① Week-end** — for each team, its next fixture (opponent, date/time, gym + itinerary link, both standings, opponent form) as a **one-tap WhatsApp share**.
- **② Résultats** — the club's latest results as a ready-to-publish post (+ a downloadable image).
- **③ Assistant** — a natural-language Q&A agent (« quand joue l'U18 ? ») — the applied-AI showcase.

Built to demonstrate three things end-to-end: **agentic tool use**, **grounding not guessing** (the agent disambiguates or says "I don't know" instead of inventing), and **LLM cost engineering** (layered caching, prompt-cache-friendly context, deterministic work kept out of the model, with the cost of every answer measured). It is **provider-agnostic** — the same agent runs on **Claude Haiku** or **Gemini Flash** behind one interface.

> Unofficial project, **not affiliated with the FFBB or the club**. Built on public data, cached and attributed. Non-commercial. MIT-licensed.

**Live demo:** [esvl-assistant.vercel.app](https://esvl-assistant.vercel.app)

---

## Run it for your own club

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPaulChass%2Fesvl-assistant&env=ANTHROPIC_API_KEY,NEXT_PUBLIC_CLUB_ORG_ID&envDescription=Anthropic%20API%20key%20(for%20the%20chat%20tab)%20%2B%20your%20FFBB%20club%20org%20id&envLink=https%3A%2F%2Fgithub.com%2FPaulChass%2Fesvl-assistant%23run-it-for-your-own-club)

Only one thing identifies a club: its **FFBB org id**. Teams, the club name, fixtures and standings are all auto-discovered from that id. Find yours:

```bash
npm run find-club "your club name"
```

It prints the `NEXT_PUBLIC_CLUB_*` lines to paste into `.env.local` (or your Vercel env). Only `NEXT_PUBLIC_CLUB_ORG_ID` is required; the Week-end and Résultats tabs then work with no API key at all (the Assistant tab needs `ANTHROPIC_API_KEY`).

---

## What it does

The Week-end and Résultats tabs are deterministic (no LLM). The Assistant tab answers, in plain French:

- « Quand joue l'équipe 1 ? » → next fixture with date, time, gym, opponent, home/away
- « Les prochains matchs du club ce week-end ? » → upcoming fixtures across every team
- « Classement des seniors ? » → the poule standing, club highlighted (and a follow-up when "seniors" is ambiguous)
- « Y a-t-il une équipe féminine ? » → an honest "no team this season", not a hallucination

It degrades gracefully when data isn't published yet (e.g. standings before the first game).

---

## Architecture

```
Browser — three surfaces (Next.js)          src/app
   Week-end · Résultats · Assistant
      │            │            │
      ▼            ▼            ▼
 /api/weekend  /api/recap   /api/chat        src/app/api
      │            │            │
      │            │            ▼
      │            │      Agent loop (provider-agnostic tool-use)   src/lib/agent
      │            │            │
      ▼            ▼            ▼
   Brief builders (① ②)   LLM provider + FFBB tools    src/lib/brief, src/lib/llm
      └────────────┴────────────┘
                   ▼
        FFBB data layer — own client + cache           src/lib/ffbb
                   ▼
        api.ffbb.com  (Directus, public)
```

See [`docs/architecture.md`](docs/architecture.md) for the data layer in detail (endpoints, auth bootstrap, field mapping, risks).

### The data layer is our own code

FFBB's public data is served by an undocumented Directus API behind `competitions.ffbb.com`. Rather than depend on an unmaintained third-party client, this project ships a **~200-line typed client** (`src/lib/ffbb`) that bootstraps the public read token, sends the headers the API requires, retries transient failures, exposes a handful of read operations returning **trimmed domain objects** (never raw payloads), resolves fuzzy French team names **in code with no LLM tokens**, and never requests the personal contact fields the federation stores on a team.

### Cost engineering is the point

In a chat agent the dominant cost is tokens, so caching is treated as **cost control**:

- **Layered TTL cache** (stale-while-revalidate): the team catalog stays warm for hours, standings/fixtures ~30 min. One fetch of a poule's matches serves both the "next matches" and "latest results" tools.
- **Prompt-cache-friendly context**: stable instructions + team catalog in one cacheable system head; the only volatile bit (today's date) is a separate block.
- **Trimmed tool outputs** and **deterministic work in code** (dates, W/L, home/away, coercion) so the model only phrases the answer.

### Provider-agnostic + benchmark

`src/lib/llm` defines one `LlmProvider` interface with two implementations (Anthropic, Google); the agent loop is written entirely against it. `npm run eval` runs a behavioural eval over live data and writes `BENCHMARK.md`:

| Provider  | Model              | Pass | Avg latency | Avg cost/answer | Cost / 1k answers |
|-----------|--------------------|------|-------------|-----------------|-------------------|
| anthropic | `claude-haiku-4-5` | 8/8  | 2 975 ms    | $0.0044         | $4.35             |
| google    | `gemini-3.6-flash` | —    | —           | —               | —                 |

(Anthropic measured live; the Gemini provider is implemented and 3.x-ready — run it with a Gemini key to fill its row.) The eval grades **behaviour** — right tool, disambiguation, no invention — because the data is live.

---

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env.local     # add your key(s) + your club org id
npm run dev                    # http://localhost:3000
```

Other commands:

```bash
npm run find-club "<name>"     # find a club's FFBB org id + env config
npm run typecheck              # tsc --noEmit
npm run eval                   # benchmark configured providers → BENCHMARK.md
npx tsx scripts/smoke.ts       # exercise the FFBB data layer (no key needed)
```

Deploys to Vercel with zero config. The cache is per-instance in-memory; swapping it for Vercel KV / Upstash behind the same interface makes it shared across cold starts. Optional `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` enable "Share"-click metrics (no-op when unset).

---

## Tech stack

TypeScript · Next.js (App Router) · `@anthropic-ai/sdk` · `@google/genai` · Vercel. No database — FFBB is the source of truth, cached in memory.

---

## Data, ethics & limitations

- **Unofficial and non-affiliated.** Not endorsed by the FFBB or any club; served with `noindex` so it is never mistaken for an official source.
- **Public data, minimal footprint.** Reads only public results/fixtures/standings, caches hard, attributes the FFBB. Members' personal data is never touched.
- **Non-commercial.** The FFBB's data is covered by database rights and monetized through official partners; this stays a free demonstration. Self-hosting for your own club is fine — keep it non-commercial and attributed.
- **The backend is undocumented** and can change or block without notice. The client fails gracefully and surfaces typed errors.

---

## Contributing

Forks and PRs are welcome — especially from other clubs. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the project layout, how to run things, and how to add a tool. Licensed under [MIT](LICENSE).

## Why this exists

I build production AI systems — RAG, agents, MCP servers — and the plumbing around them. This is a public, verifiable example of that work on a domain I actually care about (a real amateur club, real federation data), kept deliberately small and finished rather than broad and half-done.

— [Paul Chasseuil](https://paulchasseuil.fr)
