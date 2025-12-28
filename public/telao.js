const connEl = document.getElementById("conn");
const listEl = document.getElementById("list");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener("open", () => connEl.textContent = "Online");
ws.addEventListener("close", () => connEl.textContent = "Offline");

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type !== "STATE") return;
  render(msg.competitors || []);
});

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return mm > 0 ? `${mm}:${pad2(ss)}.${pad2(cs)}` : `${ss}.${pad2(cs)}`;
}

function tagClass(live) {
  if (!live) return "";
  if (live.color === "red") return "tag red";
  if (live.color === "yellow") return "tag yellow";
  if (live.color === "green") return "tag green";
  if (live.status === "running") return "tag run";
  return "tag";
}

function tagText(live) {
  if (!live) return "";
  if (live.status === "handoff") return `ENTREGA ${Math.ceil(live.countdownMs/1000)}s`;
  if (live.color === "red") return `VERMELHO ${Math.ceil(live.countdownMs/1000)}s`;
  if (live.color === "yellow") return `AMARELO ${Math.ceil(live.countdownMs/1000)}s`;
  if (live.color === "green") return `VERDE ${Math.ceil(live.countdownMs/1000)}s`;
  if (live.status === "running") return `AO VIVO`;
  return "";
}

function render(competitors) {
  listEl.innerHTML = "";

  for (const c of competitors) {
    const live = c.live;

    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    top.style.gap = "10px";

    const left = document.createElement("div");
    left.innerHTML = `<span class="name">${escapeHtml(c.name)}</span>`;

    const tag = document.createElement("span");
    tag.className = tagClass(live);
    tag.textContent = tagText(live);

    const right = document.createElement("div");
    right.className = "live";
    right.textContent = (live && live.status === "running") ? live.timeText : "";

    top.appendChild(left);
    top.appendChild(tag);
    top.appendChild(right);

    const attempts = document.createElement("div");
    attempts.className = "attempts";

    for (let i = 0; i < 5; i++) {
      const chip = document.createElement("div");
      chip.className = "chip";
      const v = c.attempts?.[i];
      chip.textContent = v == null ? `Solve ${i+1}: —` : `Solve ${i+1}: ${formatMs(v)}`;
      attempts.appendChild(chip);
    }

    card.appendChild(top);
    card.appendChild(attempts);
    listEl.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
