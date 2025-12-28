const connEl = document.getElementById("conn");
const namesEl = document.getElementById("names");
const sel = document.getElementById("sel");

const btnSet = document.getElementById("btnSet");
const btnReset = document.getElementById("btnReset");
const btnArm = document.getElementById("btnArm");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

let competitors = [];

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;
  competitors = msg.competitors || [];
  renderSelect();
});

function send(type, extra = {}) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, ...extra }));
}

function renderSelect() {
  sel.innerHTML = "";
  for (const c of competitors) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  }
}

btnSet.onclick = () => {
  const lines = namesEl.value.split("\n").map(s => s.trim()).filter(Boolean);
  send("SET_COMPETITORS", { names: lines });
};

btnReset.onclick = () => send("RESET_ALL");

btnArm.onclick = () => {
  const id = sel.value;
  if (!id) return;
  send("ARM_SOLVE", { id });
};
