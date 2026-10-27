import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { compressImage, imageUrl } from "../../utils/image";
import { formatBytes } from "../../utils/format";
import { MAX_PHOTOS } from "../../constants/listing";

// photos: [{ id, kind: "existing", url, publicId }] or [{ id, kind: "new", file, url, originalSize, size }]
// onChange receives an updater function (photos are added asynchronously after compression).
export default function ImagePicker({ photos, onChange, error, optional = false }) {
  const [compressing, setCompressing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const free = MAX_PHOTOS - photos.length - compressing;

  const addFiles = async (fileList) => {
    const files = [...fileList];
    if (files.length === 0) return;

    const accepted = files.slice(0, Math.max(0, free));
    if (files.length > accepted.length) toast.info(`You can add up to ${MAX_PHOTOS} photos`);
    if (accepted.length === 0) return;

    setCompressing((n) => n + accepted.length);
    const results = await Promise.allSettled(
      accepted.map(async (file) => {
        const compressed = await compressImage(file);
        return {
          id: crypto.randomUUID(),
          kind: "new",
          file: compressed,
          url: URL.createObjectURL(compressed),
          originalSize: file.size,
          size: compressed.size,
        };
      }),
    );
    setCompressing((n) => n - accepted.length);

    results.filter((r) => r.status === "rejected").forEach((r) => toast.error(r.reason.message));
    const added = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (added.length > 0) onChange((current) => [...current, ...added]);
  };

  const remove = (photo) => {
    if (photo.kind === "new") URL.revokeObjectURL(photo.url);
    onChange((current) => current.filter((p) => p.id !== photo.id));
  };

  const makeCover = (photo) => onChange((current) => [photo, ...current.filter((p) => p.id !== photo.id)]);

  const dropHandlers = {
    onDragOver: (event) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      addFiles(event.dataTransfer.files);
    },
  };

  const openPicker = () => inputRef.current?.click();
  const isEmpty = photos.length === 0 && compressing === 0;

  return (
    <div data-error={Boolean(error) || undefined}>
      {isEmpty ? (
        <button
          type="button"
          onClick={openPicker}
          {...dropHandlers}
          className={`flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging
              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
              : error
                ? "border-rose-300 bg-rose-50/50 dark:border-rose-500/50 dark:bg-rose-500/5"
                : "border-slate-300 hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-brand-500/5"
          }`}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <ImagePlus className="size-7" />
          </span>
          <span className="mt-3 font-semibold">Add photos{optional ? " (optional)" : ""}</span>
          <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Drag them here or tap to choose · up to {MAX_PHOTOS} · the first one is the cover
          </span>
        </button>
      ) : (
        <div {...dropHandlers} className={`grid grid-cols-3 gap-3 sm:grid-cols-5 ${dragging ? "rounded-2xl ring-2 ring-brand-500 ring-offset-4" : ""}`}>
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
            >
              <img
                src={photo.kind === "existing" ? imageUrl(photo.url, { width: 300, height: 300 }) : photo.url}
                alt={`Photo ${index + 1}`}
                className="size-full object-cover"
              />
              {index === 0 ? (
                <span className="absolute top-2 left-2 rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(photo)}
                  className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Star className="size-3" /> Cover
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(photo)}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-slate-950/70 text-white transition hover:bg-rose-600"
              >
                <X className="size-4" />
              </button>
              {photo.kind === "new" && photo.originalSize > photo.size * 1.2 && (
                <span className="absolute inset-x-2 bottom-2 truncate rounded-md bg-slate-950/70 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                  {formatBytes(photo.originalSize)} → {formatBytes(photo.size)}
                </span>
              )}
            </div>
          ))}

          {Array.from({ length: compressing }, (_, i) => (
            <div key={`compressing-${i}`} className="grid aspect-square place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <LoaderCircle className="size-6 animate-spin text-brand-500" aria-label="Optimising photo" />
            </div>
          ))}

          {free > 0 && (
            <button
              type="button"
              onClick={openPicker}
              className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 dark:border-slate-700 dark:hover:bg-brand-500/5"
            >
              <span className="flex flex-col items-center gap-1">
                <ImagePlus className="size-6" />
                <span className="text-xs font-semibold">Add</span>
                <span className="text-[10px]">
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </span>
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = ""; // lets you pick the same file again after removing it
        }}
      />

      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Photos are optimised on your device before uploading, so they upload fast even on hostel Wi-Fi.
        </p>
      )}
    </div>
  );
}
