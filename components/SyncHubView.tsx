"use client";

import { useState, useEffect } from "react";
import { useAppStore, store } from "@/lib/store";
import { 
  getPendingDeltaSyncEvents, 
  collateEvents, 
  DeltaSyncEvent 
} from "@/lib/db";
import { SyncService, DiffReport, DiffEntity } from "@/lib/syncService";
import { 
  Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, HelpCircle, 
  ArrowLeftRight, FileText, Split, Check, Layers, Play, Settings2, Trash2, Database
} from "lucide-react";

export default function SyncHubView() {
  const storeState = useAppStore((s) => s);

  const [pendingEvents, setPendingEvents] = useState<DeltaSyncEvent[]>([]);
  const [syncStatusLog, setSyncStatusLog] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<"queue" | "collate" | "diff">("diff");
  const [conflictStrategy, setConflictStrategy] = useState<"client" | "cloud" | "merge">("client");
  const [dbConfigStatus, setDbConfigStatus] = useState<"checking" | "fallback" | "empty" | "connected">("checking");
  const [dbMessage, setDbMessage] = useState<string>("");

  // Load pending events from local db queue & check Neon Cloud DB connection status
  const loadPendingEvents = async () => {
    if (!store.getState().currentUserRole) return;
    const events = await getPendingDeltaSyncEvents();
    setTimeout(() => {
      setPendingEvents(events);
    }, 0);

    try {
      const requestId = `HUB-LOAD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[DIAGNOSTIC CALL] RequestID: ${requestId} | Caller: SyncHubView.loadPendingEvents | Origin: ${window.location.origin} | Href: ${window.location.href} | Visibility: ${document.visibilityState} | Credentials: same-origin`);

      const response = await fetch("/api/sync", { 
        credentials: "same-origin",
        headers: { "x-sync-request-id": requestId }
      });
      console.log(`[DIAGNOSTIC RESPONSE] RequestID: ${requestId} | HTTP Status: ${response.status} ${response.statusText}`);

      const data = await response.json();
      if (data.status === "fallback") {
        setDbConfigStatus("fallback");
        setDbMessage("التطبيق يعمل بوضع التخزين المؤقت أوفلاين لحين الاتصال بالشبكة.");
      } else if (data.status === "empty") {
        setDbConfigStatus("empty");
        setDbMessage("قاعدة بيانات Neon متصلة بنجاح! السيرفر فارغ تماماً وجاهز لاستقبال كشوفك وبياناتك.");
      } else {
        setDbConfigStatus("connected");
        setDbMessage("قاعدة بيانات Neon PostgreSQL السحابية متصلة وشغالة بنجاح!");
      }
    } catch (e) {
      setDbConfigStatus("fallback");
      setDbMessage("تعذر الوصول للسيرفر السحابي، التغييرات محفوظة مؤقتاً بالانتظار.");
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadPendingEvents();
    };
    init();
  }, []);

  // Compute the state diff report dynamically on-the-fly during rendering
  const diffReport = SyncService.calculateStateDiff(storeState, pendingEvents);

  const getActionLabel = (act: string) => {
    switch (act) {
      case "TOGGLE_ATTENDANCE": return "تحضير / غياب طالب";
      case "ADD_STUDENT": return "إضافة طالب جديد";
      case "UPDATE_STUDENT": return "تحديث بيانات طالب";
      case "DELETE_STUDENT": return "حذف ملف طالب";
      case "ADD_PAYMENT": return "تحصيل سند مالي";
      case "DELETE_PAYMENT": return "إلغاء قسيمة مالية";
      case "ADD_GROUP": return "تأسيس مجموعة جديدة";
      case "UPDATE_GROUP": return "تعديل تفاصيل مجموعة";
      case "DELETE_GROUP": return "شطب وإلغاء مجموعة";
      case "ADD_RECITATION": return "رصد سجل تسميع";
      case "DELETE_RECITATION": return "حذف سجل تسميع";
      case "ADD_EXAM": return "إنشاء امتحان تحريري";
      case "SAVE_EXAM_SCORES": return "حفظ درجات امتحان";
      case "DELETE_EXAM": return "إلغاء امتحان بالدرجات";
      case "ADD_NOTE": return "إدخال ملاحظة سلوك";
      case "DELETE_NOTE": return "حذف ملاحظة سلوك";
      default: return act;
    }
  };

  const getActionBadgeColor = (act: string) => {
    if (act.startsWith("ADD_") || act === "ADD_STUDENT") return "bg-green-50 text-green-700 border-green-200";
    if (act.startsWith("DELETE_") || act === "DELETE_STUDENT") return "bg-red-50 text-red-700 border-red-200";
    if (act.startsWith("UPDATE_") || act.startsWith("SAVE_") || act === "UPDATE_STUDENT") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case "student": return "طالب";
      case "group": return "مجموعة";
      case "payment": return "سند مالي";
      case "attendance": return "كشف حضور";
      case "recitation": return "تسميع شفوي";
      case "exam": return "امتحان تحريري";
      case "studentNote": return "ملاحظة";
      default: return type;
    }
  };

  // Perform operational collation and cloud sync
  const handleSimulateSync = async () => {
    if (pendingEvents.length === 0 && (!diffReport || diffReport.entities.length === 0)) {
      setSyncStatusLog((prev) => ["لا توجد عمليات معلقة أو اختلافات في قاعدة البيانات لتتم مزامنتها.", ...prev]);
      return;
    }

    setIsSyncing(true);
    setSyncStatusLog([]);

    const log = (msg: string) => {
      setSyncStatusLog((prev) => [msg, ...prev]);
    };

    try {
      log("⏳ جاري تهيئة الاتصال بالسيرفر السحابي لقاعدة بيانات Neon PostgreSQL...");
      await new Promise((r) => setTimeout(r, 400));

      const rawCount = pendingEvents.length;
      log(`📝 تم تحديد عدد ${rawCount} عملية معلقة محلياً في قائمة الانتظار.`);

      if (conflictStrategy === "cloud") {
        log("📥 جاري استعادة أحدث حالة معتمدة من خادم Neon PostgreSQL...");
        const response = await fetch("/api/sync", { credentials: "same-origin" });
        const result = await response.json();

        if (response.ok && result.payload) {
          store.setState(result.payload);
          const { clearStore } = await import("@/lib/db");
          await clearStore("delta_sync_events");
          await SyncService.commitSync(result.payload, []);
          log("🧹 تم تنزيل بيانات السيرفر بالكامل، وتصفية التعديلات المحلية، وإعادة تعيين الخط الأساسي بنجاح!");
        } else {
          log("⚠️ لم يتم العثور على نسخة سحابية سابقة في قاعدة البيانات أو خطأ في الاتصال.");
        }
      } else {
        log("🚀 جاري رفع حزم التعديلات المدققة تفاضلياً إلى Neon PostgreSQL...");

        const response = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            localState: storeState,
            pendingEvents: pendingEvents,
          }),
        });

        const result = await response.json();

        if (response.ok && result.status !== "fallback") {
          const authoritativeState = result.payload;
          store.setState({
            ...authoritativeState,
            syncStatus: "online",
          });

          const eventIds = pendingEvents.map((e) => e.id);
          await SyncService.commitSync(authoritativeState, eventIds);

          log("💾 تم حفظ الحالة المتزامنة الحالية كخط أساسي معتمد في Neon SQL بنجاح.");
          log("🎉 تمت المزامنة السحابية مع Neon SQL بنجاح!");
        } else {
          throw new Error(result.message || "فشلت المزامنة نظراً لعدم الاتصال بالسيرفر.");
        }
      }

      await loadPendingEvents();
    } catch (err: any) {
      log(`❌ فشلت المزامنة: ${err.message || "خطأ غير متوقع بالاتصال أو المعالجة"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const collatedEventsList = collateEvents(pendingEvents);

  return (
    <div className="space-y-6" id="sync_hub_view">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 h-1.5 w-full bg-blue-600"></div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin-slow" />
            <span>لوحة المزامنة الذكية والربط دون اتصال (CRDT Hub)</span>
          </h1>
          <p className="text-slate-400 dark:text-slate-450 text-xs mt-0.5">
            تتبع العمليات والتحضيرات السلوكية والمالية، وإجراء تصفية تفاضلية لتلافي التضارب أثناء انقطاع الإنترنت.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {dbConfigStatus === "checking" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-3 py-1 rounded-full">
                <Database className="w-3 h-3 animate-pulse" />
                <span>جاري التحقق من اتصال قاعدة بيانات Neon...</span>
              </span>
            )}
            {dbConfigStatus === "connected" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-3 py-1 rounded-full">
                <Database className="w-3 h-3" />
                <span>خادم Neon PostgreSQL السحابي متصل بنجاح ⚡</span>
              </span>
            )}
            {dbConfigStatus === "empty" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-500 font-bold bg-blue-500/10 px-3 py-1 rounded-full">
                <Database className="w-3 h-3" />
                <span>قاعدة بيانات Neon متصلة وفارغة بنجاح ✅ جاهزة للمزامنة الأولى.</span>
              </span>
            )}
            {dbConfigStatus === "fallback" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 font-bold bg-slate-500/10 px-3 py-1 rounded-full dark:text-slate-350 dark:bg-slate-800">
                <Database className="w-3 h-3" />
                <span>التطبيق في وضع عدم الاتصال (أوفلاين) - العمليات محفوظة محلياً بالانتظار</span>
              </span>
            )}
          </div>
        </div>

        {/* Sync Now Button */}
        <button
          onClick={async () => {
            import("@/lib/store").then(({ triggerBackgroundSync }) => {
              triggerBackgroundSync(true);
            });
            await loadPendingEvents();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition duration-200 active:scale-95 cursor-pointer"
          id="btn_trigger_manual_sync"
        >
          <RefreshCw className="w-4 h-4 animate-spin-slow" />
          <span>مزامنة فورية مع Neon SQL</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sync Console, Strategy, and Interactive Controls */}
        <div className="lg:col-span-1 bg-slate-900 duration-200 p-6 rounded-3xl text-white border border-slate-800 shadow-xl flex flex-col justify-between min-h-[580px]" id="sync_control_panel">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">إعدادات حل التعارض والتحكم:</span>
            </div>
            
            {/* Strategy Selectors */}
            <div className="space-y-2 mb-6">
              <span className="text-[10px] text-slate-405 block">استراتيجية معالجة الاختلافات والتعارض:</span>
              <div className="grid grid-cols-1 gap-2 mt-1.5">
                <button
                  onClick={() => setConflictStrategy("client")}
                  className={`p-2.5 text-right rounded-xl text-3xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    conflictStrategy === "client" 
                      ? "bg-blue-600/20 border border-blue-500 text-blue-300" 
                      : "bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Check className={`w-3.5 h-3.5 ${conflictStrategy === "client" ? "opacity-100" : "opacity-0"}`} />
                    <span>تعديلات العميل تكسب (LWW)</span>
                  </div>
                  <span className="text-3xs opacity-60">تحديث السيرفر</span>
                </button>

                <button
                  onClick={() => setConflictStrategy("cloud")}
                  className={`p-2.5 text-right rounded-xl text-3xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    conflictStrategy === "cloud" 
                      ? "bg-red-650/20 border border-red-500 text-red-300" 
                      : "bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Check className={`w-3.5 h-3.5 ${conflictStrategy === "cloud" ? "opacity-100" : "opacity-0"}`} />
                    <span>استرجاع الخط الأساسي للسيرفر</span>
                  </div>
                  <span className="text-3xs opacity-60">تراجع وإلغاء</span>
                </button>

                <button
                  onClick={() => setConflictStrategy("merge")}
                  className={`p-2.5 text-right rounded-xl text-3xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    conflictStrategy === "merge" 
                      ? "bg-purple-600/20 border border-purple-500 text-purple-300" 
                      : "bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Check className={`w-3.5 h-3.5 ${conflictStrategy === "merge" ? "opacity-100" : "opacity-0"}`} />
                    <span>دمج ذكي تفاضلي (Attribute Merge)</span>
                  </div>
                  <span className="text-3xs opacity-60">توليف تلقائي</span>
                </button>
              </div>
            </div>

            {/* Sync Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleSimulateSync}
                disabled={isSyncing || (pendingEvents.length === 0 && (!diffReport || diffReport.entities.length === 0))}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100 cursor-pointer font-bold text-xs rounded-2xl transition duration-150 shadow-lg shadow-blue-600/10"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>ترحيل ومزامنة الفروق الآن</span>
              </button>
              
              <button
                onClick={async () => {
                  if (confirm("هل تريد تفريغ لوحة الانتظار محلياً دون مزامنة؟ سيؤدي هذا لإلغاء المزامنة السحابية الحالية وتجديد الخط الأساسي.")) {
                    const { clearStore } = await import("@/lib/db");
                    await clearStore("delta_events");
                    SyncService.saveBaseline(storeState);
                    loadPendingEvents();
                    setSyncStatusLog(["[نظام] تم تصفير قائمة المزامنة وإمضاء الخط الأساسي الحالي بنجاح.", ...syncStatusLog]);
                  }
                }}
                className="w-full py-2 border border-slate-200 dark:border-slate-850 hover:border-red-500 hover:bg-red-950/20 text-slate-500 dark:text-slate-450 hover:text-red-450 cursor-pointer font-bold text-2xs rounded-xl transition text-center"
              >
                تحديث الخط الأساسي واختزال التعديلات (Reset Baseline)
              </button>
            </div>
          </div>

          {/* Console Output Window */}
          <div className="flex-1 mt-6 flex flex-col min-h-[180px] bg-slate-950/85 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
            <span className="text-[10px] text-indigo-400 font-mono font-bold block mb-2 select-none">وحدة تتبع دمج المعاملات (Logs Console):</span>
            <div className="flex-1 overflow-y-auto font-mono text-3xs space-y-2 select-text divide-y divide-slate-900 pr-1">
              {syncStatusLog.length === 0 ? (
                <div className="text-center py-10 text-slate-600 font-sans">
                  <Database className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-slate-550 dark:text-slate-500" />
                  <p className="text-[10px]">جاهز لرصد العمليات السلوكية والتحقق من الشبكة...</p>
                </div>
              ) : (
                syncStatusLog.map((logStr, idx) => (
                  <p key={idx} className="pt-2 text-slate-300 leading-normal font-sans text-[11px] text-right">{logStr}</p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Diff report and ledger detail lists */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 flex flex-col md:min-h-[580px]" id="delta_queue_logger">
          
          {/* Subtabs navigation header */}
          <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3 mb-4 shrink-0 overflow-x-auto gap-3">
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setActiveSubTab("diff")}
                className={`px-3 py-2 rounded-xl text-3xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "diff"
                    ? "bg-slate-900 dark:bg-slate-950 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>فحص الفروق التفاضلية (State Diffs) ({diffReport?.totalChanges || 0})</span>
              </button>

              <button
                onClick={() => setActiveSubTab("queue")}
                className={`px-3 py-2 rounded-xl text-3xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "queue"
                    ? "bg-blue-50 dark:bg-blue-950/35 text-blue-700 dark:text-blue-400 border border-blue-150 dark:border-blue-900/50"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>سلسلـة أحداث التعديل ({pendingEvents.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab("collate")}
                className={`px-3 py-2 rounded-xl text-3xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "collate"
                    ? "bg-indigo-50 dark:bg-indigo-950/35 text-indigo-750 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/50"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>الحزمة المضغوطة (CRDT) ({collatedEventsList.length})</span>
              </button>
            </div>
            
            <button
              onClick={loadPendingEvents}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-150 dark:border-slate-850 rounded-xl text-3xs font-bold transition shrink-0 cursor-pointer"
            >
              تجديد الكشف
            </button>
          </div>

          {/* Dynamic Tab Panel Content */}
          <div className="flex-1 overflow-y-auto">
            
            {/* 1. STATE DIFF VIEW */}
            {activeSubTab === "diff" && (
              !diffReport || diffReport.entities.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                  <CheckCircle2 className="w-11 h-11 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">تطابق تام بنسبة 100%!</p>
                  <p className="text-3xs text-slate-450 mt-1 max-w-sm mx-auto">
                    لا توجد أي فروق تفاضلية بين قاعدة البيانات المحلية والخط الأساسي السحابي المحفوظ. تفضل بإتمام أي عمليات وسلوكيات دون شبكة لعرضها هنا.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    💡 <strong>تقرير الفروق التفاضلية للعمل والتقييم دون اتصال:</strong> يقوم المحرك بفحص السمات وتجزئتها، ويقوم بعزل فقط السجلات والحقول التي طرأ عليها تعديل فعلي مقارنة بالخط الأساسي السحابي الأخير، لضمان استهلاك إنترنت ذو كفاءة متناهية ودرء التعارض.
                  </div>

                  <div className="divide-y divide-slate-150 dark:divide-slate-850 border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/10 shadow-xs">
                    {diffReport.entities.map((ent, idx) => (
                      <div key={`${ent.id}_${idx}`} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                              ent.operation === "ADD" 
                                ? "bg-green-50 text-green-700 border-green-200" 
                                : ent.operation === "DELETE"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {ent.operation === "ADD" ? "إضافة" : ent.operation === "DELETE" ? "حذف" : "تعديل حقول"}
                            </span>
                            <span className="text-slate-400 text-3xs">|</span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                              {getTypeLabel(ent.type)}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[210px]">
                              {ent.name}
                            </span>
                          </div>

                          {/* Attributes Level Differences */}
                          {ent.diffs && ent.diffs.length > 0 && (
                            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl p-2.5 space-y-1.5 text-3xs font-mono">
                              {ent.diffs.map((df, dIdx) => (
                                <div key={dIdx} className="flex flex-wrap items-center gap-1.5 select-text text-slate-600 dark:text-slate-300">
                                  <span className="font-bold underline text-slate-550 dark:text-slate-400">{df.field}:</span>
                                  <span className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1 py-0.5 rounded line-through">
                                    {typeof df.oldValue === "object" ? JSON.stringify(df.oldValue) : String(df.oldValue || "لا يوجد")}
                                  </span>
                                  <span className="text-slate-450 dark:text-slate-500 font-sans">&rarr;</span>
                                  <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/25 px-1 py-0.5 rounded font-bold">
                                    {typeof df.newValue === "object" ? JSON.stringify(df.newValue) : String(df.newValue)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Added entities properties */}
                          {ent.payload && ent.operation === "ADD" && (
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-4xs font-mono text-slate-500 dark:text-slate-400 border border-transparent dark:border-slate-850">
                              {JSON.stringify(ent.payload).substring(0, 160)}...
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono self-start md:self-center select-none">
                          ID: <span className="bg-slate-100 dark:bg-slate-800 rounded px-1 text-slate-550 dark:text-slate-400">{ent.id}</span>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* 2. ACTIONS LEVEL LOCAL QUEUE */}
            {activeSubTab === "queue" && (
              pendingEvents.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                  <CheckCircle2 className="w-11 h-11 text-slate-350 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-250">قائمة الانتظار فارغة بالكامل!</p>
                  <p className="text-3xs text-slate-450 dark:text-slate-500 mt-1">لا توجد عمليات مضافة لإرسالها.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingEvents.map((ev) => (
                    <div 
                      key={ev.id} 
                      className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getActionBadgeColor(ev.action)}`}>
                          {getActionLabel(ev.action)}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[200px]">
                            {ev.action === "TOGGLE_ATTENDANCE" 
                              ? `طالب كود: ${ev.payload.studentId} - ${ev.payload.present ? "تثبيت حضور" : "غياب مستحق"}`
                              : ev.payload.name || ev.payload.title || `معرف: ${ev.payload.id || "تعديل"}`}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                            {new Date(ev.timestamp).toLocaleTimeString("ar-EG")} &middot; المعرف الفرعي: {ev.id}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg text-4xs font-mono font-bold text-slate-500 dark:text-slate-450 border border-transparent dark:border-slate-800/60 max-w-[230px] truncate select-text">
                        {JSON.stringify(ev.payload)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 3. COMPACT COLLATED CRDT VIEW */}
            {activeSubTab === "collate" && (
              collatedEventsList.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                  <ArrowLeftRight className="w-11 h-11 text-indigo-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-750 dark:text-slate-200">لا يوجد عناصر مدمجة لتلخيصها.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-[10px] text-indigo-850 dark:text-indigo-300 leading-relaxed mb-4">
                    📢 <strong>كيف تعمل خوارزمية الدمج والتوليف؟</strong> إذا قام السكرتير بإضافة طالب وتعديله عدّة مرات وتغيير كشف حضوره مراراً وهو خارج التغطية، يقوم محرك دمج الأحداث باكتشاف التكرارات، وحل التعارض بالاعتماد على التوقيت الزمني، وترحيل تجميعة واحدة مختصرة ومثالية لتوفير موارد الخوادم والاتصال.
                  </div>
                  {collatedEventsList.map((ev, idx) => (
                    <div 
                      key={`${ev.id}_${idx}`} 
                      className="p-3 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-150/50 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getActionBadgeColor(ev.action)}`}>
                          {getActionLabel(ev.action)}
                        </span>
                        <div>
                          <span className="font-semibold text-indigo-955 dark:text-indigo-200 block truncate max-w-[220px]">
                            {ev.action === "TOGGLE_ATTENDANCE" 
                              ? `طالب كود: ${ev.payload.studentId} - ${ev.payload.present ? "حضور مؤكد" : "غياب مؤكد"}`
                              : ev.payload.name || ev.payload.title || `سجل كود: ${ev.payload.id}`}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] text-green-700 font-extrabold bg-green-50 px-2 py-0.5 rounded-full border border-green-105 select-none">
                        جاهز للنشر المصغر للشبكة
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
