const connEl = document.getElementById("conn");
const phaseEl = document.getElementById("phase");
const gridEl = document.getElementById("grid");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

function liveText(live) {
  if (!live) return "—";
  if (live.status === "idle") return "Aguardando…";
  if (live.status === "handoff") return `Entrega: ${(live.countdownMs/1000).toFixed(1)}s`;
  if (live.status === "inspect") return `Inspeção (${live.color}) ${(live.countdownMs/1000).toFixed(1)}s`;
  if (live.status === "running") return live.timeText || "0.00";
  return "—";
}

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;

  phaseEl.textContent = `fase: ${msg.phase}`;

  const competitors = msg.competitors || [];
  const pairs = msg.pairs || [];

  const pairOf = (id) => pairs.find(p => p.aId === id || p.bId === id);

  gridEl.innerHTML = "";

  for (const c of competitors) {
    const p = pairOf(c.id);
    const otherId = p ? (p.aId === c.id ? p.bId : p.aId) : null;
    const other = otherId ? competitors.find(x => x.id === otherId) : null;

    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "toprow";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = other ? `Par: ${other.name}` : "Sem par";

    top.appendChild(name);
    top.appendChild(badge);

    const live = document.createElement("div");
    live.className = "live";
    live.textContent = liveText(c.live);

    const pairLine = document.createElement("div");
    pairLine.className = "pair";
    pairLine.textContent = other ? `Você faz/recebe scramble com ${other.name}` : "Aguardando par…";

    const solves = document.createElement("div");
    solves.className = "solves";
    for (let i = 0; i < 5; i++) {
      const cell = document.createElement("div");
      cell.className = "solve";
      const v = c.attempts?.[i];
      cell.innerHTML = v == null ? `<span class="muted">S${i+1}</span><br/>—` : `<span class="muted">S${i+1}</span><br/>${formatMs(v)}`;
      solves.appendChild(cell);
    }

    card.appendChild(top);
    card.appendChild(pairLine);
    card.appendChild(live);
    card.appendChild(solves);

    gridEl.appendChild(card);
  }
});
