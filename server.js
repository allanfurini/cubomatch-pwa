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

// ===== Estado do “campeonato” (MVP simples) =====
const state = {
  status: "idle", // idle | running | paused
  startedAt: null, // timestamp ms
  elapsedMs: 0, // tempo acumulado se pausar
  lastBroadcastAt: 0,
  results: [] // { name, timeMs, at }
};

// ===== Helpers =====
function now() { return Date.now(); }

function currentTimeMs() {
  if (state.status === "running" && state.startedAt) {
    return state.elapsedMs + (now() - state.startedAt);
  }
  return state.elapsedMs;
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10); // centésimos
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

function broadcast() {
  const payload = {
    type: "STATE",
    status: state.status,
    timeMs: currentTimeMs(),
    timeText: formatMs(currentTimeMs()),
    results: state.results.slice(-20).reverse() // últimos 20
  };
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ===== Rotas web =====
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

// ===== WebSocket =====
wss.on("connection", (ws) => {
  // manda estado na hora que conecta
  ws.send(JSON.stringify({
    type: "STATE",
    status: state.status,
    timeMs: currentTimeMs(),
    timeText: formatMs(currentTimeMs()),
    results: state.results.slice(-20).reverse()
  }));

  ws.on("message", (data) => {
    const msg = safeJson(String(data));
    if (!msg || !msg.type) return;

    // Iniciar (servidor controla o start)
    if (msg.type === "START") {
      if (state.status === "idle" || state.status === "paused") {
        state.status = "running";
        state.startedAt = now();
        broadcast();
      }
    }

    // Pausar (competidor envia PAUSE)
    if (msg.type === "PAUSE") {
      if (state.status === "running") {
        state.elapsedMs = currentTimeMs();
        state.startedAt = null;
        state.status = "paused";

        const name = (msg.name || "Sem nome").toString().slice(0, 40);
        state.results.push({ name, timeMs: state.elapsedMs, at: now() });

        broadcast();
      }
    }

    // Resetar (zera cronômetro)
    if (msg.type === "RESET") {
      state.status = "idle";
      state.startedAt = null;
      state.elapsedMs = 0;
      broadcast();
    }

    // Limpar resultados (opcional pro MVP)
    if (msg.type === "CLEAR_RESULTS") {
      state.results = [];
      broadcast();
    }
  });
});

// ===== Broadcast “ao vivo” (telão atualiza fluido) =====
setInterval(() => {
  if (state.status === "running") {
    // limita broadcast para não lotar rede
    if (now() - state.lastBroadcastAt > 100) {
      state.lastBroadcastAt = now();
      broadcast();
    }
  }
}, 50);

// Render usa PORT automaticamente
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("CuboMatch PWA rodando na porta", PORT);
});

