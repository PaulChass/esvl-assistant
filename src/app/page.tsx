"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type Vendor = "anthropic" | "google";

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
interface Cost {
  usd: number;
  usdPerThousand: number;
}
interface Trace {
  name: string;
  input: Record<string, unknown>;
}
interface Meta {
  model: string;
  usage: Usage;
  cost: Cost;
  toolCalls: Trace[];
}
interface Message {
  role: "user" | "assistant";
  text: string;
  meta?: Meta;
}

const SUGGESTIONS = [
  "Quand joue l'équipe 1 ?",
  "Les prochains matchs du club ce week-end ?",
  "Classement des seniors ?",
  "Où joue l'U18 au prochain match ?",
];

/** Turn bare URLs in assistant text into links. */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function fmtUsd(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(3)}`;
}

export default function Home() {
  const [vendor, setVendor] = useState<Vendor>("anthropic");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
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
      if (!res.ok) {
        setError(data.error ?? "Erreur inattendue.");
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.answer,
            meta: { model: data.model, usage: data.usage, cost: data.cost, toolCalls: data.toolCalls },
          },
        ]);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          Assistant <span className="accent">ESVL</span> Basket
        </h1>
        <p className="sub">// matchs, résultats & classements · données publiques FFBB</p>
      </header>

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
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question (ex. « quand joue l'U18 ? »)"
          maxLength={500}
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Envoyer
        </button>
      </form>

      <footer className="footer">
        Assistant non officiel, non affilié à la FFBB. Données publiques FFBB, mises en cache. Projet de démonstration.
      </footer>
    </div>
  );
}

function MetaBlock({ meta }: { meta: Meta }) {
  const totalIn = meta.usage.inputTokens + meta.usage.cacheReadTokens + meta.usage.cacheWriteTokens;
  return (
    <details className="meta">
      <summary>
        {meta.model} · {totalIn + meta.usage.outputTokens} tokens · {fmtUsd(meta.cost.usd)} ·{" "}
        {fmtUsd(meta.cost.usdPerThousand)}/1k questions
      </summary>
      <div className="chips">
        <span className="chip">
          in <b>{totalIn}</b>
        </span>
        <span className="chip">
          out <b>{meta.usage.outputTokens}</b>
        </span>
        <span className="chip">
          cache read <b>{meta.usage.cacheReadTokens}</b>
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
