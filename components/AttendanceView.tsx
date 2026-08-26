"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore, store } from "@/lib/store";
import { Save, Check, X, Clock, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AttendanceView() {
  const state = useAppStore((s) => s);
  
  // Selection
  const [selectedGroupId, setSelectedGroupId] = useState(state.groups[0]?.id || "");
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0]);

  // Check if selected date is on specified weekdays of the group
  const group = state.groups.find(g => g.id === selectedGroupId);
  const daysNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  
  let isScheduledDay = true;
  let scheduledDaysNames = "";
  let selectedDayName = "";
  
  if (group && dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    selectedDayName = daysNames[dayOfWeek];
    isScheduledDay = group.daysOfWeek?.includes(dayOfWeek) ?? true;
    scheduledDaysNames = group.daysOfWeek?.map(idx => daysNames[idx]).join(" و ") || "";
  }

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="attendance_view">
      {/* Step 1: Choose Group & Date */}
      <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl text-right">
        <h3 className="text-2xs font-bold text-slate-400 dark:text-slate-500">الخطوة الأولى: تحديد المجموعة والتاريخ</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">المجموعة:</label>
            <select 
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none text-slate-800 dark:text-slate-100"
            >
              {state.groups.map(g => (
                <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">تاريخ الحصة:</label>
            <input 
              type="date" 
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none text-slate-800 dark:text-slate-100 font-mono"
            />
          </div>
        </div>

        {/* Warning if day not scheduled */}
        {!isScheduledDay && group && (
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/45 rounded-xl text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed flex items-start gap-1.5 mt-2 animate-pulse">
            <span>⚠️</span>
            <div>
              <strong>تنبيه مواعيد المجموعة:</strong> تاريخ الحصة المختار يصادف يوم <span className="font-bold underline">{selectedDayName}</span> وهو ليس من أيام الحضور المعتادة لهذه المجموعة.
              الأيام المحددة هي: <span className="font-bold underline text-amber-900 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/45 px-1 rounded">{scheduledDaysNames || "لا يوجد"}</span>.
              <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">يمكنك المتابعة وتأكيد الحضور بشكل استثنائي إذا رغبت.</span>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Attendance Sheet Component to isolate local state */}
      {selectedGroupId && (
        <AttendanceSheet 
          key={`${selectedGroupId}-${dateStr}`}
          groupId={selectedGroupId}
          dateStr={dateStr}
        />
      )}
    </div>
  );
}

// Sub-component to manage state cleanly without useEffect setstate warning
interface AttendanceSheetProps {
  groupId: string;
  dateStr: string;
}

function AttendanceSheet({ groupId, dateStr }: AttendanceSheetProps) {
  const state = useAppStore((s) => s);
  
  // Find existing record
  const existingRecord = state.attendance.find(
    (att) => att.groupId === groupId && att.date === dateStr
  );

  // Initialize explicit states on construction
  const [presentIds, setPresentIds] = useState<string[]>(() => {
    return existingRecord ? existingRecord.presentStudentIds : [];
  });

  const [absentIds, setAbsentIds] = useState<string[]>(() => {
    return existingRecord ? (existingRecord.absentStudentIds || []) : [];
  });

  const [lateIds, setLateIds] = useState<string[]>(() => {
    return existingRecord ? (existingRecord.lateStudentIds || []) : [];
  });
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Barcode & camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanStatus, setScanStatus] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<any>(null);

  // Guest student logic state
  const [pendingGuestStudent, setPendingGuestStudent] = useState<any | null>(null);

  // Keep track of the last scanned student to prevent duplicate trigger loops (3 seconds)
  const lastScannedRef = useRef<{ id: string; time: number } | null>(null);

  // Ref to store the latest handleBarcodeScan callback to avoid stale closures in camera callback
  const handleBarcodeScanRef = useRef<(code: string) => void>(() => {});

  // Play audio feedback using Web Audio API
  const playBeep = (type: "success" | "warning" | "error") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "warning") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (e) {
      console.error("Audio feedback error:", e);
    }
  };

  const handleTransferAndMarkPresent = (student: any) => {
    store.transferStudent(student.id, groupId);
    
    const nextPresent = [...presentIds.filter((id) => id !== student.id), student.id];
    const nextAbsent = absentIds.filter((id) => id !== student.id);
    const nextLate = lateIds.filter((id) => id !== student.id);
    
    setPresentIds(nextPresent);
    setAbsentIds(nextAbsent);
    setLateIds(nextLate);
    
    // Auto-save: include the newly transferred student in the active list
    const currentGroupStudents = [
      ...state.students.filter(st => st.groupId === groupId && st.status === "active" && st.id !== student.id),
      { ...student, groupId }
    ];
    const activeStudentIds = currentGroupStudents.map(st => st.id);
    const finalPresent = nextPresent.filter(id => activeStudentIds.includes(id));
    const finalAbsent = nextAbsent.filter(id => activeStudentIds.includes(id));
    const finalLate = nextLate.filter(id => activeStudentIds.includes(id));
    
    store.recordAttendance(groupId, dateStr, finalPresent, finalAbsent, finalLate);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    
    setScanStatus({
      type: "success",
      message: `✅ تم نقل الطالب ${student.name} إلى هذه المجموعة وتسجيل حضوره بنجاح.`
    });
    setPendingGuestStudent(null);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  const handleMarkInOriginalGroup = (student: any) => {
    const origGroupId = student.groupId;
    const origGroup = state.groups.find((g) => g.id === origGroupId);
    const origGroupName = origGroup ? origGroup.name : "مجموعته الأصلية";
    
    const origRecord = state.attendance.find(
      (att) => att.groupId === origGroupId && att.date === dateStr
    );
    
    let nextOrigPresent: string[] = [];
    let nextOrigAbsent: string[] = [];
    let nextOrigLate: string[] = [];
    
    if (origRecord) {
      nextOrigPresent = [...origRecord.presentStudentIds.filter((id) => id !== student.id), student.id];
      nextOrigAbsent = (origRecord.absentStudentIds || []).filter((id) => id !== student.id);
      nextOrigLate = (origRecord.lateStudentIds || []).filter((id) => id !== student.id);
    } else {
      nextOrigPresent = [student.id];
      nextOrigAbsent = []; // Keep other students unmarked instead of defaulting them all to absent
    }
    
    store.recordAttendance(origGroupId, dateStr, nextOrigPresent, nextOrigAbsent, nextOrigLate);
    
    setScanStatus({
      type: "success",
      message: `✅ تم تسجيل حضور الطالب ${student.name} في مجموعته الأصلية ("${origGroupName}").`
    });
    setPendingGuestStudent(null);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  // Process the barcode string
  const handleBarcodeScan = (code: string) => {
    if (pendingGuestStudent) {
      return; // Prevent multiple dialog popups
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    // Duplicate detection within 3 seconds
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (
      lastScannedRef.current &&
      lastScannedRef.current.id === cleanCode &&
      now - lastScannedRef.current.time < 3000
    ) {
      return;
    }
    lastScannedRef.current = { id: cleanCode, time: now };

    // Try to find the student in store
    const student = state.students.find(
      (s) =>
        s.id.toUpperCase() === cleanCode ||
        s.id.toUpperCase() === `ST_${cleanCode}` ||
        s.id.toUpperCase() === `ST-${cleanCode}`
    );

    const targetStudent =
      student ||
      state.students.find((s) => {
        const sClean = s.id.replace(/[-_]/g, "").toUpperCase();
        const cClean = cleanCode.replace(/[-_]/g, "").toUpperCase();
        return sClean === cClean;
      });

    if (!targetStudent) {
      playBeep("error");
      setScanStatus({
        type: "error",
        message: `❌ كود الباركود غير مسجل بالنظام: ${cleanCode}`
      });
      return;
    }

    // Check if student belongs to the current group
    if (targetStudent.groupId === groupId) {
      const nextPresent = [...presentIds.filter((id) => id !== targetStudent.id), targetStudent.id];
      const nextAbsent = absentIds.filter((id) => id !== targetStudent.id);
      const nextLate = lateIds.filter((id) => id !== targetStudent.id);

      setPresentIds(nextPresent);
      setAbsentIds(nextAbsent);
      setLateIds(nextLate);
      
      // Auto-save immediately
      const activeStudentIds = state.students
        .filter((st) => st.groupId === groupId && st.status === "active")
        .map((st) => st.id);
      const finalPresent = nextPresent.filter((id) => activeStudentIds.includes(id));
      const finalAbsent = nextAbsent.filter((id) => activeStudentIds.includes(id));
      const finalLate = nextLate.filter((id) => activeStudentIds.includes(id));
      
      store.recordAttendance(groupId, dateStr, finalPresent, finalAbsent, finalLate);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      playBeep("success");
      setScanStatus({
        type: "success",
        message: `✅ تم تسجيل حضور الطالب: ${targetStudent.name} (${targetStudent.id})`
      });
    } else {
      const otherGroup = state.groups.find((g) => g.id === targetStudent.groupId);
      const groupName = otherGroup ? otherGroup.name : "مجموعة أخرى";
      
      playBeep("warning");
      setPendingGuestStudent(targetStudent);
      setScanStatus({
        type: "warning",
        message: `⚠️ تنبيه: الطالب ${targetStudent.name} مسجل في "${groupName}" وليس هذه المجموعة!`
      });
    }
  };

  useEffect(() => {
    handleBarcodeScanRef.current = handleBarcodeScan;
  }, [handleBarcodeScan]);

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeScan(barcodeInput);
    setBarcodeInput("");
    // Re-focus the input box for consecutive scans
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Camera management functions
  const startCamera = async () => {
    setScannerError(null);
    setIsCameraActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Give React a frame to mount the viewport div
      setTimeout(async () => {
        const container = document.getElementById("barcode-scanner-viewport");
        if (!container) {
          setScannerError("جاري إعداد محرك الكاميرا...");
          return;
        }

        try {
          const html5Qrcode = new Html5Qrcode("barcode-scanner-viewport");
          html5QrcodeRef.current = html5Qrcode;

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            formatsToSupport: [
              0, // Html5QrcodeSupportedFormats.CODE_39
              5, // Html5QrcodeSupportedFormats.CODE_128
              4, // Html5QrcodeSupportedFormats.CODE_93
              11, // Html5QrcodeSupportedFormats.EAN_13
              12, // Html5QrcodeSupportedFormats.EAN_8
              15, // Html5QrcodeSupportedFormats.QR_CODE
            ]
          };

          await html5Qrcode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              // Continuous camera scanning, so we process without stopping.
              handleBarcodeScanRef.current(decodedText);
            },
            () => {
              // Silent scan error (no barcode detected in frame)
            }
          );
        } catch (err: any) {
          console.error("Camera startup internal error:", err);
          setScannerError("حدث خطأ أثناء تشغيل كاميرا الهاتف، يرجى التحقق من الصلاحيات.");
          setIsCameraActive(false);
        }
      }, 300);
    } catch (err: any) {
      console.error("Camera loading package error:", err);
      setScannerError("فشل تحميل قارئ الباركود.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      } catch (err) {
        console.error("Camera stop error:", err);
      }
      html5QrcodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraScanner = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Auto-clear scanStatus banner after 5 seconds
  useEffect(() => {
    if (scanStatus) {
      const timer = setTimeout(() => setScanStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [scanStatus]);

  // Clean up camera on component unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch((err: any) => console.error("Unmount cleanup failed:", err));
      }
    };
  }, []);

  const groupStudents = state.students.filter(
    st => st.groupId === groupId && st.status === "active"
  );

  const handleToggleState = (studentId: string, status: "present" | "absent" | "late") => {
    setSaveSuccess(false);

    const isCurrentlyPresent = presentIds.includes(studentId);
    const isCurrentlyAbsent = absentIds.includes(studentId);
    const isCurrentlyLate = lateIds.includes(studentId);

    // Remove from all 3 states first
    setPresentIds(prev => prev.filter(id => id !== studentId));
    setAbsentIds(prev => prev.filter(id => id !== studentId));
    setLateIds(prev => prev.filter(id => id !== studentId));

    // If already has that state, toggle to unmarked
    if (status === "present" && isCurrentlyPresent) {
      // unmarked
    } else if (status === "absent" && isCurrentlyAbsent) {
      // unmarked
    } else if (status === "late" && isCurrentlyLate) {
      // unmarked
    } else {
      if (status === "present") {
        setPresentIds(prev => [...prev, studentId]);
      } else if (status === "absent") {
        setAbsentIds(prev => [...prev, studentId]);
      } else if (status === "late") {
        setLateIds(prev => [...prev, studentId]);
      }
    }
  };

  const handleMarkAllPresent = () => {
    const studentIds = groupStudents.map(st => st.id);
    setPresentIds(studentIds);
    setAbsentIds([]);
    setLateIds([]);
    setSaveSuccess(false);
  };

  const handleMarkAllAbsent = () => {
    const studentIds = groupStudents.map(st => st.id);
    setPresentIds([]);
    setAbsentIds(studentIds);
    setLateIds([]);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    const activeStudentIds = groupStudents.map(st => st.id);
    const finalPresent = presentIds.filter(id => activeStudentIds.includes(id));
    const finalAbsent = absentIds.filter(id => activeStudentIds.includes(id));
    const finalLate = lateIds.filter(id => activeStudentIds.includes(id));

    store.recordAttendance(groupId, dateStr, finalPresent, finalAbsent, finalLate);
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">الخطوة الثانية: كشف التحضير لـ ({groupStudents.length} طلاب)</h3>
        {/* Subtle inline text indicator */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>حُفِظ محلياً</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* قسم التحضير بالباركود (Barcode Attendance Panel) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-right">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">تحضير سريع بالباركود:</h4>
          </div>
          <button
            type="button"
            onClick={toggleCameraScanner}
            className={`px-3 py-1.5 rounded-xl text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              isCameraActive 
                ? "bg-red-50 dark:bg-red-950/20 text-red-655 dark:text-red-400 border border-red-150 dark:border-red-900/30" 
                : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-150 dark:border-blue-900/30"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCameraActive ? "إيقاف الكاميرا" : "تشغيل الكاميرا للتصوير"}</span>
          </button>
        </div>

        {/* Camera scanning area */}
        {isCameraActive && (
          <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-[4/3] max-w-sm mx-auto flex flex-col items-center justify-center">
            <div id="barcode-scanner-viewport" className="w-full h-full" />
            {/* Target scanner frame overlay */}
            <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-32 border border-dashed border-blue-400/80 rounded relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-550/80 animate-bounce" />
              </div>
            </div>
            {scannerError && (
              <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white text-[10px] p-2 rounded text-center leading-relaxed">
                {scannerError}
              </div>
            )}
          </div>
        )}

        {/* Input box for text-based scanning or physical gun scanner */}
        <form onSubmit={handleManualBarcodeSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="امسح الباركود أو اكتب كود الطالب... (مثال: ST-1001)"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-left"
              dir="ltr"
              ref={inputRef}
              autoFocus
            />
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-transparent"
          >
            إدخال
          </button>
        </form>

        {/* Scan Log Toast/Alert placeholder inside container */}
        <AnimatePresence>
          {scanStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`p-3 rounded-xl text-2xs font-extrabold border transition-all ${
                scanStatus.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-150 dark:border-emerald-900/30"
                  : scanStatus.type === "warning"
                  ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-150 dark:border-amber-900/30"
                  : "bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border-red-150 dark:border-red-900/30"
              }`}
            >
              {scanStatus.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Batch actions for quick log */}
      {groupStudents.length > 0 && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-150 dark:border-slate-800/80 justify-end">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-auto mr-1">إجراءات سريعة للمجموعة:</span>
          <button
            type="button"
            onClick={handleMarkAllAbsent}
            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-405 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/50 rounded-xl text-3xs font-extrabold flex items-center gap-1 transition-all cursor-pointer select-none ring-offset-white focus:outline-hidden"
          >
            <X className="w-3.5 h-3.5" />
            <span>تسجيل الغياب للجميع</span>
          </button>
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-405 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/50 rounded-xl text-3xs font-extrabold flex items-center gap-1 transition-all cursor-pointer select-none ring-offset-white focus:outline-hidden"
          >
            <Check className="w-3.5 h-3.5" />
            <span>تحضير الجميع</span>
          </button>
        </div>
      )}

      {/* Floating success toast notification system */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl shadow-emerald-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Check className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white">تأكيد عملية الحفظ</p>
              <p className="text-[10px] text-emerald-100 font-bold mt-0.5">تم تسجيل وحفظ دفتر الحضور اليومي وتحديث التقرير بنجاح!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2.5 min-h-[150px]">
        {groupStudents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
            لا يتوفر طلاب مسجلين بهذه المجموعة حالياً
          </div>
        ) : (
          groupStudents.map((st) => {
            const isPresent = presentIds.includes(st.id);
            const isAbsent = absentIds.includes(st.id);
            const isLate = lateIds.includes(st.id);
            
            return (
              <div 
                key={st.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition rounded-2xl h-[68px]"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[50%] text-right">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isPresent ? "bg-emerald-500" :
                    isLate ? "bg-amber-500" :
                    isAbsent ? "bg-rose-500" :
                    "bg-slate-300"
                  }`} />
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{st.name}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">كود: #{st.id}</span>
                  </div>
                </div>
                
                {/* Three segment-styled toggle controls without default selections */}
                <div className="flex items-center gap-1.5" dir="ltr">
                  {/* Absent Button (غائب) */}
                  <button
                    type="button"
                    onClick={() => handleToggleState(st.id, "absent")}
                    className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                      isAbsent 
                        ? "bg-rose-600 text-white border border-rose-650 shadow-sm shadow-rose-100 scale-102" 
                        : "bg-slate-50 dark:bg-slate-900 text-slate-450 dark:text-slate-400 border border-slate-205 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/25 hover:text-rose-600 dark:hover:text-rose-350"
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">غائب</span>
                  </button>

                  {/* Late Button (متأخر) */}
                  <button
                    type="button"
                    onClick={() => handleToggleState(st.id, "late")}
                    className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                      isLate 
                        ? "bg-amber-500 text-white border border-amber-550 shadow-sm shadow-amber-100 scale-102" 
                        : "bg-slate-50 dark:bg-slate-900 text-slate-450 dark:text-slate-400 border border-slate-205 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/25 hover:text-amber-500 dark:hover:text-amber-350"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">متأخر</span>
                  </button>

                  {/* Present Button (حاضر) */}
                  <button
                    type="button"
                    onClick={() => handleToggleState(st.id, "present")}
                    className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                      isPresent 
                        ? "bg-emerald-600 text-white border border-emerald-650 shadow-sm shadow-emerald-100 scale-102" 
                        : "bg-slate-50 dark:bg-slate-900 text-slate-450 dark:text-slate-400 border border-slate-205 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 hover:text-emerald-600 dark:hover:text-emerald-355"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">حاضر</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save Button */}
      {groupStudents.length > 0 && (
        <button 
          onClick={handleSave}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          id="btn_save_attendance"
        >
          <Save className="w-4.5 h-4.5" />
          <span>تأكيد وحفظ دفتر الحضور اليومي</span>
        </button>
      )}

      {/* Guest Student Support Dialog */}
      <AnimatePresence>
        {pendingGuestStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl max-w-md w-full text-right"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="text-sm font-black text-slate-850 dark:text-slate-100">طالب من مجموعة أخرى</h3>
                </div>
                <button 
                  onClick={() => setPendingGuestStudent(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-bold">
                  الطالب <span className="text-slate-900 dark:text-white underline decoration-amber-500 decoration-2 font-black">{pendingGuestStudent.name}</span> مسجل في مجموعة <span className="font-extrabold text-blue-600 dark:text-blue-400">«{state.groups.find(g => g.id === pendingGuestStudent.groupId)?.name || "مجموعة أخرى"}»</span> وليس هذه المجموعة.
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 leading-normal">
                  اختر الإجراء المطلوب لتسجيل الحضور للحصة الحالية:
                </p>
              </div>

              {/* Actions */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-105 dark:border-slate-850 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleTransferAndMarkPresent(pendingGuestStudent)}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition duration-150 cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>نقل دائم إلى هذه المجموعة وتسجيل حضور</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleMarkInOriginalGroup(pendingGuestStudent)}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs transition duration-150 cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>تسجيل حضور في مجموعته الأصلية اليوم فقط</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setPendingGuestStudent(null)}
                  className="w-full py-3 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-extrabold text-xs transition duration-150 cursor-pointer text-center"
                >
                  إلغاء الأمر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
