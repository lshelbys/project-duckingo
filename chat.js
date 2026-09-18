const SIDEBAR_KEY = "duckingo.sidebarCollapsed";
const CHAT_API = "https://duckingo-chat.shelbys-f3d.workers.dev/chat";
const app = document.getElementById("app");
const menuBtn = document.getElementById("menu-btn");
const sidebarToggle = document.getElementById("sidebar-toggle");
const thread = document.getElementById("chat-thread");
const inner = document.getElementById("chat-inner");
const empty = document.getElementById("empty-state");
const form = document.getElementById("composer");
const input = document.getElementById("composer-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");

const history = [];
let busy = false;

function autosize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function setSendEnabled() {
  sendBtn.disabled = busy || !input.value.trim();
}

function hideEmpty() {
  if (empty) empty.remove();
}

function scrollThread() {
  thread.scrollTop = thread.scrollHeight;
}

function bubble(role, html, typing = false) {
  const row = document.createElement("article");
  row.className = `msg msg--${role}`;
  row.innerHTML = `
    <span class="msg__avatar" aria-hidden="true">${role === "assistant" ? "D" : "You"}</span>
    <div class="msg__stack">
      <p class="msg__who">${role === "assistant" ? "Duckingo" : "You"}</p>
      <div class="msg__bubble">${html}</div>
    </div>
  `;
  if (typing) row.dataset.typing = "true";
  inner.appendChild(row);
  scrollThread();
  return row;
}

function setBubbleText(body, text) {
  body.replaceChildren();
  const chunks = String(text).trim() ? String(text).split(/\n{2,}/) : ["No reply."];
  for (const chunk of chunks) {
    const p = document.createElement("p");
    p.textContent = chunk;
    body.appendChild(p);
  }
}

async function askGemini(messages) {
  const res = await fetch(CHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error || `Chat failed (${res.status})`);
  }
  if (!data.text) {
    throw new Error("Empty Gemini reply");
  }
  return data.text;
}

async function send(text) {
  const value = text.trim();
  if (!value || busy) return;
  hideEmpty();
  busy = true;
  setSendEnabled();

  const userRow = bubble("user", "<p></p>");
  userRow.querySelector(".msg__bubble p").textContent = value;
  history.push({ role: "user", text: value });
  input.value = "";
  autosize();
  setSendEnabled();

  const pending = bubble(
    "assistant",
    `<p class="typing" aria-label="Duckingo is composing"><span></span><span></span><span></span></p>`,
    true,
  );
  const body = pending.querySelector(".msg__bubble");

  try {
    const reply = await askGemini(history);
    setBubbleText(body, reply);
    history.push({ role: "assistant", text: reply });
  } catch (error) {
    setBubbleText(body, error instanceof Error ? error.message : "Chat failed.");
  } finally {
    delete pending.dataset.typing;
    busy = false;
    setSendEnabled();
    scrollThread();
    input.focus();
  }
}

function applySidebar(collapsed) {
  app.classList.toggle("sidebar-collapsed", collapsed);
  if (sidebarToggle) {
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle.setAttribute("aria-label", collapsed ? "Expand tools" : "Collapse tools");
    sidebarToggle.textContent = collapsed ? "›" : "‹";
  }
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

try {
  applySidebar(localStorage.getItem(SIDEBAR_KEY) === "1");
} catch {
  applySidebar(false);
}

sidebarToggle?.addEventListener("click", () => {
  applySidebar(!app.classList.contains("sidebar-collapsed"));
});

menuBtn?.addEventListener("click", () => {
  const open = app.classList.toggle("nav-open");
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  send(input.value);
});

input.addEventListener("input", () => {
  autosize();
  setSendEnabled();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send(input.value);
  }
});

document.querySelectorAll("[data-prompt]").forEach((btn) => {
  btn.addEventListener("click", () => send(btn.getAttribute("data-prompt") || ""));
});

newChatBtn?.addEventListener("click", () => {
  window.location.reload();
});

autosize();
setSendEnabled();
