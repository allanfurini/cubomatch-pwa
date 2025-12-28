const connEl = document.getElementById("conn");
const phaseEl = document.getElementById("phase");
const listEl = document.getElementById("list");
const btnApprove = document.getElementById("btnApprove");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;

  phaseEl.textContent = msg.phase;

  listEl.innerHTML = "";
  for (const c of (msg.competitors || [])) {
    const li = document.createElement("li");
    li.textContent = c.name;
    listEl.appendChild(li);
  }
});

function send(type) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type }));
}

btnApprove.onclick = () => send("APPROVE_ROSTER");
btnStart.onclick = () => send("START_ROUND");
btnReset.onclick = () => send("RESET_ALL");
