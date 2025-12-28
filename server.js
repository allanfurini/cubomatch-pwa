import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

function now() { return Date.now(); }
function safeJson(str) { try { return JSON.parse(str); } catch { return null; } }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

// ===== Config da rodada =====
const SOLVES_PER_PERSON = 5;

// ===== Estado =====
const state = {
  competitors: [], // [{ id, name, attempts: [null|timeMs], running: {...}|null, phase: {...}|null }]
};

// running: { attemptIndex, startedAt, elapsedMs }
// phase: { armedAt, stage }  stage: "handoff"|"red"|"yellow"|"green"|"running"

function ensureCompetitor(id) {
  return state.competitors.find(c => c.id === id);
}

function broadcast() {
  const payload = {
    type: "STATE",
    competitors: state.competitors.map(c => {
      const live = getLiveInfo(c);
      return {
        id: c.id,
        name: c.name,
        attempts: c.attempts,
        live
      };
    })
  };

  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function getLiveInfo(c) {
  // Retorna info do que está acontecendo AGORA (fase/tempo correndo)
  if (!c.phase) {
    return { status: "idle", color: "none", countdownMs: 0, timeMs: null, timeText: null };
  }

  const t = now();
  const elapsed = t - c.phase.armedAt;

  // 5s handoff + 15s total até começar (cores contam dentro dos 15 após handoff)
  // Modelo: primeiro handoff 5s. Depois cores até completar 15s adicionais.
  // total até iniciar solve = 5 + 15 = 20s.
  const handoffMs = 5000;
  const colorTotalMs = 15000;

  if (elapsed < handoffMs) {
    return {
      status: "handoff",
      color: "none",
      countdownMs: handoffMs - elapsed,
      timeMs: null,
      timeText: null
    };
  }

  const colorElapsed = elapsed - handoffMs;

  if (colorElapsed < 8000) {
    return {
      status: "inspect",
      color: "red",
      countdownMs: 8000 - colorElapsed,
      timeMs: null,
      timeText: null
    };
  }
  if (colorElapsed < 12000) {
    return {
      status: "inspect",
      color: "yellow",
      countdownMs: 12000 - colorElapsed,
      timeMs: null,
      timeText: null
    };
  }
  if (colorElapsed < colorTotalMs) {
    return {
      status: "inspect",
      color: "green",
      countdownMs: colorTotalMs - colorElapsed,
      timeMs: null,
      timeText: null
    };
  }

  // Começou o solve real
  if (!c.running) {
    // inicia automaticamente
    const attemptIndex = nextAttemptIndex(c);
    if (attemptIndex === null) {
      // já completou 5 solves
      c.phase = null;
      return { status: "idle", color: "none", countdownMs: 0, timeMs: null, timeText: null };
    }
    c.running = { attemptIndex, startedAt: now(), elapsedMs: 0 };
  }

  const timeMs = c.running.elapsedMs + (now() - c.running.startedAt);
  return {
    status: "running",
    color: "running",
    countdownMs: 0,
    timeMs,
    timeText: formatMs(timeMs)
  };
}

function nextAttemptIndex(c) {
  for (let i = 0; i < SOLVES_PER_PERSON; i++) {
    if (c.attempts[i] == null) return i;
  }
  return null;
}

// ===== WS =====
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({
    type: "STATE",
    competitors: state.competitors.map(c => ({
      id: c.id,
      name: c.name,
      attempts: c.attempts,
      live: getLiveInfo(c)
    }))
  }));

  ws.on("message", (data) => {
    const msg = safeJson(String(data));
    if (!msg || !msg.type) return;

    // ADMIN cadastra lista
    if (msg.type === "SET_COMPETITORS") {
      const names = Array.isArray(msg.names) ? msg.names : [];
      const clean = names
        .map(s => (s || "").toString().trim())
        .filter(s => s.length > 0)
        .slice(0, 300);

      state.competitors = clean.map((name, idx) => ({
        id: `c${idx + 1}`,
        name,
        attempts: Array(SOLVES_PER_PERSON).fill(null),
        phase: null,
        running: null
      }));
      broadcast();
    }

    // ADMIN libera/arma um competidor (equivale: scramble validado, foto ok)
    if (msg.type === "ARM_SOLVE") {
      const id = (msg.id || "").toString();
      const c = ensureCompetitor(id);
      if (!c) return;

      // se já está rodando, ignora
      if (c.running) return;

      // se já completou 5 solves, ignora
      if (nextAttemptIndex(c) === null) return;

      c.phase = { armedAt: now() }; // o resto é calculado por tempo
      broadcast();
    }

    // COMPETIDOR pausa (só o dele)
    if (msg.type === "PAUSE") {
      const id = (msg.id || "").toString();
      const c = ensureCompetitor(id);
      if (!c) return;

      // só pode pausar se estiver realmente rodando
      const live = getLiveInfo(c);
      if (live.status !== "running" || !c.running) return;

      const finalMs = c.running.elapsedMs + (now() - c.running.startedAt);
      const idx = c.running.attemptIndex;

      c.attempts[idx] = finalMs;
      c.running = null;
      c.phase = null;

      broadcast();
    }

    // ADMIN reset geral (opcional)
    if (msg.type === "RESET_ALL") {
      for (const c of state.competitors) {
        c.attempts = Array(SOLVES_PER_PERSON).fill(null);
        c.phase = null;
        c.running = null;
      }
      broadcast();
    }
  });
});

// Tick: atualiza telão “ao vivo”
setInterval(() => {
  // só broadcast se tiver alguém em fase/rodando
  const anyActive = state.competitors.some(c => c.phase || c.running);
  if (anyActive) broadcast();
}, 150);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("CuboMatch PWA rodando na porta", PORT));
