/**
 * CenterFlow WhatsApp Automation Engine - Background Service Worker
 * Manages sending queue, WhatsApp tab navigation, watchdog timers, and random delays.
 */

let currentBatch = null;
let isProcessing = false;
let waTabId = null;
let watchdogTimer = null;
let delayTimer = null;

const WATCHDOG_TIMEOUT_MS = 14000; // 14 Seconds Safety Watchdog Timer

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

  currentBatch = {
    batchId: payload.batchId || Date.now().toString(),
    items: payload.items,
    currentIndex: 0,
    completedCount: 0,
    failedCount: 0,
    totalCount: payload.items.length
  };

  isProcessing = true;
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
  isProcessing = false;
  const batchId = currentBatch ? currentBatch.batchId : null;
  currentBatch = null;

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
  if (!isProcessing || !currentBatch) return;

  if (currentBatch.currentIndex >= currentBatch.items.length) {
    // Batch finished
    notifyApp({
      type: "WHATSAPP_BATCH_COMPLETE",
      batchId: currentBatch.batchId,
      completedCount: currentBatch.completedCount,
      failedCount: currentBatch.failedCount,
      totalCount: currentBatch.totalCount
    });
    isProcessing = false;
    currentBatch = null;
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

  // Set 14s Safety Watchdog Timer before navigating tab
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
    console.warn(`[Watchdog] Timeout reached (14s) for student: ${studentId}`);
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

  advanceQueueWithRandomDelay();
}

function advanceQueueWithRandomDelay() {
  if (!isProcessing || !currentBatch) return;

  currentBatch.currentIndex++;
  clearDelayTimer();

  if (currentBatch.currentIndex >= currentBatch.items.length) {
    processNextItem();
    return;
  }

  // Base delay: 5 seconds (5000 ms) between messages
  // Throttling: After every 10 messages, pause for 1 minute (60,000 ms)
  let delayMs = 5000;
  if (currentBatch.currentIndex % 10 === 0) {
    delayMs = 60000; // 1 minute rest after 10 messages
    console.log(`[CenterFlow WA] 1-minute safety rest after 10 messages (Index: ${currentBatch.currentIndex})`);
    notifyApp({
      type: "WHATSAPP_BATCH_PAUSED",
      batchId: currentBatch.batchId,
      message: `فترة استراحة آمنة (دقيقة واحدة) بعد إرسال 10 رسائل... سيتأستأنف الإرسال تلقائياً (الرسالة ${currentBatch.currentIndex + 1} من ${currentBatch.totalCount})`,
      resumeInMs: 60000
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
      // Do not send app notifications to whatsapp web tabs
      if (tab.url && !tab.url.includes("web.whatsapp.com")) {
        chrome.tabs.sendMessage(tab.id, message, () => {
          if (chrome.runtime.lastError) {
            // Ignore tab communication errors for non-matching pages
          }
        });
      }
    });
  });
}
