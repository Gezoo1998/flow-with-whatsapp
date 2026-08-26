export * from './barcodeHelperBitmap';
export {
  generateCode128Bitmap as generateBarcodePNG,
  downloadStudentBarcodeBitmap as downloadBarcodePNG,
  printStudentBarcodeBitmap as printBarcodeImage,
  downloadMultipleBarcodeBitmaps as downloadMultipleBarcodePNGs,
  printMultipleBarcodeBitmaps as printMultipleBarcodeImages
} from './barcodeHelperBitmap';
