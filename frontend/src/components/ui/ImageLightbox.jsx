import { X } from "lucide-react";
import Modal from "./Modal";

// A photo at full size (chat photos, listing photos). Esc, the backdrop or the button closes it.
export default function ImageLightbox({ src, alt = "Photo", onClose }) {
  return (
    <Modal open={Boolean(src)} onClose={onClose} label={alt} variant="bare">
      <div className="relative">
        <img src={src} alt={alt} className="max-h-[calc(100dvh-4rem)] max-w-full rounded-2xl object-contain shadow-2xl" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur transition hover:bg-slate-950/90 focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-5" />
        </button>
      </div>
    </Modal>
  );
}
