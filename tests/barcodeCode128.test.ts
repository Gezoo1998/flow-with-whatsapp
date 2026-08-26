import { describe, it, expect } from 'vitest';
import { encodeCode128, generateCode128SVG } from '../lib/barcodeCode128';

describe('Code 128 Barcode Engine', () => {
  it('encodes ST-1055 correctly with Code 128 Auto', () => {
    const encoded = encodeCode128('ST-1055');
    expect(encoded.text).toBe('ST-1055');
    // Symbols: Start B (104), 'S' (51), 'T' (52), '-' (13), Code C (99), '10' (10), '55' (55), Checksum, Stop (106)
    expect(encoded.symbolValues[0]).toBe(104); // Start B
    expect(encoded.symbolValues[1]).toBe(51);  // 'S'
    expect(encoded.symbolValues[2]).toBe(52);  // 'T'
    expect(encoded.symbolValues[3]).toBe(13);  // '-'
    expect(encoded.symbolValues[4]).toBe(99);  // Code C
    expect(encoded.symbolValues[5]).toBe(10);  // 10
    expect(encoded.symbolValues[6]).toBe(55);  // 55
    expect(encoded.symbolValues[encoded.symbolValues.length - 1]).toBe(106); // Stop
  });

  it('encodes numeric ST-1001 correctly', () => {
    const encoded = encodeCode128('ST-1001');
    expect(encoded.text).toBe('ST-1001');
    expect(encoded.symbolValues[0]).toBe(104);
    expect(encoded.symbolValues[encoded.symbolValues.length - 1]).toBe(106);
  });

  it('encodes ST-1037 and ST-1388 correctly', () => {
    const e1 = encodeCode128('ST-1037');
    const e2 = encodeCode128('ST-1388');
    expect(e1.symbolValues[0]).toBe(104);
    expect(e2.symbolValues[0]).toBe(104);
  });

  it('generates valid SVG output for Code 128', () => {
    const svgRes = generateCode128SVG('ST-1055', { includeText: true });
    expect(svgRes.svgContent).toContain('<svg');
    expect(svgRes.svgContent).toContain('ST-1055');
    expect(svgRes.width).toBeGreaterThan(0);
    expect(svgRes.height).toBeGreaterThan(0);
  });
});
