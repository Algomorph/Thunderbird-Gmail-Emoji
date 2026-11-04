const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "👀"];

const box = document.getElementById("emojis");
for (const emoji of EMOJIS) {
  const b = document.createElement("button");
  b.textContent = emoji;
  b.onclick = async () => {
    const [tab] = await messenger.tabs.query({ active: true, currentWindow: true });
    // Hand off to the background page: the popup dies once the compose window opens.
    const res = await messenger.runtime.sendMessage({ type: "react", tabId: tab.id, emoji });
    if (res?.error) {
      document.getElementById("err").textContent = res.error;
    } else {
      window.close();
    }
  };
  box.appendChild(b);
}
