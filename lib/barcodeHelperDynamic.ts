// Standalone Dynamic Barcode Helper
// Pure SVG Code 128 generator and printer without forced physical paper sizes, orientation, or hardcoded dimensions.

import { generateCode128SVG } from './barcodeCode128';

export interface BarcodeDynamicOptions {
  width?: number; // Unit width multiplier
  height?: number; // Unit height multiplier
  includeText?: boolean;
}

export function generateCode128DynamicSVG(
  text: string,
  options: BarcodeDynamicOptions = {}
): { svgContent: string; width: number; height: number } {
  return generateCode128SVG(text, {
    moduleWidth: options.width || 1.4,
    height: options.height || 45,
    includeText: options.includeText,
    quietZoneModules: 8
  });
}

// Alias for backward compatibility
export const generateCode39DynamicSVG = generateCode128DynamicSVG;

export interface PrintLabelStudentData {
  id: string;
  name: string;
  groupName?: string;
  parentPhone?: string;
  phone?: string;
}

export function generateDynamicLabelHTML(students: PrintLabelStudentData[]): string {
  const labelItems = students.map((st) => {
    const cleanId = (st.id || "").trim();
    const cleanName = (st.name || "").trim();
    const { svgContent } = generateCode128DynamicSVG(cleanId, { includeText: false, height: 45, width: 1.4 });

    return `<div class="dynamic-barcode-page">
      <div class="dynamic-barcode-content">
        <div class="dynamic-barcode-container">${svgContent}</div>
        <div class="dynamic-barcode-text" dir="rtl"><bdi>${cleanName}</bdi> - <bdi>${cleanId}</bdi></div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <title>طباعة ملصقات الباركود - ديناميكي</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      @page {
        size: 48mm 101.5mm;
        margin: 0;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: 'Cairo', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #000000;
      }

      .dynamic-barcode-page {
        width: 48mm;
        max-width: 48mm;
        padding: 2mm 2mm;
        background: #ffffff;
        box-sizing: border-box;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: always;
        break-after: page;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
        overflow: hidden;
      }

      .dynamic-barcode-page:last-child,
      .dynamic-barcode-page:only-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      .dynamic-barcode-content {
        width: 44mm;
        max-width: 44mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 0;
      }

      .dynamic-barcode-container {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 1.5mm;
        overflow: hidden;
      }

      .dynamic-barcode-container svg {
        display: block;
        margin: 0 auto;
        max-width: 42mm;
        max-height: 24mm;
        width: auto;
        height: auto;
        shape-rendering: crispEdges;
      }

      .dynamic-barcode-text {
        width: 100%;
        font-size: 3.6mm;
        font-weight: 800;
        color: #000000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
        line-height: 1.2;
        margin: 0;
        padding: 0;
        font-family: 'Cairo', 'Segoe UI', system-ui, -apple-system, sans-serif;
      }
    </style>
  </head>
  <body>
    ${labelItems}
    <script>
      window.onload = function() {
        var svgs = document.querySelectorAll('svg');
        svgs.forEach(function(svg) {
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        });

        window.print();
        setTimeout(function() {
          window.close();
        }, 800);
      };
    </script>
  </body>
</html>`;
}

export function printStudentBarcodeLabelDynamic(student: PrintLabelStudentData): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generateDynamicLabelHTML([student]);
  printWindow.document.write(html);
  printWindow.document.close();
}

export function printMultipleBarcodeLabelsDynamic(students: PrintLabelStudentData[]): void {
  if (typeof window === "undefined" || !students.length) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generateDynamicLabelHTML(students);
  printWindow.document.write(html);
  printWindow.document.close();
}
