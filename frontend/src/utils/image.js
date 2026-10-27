const UPLOADABLE = ["image/jpeg", "image/png", "image/webp"];

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// Shrinks a photo in the browser before it's uploaded. Phone photos are often 3–8 MB; this
// turns them into ~200–400 KB WebP files, which upload fast even on hostel Wi-Fi.
export async function compressImage(file, { maxSize = 1600, quality = 0.82 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read "${file.name}". Please use a JPG, PNG or WebP photo.`);
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let blob = await canvasToBlob(canvas, "image/webp", quality);
  // Older Safari can't encode WebP (it silently returns PNG): use JPEG there.
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);

  // A tiny original can beat the "compressed" copy; keep whichever is smaller.
  if (UPLOADABLE.includes(file.type) && file.size <= blob.size && scale === 1) return file;

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type });
}

// Cloudinary resizes and converts images on the fly when a transformation is put in the URL.
// Other URLs (local uploads in development) are returned unchanged.
export function imageUrl(url, { width, height, crop = "fill" } = {}) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  const transform = ["f_auto", "q_auto", width && `w_${width}`, height && `h_${height}`, (width || height) && `c_${crop}`]
    .filter(Boolean)
    .join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}
