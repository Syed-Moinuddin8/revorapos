/**
 * Thermal Printer Logo Processor
 * Converts any uploaded image into a high-contrast 1-bit monochrome thermal graphic.
 * Eliminates background cards/boxes (knocks out light/beige/white backgrounds to 100% transparent),
 * and converts logo artwork/text into pure black thermal printer ink dots.
 */

export async function processToThermalLogo(
  dataUrlOrSrc: string,
  threshold = 200
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrlOrSrc) {
      resolve('');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 384; // Standard 58mm/80mm thermal dot width
        const maxH = 160;

        let w = img.width;
        let h = img.height;

        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrlOrSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const pixels = imgData.data;

        // Sample border/corner pixels to accurately detect background color
        const corners = [
          0, // top-left
          (w - 1) * 4, // top-right
          ((h - 1) * w) * 4, // bottom-left
          ((h - 1) * w + (w - 1)) * 4, // bottom-right
        ];

        let avgCornerR = 0;
        let avgCornerG = 0;
        let avgCornerB = 0;

        for (const idx of corners) {
          avgCornerR += pixels[idx];
          avgCornerG += pixels[idx + 1];
          avgCornerB += pixels[idx + 2];
        }
        avgCornerR = Math.round(avgCornerR / corners.length);
        avgCornerG = Math.round(avgCornerG / corners.length);
        avgCornerB = Math.round(avgCornerB / corners.length);

        const cornerLum = 0.299 * avgCornerR + 0.587 * avgCornerG + 0.114 * avgCornerB;
        const hasLightBackground = cornerLum > 120;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Transparent pixels remain transparent
          if (a < 35) {
            pixels[i + 3] = 0;
            continue;
          }

          // Perceived luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Color distance from background corner
          const distToCorner = Math.sqrt(
            (r - avgCornerR) ** 2 + (g - avgCornerG) ** 2 + (b - avgCornerB) ** 2
          );

          // If pixel matches the background or is brighter than threshold:
          if ((hasLightBackground && distToCorner < 55) || lum > threshold) {
            // Knock out background completely (transparent!)
            pixels[i + 3] = 0;
          } else {
            // Convert foreground to crisp thermal black ink
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
            pixels[i + 3] = 255; // 100% opaque black ink
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Thermal logo processing fallback:', err);
        resolve(dataUrlOrSrc);
      }
    };

    img.onerror = () => {
      resolve(dataUrlOrSrc);
    };

    img.src = dataUrlOrSrc;
  });
}
