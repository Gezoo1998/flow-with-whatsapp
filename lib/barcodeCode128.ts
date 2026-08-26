/**
 * Central Code 128 Barcode Encoding & Rendering Engine
 *
 * Implements standard, robust Code 128 (A/B/C Auto) barcode generation
 * supporting both SVG vector rendering and Canvas/Bitmap raster rendering.
 */

const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"                              // 100-106
];

export interface Code128Bar {
  isBar: boolean;
  width: number; // in module units
}

export interface Code128EncodeResult {
  text: string;
  symbolValues: number[];
  bars: Code128Bar[];
  totalModules: number;
}

function countDigits(str: string, index: number): number {
  let count = 0;
  for (let i = index; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Encodes input text into Code 128 module patterns using automatic Code B / Code C subset optimization.
 */
export function encodeCode128(input: string): Code128EncodeResult {
  const text = (input || "").trim();
  if (!text) {
    return encodeCode128("UNKNOWN");
  }

  const symbols: number[] = [];
  let i = 0;
  let mode: 'B' | 'C' = 'B';

  const initialDigits = countDigits(text, 0);
  if (initialDigits >= 4 || (initialDigits === text.length && text.length % 2 === 0)) {
    mode = 'C';
    symbols.push(105); // Start C
  } else {
    mode = 'B';
    symbols.push(104); // Start B
  }

  while (i < text.length) {
    if (mode === 'B') {
      const digitsAhead = countDigits(text, i);
      if (digitsAhead >= 4 || (digitsAhead === text.length - i && digitsAhead % 2 === 0 && digitsAhead >= 2)) {
        symbols.push(99); // Code C
        mode = 'C';
      } else {
        const charCode = text.charCodeAt(i);
        const val = (charCode >= 32 && charCode <= 126) ? charCode - 32 : 0;
        symbols.push(val);
        i++;
      }
    } else if (mode === 'C') {
      const digitsAhead = countDigits(text, i);
      if (digitsAhead >= 2) {
        const pair = text.slice(i, i + 2);
        symbols.push(parseInt(pair, 10));
        i += 2;
      } else {
        symbols.push(100); // Code B
        mode = 'B';
      }
    }
  }

  // Calculate checksum
  let checksumSum = symbols[0];
  for (let j = 1; j < symbols.length; j++) {
    checksumSum += symbols[j] * j;
  }
  const checksum = checksumSum % 103;
  symbols.push(checksum);
  symbols.push(106); // Stop code

  // Build bars list
  const bars: Code128Bar[] = [];
  let totalModules = 0;

  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym];
    if (!pattern) continue;
    for (let p = 0; p < pattern.length; p++) {
      const modWidth = parseInt(pattern[p], 10);
      const isBar = p % 2 === 0;
      bars.push({ isBar, width: modWidth });
      totalModules += modWidth;
    }
  }

  return {
    text,
    symbolValues: symbols,
    bars,
    totalModules,
  };
}

export interface Code128SVGOptions {
  moduleWidth?: number;  // Narrow bar module width in px (default 1.4)
  height?: number;       // Height of bars in px (default 45)
  quietZoneModules?: number; // Quiet zone in module units (default 10)
  includeText?: boolean;
}

/**
 * Generates pure vector SVG markup for Code 128 barcode.
 */
export function generateCode128SVG(
  text: string,
  options: Code128SVGOptions = {}
): { svgContent: string; width: number; height: number; totalModules: number } {
  const encoded = encodeCode128(text);
  const moduleWidth = options.moduleWidth || 1.4;
  const barcodeHeight = options.height || 45;
  const quietZoneModules = options.quietZoneModules !== undefined ? options.quietZoneModules : 10;
  const includeText = options.includeText || false;

  const quietZonePx = quietZoneModules * moduleWidth;
  const barcodeWidthPx = encoded.totalModules * moduleWidth;
  const totalSvgWidth = Math.ceil(barcodeWidthPx + quietZonePx * 2);
  const textPaddingPx = includeText ? 18 : 0;
  const totalSvgHeight = Math.ceil(barcodeHeight + textPaddingPx + 4);

  let currentX = quietZonePx;
  const paths: string[] = [];

  for (const bar of encoded.bars) {
    const widthPx = bar.width * moduleWidth;
    if (bar.isBar) {
      paths.push(`M ${currentX.toFixed(2)} 2 h ${widthPx.toFixed(2)} v ${barcodeHeight.toFixed(2)} h -${widthPx.toFixed(2)} Z`);
    }
    currentX += widthPx;
  }

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSvgWidth} ${totalSvgHeight}" width="${totalSvgWidth}" height="${totalSvgHeight}">`;
  svgContent += `<rect x="0" y="0" width="${totalSvgWidth}" height="${totalSvgHeight}" fill="#FFFFFF" />`;
  svgContent += `<g fill="#000000">`;
  svgContent += `<path d="${paths.join(' ')}" />`;
  svgContent += `</g>`;

  if (includeText) {
    const textY = barcodeHeight + 14;
    svgContent += `<text x="${(totalSvgWidth / 2).toFixed(2)}" y="${textY}" font-family="monospace, 'Cairo', sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="1">${encoded.text}</text>`;
  }

  svgContent += `</svg>`;

  return {
    svgContent,
    width: totalSvgWidth,
    height: totalSvgHeight,
    totalModules: encoded.totalModules,
  };
}
