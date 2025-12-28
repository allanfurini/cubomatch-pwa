const connEl = document.getElementById("conn");
const meNameEl = document.getElementById("meName");
const screenEl = document.getElementById("screen");
const phaseEl = document.getElementById("phaseText");
const countdownEl = document.getElementById("countdown");
const timerEl = document.getElementById("timer");
const pauseBtn = document.getElementById("pauseBtn");
const hintEl = document.getElementById("hint");

function getDeviceId() {
  return localStorage.getItem("cubomatch_deviceId");
}
const deviceId = getDeviceId();

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let myId = null;
let lastState = null;

function setScreenClass(kind) {
  screenEl.classList.remove("red","yellow","green","neutral");
  if (kind === "red") screenEl.classList.add("red");
  else if (kind === "yellow") screenEl.classList.add("yellow");
  else if (kind === "green") screenEl.classList.add("green");
  else screenEl.classList.add("neutral");
}

function render() {
  if (!lastState) return;

  if (!deviceId) {
    meNameEl.textContent = "Entre primeiro em /join.html neste celular.";
    phaseEl.textContent = "Aguardando…";
    timerEl.textContent = "0.00";
    countdownEl.textContent = "";
    hintEl.textContent = "";
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  if (!myId) {
    meNameEl.textContent = "Identificando…";
    phaseEl.textContent = "Aguardando…";
    timerEl.textContent = "0.00";
    countdownEl.textContent = "";
    hintEl.textContent = "Se não entrou, vá em /join.html";
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  const me = (lastState.competitors || []).find(c => c.id === myId);
  if (!me) {
    meNameEl.textContent = "Você não está cadastrado nesta rodada.";
    hintEl.textContent = "Vá em /join.html e entre com um nome.";
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  meNameEl.textContent = me.name;

  if (lastState.phase !== "running") {
    phaseEl.textContent = "Aguardando o Admin iniciar…";
    timerEl.textContent = "0.00";
    countdownEl.textContent = "";
    hintEl.textContent = `Fase: ${lastState.phase}`;
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  const live = me.live || { status: "idle", color: "none" };

  if (live.status === "idle") {
    phaseEl.textContent = "Aguardando scramble do seu par…";
    timerEl.textContent = "0.00";
    countdownEl.textContent = "";
    hintEl.textContent = "Quando seu par confirmar o embaralhamento, as cores começam.";
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  if (live.status === "handoff") {
    phaseEl.textContent = "Recebendo cubo…";
    timerEl.textContent = "0.00";
    countdownEl.textContent = `Entrega: ${(live.countdownMs/1000).toFixed(1)}s`;
    hintEl.textContent = "Pegue o cubo quando receber.";
    pauseBtn.disabled = true;
    setScreenClass("neutral");
    return;
  }

  if (live.status === "inspect") {
    phaseEl.textContent = "Inspeção";
    timerEl.textContent = "0.00";
    countdownEl.textContent = `Começa em: ${(live.countdownMs/1000).toFixed(1)}s`;
    hintEl.textContent = "Você pode olhar o cubo. O timer real inicia sozinho.";
    pauseBtn.disabled = true;

    if (live.color === "red") setScreenClass("red");
    else if (live.color === "yellow") setScreenClass("yellow");
    else if (live.color === "green") setScreenClass("green");
    else setScreenClass("neutral");
    return;
  }

  if (live.status === "running") {
    phaseEl.textContent = "RESOLVENDO";
    timerEl.textContent = live.timeText || "0.00";
    countdownEl.textContent = "";
    hintEl.textContent = "Quando terminar, aperte PAUSE.";
    pauseBtn.disabled = false;
    setScreenClass("neutral");
    return;
  }
}

ws.addEventListener("open", () => {
  connEl.textContent = "Online";
  if (deviceId) ws.send(JSON.stringify({ type: "IDENTIFY", deviceId }));
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

pauseBtn.onclick = () => {
  if (!deviceId) return;
  pauseBtn.disabled = true;
  ws.send(JSON.stringify({ type: "PAUSE", deviceId }));
};
