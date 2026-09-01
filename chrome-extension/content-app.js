/**
 * CenterFlow WhatsApp Automation Engine - App Content Script
 * Bridge between CenterFlow Next.js web application and Chrome Extension background worker.
 */

// Safe helper to check if Chrome Extension context is valid
function isContextValid() {
  try {
    return Boolean(typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// Notify webpage that extension is loaded
function announcePresence() {
  try {
    window.postMessage(
      {
        type: "CENTERFLOW_EXTENSION_PONG",
        version: "1.0.0",
        status: "ready"
      },
      "*"
    );
  } catch (e) {
    // Ignore postMessage errors
  }
}

// Initial presence ping
if (isContextValid()) {
  announcePresence();
}

// Periodically check or listen for web application pings
window.addEventListener("message", (event) => {
  try {
    // Check if extension context is valid
    if (!isContextValid()) {
      return;
    }

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
          try {
            if (isContextValid() && chrome.runtime.lastError) {
              console.error("[CenterFlow Extension] Error starting batch:", chrome.runtime.lastError);
              window.postMessage(
                {
                  type: "WHATSAPP_BATCH_ERROR",
                  error: chrome.runtime.lastError.message
                },
                "*"
              );
            }
          } catch (e) {
            // Ignore response error if context died
          }
        }
      );
    } else if (type === "STOP_WHATSAPP_BATCH") {
      if (isContextValid()) {
        chrome.runtime.sendMessage({ action: "STOP_BATCH" });
      }
    }
  } catch (err) {
    // Gracefully catch context invalidation when extension is reloaded/disabled
    console.warn("[CenterFlow Extension] Extension context invalidated gracefully:", err);
  }
});

// Listen for updates from Background Service Worker and relay to web page
try {
  if (isContextValid() && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      try {
        if (!message || !message.type) return;
        window.postMessage(message, "*");
      } catch (err) {
        // Ignore message relay errors
      }
    });
  }
} catch (err) {
  console.warn("[CenterFlow Extension] Listener context check skipped:", err);
}
