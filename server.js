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

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

// ====== Config ======
const SOLVES_PER_PERSON = 5;

// Tempo de “entrega + inspeção” antes do timer real
const HANDOFF_MS = 5000;      // entrega do cubo
const RED_MS = 8000;          // vermelho
const YELLOW_MS = 4000;       // amarelo (até 12)
const GREEN_MS = 3000;        // verde (até 15)
const INSPECTION_MS = RED_MS + YELLOW_MS + GREEN_MS; // 15000
const TOTAL_PRE_MS = HANDOFF_MS + INSPECTION_MS;     // 20000

// ====== Scramble simples (3x3) ======
function genScramble(len = 20) {
  const moves = ["R","L","U","D","F","B"];
  const suff = ["", "'", "2"];
  let out = [];
  let last = null;

  while (out.length < len) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    // evita repetição do mesmo eixo (ex.: R seguido de L ainda é eixo R/L)
    const axis = (x) => (x === "R" || x === "L") ? "x" : (x === "U" || x === "D") ? "y" : "z";
    if (last && axis(m) === axis(last)) continue;
    const s = suff[Math.floor(Math.random() * suff.length)];
    out.push(m + s);
    last = m;
  }
  return out.join(" ");
}

// ====== Estado do sistema ======
const state = {
  phase: "registration", // registration | approved | running
  competitors: [], // { id, name, deviceId, attempts[], running?, armedAt?, livePhase? }
  pairs: [],       // { aId, bId }
  scrambleJobs: [] // { id, scramblerId, solverId, attemptIndex, scramble, status: pending|confirmed }
};

// ====== Helpers de competidor ======
function findByDevice(deviceId) {
  return state.competitors.find(c => c.deviceId === deviceId);
}
function findById(id) {
  return state.competitors.find(c => c.id === id);
}
function nameTaken(name) {
  return state.competitors.some(c => c.name.toLowerCase() === name.toLowerCase());
}
function nextAttemptIndex(c) {
  for (let i = 0; i < SOLVES_PER_PERSON; i++) {
    if (c.attempts[i] == null) return i;
  }
  return null;
}

// ====== Rodada: formar pares e jobs ======
function buildPairsAndJobs() {
  state.pairs = [];
  state.scrambleJobs = [];

  const ids = state.competitors.map(c => c.id);
  for (let i = 0; i < ids.length; i += 2) {
    const aId = ids[i];
    const bId = ids[i + 1];
    if (!bId) break; // ímpar fica sem par por enquanto
    state.pairs.push({ aId, bId });
  }

  // Para TESTE: cria apenas o job da SOLVE 1 para cada pessoa (depois expandimos p/ 5)
  // Em cada dupla: A embaralha para B e B embaralha para A
  for (const p of state.pairs) {
    const a = findById(p.aId);
    const b = findById(p.bId);
    if (!a || !b) continue;

    const aIdx = nextAttemptIndex(a);
    const bIdx = nextAttemptIndex(b);
    if (aIdx != null) {
      state.scrambleJobs.push({
        id: `job-${p.bId}-${a.id}-${aIdx}-${now()}`,
        scramblerId: b.id,
        solverId: a.id,
        attemptIndex: aIdx,
        scramble: genScramble(),
        status: "pending"
      });
    }
    if (bIdx != null) {
      state.scrambleJobs.push({
        id: `job-${p.aId}-${b.id}-${bIdx}-${now()}`,
        scramblerId: a.id,
        solverId: b.id,
        attemptIndex: bIdx,
        scramble: genScramble(),
        status: "pending"
      });
    }
  }
}

// ====== Live / Timer por competidor ======
function getLiveInfo(c) {
  // armedAt = quando o embaralhador confirmou
  if (!c.armedAt) {
    return { status: "idle", color: "none", countdownMs: 0, timeText: null, timeMs: null };
  }

  const elapsed = now() - c.armedAt;

  // handoff
  if (elapsed < HANDOFF_MS) {
    return { status: "handoff", color: "none", countdownMs: HANDOFF_MS - elapsed, timeText: null, timeMs: null };
  }

  const insp = elapsed - HANDOFF_MS;
  if (insp < RED_MS) {
    return { status: "inspect", color: "red", countdownMs: RED_MS - insp, timeText: null, timeMs: null };
  }
  if (insp < RED_MS + YELLOW_MS) {
    return { status: "inspect", color: "yellow", countdownMs: (RED_MS + YELLOW_MS) - insp, timeText: null, timeMs: null };
  }
  if (insp < INSPECTION_MS) {
    return { status: "inspect", color: "green", countdownMs: INSPECTION_MS - insp, timeText: null, timeMs: null };
  }

  // Timer real começa após 20s totais
  const tsolve = elapsed - TOTAL_PRE_MS;
  if (tsolve < 0) {
    return { status: "inspect", color: "green", countdownMs: 1, timeText: null, timeMs: null };
  }

  // Se ainda não criou running, cria agora
  if (!c.running) {
    const idx = c.activeAttemptIndex;
    if (idx == null) {
      c.armedAt = null;
      return { status: "idle", color: "none", countdownMs: 0, timeText: null, timeMs: null };
    }
    c.running = { startedAt: now(), elapsedMs: 0 };
  }

  const timeMs = c.running.elapsedMs + (now() - c.running.startedAt);
  return { status: "running", color: "running", countdownMs: 0, timeText: formatMs(timeMs), timeMs };
}

// ====== Broadcast ======
function broadcast() {
  const payload = {
    type: "STATE",
    phase: state.phase,
    competitors: state.competitors.map(c => ({
      id: c.id,
      name: c.name,
      attempts: c.attempts,
      live: getLiveInfo(c),
      // pra UI mostrar quem está no mesmo par:
      pair: state.pairs.find(p => p.aId === c.id || p.bId === c.id) || null
    })),
    pairs: state.pairs,
    scrambleJobs: state.scrambleJobs
  };

  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ====== WebSocket ======
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "HELLO" }));
  ws.send(JSON.stringify({
    type: "STATE",
    phase: state.phase,
    competitors: state.competitors.map(c => ({
      id: c.id,
      name: c.name,
      attempts: c.attempts,
      live: getLiveInfo(c),
      pair: state.pairs.find(p => p.aId === c.id || p.bId === c.id) || null
    })),
    pairs: state.pairs,
    scrambleJobs: state.scrambleJobs
  }));

  ws.on("message", (data) => {
    const msg = safeJson(String(data));
    if (!msg || !msg.type) return;

    // ===== Competidor se registra =====
    if (msg.type === "REGISTER") {
      if (state.phase !== "registration") return;

      const name = (msg.name || "").toString().trim();
      const deviceId = (msg.deviceId || "").toString().trim();
      if (!name || name.length < 2 || name.length > 40) return;
      if (!deviceId || deviceId.length < 6) return;

      // se device já registrado, não cria outro
      const existing = findByDevice(deviceId);
      if (existing) return;

      // sem duplicidade por nome
      if (nameTaken(name)) {
        ws.send(JSON.stringify({ type: "ERROR", code: "NAME_TAKEN", message: "Nome já usado" }));
        return;
      }

      const id = `c${state.competitors.length + 1}-${Math.random().toString(16).slice(2, 6)}`;
      state.competitors.push({
        id,
        name,
        deviceId,
        attempts: Array(SOLVES_PER_PERSON).fill(null),
        armedAt: null,
        activeAttemptIndex: null,
        running: null
      });
      broadcast();
    }

    // ===== Admin aprova lista (fecha cadastro) =====
    if (msg.type === "APPROVE_ROSTER") {
      if (state.competitors.length < 2) return;
      state.phase = "approved";
      buildPairsAndJobs();
      broadcast();
    }

    // ===== Admin inicia rodada (libera embaralhamento) =====
    if (msg.type === "START_ROUND") {
      if (state.phase !== "approved") return;
      state.phase = "running";
      broadcast();
    }

    // ===== Embaralhador confirma que embaralhou =====
    if (msg.type === "CONFIRM_SCRAMBLE") {
      if (state.phase !== "running") return;

      const jobId = (msg.jobId || "").toString();
      const deviceId = (msg.deviceId || "").toString();
      const scrambler = findByDevice(deviceId);
      if (!scrambler) return;

      const job = state.scrambleJobs.find(j => j.id === jobId);
      if (!job) return;
      if (job.status !== "pending") return;
      if (job.scramblerId !== scrambler.id) return;

      const solver = findById(job.solverId);
      if (!solver) return;

      // arma o solver para começar a sequência de cores
      solver.activeAttemptIndex = job.attemptIndex;
      solver.armedAt = now();
      solver.running = null;

      job.status = "confirmed";
      broadcast();
    }

    // ===== Solver dá PAUSE (só dele) =====
    if (msg.type === "PAUSE") {
      if (state.phase !== "running") return;

      const deviceId = (msg.deviceId || "").toString();
      const solver = findByDevice(deviceId);
      if (!solver) return;

      const live = getLiveInfo(solver);
      if (live.status !== "running" || !solver.running) return;

      const finalMs = solver.running.elapsedMs + (now() - solver.running.startedAt);
      const idx = solver.activeAttemptIndex;

      if (idx == null) return;

      solver.attempts[idx] = finalMs;
      solver.running = null;
      solver.armedAt = null;
      solver.activeAttemptIndex = null;

      // (depois: aqui a gente cria o próximo job automaticamente para SOLVE 2…5)
      broadcast();
    }

    // ===== Reset geral (se precisar) =====
    if (msg.type === "RESET_ALL") {
      state.phase = "registration";
      state.competitors = [];
      state.pairs = [];
      state.scrambleJobs = [];
      broadcast();
    }
  });
});

// Broadcast “ao vivo” quando alguém estiver ativo
setInterval(() => {
  const anyActive = state.competitors.some(c => c.armedAt || c.running);
  if (anyActive) broadcast();
}, 150);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("CuboMatch PWA rodando na porta", PORT));
