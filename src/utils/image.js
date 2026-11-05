/**
 * Resize + re-encode an image file to JPEG in the browser.
 * - maxSize: longest side in px (or the square size when square = true)
 * - square: center-crop to a square (used for avatars)
 */
export async function compressImage(file, { maxSize = 1600, quality = 0.82, square = false } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.");
  }

  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  let dw;
  let dh;

  if (square) {
    const s = Math.min(sw, sh);
    sx = (sw - s) / 2;
    sy = (sh - s) / 2;
    sw = sh = s;
    dw = dh = Math.min(maxSize, s);
  } else {
    const scale = Math.min(1, maxSize / Math.max(sw, sh));
    dw = Math.round(sw * scale);
    dh = Math.round(sh * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // flatten transparent PNGs onto white instead of black
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error("That image couldn't be processed.");
  return blob;
}
