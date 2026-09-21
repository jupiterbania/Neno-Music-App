import { useEffect, useRef, useState } from "react";
import { useAdaptiveThemeEnabled } from "../settings/adaptiveTheme";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const colorCache = new Map<string, RgbColor>();
const DEFAULT_RGB: RgbColor = { r: 255, g: 0, b: 51 }; // #ff0033

/**
 * Extracts dominant vibrant color from an image URL using an offscreen canvas.
 */
export async function extractDominantColor(url: string): Promise<RgbColor> {
  if (!url) return DEFAULT_RGB;
  const cached = colorCache.get(url);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_RGB);
          return;
        }

        // Downscale to 24x24 for sub-millisecond pixel scanning
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        let bestScore = -1;
        let dominant: RgbColor = DEFAULT_RGB;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 128) continue; // Skip transparent

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const brightness = (r + g + b) / 3;

          // Skip near-black, near-white, or flat grey
          if (brightness < 30 || brightness > 235 || delta < 20) continue;

          // Score by saturation and healthy brightness
          const saturation = delta / max;
          const score = saturation * 1.5 + (1 - Math.abs(brightness - 128) / 128);

          if (score > bestScore) {
            bestScore = score;
            dominant = { r, g, b };
          }
        }

        colorCache.set(url, dominant);
        resolve(dominant);
      } catch {
        resolve(DEFAULT_RGB);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_RGB);
    };
  });
}

/**
 * Hook that keeps the CSS custom properties `--ambient-artwork-color` and `--ambient-artwork-glow`
 * synchronized with the currently playing track's artwork.
 */
export function useDynamicArtworkTheme(artworkUrl?: string | null): {
  colorRgb: RgbColor;
  colorCss: string;
  glowCss: string;
} {
  const isAdaptive = useAdaptiveThemeEnabled();
  const [colorRgb, setColorRgb] = useState<RgbColor>(DEFAULT_RGB);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAdaptive || !artworkUrl) {
      if (!isAdaptive) {
        document.documentElement.style.removeProperty("--ambient-artwork-color");
        document.documentElement.style.removeProperty("--ambient-artwork-glow");
      }
      return;
    }

    currentUrlRef.current = artworkUrl;
    let active = true;

    void extractDominantColor(artworkUrl).then((rgb) => {
      if (!active || currentUrlRef.current !== artworkUrl) return;
      setColorRgb(rgb);

      const colorCss = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      const glowCss = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;

      document.documentElement.style.setProperty("--ambient-artwork-color", colorCss);
      document.documentElement.style.setProperty("--ambient-artwork-glow", glowCss);
    });

    return () => {
      active = false;
    };
  }, [artworkUrl, isAdaptive]);

  const colorCss = `rgb(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b})`;
  const glowCss = `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, 0.35)`;

  return { colorRgb, colorCss, glowCss };
}
