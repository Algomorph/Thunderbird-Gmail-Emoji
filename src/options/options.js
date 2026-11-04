const checkbox = document.getElementById("reviewBeforeSend");

const { reviewBeforeSend } = await messenger.storage.local.get({ reviewBeforeSend: false });
checkbox.checked = reviewBeforeSend;

checkbox.addEventListener("change", () => {
  messenger.storage.local.set({ reviewBeforeSend: checkbox.checked });
});
