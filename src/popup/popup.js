const EMOJIS = [
  ["👍", "Thumbs up"],
  ["❤️", "Heart"],
  ["😂", "Laughing"],
  ["😮", "Surprised"],
  ["😢", "Sad"],
  ["🙏", "Thank you"],
  ["🎉", "Celebrate"],
  ["👀", "Eyes"],
];

const container = document.getElementById("emojis");
const status = document.getElementById("status");

function setBusy(busy) {
  for (const b of container.querySelectorAll("button")) b.disabled = busy;
}

async function pick(emoji) {
  setBusy(true);
  status.hidden = true;
  try {
    const [tab] = await messenger.tabs.query({ active: true, currentWindow: true });
    // The background does the work: this popup closes as soon as a compose
    // window takes focus.
    const result = await messenger.runtime.sendMessage({ type: "react", tabId: tab.id, emoji });
    if (result?.ok) {
      window.close();
      return;
    }
    status.textContent = result?.reason ?? "The reaction was not sent.";
  } catch (e) {
    status.textContent = `The reaction was not sent: ${e?.message ?? e}`;
  }
  status.hidden = false;
  setBusy(false);
}

for (const [emoji, label] of EMOJIS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = emoji;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => pick(emoji));
  container.appendChild(button);
}
container.querySelector("button")?.focus();
