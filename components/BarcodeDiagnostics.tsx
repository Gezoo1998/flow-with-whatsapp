'use client';

import { useState, useTransition } from 'react';
import { Bug, X, RefreshCw, Printer, Download, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { generateCode128PortraitSVG } from '@/lib/barcodeHelper';
import { generateCode128LandscapeSVG } from '@/lib/barcodeHelperLandscape';
import { generateCode128DynamicSVG } from '@/lib/barcodeHelperDynamic';
import { generateCode128Bitmap, downloadStudentBarcodeBitmap, printStudentBarcodeBitmap } from '@/lib/barcodeHelperBitmap';
import { downloadStudentBarcodePDF, printStudentBarcodePDF } from '@/lib/barcodeHelperPDF';
import {
  generateCompactBarcodePNG,
  downloadStudentBarcodeCompact,
  printStudentBarcodeCompact,
  downloadMultipleBarcodeZip,
  CompactVariant
} from '@/lib/barcodeHelperCompact';

export interface BarcodeDiagnosticsProps {
  student?: {
    id: string;
    name: string;
    groupName?: string;
  };
}

export function BarcodeDiagnostics({ student }: BarcodeDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCompactVariant, setActiveCompactVariant] = useState<CompactVariant>('COMPACT');
  const [, startTransition] = useTransition();

  const testStudent = student || {
    id: 'ST-1037',
    name: 'محمد مصطفى علي السعيد',
    groupName: 'المجموعة الأولى (أبطال)',
  };

  // Compute diagnostics metrics for all engines using Code 128
  const portraitSvg = generateCode128PortraitSVG(testStudent.id, { height: 45, width: 1.4 });
  const landscapeSvg = generateCode128LandscapeSVG(testStudent.id, { height: 45, width: 1.4 });
  const dynamicSvg = generateCode128DynamicSVG(testStudent.id, { height: 45, width: 1.4 });
  const bitmapRes = typeof window !== 'undefined' ? generateCode128Bitmap(testStudent, { scale: 3 }) : null;
  const compactRes = typeof window !== 'undefined' ? generateCompactBarcodePNG(testStudent, activeCompactVariant) : null;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-amber-400 border border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer shadow-sm"
        title="فتح أداة تشخيصات أنظمة الباركود (Code 128)"
      >
        <Bug className="w-3.5 h-3.5" />
        <span>تشخيص الباركود (CODE 128)</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-800 dark:text-slate-100 flex flex-col gap-6" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">لوحة تشخيص وتطوير أنظمة الباركود (Code 128)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اختبار الأبعاد الفعالية والمخرجات لمطابعة Xprinter XP-246B بكود CODE 128
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Environment Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100 dark:bg-slate-950 p-3.5 rounded-xl text-xs">
          <div>
            <span className="text-slate-500 block">كود الطالب:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{testStudent.id}</span>
          </div>
          <div>
            <span className="text-slate-500 block">اسم الطالب:</span>
            <span className="font-bold text-slate-900 dark:text-white truncate block">{testStudent.name}</span>
          </div>
          <div>
            <span className="text-slate-500 block">نسبة بكسل الشاشة (DPR):</span>
            <span className="font-mono font-bold text-amber-600">{dpr}x</span>
          </div>
          <div>
            <span className="text-slate-500 block">المقاس المستهدف للملصق:</span>
            <span className="font-bold text-emerald-600">48mm × 101.5mm (Code 128 Compact)</span>
          </div>
        </div>

        {/* Systems Diagnostics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* System 1: Portrait SVG */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400">1. النظام الرأسي (Code 128 Portrait SVG)</span>
                <span className="text-3xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono">
                  {portraitSvg.width}px × {portraitSvg.height}px
                </span>
              </div>
              <p className="text-3xs text-slate-500 mb-2">أبعاد SVG الحقيقية المحسوبة بكود Code 128.</p>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center min-h-[90px]">
                <div dangerouslySetInnerHTML={{ __html: portraitSvg.svgContent }} className="max-w-[160px]" />
                <span className="text-3xs font-bold mt-1">{testStudent.name} - {testStudent.id}</span>
              </div>
            </div>
            <div className="text-3xs text-slate-500">
              <span>طريقة العرض: </span><span className="font-semibold text-slate-700 dark:text-slate-300">Code 128 SVG Vector Page Break</span>
            </div>
          </div>

          {/* System 2: Landscape SVG */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-xs text-purple-600 dark:text-purple-400">2. النظام الأفقي (Code 128 Landscape SVG)</span>
                <span className="text-3xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-mono">
                  {landscapeSvg.width}px × {landscapeSvg.height}px
                </span>
              </div>
              <p className="text-3xs text-slate-500 mb-2">مخصص للملصقات ذات العرض الأفقِي بكود Code 128.</p>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center min-h-[90px]">
                <div dangerouslySetInnerHTML={{ __html: landscapeSvg.svgContent }} className="max-w-[180px]" />
                <span className="text-3xs font-bold mt-1">{testStudent.name} - {testStudent.id}</span>
              </div>
            </div>
            <div className="text-3xs text-slate-500">
              <span>طريقة العرض: </span><span className="font-semibold text-slate-700 dark:text-slate-300">Code 128 SVG Landscape @page</span>
            </div>
          </div>

          {/* System 3: Dynamic SVG */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">3. النظام الديناميكي (Code 128 Dynamic SVG)</span>
                <span className="text-3xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  {dynamicSvg.width}px × {dynamicSvg.height}px
                </span>
              </div>
              <p className="text-3xs text-slate-500 mb-2">يتكيف مع المحتوى تلقائياً بحجم مضغوط بكود Code 128.</p>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center min-h-[90px]">
                <div dangerouslySetInnerHTML={{ __html: dynamicSvg.svgContent }} className="max-w-[160px]" />
                <span className="text-3xs font-bold mt-1">{testStudent.name} - {testStudent.id}</span>
              </div>
            </div>
            <div className="text-3xs text-slate-500">
              <span>طريقة العرض: </span><span className="font-semibold text-slate-700 dark:text-slate-300">Code 128 Content Bounding Box</span>
            </div>
          </div>

          {/* System 4: Bitmap / PNG */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400">4. نظام الصورة النقطية (Code 128 Canvas PNG)</span>
                <span className="text-3xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  {bitmapRes ? `${bitmapRes.canvas.width}px × ${bitmapRes.canvas.height}px` : 'N/A'}
                </span>
              </div>
              <p className="text-3xs text-slate-500 mb-2">صورة مقتصة بكود Code 128 النقية.</p>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center min-h-[90px]">
                {bitmapRes && (
                  <img src={bitmapRes.dataUrl} alt="Canvas preview" className="max-w-[180px] border border-dashed border-amber-300" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadStudentBarcodeBitmap(testStudent)}
                className="py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-3xs font-bold transition flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>تحميل PNG</span>
              </button>
              <button
                onClick={() => printStudentBarcodeBitmap(testStudent)}
                className="py-1 px-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-3xs font-bold transition flex items-center gap-1"
              >
                <Printer className="w-3 h-3" />
                <span>طباعة PNG</span>
              </button>
            </div>
          </div>

        </div>

        {/* System 6: Independent Compact Barcode System */}
        <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-xl font-bold text-xs">
                CODE 128
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-teal-800 dark:text-teal-300">
                  النظام المصغر المستقل (Code 128 Compact Barcode System)
                </h4>
                <p className="text-3xs text-slate-600 dark:text-slate-400">
                  صورة PNG مقتصة تلقائياً بحسابات البيكسل الفعلية (4-Side Auto Crop) بكود Code 128 عالي الكثافة.
                </p>
              </div>
            </div>

            {/* Compact Variant Selector */}
            <div className="flex flex-wrap items-center gap-1 bg-teal-100 dark:bg-teal-900/60 p-1 rounded-xl self-stretch sm:self-auto">
              {(['COMPACT', 'EXTRA_COMPACT', 'ULTRA_COMPACT', 'ULTRA_TALL'] as CompactVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setActiveCompactVariant(v)}
                  className={`px-2.5 py-1 rounded-lg text-3xs font-extrabold transition cursor-pointer ${
                    activeCompactVariant === v
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-teal-800 dark:text-teal-200 hover:bg-teal-200/50 dark:hover:bg-teal-800/50'
                  }`}
                >
                  {v === 'COMPACT' ? 'Compact' : v === 'EXTRA_COMPACT' ? 'Extra Compact' : v === 'ULTRA_COMPACT' ? 'Ultra Compact' : 'Ultra Tall'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-white dark:bg-slate-900 p-3.5 border border-teal-100 dark:border-teal-900 rounded-lg">
            <div className="flex flex-col items-center justify-center min-h-[100px]">
              {compactRes ? (
                <div className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={compactRes.dataUrl}
                    alt="Compact Preview"
                    className="border border-dashed border-teal-400 bg-white shadow-xs max-h-[100px] object-contain"
                  />
                  <span className="text-3xs font-mono text-teal-700 dark:text-teal-400">
                    أبعاد الصورة: {compactRes.canvas.width}px × {compactRes.canvas.height}px (منطقية: {compactRes.width}×{compactRes.height})
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">جاري التوليد...</span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 justify-center">
              <div className="text-3xs text-slate-600 dark:text-slate-300 space-y-1 bg-teal-50/50 dark:bg-slate-950 p-2.5 rounded-lg border border-teal-100 dark:border-slate-800">
                <div>• <span className="font-bold">المعدل المصغر:</span> {activeCompactVariant}</div>
                <div>• <span className="font-bold">الاقتصاص التلقائي:</span> تم إزالة كافة المساحات البيضاء من جميع الاتجاهات (4-Side Pixel Bounding Box).</div>
                <div>• <span className="font-bold">ترميز Code 128:</span> أعلى كثافة مع حجم باركود أصغر بمرتين وحواف حادة وسلاسة مسح ضوئي فائقة.</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadStudentBarcodeCompact(testStudent, activeCompactVariant)}
                  className="flex-1 py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل PNG {activeCompactVariant}</span>
                </button>
                <button
                  onClick={() => downloadMultipleBarcodeZip([testStudent], activeCompactVariant, `barcode_${activeCompactVariant.toLowerCase()}_${testStudent.id}.zip`)}
                  className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  title="تحميل الباركود في ملف ZIP مضغوط"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل ZIP</span>
                </button>
                <button
                  onClick={() => printStudentBarcodeCompact(testStudent, activeCompactVariant)}
                  className="flex-1 py-1.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة PNG {activeCompactVariant}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System 5: PDF System Test Action */}
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-rose-700 dark:text-rose-400">5. نظام مستندات Code 128 PDF الملموسة (jsPDF Content-Sized)</h4>
              <p className="text-3xs text-slate-600 dark:text-slate-400">ينشئ ملفات PDF بأبعاد مخصصة مباشرة بدون الهوامش التقليدية أو مشاكل المتصفح.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => downloadStudentBarcodePDF(testStudent)}
              className="flex-1 sm:flex-initial py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل PDF</span>
            </button>
            <button
              onClick={() => printStudentBarcodePDF(testStudent)}
              className="flex-1 sm:flex-initial py-1.5 px-3 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة PDF</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق التشخيص
          </button>
        </div>

      </div>
    </div>
  );
}
