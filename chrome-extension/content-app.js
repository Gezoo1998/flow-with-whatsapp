/**
 * CenterFlow WhatsApp Automation Engine - App Content Script
 * Bridge between CenterFlow Next.js web application and Chrome Extension background worker.
 */

(function () {
  let isExtensionValid = false;

  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      isExtensionValid = true;
    }
  } catch (e) {
    isExtensionValid = false;
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

  // Initial presence ping if extension valid
  if (isExtensionValid) {
    announcePresence();
  }

  // Web message listener
  function handleWebMessage(event) {
    if (!isExtensionValid) {
      window.removeEventListener("message", handleWebMessage);
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
      try {
        chrome.runtime.sendMessage(
          {
            action: "START_BATCH",
            payload
          },
          (response) => {
            if (!isExtensionValid) return;
            try {
              if (chrome.runtime && chrome.runtime.lastError) {
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
              isExtensionValid = false;
            }
          }
        );
      } catch (err) {
        isExtensionValid = false;
        window.removeEventListener("message", handleWebMessage);
      }
    } else if (type === "STOP_WHATSAPP_BATCH") {
      try {
        chrome.runtime.sendMessage({ action: "STOP_BATCH" });
      } catch (err) {
        isExtensionValid = false;
        window.removeEventListener("message", handleWebMessage);
      }
    }
  }

  window.addEventListener("message", handleWebMessage);

  // Background message listener
  try {
    if (isExtensionValid && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (!isExtensionValid) return;
        try {
          if (!message || !message.type) return;
          window.postMessage(message, "*");
        } catch (err) {
          isExtensionValid = false;
        }
      });
    }
  } catch (err) {
    isExtensionValid = false;
  }
})();
