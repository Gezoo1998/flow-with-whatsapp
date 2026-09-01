/**
 * CenterFlow WhatsApp Automation Engine - Background Service Worker
 * Manages sending queue, WhatsApp tab navigation, watchdog timers, and random delays.
 */

let currentBatch = null;
let isProcessing = false;
let waTabId = null;
let watchdogTimer = null;
let delayTimer = null;
let keepAliveInterval = null;

const WATCHDOG_TIMEOUT_MS = 25000; // 25 Seconds Safety Watchdog Timer

// KeepAlive Heartbeat: Prevents Manifest V3 Service Worker from sleeping during active batch processing
function startKeepAlive() {
  stopKeepAlive();
  keepAliveInterval = setInterval(() => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getPlatformInfo) {
      chrome.runtime.getPlatformInfo(() => {
        // Keeps Manifest V3 Service Worker active in memory
      });
    }
  }, 10000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Persist batch state to chrome.storage.local to survive any service worker restarts
function saveStateToStorage() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      cf_currentBatch: currentBatch,
      cf_isProcessing: isProcessing
    });
  }
}

// Restore batch state from chrome.storage.local if service worker restarted
function restoreStateFromStorage(cb) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["cf_currentBatch", "cf_isProcessing"], (result) => {
      if (result.cf_currentBatch && result.cf_isProcessing) {
        currentBatch = result.cf_currentBatch;
        isProcessing = result.cf_isProcessing;
      }
      if (cb) cb();
    });
  } else {
    if (cb) cb();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;

  if (message.action === "START_BATCH") {
    handleStartBatch(message.payload);
    sendResponse({ status: "batch_started" });
  } else if (message.action === "STOP_BATCH") {
    handleStopBatch();
    sendResponse({ status: "batch_stopped" });
  } else if (message.action === "WA_ITEM_RESULT") {
    handleWaItemResult(message);
    sendResponse({ status: "result_received" });
  }
  return true;
});

function clearDelayTimer() {
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
}

async function handleStartBatch(payload) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    notifyApp({ type: "WHATSAPP_BATCH_ERROR", error: "الطابور فارغ" });
    return;
  }

  clearDelayTimer();
  clearWatchdog();
  startKeepAlive();

  currentBatch = {
    batchId: payload.batchId || Date.now().toString(),
    items: payload.items,
    currentIndex: 0,
    completedCount: 0,
    failedCount: 0,
    totalCount: payload.items.length
  };

  isProcessing = true;
  saveStateToStorage();

  notifyApp({
    type: "WHATSAPP_BATCH_STARTED",
    batchId: currentBatch.batchId,
    totalCount: currentBatch.totalCount
  });

  await processNextItem();
}

function handleStopBatch() {
  clearWatchdog();
  clearDelayTimer();
  stopKeepAlive();
  isProcessing = false;

  const batchId = currentBatch ? currentBatch.batchId : null;
  currentBatch = null;
  saveStateToStorage();

  if (waTabId) {
    chrome.tabs.update(waTabId, { url: "https://web.whatsapp.com/" }, () => {
      if (chrome.runtime.lastError) {}
    });
  }

  notifyApp({
    type: "WHATSAPP_BATCH_STOPPED",
    batchId
  });
}

async function processNextItem() {
  if (!isProcessing || !currentBatch) {
    restoreStateFromStorage(() => {
      if (isProcessing && currentBatch) {
        processNextItem();
      }
    });
    return;
  }

  if (currentBatch.currentIndex >= currentBatch.items.length) {
    // Batch finished
    notifyApp({
      type: "WHATSAPP_BATCH_COMPLETE",
      batchId: currentBatch.batchId,
      completedCount: currentBatch.completedCount,
      failedCount: currentBatch.failedCount,
      totalCount: currentBatch.totalCount
    });
    stopKeepAlive();
    isProcessing = false;
    currentBatch = null;
    saveStateToStorage();
    return;
  }

  const item = currentBatch.items[currentBatch.currentIndex];

  notifyApp({
    type: "WHATSAPP_ITEM_SENDING",
    batchId: currentBatch.batchId,
    studentId: item.studentId,
    studentName: item.studentName,
    phone: item.phone,
    index: currentBatch.currentIndex,
    total: currentBatch.totalCount
  });

  // Ensure WhatsApp Web tab exists or open one
  try {
    waTabId = await getOrCreateWaTab();
  } catch (err) {
    console.error("[Background] Failed to open WhatsApp tab:", err);
    markCurrentItemFailed("فشل فتح تبويب واتساب");
    return;
  }

  // Format Egyptian/International phone number
  let cleanedPhone = item.phone.replace(/\D/g, "");
  if (cleanedPhone.startsWith("01")) {
    cleanedPhone = "20" + cleanedPhone;
  }

  const targetUrl = `https://web.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(item.messageText)}&centerflow_id=${encodeURIComponent(item.studentId)}&centerflow_batch=${encodeURIComponent(currentBatch.batchId)}`;

  // Set 25s Safety Watchdog Timer before navigating tab
  setWatchdog(item.studentId);

  // Navigate tab
  chrome.tabs.update(waTabId, { url: targetUrl, active: false }, () => {
    if (chrome.runtime.lastError) {
      console.error("[Background] Tab update error:", chrome.runtime.lastError);
      markCurrentItemFailed("خطأ تنقل في التبويب");
    }
  });
}

function setWatchdog(studentId) {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    console.warn(`[Watchdog] Timeout reached (25s) for student: ${studentId}`);
    markCurrentItemFailed("تجاوز وقت الانتظار (الرقم قد يكون غير مسجل بالواتساب)");
  }, WATCHDOG_TIMEOUT_MS);
}

function clearWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

function handleWaItemResult(msg) {
  if (!isProcessing || !currentBatch) return;

  const currentItem = currentBatch.items[currentBatch.currentIndex];
  if (!currentItem || currentItem.studentId !== msg.studentId) {
    return;
  }

  clearWatchdog();

  if (msg.success) {
    currentBatch.completedCount++;
    notifyApp({
      type: "WHATSAPP_ITEM_SENT_SUCCESS",
      batchId: currentBatch.batchId,
      studentId: msg.studentId,
      studentName: currentItem.studentName,
      phone: currentItem.phone,
      completedCount: currentBatch.completedCount,
      totalCount: currentBatch.totalCount
    });
  } else {
    currentBatch.failedCount++;
    notifyApp({
      type: "WHATSAPP_ITEM_FAILED",
      batchId: currentBatch.batchId,
      studentId: msg.studentId,
      studentName: currentItem.studentName,
      phone: currentItem.phone,
      reason: msg.reason || "فشل غير معروف"
    });
  }

  saveStateToStorage();
  advanceQueueWithRandomDelay();
}

function markCurrentItemFailed(reason) {
  if (!isProcessing || !currentBatch) return;

  clearWatchdog();
  const currentItem = currentBatch.items[currentBatch.currentIndex];
  if (!currentItem) return;

  currentBatch.failedCount++;
  notifyApp({
    type: "WHATSAPP_ITEM_FAILED",
    batchId: currentBatch.batchId,
    studentId: currentItem.studentId,
    studentName: currentItem.studentName,
    phone: currentItem.phone,
    reason: reason
  });

  saveStateToStorage();
  advanceQueueWithRandomDelay();
}

function advanceQueueWithRandomDelay() {
  if (!isProcessing || !currentBatch) return;

  currentBatch.currentIndex++;
  clearDelayTimer();
  saveStateToStorage();

  if (currentBatch.currentIndex >= currentBatch.items.length) {
    processNextItem();
    return;
  }

  // Base delay: 12 seconds (12000 ms) between messages
  // Safety rest: After every 10 messages, rest for 15 seconds (15000 ms)
  let delayMs = 12000;
  if (currentBatch.currentIndex > 0 && currentBatch.currentIndex % 10 === 0) {
    delayMs = 15000; // 15 seconds safety pause after every 10 messages
    console.log(`[CenterFlow WA] 15-second safety rest after 10 messages (Index: ${currentBatch.currentIndex})`);
    notifyApp({
      type: "WHATSAPP_BATCH_PAUSED",
      batchId: currentBatch.batchId,
      message: `فترة استراحة آمنة (15 ثانية) بعد إرسال 10 رسائل... سيتأستأنف الإرسال تلقائياً (الرسالة ${currentBatch.currentIndex + 1} من ${currentBatch.totalCount})`,
      resumeInMs: 15000
    });
  }

  delayTimer = setTimeout(() => {
    delayTimer = null;
    processNextItem();
  }, delayMs);
}

async function getOrCreateWaTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      if (tabs && tabs.length > 0) {
        resolve(tabs[0].id);
      } else {
        chrome.tabs.create({ url: "https://web.whatsapp.com/", active: false }, (tab) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(tab.id);
        });
      }
    });
  });
}

function notifyApp(message) {
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    tabs.forEach((tab) => {
      if (tab.url && !tab.url.includes("web.whatsapp.com")) {
        chrome.tabs.sendMessage(tab.id, message, () => {
          if (chrome.runtime.lastError) {
            // Ignore tab communication errors
          }
        });
      }
    });
  });
}
