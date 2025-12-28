const connEl = document.getElementById("conn");
const nameEl = document.getElementById("name");
const out = document.getElementById("out");
const btn = document.getElementById("btn");

function getDeviceId() {
  let id = localStorage.getItem("cubomatch_deviceId");
  if (!id) {
    id = "dev-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
    localStorage.setItem("cubomatch_deviceId", id);
  }
  return id;
}
const deviceId = getDeviceId();

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let myId = null;

ws.addEventListener("open", () => {
  connEl.textContent = "Online";
  ws.send(JSON.stringify({ type: "IDENTIFY", deviceId }));
});
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);

  if (msg.type === "ME") {
    myId = msg.myId;
  }

  if (msg.type === "ERROR" && msg.code === "NAME_TAKEN") {
    out.innerHTML = `<span class="bad">❌ Esse nome já foi usado. Escolha outro.</span>`;
  }
});

btn.onclick = () => {
  const name = nameEl.value.trim();
  if (name.length < 2) {
    out.innerHTML = `<span class="bad">Digite um nome com pelo menos 2 letras.</span>`;
    return;
  }

  ws.send(JSON.stringify({ type: "REGISTER", name, deviceId }));
  out.innerHTML = `<span class="ok">✅ Enviado. Se não aparecer erro, você está cadastrado.</span>`;
};
