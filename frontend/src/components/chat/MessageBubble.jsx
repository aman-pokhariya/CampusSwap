import { Ellipsis, Flag, LoaderCircle, RotateCcw } from "lucide-react";
import Avatar from "../ui/Avatar";
import { imageUrl } from "../../utils/image";

// A text or photo message. Messages still in the outbox carry `status`: "sending" or "failed".
// Bubbles in a run from the same person share squarer inner corners; their avatar sits by the last one.
// `onReport`, for the other person's messages: a flag that shows on hover or keyboard focus, and a ⋯
// that's always there on touch screens (they can't hover).
export default function MessageBubble({ message, mine, groupStart, groupEnd, sender, meta, onOpenImage, onRetry, onDiscard, onReport }) {
  const { status } = message;
  const corners = mine
    ? `${groupStart ? "" : "rounded-tr-md"} ${groupEnd ? "" : "rounded-br-md"}`
    : `${groupStart ? "" : "rounded-tl-md"} ${groupEnd ? "" : "rounded-bl-md"}`;
  const tone = mine
    ? `bg-brand-600 text-white dark:bg-brand-500 ${status === "failed" ? "ring-2 ring-rose-400" : ""}`
    : "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700/80";

  return (
    <div className={`group flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
      {/* Decoration: every bubble already says who wrote it to screen readers. */}
      {!mine && (
        <span className="flex w-6 shrink-0" aria-hidden>
          {groupEnd && <Avatar name={sender.name} src={sender.avatar?.url} size="xs" />}
        </span>
      )}

      <div className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        {/* A photo sets the bubble's width, so a long caption wraps under it instead of widening the bubble.
            The bubble clips its corners (overflow-hidden), so the photo button's focus ring is drawn
            around the whole bubble instead of on the button, where it would be cut off. */}
        <div
          className={`overflow-hidden rounded-2xl has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-brand-500 ${message.image ? "w-60 max-w-full sm:w-72" : ""} ${corners} ${tone} ${status === "sending" ? "opacity-70" : ""}`}
        >
          <span className="sr-only">{mine ? "You" : sender.name}: </span>
          {message.image && (
            <button
              type="button"
              onClick={() => onOpenImage(message.image.url)}
              aria-label="Open photo"
              className="block w-full focus-visible:outline-none"
            >
              <img
                src={imageUrl(message.image.url, { width: 640, crop: "limit" })}
                alt={message.text || "Photo"}
                loading="lazy"
                className="max-h-80 w-full object-cover"
              />
            </button>
          )}
          {message.text && (
            <p className="px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p>
          )}
        </div>

        {status === "sending" && (
          <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <LoaderCircle className="size-3 animate-spin" aria-hidden /> Sending…
          </p>
        )}
        {status === "failed" && (
          <p className="mt-1 flex flex-wrap items-center justify-end gap-x-2 px-1 text-[11px] font-medium text-rose-600 dark:text-rose-400" role="alert">
            {message.error || "Not sent"}
            {/* A closed chat (deleted listing, a block) would refuse it again: only Delete is offered. */}
            {message.retryable !== false && (
              <button type="button" onClick={() => onRetry(message)} className="inline-flex items-center gap-1 font-bold underline underline-offset-2">
                <RotateCcw className="size-3" aria-hidden /> Retry
              </button>
            )}
            <button type="button" onClick={() => onDiscard(message)} className="font-semibold text-slate-500 underline underline-offset-2 dark:text-slate-400">
              Delete
            </button>
          </p>
        )}
        {!status && meta && <p className="mt-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">{meta}</p>}
      </div>

      {onReport && (
        <button
          type="button"
          onClick={() => onReport(message)}
          aria-label="Report this message"
          title="Report this message"
          className="grid size-8 shrink-0 place-items-center self-center rounded-full text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-500 [@media(hover:none)]:opacity-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Flag className="size-3.5 [@media(hover:none)]:hidden" aria-hidden />
          <Ellipsis className="hidden size-4 [@media(hover:none)]:block" aria-hidden />
        </button>
      )}
    </div>
  );
}
