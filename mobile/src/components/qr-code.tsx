import createQr from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';

// Draws a QR code with plain views (no native SVG dependency). Dark modules on
// each row are merged into runs to keep the view count low.
export function QrCode({ value, size, color = '#000', background = '#fff' }: {
  value: string; size: number; color?: string; background?: string;
}) {
  const rows = useMemo(() => {
    const qr = createQr(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const out: { y: number; runs: [number, number][] }[] = [];
    for (let r = 0; r < n; r++) {
      const runs: [number, number][] = [];
      let start = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && qr.isDark(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) {
          runs.push([start, c - start]);
          start = -1;
        }
      }
      out.push({ y: r, runs });
    }
    return { n, out };
  }, [value]);

  // Quiet zone of 2 modules around the code, as scanners expect.
  const cell = size / (rows.n + 4);
  return (
    <View accessibilityRole="image" accessibilityLabel="QR code da carteirinha"
      style={{ width: size, height: size, backgroundColor: background }}>
      {rows.out.map(({ y, runs }) => runs.map(([x, len]) => (
        <View key={`${y}-${x}`} style={{ position: 'absolute', backgroundColor: color,
          left: (x + 2) * cell, top: (y + 2) * cell, width: len * cell + 0.5, height: cell + 0.5 }} />
      )))}
    </View>
  );
}
