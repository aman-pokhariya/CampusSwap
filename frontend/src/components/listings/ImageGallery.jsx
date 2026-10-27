import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TypeVisual } from "./ListingCard";
import ImageLightbox from "../ui/ImageLightbox";
import { imageUrl } from "../../utils/image";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

// Photos sit in a horizontally scrolling strip with CSS scroll-snap, so swiping on a phone is
// native and smooth. Arrows and thumbnails just scroll the same strip; tapping a photo opens it full size.
export default function ImageGallery({ images, title, type }) {
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState(null); // index of the photo open full size
  const trackRef = useRef(null);

  if (images.length === 0) return <TypeVisual type={type} className="aspect-[4/3] rounded-3xl" />;

  const goTo = (index) => {
    const track = trackRef.current;
    const wrapped = (index + images.length) % images.length;
    track.scrollTo({ left: wrapped * track.clientWidth, behavior: "smooth" });
  };

  const arrow = `absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow-lg backdrop-blur transition hover:scale-105 sm:grid sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 dark:bg-slate-900/90 dark:text-white ${FOCUS_RING}`;
  const fullSize = viewing === null ? null : images[viewing];

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-900">
        <div
          ref={trackRef}
          onScroll={(event) => setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div key={image.publicId} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
              {/* A blurred copy fills the frame behind photos that aren't 4:3 */}
              <img
                src={imageUrl(image.url, { width: 64 })}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
              />
              {/* The frame clips anything outside it, so this focus ring is drawn just inside the edge.
                  Only the photo in view is a tab stop: the arrows and thumbnails move between them. */}
              <button
                type="button"
                onClick={() => setViewing(index)}
                tabIndex={index === active ? 0 : -1}
                aria-label={`Open photo ${index + 1} of ${images.length} full size`}
                className="relative block size-full cursor-zoom-in rounded-3xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand-500"
              >
                <img
                  src={imageUrl(image.url, { width: 1400, crop: "limit" })}
                  alt={`${title}, photo ${index + 1}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="size-full object-contain"
                />
              </button>
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(active - 1)} aria-label="Previous photo" className={`${arrow} left-3`}>
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} aria-label="Next photo" className={`${arrow} right-3`}>
              <ChevronRight className="size-5" />
            </button>
            <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Padding (cancelled by the negative margin) leaves room for the rings, which the scroller would clip. */}
      {images.length > 1 && (
        <div className="-m-1.5 flex gap-2 overflow-x-auto p-1.5">
          {images.map((image, index) => (
            <button
              key={image.publicId}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active}
              className={`size-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-slate-50 transition focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 sm:size-20 dark:ring-offset-slate-950 ${
                index === active ? "ring-brand-500" : "opacity-60 ring-transparent hover:opacity-100"
              }`}
            >
              <img src={imageUrl(image.url, { width: 160, height: 160 })} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        src={fullSize ? imageUrl(fullSize.url) : null}
        alt={fullSize ? `${title}, photo ${viewing + 1}` : undefined}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
