"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Recap } from "@/lib/brief/recap";
import type { Weekend, WeekendFixture } from "@/lib/brief/weekend";

const DEFAULT_ORG = "10135"; // ES Villeneuve-Loubet Basket (pilot club)

/* ---------- icons ---------- */
const Basketball = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18M3 12h18M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8" />
  </svg>
);
const WhatsApp = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.9c0 2.1.55 4.06 1.6 5.82L2 22l4.4-1.15a9.9 9.9 0 0 0 5.64 1.73c5.46 0 9.9-4.45 9.9-9.9C21.95 6.45 17.5 2 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-2.6.68.7-2.53-.2-.32a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.16 8.16 0 0 1 2.42 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.12-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
  </svg>
);
const Cal = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
);
const Pin = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);
const Copy = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const Download = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
  </svg>
);

/* ---------- shared helpers ---------- */
function ping(event: string, org: string, label?: string) {
  try {
    fetch("/api/metric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, org, label }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* metrics must never break the UI */
  }
}

async function shareText(text: string, org: string, label?: string) {
  ping("share", org, label);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* cancelled or unsupported → WhatsApp fallback */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

/* ---------- page ---------- */
type Tab = "weekend" | "recap" | "chat";

export default function Home() {
  const [tab, setTab] = useState<Tab>("weekend");
  return (
    <div className="app">
      <header className="brand">
        <span className="brand-badge">
          <Basketball />
        </span>
        <div>
          <h1>
            Assistant <span className="accent">ESVL</span> Basket
          </h1>
          <p className="sub">// brief du week-end · résultats · assistant</p>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        <button className="tab" role="tab" aria-selected={tab === "weekend"} onClick={() => setTab("weekend")}>
          Week-end
        </button>
        <button className="tab" role="tab" aria-selected={tab === "recap"} onClick={() => setTab("recap")}>
          Résultats
        </button>
        <button className="tab" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
          Assistant
        </button>
      </nav>

      {tab === "weekend" && <WeekendPanel org={DEFAULT_ORG} />}
      {tab === "recap" && <RecapPanel org={DEFAULT_ORG} />}
      {tab === "chat" && <ChatPanel />}

      <footer className="footer">
        Assistant non officiel, non affilié à la FFBB. Données publiques FFBB, mises en cache. Projet de démonstration.
      </footer>
    </div>
  );
}

/* ---------- weekend ---------- */
function WeekendPanel({ org }: { org: string }) {
  const [data, setData] = useState<Weekend | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ping("weekend_view", org);
    fetch(`/api/weekend?org=${org}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => alive && setError("Impossible de charger les rencontres."));
    return () => {
      alive = false;
    };
  }, [org]);

  if (error) return <div className="error">⚠ {error}</div>;
  if (!data)
    return (
      <div className="skeletons" aria-busy="true" aria-label="Chargement">
        <div className="sk" />
        <div className="sk" />
        <div className="sk" />
      </div>
    );

  return (
    <div>
      <div className="panel-head">
        <div className="club">{data.club}</div>
        <div className="season">Prochaines rencontres · {data.season}</div>
      </div>
      {data.fixtures.length === 0 ? (
        <div className="empty">Aucune rencontre à venir pour l'instant — la saison n'a peut-être pas encore démarré.</div>
      ) : (
        <div className="fixtures">
          {data.fixtures.map((fx) => (
            <FixtureRow key={fx.code + fx.dateISO} fx={fx} org={data.orgId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureRow({ fx, org }: { fx: WeekendFixture; org: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const home = fx.homeAway === "domicile";

  const copy = async () => {
    ping("copy", org, fx.code);
    try {
      await navigator.clipboard.writeText(fx.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setOpen(true);
    }
  };

  return (
    <article className={`fixture${fx.thisWeekend ? " soon" : ""}`}>
      <div className="fx-head">
        <span className="fx-team">{fx.team}</span>
        <span className={`ha ${home ? "home" : "away"}`}>{home ? "domicile" : "extérieur"}</span>
        {fx.thisWeekend && <span className="fx-soon">● ce week-end</span>}
      </div>

      <h3 className="fx-opp">
        <span className="lead-in">vs </span>
        {fx.opponent}
      </h3>

      <div className="fx-meta">
        {fx.dateLabel && (
          <span className="meta-chip">
            <Cal />
            {fx.dateLabel}
            {fx.timeLabel ? ` · ${fx.timeLabel}` : ""}
          </span>
        )}
        {fx.venue && (
          <span className="meta-chip">
            <Pin />
            {fx.mapsUrl ? (
              <a href={fx.mapsUrl} target="_blank" rel="noreferrer noopener">
                {fx.venue}
                {fx.venueCity ? ` (${fx.venueCity})` : ""}
              </a>
            ) : (
              `${fx.venue}${fx.venueCity ? ` (${fx.venueCity})` : ""}`
            )}
          </span>
        )}
      </div>

      {(fx.clubRank || fx.opponentRank) && (
        <div className="fx-standings">
          Classement · l'équipe <b>{fx.clubRank ? `${fx.clubRank}ᵉ` : "n/a"}</b>
          {fx.opponentRank ? (
            <>
              {" · "}
              {fx.opponent} <b>{fx.opponentRank}ᵉ</b>
            </>
          ) : null}
        </div>
      )}

      <div className="fx-actions">
        <button className="btn wa" onClick={() => shareText(fx.message, org, fx.code)}>
          <WhatsApp /> Partager
        </button>
        <button className="btn" onClick={copy}>
          <Copy /> {copied ? "Copié !" : "Copier"}
        </button>
        <button className="btn link" onClick={() => setOpen((o) => !o)}>
          {open ? "Masquer" : "Voir le message"}
        </button>
      </div>

      {open && <pre className="msg-pre">{fx.message}</pre>}
    </article>
  );
}

/* ---------- recap ---------- */
function RecapPanel({ org }: { org: string }) {
  const [data, setData] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    ping("recap_view", org);
    fetch(`/api/recap?org=${org}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => alive && setError("Impossible de charger les résultats."));
    return () => {
      alive = false;
    };
  }, [org]);

  if (error) return <div className="error">⚠ {error}</div>;
  if (!data)
    return (
      <div className="skeletons" aria-busy="true">
        <div className="sk" style={{ height: 220 }} />
      </div>
    );

  const copy = async () => {
    ping("recap_copy", org);
    try {
      await navigator.clipboard.writeText(data.post);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div className="panel-head">
        <div className="club">{data.club}</div>
        <div className="season">Récap à publier · {data.season}</div>
      </div>
      <div className="recap-card">
        <pre className="msg-pre" style={{ marginTop: 0 }}>
          {data.post}
        </pre>
        <div className="recap-actions">
          <button className="btn wa" onClick={() => shareText(data.post, org)}>
            <WhatsApp /> Partager
          </button>
          <button className="btn" onClick={copy}>
            <Copy /> {copied ? "Copié !" : "Copier le post"}
          </button>
          <button className="btn" onClick={() => downloadRecapImage(data.post, data.club)}>
            <Download /> Image
          </button>
        </div>
      </div>
      {!data.hasResults && <p className="empty">Le visuel et le post se rempliront après la première journée.</p>}
    </div>
  );
}

function downloadRecapImage(post: string, club: string) {
  const lines = post.split("\n");
  const pad = 56;
  const lineH = 46;
  const width = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = pad * 2 + lines.length * lineH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff8a3a";
  ctx.fillRect(0, 0, width, 12);
  ctx.textBaseline = "top";
  let y = pad;
  lines.forEach((ln, i) => {
    ctx.font = i === 0 ? '600 42px "IBM Plex Mono", monospace' : '400 30px "IBM Plex Mono", monospace';
    ctx.fillStyle = i === 0 ? "#ff8a3a" : "#e7ecf2";
    ctx.fillText(ln, pad, y);
    y += lineH;
  });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `resultats-${club.toLowerCase().replace(/\s+/g, "-")}.png`;
  a.click();
}

/* ---------- chat (item ③ — interview showcase) ---------- */
type Vendor = "anthropic" | "google";
interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
interface Meta {
  model: string;
  usage: Usage;
  cost: { usd: number; usdPerThousand: number };
  toolCalls: { name: string; input: Record<string, unknown> }[];
}
interface Message {
  role: "user" | "assistant";
  text: string;
  meta?: Meta;
}

const SUGGESTIONS = ["Quand joue l'équipe 1 ?", "Classement des seniors ?", "Résultats du week-end ?"];

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const fmtUsd = (v: number) => (v === 0 ? "$0" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);

function ChatPanel() {
  const [vendor, setVendor] = useState<Vendor>("anthropic");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setError(null);
      setInput("");
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history, vendor }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Erreur inattendue.");
        else
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: data.answer, meta: { model: data.model, usage: data.usage, cost: data.cost, toolCalls: data.toolCalls } },
          ]);
      } catch {
        setError("Impossible de contacter le serveur.");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, vendor],
  );

  return (
    <div>
      <div className="chat-toolbar">
        <div className="seg" role="group" aria-label="Modèle">
          <button aria-pressed={vendor === "anthropic"} onClick={() => setVendor("anthropic")}>
            Claude Haiku
          </button>
          <button aria-pressed={vendor === "google"} onClick={() => setVendor("google")}>
            Gemini Flash
          </button>
        </div>
        <span className="hint">agent · tool-use · coûts mesurés</span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggestion" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="who">{m.role === "user" ? "vous" : "assistant"}</span>
            <div className="bubble">{linkify(m.text)}</div>
            {m.meta && <MetaBlock meta={m.meta} />}
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <span className="who">assistant</span>
            <div className="bubble dots">
              <span>●</span> <span>●</span> <span>●</span>
            </div>
          </div>
        )}
        {error && <div className="error">⚠ {error}</div>}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pose ta question (ex. « quand joue l'U18 ? »)" maxLength={500} />
        <button type="submit" className="btn accent" disabled={loading || !input.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}

function MetaBlock({ meta }: { meta: Meta }) {
  const totalIn = meta.usage.inputTokens + meta.usage.cacheReadTokens + meta.usage.cacheWriteTokens;
  return (
    <details className="meta">
      <summary>
        {meta.model} · {totalIn + meta.usage.outputTokens} tokens · {fmtUsd(meta.cost.usd)} · {fmtUsd(meta.cost.usdPerThousand)}/1k
      </summary>
      <div className="chips">
        <span className="chip">
          in <b>{totalIn}</b>
        </span>
        <span className="chip">
          out <b>{meta.usage.outputTokens}</b>
        </span>
        <span className="chip">
          cache <b>{meta.usage.cacheReadTokens}</b>
        </span>
        <span className="chip">
          outils <b>{meta.toolCalls.length}</b>
        </span>
      </div>
      {meta.toolCalls.length > 0 && (
        <div className="trace">
          {meta.toolCalls.map((t, i) => (
            <div key={i}>
              → {t.name}({JSON.stringify(t.input)})
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
