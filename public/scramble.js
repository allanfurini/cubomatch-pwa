const connEl = document.getElementById("conn");
const statusEl = document.getElementById("status");
const targetEl = document.getElementById("target");
const scrEl = document.getElementById("scramble");
const btn = document.getElementById("btn");
const msgEl = document.getElementById("msg");

function getDeviceId() {
  return localStorage.getItem("cubomatch_deviceId");
}
const deviceId = getDeviceId();

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let myId = null;
let lastState = null;
let myJob = null;

function setWaiting(text) {
  statusEl.textContent = text;
  targetEl.textContent = "—";
  scrEl.textContent = "—";
  btn.disabled = true;
  myJob = null;
}

function render() {
  if (!lastState) return;

  if (!deviceId) {
    setWaiting("Entre primeiro em /join.html neste celular.");
    msgEl.textContent = "";
    return;
  }

  if (lastState.phase !== "running") {
    setWaiting("Aguardando o Admin iniciar a rodada…");
    msgEl.textContent = `Fase atual: ${lastState.phase}`;
    return;
  }

  if (!myId) {
    setWaiting("Identificando seu cadastro…");
    msgEl.textContent = "Se você ainda não entrou, vá em /join.html";
    return;
  }

  const jobs = lastState.scrambleJobs || [];
  const competitors = lastState.competitors || [];

  const pending = jobs.find(j => j.scramblerId === myId && j.status === "pending");

  if (!pending) {
    setWaiting("Sem scramble pendente pra você agora.");
    msgEl.textContent = "Quando seu par precisar de solve, vai aparecer aqui.";
    return;
  }

  myJob = pending;
  const solver = competitors.find(c => c.id === pending.solverId);

  statusEl.textContent = "Pronto para embaralhar!";
  targetEl.textContent = solver ? solver.name : pending.solverId;
  scrEl.textContent = pending.scramble;
  btn.disabled = false;
  msgEl.textContent = "Quando terminar, clique em CONFIRMAR. O cronômetro do seu par vai iniciar sozinho.";
}

ws.addEventListener("open", () => {
  connEl.textContent = "Online";
  if (deviceId) {
    ws.send(JSON.stringify({ type: "IDENTIFY", deviceId }));
  } else {
    setWaiting("Entre primeiro em /join.html neste celular.");
  }
});
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);

  if (msg.type === "ME") {
    myId = msg.myId;
    render();
    return;
  }

  if (msg.type === "STATE") {
    lastState = msg;
    render();
    return;
  }
});

btn.onclick = () => {
  if (!deviceId || !myJob) return;
  btn.disabled = true;
  ws.send(JSON.stringify({ type: "CONFIRM_SCRAMBLE", jobId: myJob.id, deviceId }));
  msgEl.textContent = "✅ Confirmado. Agora o solver recebe as cores e depois o timer real.";
};
