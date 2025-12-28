const connEl = document.getElementById("conn");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");

const rowsEl = document.getElementById("rows"); // só existe no telão
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnClear = document.getElementById("btnClear");

const btnPause = document.getElementById("btnPause");
const nameInput = document.getElementById("name");

// Conexão WS para o mesmo host do site
const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener("open", () => {
  if (connEl) connEl.textContent = "Online";
});

ws.addEventListener("close", () => {
  if (connEl) connEl.textContent = "Offline";
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;

  if (timeEl) timeEl.textContent = msg.timeText;
  if (statusEl) statusEl.textContent = `Status: ${msg.status}`;

  if (rowsEl) {
    rowsEl.innerHTML = "";
    for (const r of msg.results) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      const td2 = document.createElement("td");
      td1.textContent = r.name;
      td2.textContent = formatMs(r.timeMs);
      tr.appendChild(td1);
      tr.appendChild(td2);
      rowsEl.appendChild(tr);
    }
  }
});

function send(type, extra = {}) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, ...extra }));
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

// Botões do TELÃO
if (btnStart) btnStart.onclick = () => send("START");
if (btnReset) btnReset.onclick = () => send("RESET");
if (btnClear) btnClear.onclick = () => send("CLEAR_RESULTS");

// Botão do COMPETIDOR
if (btnPause) {
  btnPause.onclick = () => {
    const name = (nameInput?.value || "Sem nome").trim() || "Sem nome";
    send("PAUSE", { name });
  };
}

