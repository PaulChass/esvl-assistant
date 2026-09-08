# ESVL Basket Assistant

A natural-language assistant for an amateur basketball club — **ES Villeneuve-Loubet Basket** — that answers *"when do we play?"*, *"what were the results?"* and *"where are we in the table?"*, grounded on public [FFBB](https://www.ffbb.com/) (French Basketball Federation) data.

It's a small, finished, applied-AI project built to demonstrate three things end-to-end:

- **Agentic tool use** — a French-language agent that routes fuzzy questions to a handful of typed tools over live federation data.
- **Grounding, not guessing** — every answer comes from a tool result; the agent disambiguates or says "I don't know" instead of inventing scores and dates.
- **LLM cost engineering** — layered caching, prompt-cache-friendly context, and moving deterministic work out of the model, with the cost of every answer measured.

It is **provider-agnostic**: the same agent loop runs on **Claude Haiku** or **Gemini Flash** behind one interface, and a benchmark compares them on cost, latency, and correctness.

> Unofficial project, **not affiliated with the FFBB or the club**. Built on public data, cached and attributed. Non-commercial.

---

## What it does

Ask, in plain French:

- « Quand joue l'équipe 1 ? » → next fixture with date, time, gym, opponent, home/away
- « Les prochains matchs du club ce week-end ? » → upcoming fixtures across every team
- « Classement des seniors ? » → the poule standing, with the club highlighted (and a follow-up question when "seniors" is ambiguous)
- « Y a-t-il une équipe féminine ? » → an honest "no team this season", not a hallucination

The season hasn't started yet as of this writing, so the assistant is designed to come alive as fixtures, results, and standings fill in — and to degrade gracefully when data isn't published.

---

## Architecture

```
Browser (chat UI, Next.js)
      │  POST /api/chat  { message, history, vendor }
      ▼
Agent loop  (provider-agnostic tool-use)         src/lib/agent
      │              │
      ▼              ▼
LLM provider     FFBB tools                       src/lib/llm, src/lib/agent/tools.ts
 Claude | Gemini   list_teams / get_schedule / get_results / get_standing
                        │
                        ▼
                  FFBB data layer  (own client + cache)   src/lib/ffbb
                        │
                        ▼
                  api.ffbb.com  (Directus + Meilisearch, public)
```

See [`docs/architecture.md`](docs/architecture.md) for the data layer in detail (endpoints, auth bootstrap, field mapping, risks).

### The data layer is our own code

FFBB's public data is served by an undocumented Directus API behind `competitions.ffbb.com`. Rather than depend on an unmaintained third-party client, this project ships a **~200-line typed client** (`src/lib/ffbb`) that:

- bootstraps the public read token, sends the headers the API requires, and retries transient failures;
- exposes exactly four read operations, each returning **trimmed domain objects** (never raw API payloads);
- resolves fuzzy French team names (« les U15 », « équipe 1 », « féminines ») to a concrete team **in code, with no LLM tokens**;
- never requests or exposes the personal contact fields the federation stores on a team.

### Cost engineering is the point

In a chat agent the dominant cost is tokens, so the design treats caching as **cost control**, not just network hygiene:

- **Layered TTL cache** (stale-while-revalidate): the team catalog is kept warm for hours, standings/fixtures for ~30 min. One fetch of a poule's matches serves both the "next matches" and "latest results" tools.
- **Prompt-cache-friendly context**: the stable instructions + team catalog live in a single cacheable system head; the only volatile bit (today's date) is a separate block, so Claude's prompt cache is reused across turns.
- **Trimmed tool outputs**: tools return only `{ date, opponent, venue, score, W/L, rank }` — never dumped Directus objects.
- **Deterministic work in code, not the model**: date parsing, win/loss, home/away, and string→number coercion happen in TypeScript (token-free and error-free), so the model only has to phrase the answer.

Every answer reports its own token usage and cost in the UI.

### Provider-agnostic + benchmark

`src/lib/llm` defines one `LlmProvider` interface with two implementations (Anthropic, Google). The agent loop is written entirely against the interface, so switching vendors is a config change. `npm run eval` runs a behavioural eval set over live data and prints a cost/latency/correctness table per provider:

```
| Provider  | Model                 | Pass | Avg latency | Avg cost/answer | Cost / 1k answers |
|-----------|-----------------------|------|-------------|-----------------|-------------------|
| anthropic | claude-haiku-4-5      |  …   |     … ms    |      $…         |        $…         |
| google    | gemini-2.5-flash      |  …   |     … ms    |      $…         |        $…         |
```

Run it with your own keys to populate the numbers (it writes `BENCHMARK.md`). The eval grades **behaviour** — did the agent route to the right tool, disambiguate when needed, and refuse to invent — because the underlying data is live.

---

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then add your key(s)
npm run dev                  # http://localhost:3000
```

Set at least one provider key in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...     # default provider (Claude Haiku)
GEMINI_API_KEY=...               # optional second provider (Gemini Flash)
```

Other commands:

```bash
npm run typecheck            # tsc --noEmit
npm run eval                 # benchmark configured providers → BENCHMARK.md
npx tsx scripts/smoke.ts     # exercise the FFBB data layer (no key needed)
```

Deploy target is Vercel (the cache is per-instance in-memory; a shared KV store is a documented upgrade path).

---

## Tech stack

TypeScript · Next.js (App Router) · `@anthropic-ai/sdk` · `@google/genai` · Vercel. No database — FFBB is the source of truth, cached in memory.

---

## Data, ethics & limitations

- **Unofficial and non-affiliated.** The assistant is a personal project; it is not endorsed by the FFBB or the club, and it is served with `noindex` so it is never mistaken for an official source.
- **Public data, minimal footprint.** It reads only public results/fixtures/standings, caches hard to keep request volume low, and attributes the FFBB as the source. Members' personal data is never touched.
- **Non-commercial.** The FFBB's data is covered by database rights and its official results partner monetizes it; this project stays a free demonstration.
- **The backend is undocumented** and can change or block without notice. The client fails gracefully and surfaces typed errors.

---

## Why this exists

I build production AI systems — RAG, agents, MCP servers — and the plumbing around them. This is a public, verifiable example of that work on a domain I actually care about (a real amateur club, real federation data), kept deliberately small and finished rather than broad and half-done.

— [Paul Chasseuil](https://paulchasseuil.fr)
