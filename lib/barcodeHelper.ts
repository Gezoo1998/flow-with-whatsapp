// Portrait Barcode System (48mm × 101.5mm)
// Code 128 pure SVG generator and Portrait label printing pipeline.

import { generateCode128SVG, Code128SVGOptions } from './barcodeCode128';

export interface BarcodeOptions {
  width?: number; // Target narrow bar module width in pixels
  height?: number; // Height of the barcode in pixels
  includeText?: boolean;
}

export function generateCode128PortraitSVG(
  text: string,
  options: BarcodeOptions = {}
): { svgContent: string; width: number; height: number } {
  return generateCode128SVG(text, {
    moduleWidth: options.width || 1.4,
    height: options.height || 45,
    includeText: options.includeText,
    quietZoneModules: 8
  });
}

// Backward compatibility alias for generateCode39SVG -> now genuine Code 128
export const generateCode39SVG = generateCode128PortraitSVG;

export interface PrintLabelStudentData {
  id: string;
  name: string;
  groupName?: string;
  parentPhone?: string;
  phone?: string;
}

// ==========================================
// PORTRAIT PRINTING (48mm × 101.5mm)
// ==========================================

export function generatePortraitLabelHTML(students: PrintLabelStudentData[]): string {
  const labelItems = students.map((st) => {
    const cleanId = (st.id || "").trim();
    const cleanName = (st.name || "").trim();
    // Barcode encodes ONLY student ID in Code 128 format
    const { svgContent } = generateCode128PortraitSVG(cleanId, { includeText: false, height: 45, width: 1.4 });

    return `<div class="label-page">
      <div class="content-area">
        <div class="barcode-container">${svgContent}</div>
        <div class="label-text" dir="rtl"><bdi>${cleanName}</bdi> - <bdi>${cleanId}</bdi></div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <title>طباعة ملصقات الباركود - رأسي</title>
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
        width: 48mm;
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: 'Cairo', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #000000;
      }

      .label-page {
        width: 48mm;
        max-width: 48mm;
        padding: 2mm 2mm;
        background: #ffffff;
        box-sizing: border-box;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
      }

      .label-page:last-child,
      .label-page:only-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      .content-area {
        width: 44mm;
        max-width: 44mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
        box-sizing: border-box;
        overflow: hidden;
        margin: 0 auto;
        padding: 0;
      }

      .barcode-container {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 1.5mm;
      }

      .barcode-container svg {
        width: auto !important;
        max-width: 42mm !important;
        height: auto !important;
        max-height: 24mm !important;
        shape-rendering: crispEdges;
      }

      .label-text {
        width: 100%;
        max-width: 44mm;
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
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        });

        var labelTexts = document.querySelectorAll('.label-text');
        labelTexts.forEach(function(el) {
          var fontSize = 3.8;
          while (el.scrollWidth > el.clientWidth && fontSize > 2.0) {
            fontSize -= 0.1;
            el.style.fontSize = fontSize + 'mm';
          }
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

export function printStudentBarcodeLabel(student: PrintLabelStudentData): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generatePortraitLabelHTML([student]);
  printWindow.document.write(html);
  printWindow.document.close();
}

export function printMultipleBarcodeLabels(students: PrintLabelStudentData[]): void {
  if (typeof window === "undefined" || !students.length) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generatePortraitLabelHTML(students);
  printWindow.document.write(html);
  printWindow.document.close();
}
