import { react } from "./lib/send-flow.js";
const log = (...a) => console.log("HARNESS", ...a);
async function main() {
  const [acc] = await messenger.accounts.list(true);
  log("account", acc.id, JSON.stringify(acc.identities.map(i => i.email)));
  const root = acc.rootFolder;
  const folder = await messenger.folders.create(root.id, "Orig");
  const eml = [
    "From: Ann <ann@example.com>",
    "To: Me <me@example.com>",
    "Subject: Lunch?",
    "Date: Mon, 02 Nov 2026 10:00:00 +0000",
    "Message-ID: <orig-123@example.com>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Lunch tomorrow?",
    "",
  ].join("\r\n");
  const msg = await messenger.messages.import(new File([eml], "orig.eml"), folder.id);
  log("imported", msg.id, msg.headerMessageId);
  // Real send flow; only the displayed-message lookup is faked, and review mode
  // guarantees nothing is sent.
  await messenger.storage.local.set({ reviewBeforeSend: true });
  const api = Object.assign(Object.create(messenger), {
    messageDisplay: { getDisplayedMessages: async () => [msg] },
  });
  const result = await react({ tabId: 0, emoji: "👍" }, api);
  log("react", JSON.stringify(result));
  const [tab] = await messenger.tabs.query({ type: "messageCompose" });
  const sent = await messenger.compose.sendMessage(tab.id, { mode: "sendLater" });
  log("queued", JSON.stringify(sent));
  const [acc2] = await messenger.accounts.list(true);
  const outbox = acc2.rootFolder.subFolders.find(f => f.specialUse?.includes("outbox") || /Unsent/.test(f.name));
  log("outbox", outbox?.path);
  const page = await messenger.messages.list(outbox.id);
  const raw = await messenger.messages.getRaw(page.messages[0].id);
  log("RAW-BEGIN\n" + (typeof raw === "string" ? raw : await raw.text()) + "\nRAW-END");
}
main().catch(e => log("ERROR", e?.message ?? e, e?.stack));
