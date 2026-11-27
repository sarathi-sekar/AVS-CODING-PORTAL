export const BANNER_W = 960;
export const BANNER_H = 320; // 3:1

/**
 * Crops an image to the banner shape (centre crop), resizes it to 960 x 320 and compresses it to a small JPEG
 * data URL, so it can be stored in Firestore without Firebase Storage (free plan).
 */
export async function fileToBanner(file: File, maxBytes = 180_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is larger than 15 MB. Choose a smaller one.');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('This image could not be read. Try a JPG or PNG.'); });
  const canvas = document.createElement('canvas');
  canvas.width = BANNER_W; canvas.height = BANNER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot process images.');
  const scale = Math.max(BANNER_W / bmp.width, BANNER_H / bmp.height);
  const w = bmp.width * scale; const h = bmp.height * scale;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, BANNER_W, BANNER_H);
  ctx.drawImage(bmp, (BANNER_W - w) / 2, (BANNER_H - h) / 2, w, h);
  bmp.close();
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length * 0.75 <= maxBytes) return url;
  }
  throw new Error('This image is too detailed to store. Try a simpler picture.');
}
