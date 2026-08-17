/**
 * Client-side image optimization: validates format/size, center-crops to a
 * square, downscales to an optimized resolution, and re-encodes.
 */
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function optimizeAvatar(
  file: File,
  opts: { maxSizeMb?: number; maxDimension?: number } = {},
): Promise<string> {
  const maxSizeMb = opts.maxSizeMb ?? 5;
  const maxDimension = opts.maxDimension ?? 512;

  if (!ACCEPTED.includes(file.type)) {
    throw new Error("Please choose a JPG, JPEG, PNG or WEBP image.");
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Image must be ${maxSizeMb} MB or smaller.`);
  }

  const bitmap = await createImageBitmap(file);

  // Center-crop to a square so avatars display consistently everywhere.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);
  const out = Math.max(1, Math.min(side, maxDimension));

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();

  // Prefer WebP, fall back to JPEG
  const webp = canvas.toDataURL("image/webp", 0.85);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Generic photo optimization (keeps aspect ratio): validates format/size,
 * downscales so the longest edge is maxDimension, and re-encodes as JPEG.
 * Used for property media and team photos.
 */
export async function optimizeImage(
  file: File,
  opts: { maxSizeMb?: number; maxDimension?: number; quality?: number } = {},
): Promise<string> {
  const maxSizeMb = opts.maxSizeMb ?? 8;
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.85;

  if (!ACCEPTED.includes(file.type)) {
    throw new Error("Please choose a JPG, JPEG, PNG or WEBP image.");
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Image must be ${maxSizeMb} MB or smaller.`);
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
