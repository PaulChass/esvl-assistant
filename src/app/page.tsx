"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Recap } from "@/lib/brief/recap";
import type { Weekend, WeekendFixture } from "@/lib/brief/weekend";

const DEFAULT_ORG = "10135"; // ES Villeneuve-Loubet Basket (pilot club)

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
      /* cancelled or unsupported → fall through to WhatsApp */
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
      <header className="header">
        <h1>
          Assistant <span className="accent">ESVL</span> Basket
        </h1>
        <p className="sub">// brief du week-end · résultats · assistant — données publiques FFBB</p>
      </header>

      <nav className="tabs" role="tablist">
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
  if (!data) return <div className="loading">Chargement des rencontres…</div>;

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
    <div className={`fixture${fx.thisWeekend ? " soon" : ""}`}>
      <div className="fx-top">
        <span className="fx-team">{fx.team}</span>
        <span className={`badge-ha ${fx.homeAway === "domicile" ? "home" : "away"}`}>
          {fx.homeAway === "domicile" ? "domicile" : "extérieur"}
        </span>
        {fx.thisWeekend && <span className="tag-soon">● ce week-end</span>}
      </div>
      <div className="fx-vs">vs {fx.opponent}</div>
      <div className="fx-meta">
        {[fx.dateLabel, fx.timeLabel && `à ${fx.timeLabel}`, fx.venue && `· ${fx.venue}${fx.venueCity ? ` (${fx.venueCity})` : ""}`]
          .filter(Boolean)
          .join(" ")}
      </div>
      <div className="fx-actions">
        <button className="btn primary" onClick={() => shareText(fx.message, org, fx.code)}>
          Partager
        </button>
        <button className="btn" onClick={copy}>
          {copied ? "Copié !" : "Copier"}
        </button>
        <button className="btn link" onClick={() => setOpen((o) => !o)}>
          {open ? "Masquer" : "Voir le message"}
        </button>
      </div>
      {open && <pre className="msg-pre">{fx.message}</pre>}
    </div>
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
  if (!data) return <div className="loading">Chargement des résultats…</div>;

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
      <pre className="msg-pre">{data.post}</pre>
      <div className="recap-actions">
        <button className="btn primary" onClick={() => shareText(data.post, org)}>
          Partager
        </button>
        <button className="btn" onClick={copy}>
          {copied ? "Copié !" : "Copier le post"}
        </button>
        <button className="btn" onClick={() => downloadRecapImage(data.post, data.club)}>
          Télécharger l'image
        </button>
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
  ctx.fillStyle = "#ff7a1a";
  ctx.fillRect(0, 0, width, 12);
  ctx.textBaseline = "top";
  let y = pad;
  lines.forEach((ln, i) => {
    ctx.font = i === 0 ? '700 42px "IBM Plex Mono", monospace' : '400 30px "IBM Plex Mono", monospace';
    ctx.fillStyle = i === 0 ? "#ff7a1a" : "#e7ecf2";
    ctx.fillText(ln, pad, y);
    y += lineH;
  });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `resultats-${club.toLowerCase().replace(/\s+/g, "-")}.png`;
  a.click();
}

/* ---------- chat (item ③ — interview showcase, not the adoption engine) ---------- */

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
      <div className="toolbar">
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
              <button key={s} onClick={() => send(s)}>
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
        <button type="submit" disabled={loading || !input.trim()}>
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
