/**
 * 4th Independent Barcode System: Bitmap / Image Barcode Printing
 *
 * Generates Code 128 student barcodes directly into an HTML5 Canvas as a raster image (PNG),
 * completely bypassing SVG, CSS layout engines, and forced @page rules.
 */

import { encodeCode128 } from './barcodeCode128';

export interface StudentBarcodeInfo {
  id: string;
  name: string;
  groupName?: string;
  parentPhone?: string;
  phone?: string;
}

/**
 * Generates a high-resolution raster bitmap (PNG) of the student barcode label
 * rendered on an HTML5 canvas using Code 128 encoding.
 */
export function generateCode128Bitmap(
  student: StudentBarcodeInfo,
  options?: {
    scale?: number; // Scaling for high-DPI (default 3x)
    narrowBarWidth?: number; // Base width of narrow bar in px (default 1.8)
    barcodeHeight?: number; // Barcode height in px (default 65)
  }
): { canvas: HTMLCanvasElement; dataUrl: string; width: number; height: number } | null {
  if (typeof window === 'undefined') return null;

  const scale = options?.scale || 3;
  const narrow = options?.narrowBarWidth || 1.8;
  const barHeight = options?.barcodeHeight || 65;
  const quietZone = 12; // Compact side quiet zone in px
  const paddingTop = 8;
  const paddingBottom = 8;
  const textGap = 6;
  let baseFontSize = 15;

  const cleanId = (student.id || '').trim();
  const encoded = encodeCode128(cleanId);
  const calcBarcodeWidth = Math.ceil(encoded.totalModules * narrow);

  const cleanName = (student.name || '').trim();
  const labelText = `${cleanName} - ${cleanId}`;

  // Temporary measuring canvas
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return null;

  tempCtx.font = `bold ${baseFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
  let textMetrics = tempCtx.measureText(labelText);
  const targetMaxWidth = Math.max(calcBarcodeWidth + quietZone, 220);

  while (textMetrics.width > targetMaxWidth && baseFontSize > 9) {
    baseFontSize -= 1;
    tempCtx.font = `bold ${baseFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
    textMetrics = tempCtx.measureText(labelText);
  }

  const finalContentWidth = Math.max(calcBarcodeWidth, textMetrics.width);
  const baseWidth = Math.ceil(finalContentWidth + quietZone * 2);
  const baseHeight = Math.ceil(paddingTop + barHeight + textGap + baseFontSize + paddingBottom);

  // Main canvas setup
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(baseWidth * scale);
  canvas.height = Math.ceil(baseHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  // Solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Render Code 128 bars
  const barcodeStartX = Math.round((baseWidth - calcBarcodeWidth) / 2);
  let currentX = barcodeStartX;
  const barcodeStartY = paddingTop;

  ctx.fillStyle = '#000000';

  for (const bar of encoded.bars) {
    const widthPx = bar.width * narrow;
    if (bar.isBar) {
      ctx.fillRect(currentX, barcodeStartY, widthPx, barHeight);
    }
    currentX += widthPx;
  }

  // Render centered student name & ID text
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${baseFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const textY = barcodeStartY + barHeight + textGap;
  ctx.fillText(labelText, baseWidth / 2, textY);

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    width: baseWidth,
    height: baseHeight,
  };
}

// Alias for backward compatibility
export const generateCode39Bitmap = generateCode128Bitmap;

/**
 * Download single student barcode as PNG file.
 */
export function downloadStudentBarcodeBitmap(student: StudentBarcodeInfo): boolean {
  const result = generateCode128Bitmap(student);
  if (!result) return false;

  const cleanId = (student.id || 'student').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = `barcode-${cleanId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/**
 * Print single student barcode image using minimal popup window containing ONLY the PNG.
 */
export function printStudentBarcodeBitmap(student: StudentBarcodeInfo): boolean {
  const result = generateCode128Bitmap(student);
  if (!result) return false;

  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) return false;

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>باركود ${student.name || ''} - ${student.id || ''}</title>
  <style>
    @page {
      margin: 0;
      size: auto;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      font-family: 'Cairo', system-ui, sans-serif;
    }
    .barcode-bitmap-img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    @media print {
      html, body {
        margin: 0;
        padding: 0;
      }
      .barcode-bitmap-img {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <img src="${result.dataUrl}" alt="Barcode ${student.id}" class="barcode-bitmap-img" />
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
}

/**
 * Download PNG barcodes for multiple students.
 */
export function downloadMultipleBarcodeBitmaps(students: StudentBarcodeInfo[]) {
  if (!students || students.length === 0) return;

  students.forEach((st, idx) => {
    setTimeout(() => {
      downloadStudentBarcodeBitmap(st);
    }, idx * 250);
  });
}

/**
 * Print PNG barcode images for multiple students in one print stream.
 */
export function printMultipleBarcodeBitmaps(students: StudentBarcodeInfo[]) {
  if (!students || students.length === 0) return;

  const images = students
    .map((st) => {
      const res = generateCode128Bitmap(st);
      return res ? { ...st, dataUrl: res.dataUrl } : null;
    })
    .filter((item): item is { dataUrl: string; id: string; name: string } => item !== null);

  if (images.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=600,height=600');
  if (!printWindow) return;

  const imgTags = images
    .map(
      (img) => `<div class="print-page">
      <img src="${img.dataUrl}" alt="Barcode ${img.id}" class="barcode-bitmap-img" />
    </div>`
    )
    .join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة مجموعة صور الباركود</title>
  <style>
    @page {
      margin: 0;
      size: auto;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Cairo', system-ui, sans-serif;
    }
    .print-page {
      page-break-after: always;
      break-after: page;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10px;
      box-sizing: border-box;
    }
    .print-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .barcode-bitmap-img {
      max-width: 95%;
      height: auto;
      display: block;
      margin: auto;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  </style>
</head>
<body>
  ${imgTags}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
