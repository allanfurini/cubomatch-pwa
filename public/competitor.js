const connEl = document.getElementById("conn");
const sel = document.getElementById("sel");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const bar = document.getElementById("bar");
const btnPause = document.getElementById("btnPause");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let competitors = [];
let myId = null;

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;

  competitors = msg.competitors || [];
  renderSelect();

  const me = competitors.find(c => c.id === myId) || null;
  updateMe(me);
});

function send(type, extra = {}) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, ...extra }));
}

function renderSelect() {
  const current = sel.value || myId || "";
  sel.innerHTML = "";

  for (const c of competitors) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  }

  // tenta manter seleção
  if (current) sel.value = current;

  myId = sel.value || (competitors[0]?.id ?? null);
}

sel.addEventListener("change", () => {
  myId = sel.value;
});

btnPause.onclick = () => {
  if (!myId) return;
  send("PAUSE", { id: myId });
};

function setBar(color) {
  if (color === "red") bar.style.background = "#ff3355";
  else if (color === "yellow") bar.style.background = "#ffd54a";
  else if (color === "green") bar.style.background = "#4cff88";
  else if (color === "running") bar.style.background = "#66aaff";
  else bar.style.background = "#222";
}

function updateMe(me) {
  if (!me || !me.live) {
    timeEl.textContent = "—";
    statusEl.textContent = "Aguardando liberação do embaralhador";
    setBar("none");
    btnPause.disabled = true;
    return;
  }

  const live = me.live;

  if (live.status === "handoff") {
    timeEl.textContent = "—";
    statusEl.textContent = `Entrega do cubo: ${Math.ceil(live.countdownMs/1000)}s`;
    setBar("none");
    btnPause.disabled = true;
    return;
  }

  if (live.color === "red") {
    timeEl.textContent = "—";
    statusEl.textContent = `Vermelho (inspeção): ${Math.ceil(live.countdownMs/1000)}s`;
    setBar("red");
    btnPause.disabled = true;
    return;
  }

  if (live.color === "yellow") {
    timeEl.textContent = "—";
    statusEl.textContent = `Amarelo (inspeção): ${Math.ceil(live.countdownMs/1000)}s`;
    setBar("yellow");
    btnPause.disabled = true;
    return;
  }

  if (live.color === "green") {
    timeEl.textContent = "—";
    statusEl.textContent = `Verde (inspeção): ${Math.ceil(live.countdownMs/1000)}s`;
    setBar("green");
    btnPause.disabled = true;
    return;
  }

  if (live.status === "running") {
    timeEl.textContent = live.timeText;
    statusEl.textContent = "Tempo rodando… termine e aperte PAUSE";
    setBar("running");
    btnPause.disabled = false;
    return;
  }

  timeEl.textContent = "—";
  statusEl.textContent = "Aguardando liberação do embaralhador";
  setBar("none");
  btnPause.disabled = true;
}
