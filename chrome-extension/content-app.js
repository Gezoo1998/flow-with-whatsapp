/**
 * CenterFlow WhatsApp Automation Engine - App Content Script
 * Bridge between CenterFlow Next.js web application and Chrome Extension background worker.
 */

// Notify webpage that extension is loaded
function announcePresence() {
  window.postMessage(
    {
      type: "CENTERFLOW_EXTENSION_PONG",
      version: "1.0.0",
      status: "ready"
    },
    "*"
  );
}

// Initial presence ping
announcePresence();

// Periodically check or listen for web application pings
window.addEventListener("message", (event) => {
  // Ignore messages from non-current window or unknown sources
  if (event.source !== window || !event.data || typeof event.data !== "object") {
    return;
  }

  const { type, payload } = event.data;

  if (type === "CENTERFLOW_CHECK_EXTENSION") {
    announcePresence();
  } else if (type === "START_WHATSAPP_BATCH") {
    chrome.runtime.sendMessage(
      {
        action: "START_BATCH",
        payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[CenterFlow Extension] Error starting batch:", chrome.runtime.lastError);
          window.postMessage(
            {
              type: "WHATSAPP_BATCH_ERROR",
              error: chrome.runtime.lastError.message
            },
            "*"
          );
        }
      }
    );
  } else if (type === "STOP_WHATSAPP_BATCH") {
    chrome.runtime.sendMessage({ action: "STOP_BATCH" });
  }
});

// Listen for updates from Background Service Worker and relay to web page
chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  // Forward relevant events to window
  window.postMessage(message, "*");
});
