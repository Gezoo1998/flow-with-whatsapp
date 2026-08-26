/**
 * 5th Independent Barcode System: Content-Sized PDF Barcode System
 *
 * Uses jsPDF to construct crisp, content-sized PDF documents where each page
 * corresponds directly to one physical student label (e.g. 48mm × 32mm)
 * without A4/Letter margins, blank gaps, or browser pagination bugs.
 */

import { jsPDF } from 'jspdf';
import { generateCode128Bitmap, StudentBarcodeInfo } from './barcodeHelperBitmap';

export interface PDFBarcodeOptions {
  widthMm?: number; // Target PDF page width in mm (default 48mm)
  maxHeightMm?: number; // Maximum allowed PDF page height in mm
}

/**
 * Creates a jsPDF document containing content-sized Code 128 barcode pages for the given students.
 */
export function buildStudentBarcodePDFDoc(
  students: StudentBarcodeInfo[],
  options?: PDFBarcodeOptions
): jsPDF | null {
  if (!students || students.length === 0) return null;

  const targetWidthMm = options?.widthMm || 48; // Standard label width
  let pdfDoc: jsPDF | null = null;

  students.forEach((student, index) => {
    // Generate raster bitmap canvas for crisp exact rendering using Code 128
    const bitmapRes = generateCode128Bitmap(student, { scale: 4, narrowBarWidth: 1.8, barcodeHeight: 65 });
    if (!bitmapRes) return;

    // Calculate aspect ratio and resulting content height in mm
    const aspectRatio = bitmapRes.height / bitmapRes.width;
    const contentHeightMm = Math.max(Math.ceil(targetWidthMm * aspectRatio), 20);
    const finalHeightMm = options?.maxHeightMm
      ? Math.min(contentHeightMm, options.maxHeightMm)
      : contentHeightMm;

    if (index === 0) {
      // First page initializes PDF with exact content dimensions
      pdfDoc = new jsPDF({
        orientation: targetWidthMm > finalHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [targetWidthMm, finalHeightMm],
        compress: true,
      });
    } else if (pdfDoc) {
      // Subsequent students get a new content-sized page
      pdfDoc.addPage([targetWidthMm, finalHeightMm], targetWidthMm > finalHeightMm ? 'landscape' : 'portrait');
    }

    if (pdfDoc) {
      pdfDoc.addImage(
        bitmapRes.dataUrl,
        'PNG',
        0,
        0,
        targetWidthMm,
        finalHeightMm,
        `student-${student.id}-${index}`,
        'FAST'
      );
    }
  });

  return pdfDoc;
}

/**
 * Download a PDF barcode label for a single student.
 */
export function downloadStudentBarcodePDF(
  student: StudentBarcodeInfo,
  options?: PDFBarcodeOptions
): boolean {
  const doc = buildStudentBarcodePDFDoc([student], options);
  if (!doc) return false;

  const cleanId = (student.id || 'student').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`barcode-${cleanId}.pdf`);
  return true;
}

/**
 * Download a multi-page PDF barcode document for multiple students.
 */
export function downloadMultipleBarcodePDFs(
  students: StudentBarcodeInfo[],
  options?: PDFBarcodeOptions
): boolean {
  const doc = buildStudentBarcodePDFDoc(students, options);
  if (!doc) return false;

  doc.save(`barcodes-group-${students.length}-students.pdf`);
  return true;
}

/**
 * Print a PDF barcode document for a single student via blob print stream.
 */
export function printStudentBarcodePDF(
  student: StudentBarcodeInfo,
  options?: PDFBarcodeOptions
): boolean {
  const doc = buildStudentBarcodePDFDoc([student], options);
  if (!doc) return false;

  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl.toString(), '_blank');
  if (printWindow) {
    printWindow.focus();
    return true;
  }
  return false;
}

/**
 * Print a multi-page PDF barcode document for multiple students.
 */
export function printMultipleBarcodePDFs(
  students: StudentBarcodeInfo[],
  options?: PDFBarcodeOptions
): boolean {
  const doc = buildStudentBarcodePDFDoc(students, options);
  if (!doc) return false;

  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl.toString(), '_blank');
  if (printWindow) {
    printWindow.focus();
    return true;
  }
  return false;
}
