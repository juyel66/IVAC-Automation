chrome.runtime.onInstalled.addListener((e) => {
  e.reason === "install" ? (console.log("[IVAC Assistant] Extension installed successfully."), chrome.action.setBadgeText({ text: "IVAC" }), chrome.action.setBadgeBackgroundColor({ color: "#16a34a" })) : e.reason === "update" && console.log("[IVAC Assistant] Extension updated to new version.");
});
chrome.runtime.onMessage.addListener((e, n, t) => {
  if (e.type === "PING")
    return t({ status: "PONG", timestamp: Date.now() }), !0;
  if (e.type === "GET_EXTENSION_INFO")
    return t({
      name: "IVAC Booking Assistant",
      version: chrome.runtime.getManifest().version,
      targetDomain: "appointment.ivacbd.com"
    }), !0;
});
