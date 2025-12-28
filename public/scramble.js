const connEl = document.getElementById("conn");
const whoEl = document.getElementById("who");
const scrEl = document.getElementById("scramble");
const btn = document.getElementById("btn");

function getDeviceId() {
  return localStorage.getItem("cubomatch_deviceId");
}

const deviceId = getDeviceId();
if (!deviceId) {
  whoEl.textContent = "Entre primeiro em /join.html neste celular.";
}

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let myId = null;
let myName = null;
let myJob = null;

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;

  // Descobre quem sou eu
  const me = (msg.competitors || []).find(c => c && c.name && c.id && c);
  const mine = (msg.competitors || []).find(c => c && c.id && c.name && c) && (msg.competitors || []).find(c => c.deviceId === deviceId);

  // Como o server não manda deviceId no STATE (por segurança),
  // a gente identifica “meu job” pela lista de jobs + meu dispositivo via REGISTER antes.
  // Então: simplificação: pega o primeiro job pending que está atribuído ao meu nome (por pareamento visível no telão)
  // => Melhor: o server mandar no STATE um campo "myId" por deviceId (vamos fazer isso depois).
  // Por ora, vamos achar o job pelo texto no telão:
  const competitors = msg.competitors || [];
  // Heurística: se eu entrei antes, meu nome fica salvo no localStorage opcionalmente.
});

btn.onclick = () => {
  if (!deviceId) return;
  if (!myJob) return;
  ws.send(JSON.stringify({ type: "CONFIRM_SCRAMBLE", jobId: myJob.id, deviceId }));
  btn.disabled = true;
};
