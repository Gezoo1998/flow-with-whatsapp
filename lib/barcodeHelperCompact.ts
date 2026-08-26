/**
 * Compact Barcode System (Independent Helper)
 *
 * Generates ultra-compact, tightly auto-cropped Code 128 barcode PNG images directly on HTML5 Canvas.
 * Supports four compactness levels: COMPACT, EXTRA_COMPACT, ULTRA_COMPACT, and ULTRA_TALL.
 * Includes pixel-level 4-side bounding box auto-cropping to guarantee zero unnecessary whitespace.
 */

import JSZip from 'jszip';
import { encodeCode128 } from './barcodeCode128';

export interface StudentBarcodeInfo {
  id: string;
  name: string;
  groupName?: string;
  parentPhone?: string;
  phone?: string;
}

export type CompactVariant = 'COMPACT' | 'EXTRA_COMPACT' | 'ULTRA_COMPACT' | 'ULTRA_TALL';

// Configuration specs for each compactness variant
const VARIANT_SPECS: Record<CompactVariant, { modulePx: number; barHeightPx: number; scale: number }> = {
  COMPACT: {
    modulePx: 1.4,
    barHeightPx: 38,
    scale: 3,
  },
  EXTRA_COMPACT: {
    modulePx: 1.1,
    barHeightPx: 32,
    scale: 3,
  },
  ULTRA_COMPACT: {
    modulePx: 0.8,
    barHeightPx: 26,
    scale: 3,
  },
  ULTRA_TALL: {
    modulePx: 0.7,
    barHeightPx: 32,
    scale: 3,
  },
};

export interface CompactResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
  variant: CompactVariant;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Generates a tightly auto-cropped Code 128 barcode PNG for a student.
 * Performs 4-side pixel auto-cropping to guarantee zero unnecessary whitespace.
 */
export function generateCompactBarcodePNG(
  student: StudentBarcodeInfo,
  variant: CompactVariant = 'COMPACT'
): CompactResult | null {
  if (typeof window === 'undefined') return null;

  const spec = VARIANT_SPECS[variant] || VARIANT_SPECS.COMPACT;
  const scale = spec.scale;
  const modulePx = spec.modulePx;
  const barHeight = spec.barHeightPx;
  const quietZoneModules = 8;
  const quietZone = Math.max(Math.round(modulePx * quietZoneModules), 6);
  const textGap = 4;
  let baseFontSize = (variant === 'ULTRA_COMPACT' || variant === 'ULTRA_TALL') ? 10 : variant === 'EXTRA_COMPACT' ? 11.5 : 13;

  const cleanId = (student.id || '').trim();
  const encoded = encodeCode128(cleanId);
  const calcBarcodeWidth = Math.ceil(encoded.totalModules * modulePx);

  // Label text
  const cleanName = (student.name || '').trim();
  const labelText = `${cleanName} - ${cleanId}`;

  // Temporary canvas to measure text
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return null;

  tempCtx.font = `bold ${baseFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
  let textMetrics = tempCtx.measureText(labelText);
  const maxTargetWidth = Math.max(calcBarcodeWidth + quietZone * 2, 180);

  // Auto-fit font size to keep text on a single line
  while (textMetrics.width > maxTargetWidth && baseFontSize > 9) {
    baseFontSize -= 1;
    tempCtx.font = `bold ${baseFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
    textMetrics = tempCtx.measureText(labelText);
  }

  const contentWidth = Math.max(calcBarcodeWidth, textMetrics.width);
  const initialWidth = Math.ceil((contentWidth + quietZone * 2) * scale);
  const initialHeight = Math.ceil((barHeight + textGap + baseFontSize + 20) * scale);

  // Primary rendering Canvas
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = initialWidth;
  renderCanvas.height = initialHeight;

  const ctx = renderCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;

  // Solid white canvas background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, initialWidth, initialHeight);

  // Scaled parameters
  const scaledModulePx = modulePx * scale;
  const scaledBarHeight = barHeight * scale;
  const scaledBarWidthTotal = calcBarcodeWidth * scale;
  const scaledStartX = Math.round((initialWidth - scaledBarWidthTotal) / 2);
  const scaledStartY = Math.round(8 * scale);

  // Draw black Code 128 barcode bars
  ctx.fillStyle = '#000000';
  let currentX = scaledStartX;

  for (const bar of encoded.bars) {
    const widthPx = bar.width * scaledModulePx;
    if (bar.isBar) {
      const x1 = Math.round(currentX);
      const x2 = Math.round(currentX + widthPx);
      ctx.fillRect(x1, scaledStartY, Math.max(1, x2 - x1), scaledBarHeight);
    }
    currentX += widthPx;
  }

  // Draw centered text
  const scaledFontSize = Math.round(baseFontSize * scale);
  const scaledTextGap = Math.round(textGap * scale);
  ctx.font = `bold ${scaledFontSize}px 'Cairo', 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const textY = scaledStartY + scaledBarHeight + scaledTextGap;
  ctx.fillText(labelText, initialWidth / 2, textY);

  // ==========================================
  // FOUR-SIDE PIXEL AUTO-CROPPING ALGORITHM
  // ==========================================
  const imgData = ctx.getImageData(0, 0, initialWidth, initialHeight);
  const data = imgData.data;

  let minX = initialWidth;
  let minY = initialHeight;
  let maxX = 0;
  let maxY = 0;

  // Scan all pixels to find non-white bounding box
  for (let y = 0; y < initialHeight; y++) {
    for (let x = 0; x < initialWidth; x++) {
      const idx = (y * initialWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (r < 240 || g < 240 || b < 240) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback if canvas is empty
  if (minX >= maxX || minY >= maxY) {
    minX = 0;
    maxX = initialWidth;
    minY = 0;
    maxY = initialHeight;
  }

  // Minimal quiet zone / safety padding (scaled)
  const sidePaddingPx = Math.round(quietZone * scale);
  const topBottomPaddingPx = Math.round(2 * scale);

  const cropX = Math.max(0, minX - sidePaddingPx);
  const cropY = Math.max(0, minY - topBottomPaddingPx);
  const cropW = Math.min(initialWidth - cropX, (maxX - minX + 1) + sidePaddingPx * 2);
  const cropH = Math.min(initialHeight - cropY, (maxY - minY + 1) + topBottomPaddingPx * 2);

  // Create cropped final Canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;

  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return null;

  croppedCtx.imageSmoothingEnabled = false;
  croppedCtx.fillStyle = '#ffffff';
  croppedCtx.fillRect(0, 0, cropW, cropH);

  croppedCtx.drawImage(
    renderCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return {
    canvas: croppedCanvas,
    dataUrl: croppedCanvas.toDataURL('image/png'),
    width: Math.round(cropW / scale),
    height: Math.round(cropH / scale),
    variant,
    bounds: { minX: cropX, maxX: cropX + cropW, minY: cropY, maxY: cropY + cropH },
  };
}

/**
 * Downloads a compact PNG barcode image for a student.
 */
export function downloadStudentBarcodeCompact(
  student: StudentBarcodeInfo,
  variant: CompactVariant = 'COMPACT'
): boolean {
  const result = generateCompactBarcodePNG(student, variant);
  if (!result) return false;

  const cleanId = (student.id || 'student').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = `compact-barcode-${variant.toLowerCase()}-${cleanId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/**
 * Prints a compact PNG barcode image using a ultra-minimal popup document.
 */
export function printStudentBarcodeCompact(
  student: StudentBarcodeInfo,
  variant: CompactVariant = 'COMPACT'
): boolean {
  const result = generateCompactBarcodePNG(student, variant);
  if (!result) return false;

  const printWindow = window.open('', '_blank', 'width=500,height=400');
  if (!printWindow) return false;

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>باركود مصغر - ${student.name || ''}</title>
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
      justify-content: flex-start;
      align-items: center;
      flex-direction: column;
      font-family: 'Cairo', system-ui, sans-serif;
    }
    .compact-barcode-img {
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
      .compact-barcode-img {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <img src="${result.dataUrl}" alt="Compact Barcode ${student.id}" class="compact-barcode-img" />
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 200);
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
 * Downloads multiple compact barcode PNGs sequentially.
 */
export function downloadMultipleBarcodeCompact(
  students: StudentBarcodeInfo[],
  variant: CompactVariant = 'COMPACT'
) {
  if (!students || students.length === 0) return;

  students.forEach((st, idx) => {
    setTimeout(() => {
      downloadStudentBarcodeCompact(st, variant);
    }, idx * 200);
  });
}

/**
 * Prints multiple compact barcode PNG images in one clean print stream.
 */
export function printMultipleBarcodeCompact(
  students: StudentBarcodeInfo[],
  variant: CompactVariant = 'COMPACT'
) {
  if (!students || students.length === 0) return;

  const images = students
    .map((st) => {
      const res = generateCompactBarcodePNG(st, variant);
      return res ? { ...st, dataUrl: res.dataUrl } : null;
    })
    .filter((item): item is { dataUrl: string; id: string; name: string } => item !== null);

  if (images.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=500,height=500');
  if (!printWindow) return;

  const imgTags = images
    .map(
      (img) => `<div class="print-page">
      <img src="${img.dataUrl}" alt="Compact Barcode ${img.id}" class="compact-barcode-img" />
    </div>`
    )
    .join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة مجموعة الباركود المصغر</title>
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
      padding: 4px;
      box-sizing: border-box;
    }
    .print-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .compact-barcode-img {
      max-width: 100%;
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
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Downloads multiple compact PNG barcode images bundled in a single ZIP archive.
 */
export async function downloadMultipleBarcodeZip(
  students: StudentBarcodeInfo[],
  variant: CompactVariant = 'ULTRA_TALL',
  zipFilename?: string
): Promise<boolean> {
  if (!students || students.length === 0) return false;

  const zip = new JSZip();
  const usedNames = new Set<string>();

  students.forEach((st, idx) => {
    const res = generateCompactBarcodePNG(st, variant);
    if (!res) return;

    const base64Data = res.dataUrl.replace(/^data:image\/png;base64,/, '');

    const cleanId = (st.id || `st_${idx + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanName = (st.name || '').trim().replace(/[\/\\?%*:|"<>]/g, '_');

    const baseFilename = cleanName ? `${cleanId}_${cleanName}` : cleanId;
    let filename = `${baseFilename}.png`;

    let counter = 1;
    while (usedNames.has(filename)) {
      filename = `${baseFilename}_${counter}.png`;
      counter++;
    }
    usedNames.add(filename);

    zip.file(filename, base64Data, { base64: true });
  });

  const defaultName = `barcodes_${variant.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.zip`;
  const finalZipName = zipFilename || defaultName;

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = finalZipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);

  return true;
}
