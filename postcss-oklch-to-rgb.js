function oklchToRgb(L, C, hue) {
  const H = (hue * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = Math.pow(l_, 3);
  const m = Math.pow(m_, 3);
  const s = Math.pow(s_, 3);

  let r =  +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g =  -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_val =  -0.0041960863 * l - 0.7034186145 * m + 1.7076147010 * s;

  const f = (c) => {
    const clampedC = Math.max(0, c);
    if (clampedC <= 0.0031308) {
      return 12.92 * clampedC;
    } else {
      return 1.055 * Math.pow(clampedC, 1 / 2.4) - 0.055;
    }
  };

  r = f(r);
  g = f(g);
  b_val = f(b_val);

  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val * 255)));

  return {
    r: clamp(r),
    g: clamp(g),
    b: clamp(b_val),
  };
}

function replaceOklchWithRgb(value) {
  return value.replace(/oklch\(([^)]+)\)/g, (match, content) => {
    const cleanContent = content.replace(/,/g, ' ');
    const parts = cleanContent.trim().split(/[\s/]+/).filter(Boolean);
    if (parts.length < 3) return match;

    const L_str = parts[0];
    const C_str = parts[1];
    const H_str = parts[2];
    const alpha_str = parts[3] !== undefined ? parts[3] : null;

    let L = parseFloat(L_str);
    if (L_str.endsWith('%')) {
      L = L / 100;
    }

    let C = parseFloat(C_str);
    if (C_str.endsWith('%')) {
      C = (C / 100) * 0.4;
    }

    let H = parseFloat(H_str);

    if (isNaN(L) || isNaN(C) || isNaN(H)) return match;

    let alpha = null;
    if (alpha_str !== null) {
      alpha = parseFloat(alpha_str);
      if (alpha_str.endsWith('%')) {
        alpha = alpha / 100;
      }
    }

    const rgb = oklchToRgb(L, C, H);
    if (!rgb) return match;

    if (alpha !== null && !isNaN(alpha)) {
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    } else {
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
  });
}

module.exports = () => {
  return {
    postcssPlugin: 'postcss-oklch-to-rgb',
    Once(root) {
      root.walkDecls(decl => {
        if (decl.value && decl.value.includes('oklch(')) {
          decl.value = replaceOklchWithRgb(decl.value);
        }
      });
    }
  };
};
module.exports.postcss = true;
