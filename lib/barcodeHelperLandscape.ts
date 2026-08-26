// Independent Landscape Barcode Helper (101.5mm × 48mm)
// Code 128 pure SVG generator and standalone Landscape print pipeline.

import { generateCode128SVG } from './barcodeCode128';

export interface BarcodeLandscapeOptions {
  width?: number; // Narrow bar unit width
  height?: number; // Height unit of the barcode
  includeText?: boolean;
}

export function generateCode128LandscapeSVG(
  text: string,
  options: BarcodeLandscapeOptions = {}
): { svgContent: string; width: number; height: number } {
  return generateCode128SVG(text, {
    moduleWidth: options.width || 1.4,
    height: options.height || 45,
    includeText: options.includeText,
    quietZoneModules: 8
  });
}

// Alias for backward compatibility
export const generateCode39LandscapeSVG = generateCode128LandscapeSVG;

export interface PrintLabelStudentData {
  id: string;
  name: string;
  groupName?: string;
  parentPhone?: string;
  phone?: string;
}

export function generateLandscapeLabelHTML(students: PrintLabelStudentData[]): string {
  const labelItems = students.map((st) => {
    const cleanId = (st.id || "").trim();
    const cleanName = (st.name || "").trim();
    // Pure vector SVG encoding ONLY student ID in Code 128
    const { svgContent } = generateCode128LandscapeSVG(cleanId, { includeText: false, height: 45, width: 1.4 });

    return `<div class="landscape-barcode-page">
      <div class="landscape-barcode-content">
        <div class="landscape-barcode-container">${svgContent}</div>
        <div class="landscape-barcode-text" dir="rtl"><bdi>${cleanName}</bdi> - <bdi>${cleanId}</bdi></div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <title>طباعة ملصقات الباركود - أفقي</title>
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
        size: 101.5mm 48mm;
        margin: 0;
      }

      html, body {
        width: 101.5mm;
        height: 48mm;
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: 'Cairo', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #000000;
        overflow: hidden;
      }

      .landscape-barcode-page {
        width: 101.5mm;
        height: 48mm;
        max-width: 101.5mm;
        max-height: 48mm;
        padding: 4mm 6mm;
        background: #ffffff;
        box-sizing: border-box;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .landscape-barcode-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .landscape-barcode-content {
        width: 90mm;
        max-width: 90mm;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        box-sizing: border-box;
        overflow: hidden;
      }

      .landscape-barcode-container {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 2mm;
      }

      .landscape-barcode-container svg {
        width: auto !important;
        height: auto !important;
        max-width: 80mm !important;
        max-height: 25mm !important;
        shape-rendering: crispEdges;
      }

      .landscape-barcode-text {
        width: 100%;
        max-width: 85mm;
        font-size: 3.8mm;
        font-weight: 800;
        color: #000000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
        line-height: 1.1;
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

        var labelTexts = document.querySelectorAll('.landscape-barcode-text');
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

export function printStudentBarcodeLabelLandscape(student: PrintLabelStudentData): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generateLandscapeLabelHTML([student]);
  printWindow.document.write(html);
  printWindow.document.close();
}

export function printMultipleBarcodeLabelsLandscape(students: PrintLabelStudentData[]): void {
  if (typeof window === "undefined" || !students.length) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = generateLandscapeLabelHTML(students);
  printWindow.document.write(html);
  printWindow.document.close();
}
