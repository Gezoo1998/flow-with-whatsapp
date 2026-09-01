/**
 * CenterFlow WhatsApp Automation Engine - WhatsApp Web Content Script
 * Enforces Batch SessionStorage Lock, validates DOM compose area, and executes automated single click.
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get("centerflow_id");
  const batchId = urlParams.get("centerflow_batch");

  // If parameters are missing, this page load is normal user browsing
  if (!studentId || !batchId) {
    return;
  }

  // 🛡️ BATCH SESSIONSTORAGE LOCK
  const storageKey = `cf_sent_${studentId}_${batchId}`;
  if (sessionStorage.getItem(storageKey)) {
    console.warn(`[CenterFlow WA Lock] Item already sent in this batch: ${studentId}`);
    return;
  }

  // Set the iron lock immediately before attempting DOM click
  sessionStorage.setItem(storageKey, "done");
  console.log(`[CenterFlow WA Lock] Lock set for student: ${studentId}`);

  let attempts = 0;
  const maxAttempts = 50; // 50 attempts * 400ms = 20 seconds max DOM search

  const pollInterval = setInterval(() => {
    attempts++;

    // 1. Check for invalid number error modal
    const invalidModal = document.querySelector(
      'div[data-animate-modal-body="true"], [data-testid="popup-contents"], div[role="dialog"], div[data-tab="2"]'
    );
    if (invalidModal) {
      const text = (invalidModal.innerText || "").toLowerCase();
      if (
        text.includes("غير صحيح") ||
        text.includes("invalid") ||
        text.includes("غير مسجل") ||
        text.includes("phone number") ||
        text.includes("not on whatsapp") ||
        text.includes("لا يملك حساباً")
      ) {
        clearInterval(pollInterval);
        notifyBackground(false, "رقم غير مسجل في الواتساب أو الرابط غير صحيح");
        return;
      }
    }

    // 2. Find WhatsApp Web Send Button
    const sendButton =
      document.querySelector('button span[data-icon="send"]') ||
      document.querySelector('span[data-icon="send"]') ||
      document.querySelector('span[data-icon="send-light"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('button[aria-label="إرسال"]') ||
      document.querySelector('button[aria-label="إرسال "]') ||
      document.querySelector('button[aria-label="Send "]') ||
      document.querySelector('footer button span[data-icon="send"]') ||
      document.querySelector('footer button[aria-label*="إرسال"]') ||
      document.querySelector('footer button[aria-label*="Send"]');

    if (sendButton) {
      clearInterval(pollInterval);

      // Parent button if icon selected
      const clickableBtn = sendButton.closest("button") || sendButton;

      setTimeout(() => {
        try {
          if (typeof clickableBtn.focus === "function") {
            clickableBtn.focus();
          }
          if (typeof clickableBtn.click === "function") {
            clickableBtn.click();
          }
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          });
          clickableBtn.dispatchEvent(clickEvent);

          console.log(`[CenterFlow WA] Send button clicked successfully for student: ${studentId}`);
          
          setTimeout(() => {
            notifyBackground(true);
          }, 400);
        } catch (err) {
          console.error(`[CenterFlow WA] Click execution error:`, err);
          notifyBackground(false, "خطأ أثناء النقر على زر الإرسال");
        }
      }, 400);

      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.warn(`[CenterFlow WA] Max attempts reached searching for send button.`);
      notifyBackground(false, "تأخر ظهور زر الإرسال في الصفحة");
    }
  }, 400);

  function notifyBackground(success, reason = "") {
    chrome.runtime.sendMessage({
      action: "WA_ITEM_RESULT",
      studentId: studentId,
      batchId: batchId,
      success: success,
      reason: reason
    });
  }
})();
