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

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === "ERROR" && msg.code === "NAME_TAKEN") {
    out.textContent = "❌ Esse nome já foi usado. Escolha outro.";
  }
});

btn.onclick = () => {
  const name = nameEl.value.trim();
  if (name.length < 2) {
    out.textContent = "Digite um nome com pelo menos 2 letras.";
    return;
  }
  ws.send(JSON.stringify({ type: "REGISTER", name, deviceId }));
  out.textContent = "✅ Pedido enviado. Se não der erro, você já está cadastrado.";
};
