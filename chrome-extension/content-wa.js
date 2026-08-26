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
  const maxAttempts = 30; // 30 attempts * 400ms = 12 seconds max DOM search

  const pollInterval = setInterval(() => {
    attempts++;

    // 1. Check for invalid number error modal
    const invalidModal = document.querySelector(
      'div[data-animate-modal-body="true"], [data-testid="popup-contents"]'
    );
    if (invalidModal) {
      const text = invalidModal.innerText || "";
      if (
        text.includes("غير صحيح") ||
        text.includes("invalid") ||
        text.includes("غير مسجل") ||
        text.includes("Phone number")
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
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('button[aria-label="إرسال"]');

    if (sendButton) {
      clearInterval(pollInterval);

      // Parent button if icon selected
      const clickableBtn = sendButton.closest("button") || sendButton;

      setTimeout(() => {
        try {
          // Trigger click event on send button EXACTLY ONCE to prevent double sending
          if (typeof clickableBtn.click === "function") {
            clickableBtn.click();
          } else {
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            });
            clickableBtn.dispatchEvent(clickEvent);
          }

          console.log(`[CenterFlow WA] Send button clicked successfully for student: ${studentId}`);
          notifyBackground(true);
        } catch (err) {
          console.error(`[CenterFlow WA] Click execution error:`, err);
          notifyBackground(false, "خطأ أثناء النقر على زر الإرسال");
        }
      }, 500);

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
