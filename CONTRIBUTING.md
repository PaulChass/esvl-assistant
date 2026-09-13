# Contributing

Thanks for looking! This started as a tool for one club (ES Villeneuve-Loubet) but it's built to work for **any FFBB club**, and contributions — bug fixes, new features, docs, or just running it for your own club — are very welcome.

## Ground rules

- Keep it **non-commercial and attributed**: this reads public FFBB data under the federation's terms. Don't build a paid product on it.
- **Never surface members' personal data.** The FFBB stores contact fields (email/phone/address) on engagements; the data layer deliberately never requests them. Keep it that way.
- Match the existing style. TypeScript, `strict` on, small typed functions, French user-facing copy / English code + comments.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY + your NEXT_PUBLIC_CLUB_ORG_ID
npm run dev                    # http://localhost:3000
npm run typecheck              # must pass before a PR
npx tsx scripts/smoke.ts       # hits the live FFBB API (no key needed) — good first sanity check
```

`npm run find-club "<name>"` prints any club's org id and env config.

## Project layout

```
src/
  app/                 UI (App Router) + API routes
    page.tsx           the three tabs (Week-end / Résultats / Assistant)
    api/{weekend,recap,chat,metric}/route.ts
  lib/
    ffbb/              FFBB data layer — the own Directus client + domain model
    brief/             deterministic builders for the weekend brief (①) and recap (②)
    llm/               provider-agnostic LLM interface (Anthropic + Google)
    agent/             tools, system prompt, tool-use loop (③)
    cost.ts            pricing table + cost accounting
    cache.ts           TTL cache (stale-while-revalidate)
    metrics.ts         optional Upstash counter
  evals/               behavioural eval + benchmark
scripts/               find-club, smoke (dev tools)
docs/architecture.md   how the FFBB layer works
```

The single source of truth for the FFBB API shapes and gotchas is [`docs/architecture.md`](docs/architecture.md) — read it before touching `src/lib/ffbb`.

## Common changes

- **Add a tool to the assistant:** add a data function in `src/lib/ffbb`, expose it in `src/lib/ffbb/index.ts`, then declare + dispatch it in `src/lib/agent/tools.ts`. Add a case to `src/evals/cases.ts`.
- **Change a message format:** the WhatsApp brief and the recap post are pure functions in `src/lib/brief/format.ts` — easy to tweak and test via `scripts/smoke.ts`.
- **Support another club by default:** don't hardcode it — use the `NEXT_PUBLIC_CLUB_*` env vars (see `src/config.ts`).

## Pull requests

- Keep PRs focused; explain the user-facing change.
- `npm run typecheck` must pass. If your change is previewable, include a screenshot.
- If it touches the assistant's behaviour, run `npm run eval` and mention the result.

By contributing you agree your contribution is licensed under the project's [MIT license](LICENSE).
