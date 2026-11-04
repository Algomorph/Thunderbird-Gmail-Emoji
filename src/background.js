import { handleRuntimeMessage } from "./lib/send-flow.js";

messenger.runtime.onMessage.addListener((message) => handleRuntimeMessage(message, messenger));
