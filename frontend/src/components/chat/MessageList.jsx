import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowDown, LoaderCircle, ShieldCheck } from "lucide-react";
import Avatar from "../ui/Avatar";
import ImageLightbox from "../ui/ImageLightbox";
import { TypeVisual } from "../listings/ListingCard";
import ReportDialog from "../trust/ReportDialog";
import MessageBubble from "./MessageBubble";
import OfferCard from "./OfferCard";
import SystemMessage from "./SystemMessage";
import TypingDots from "./TypingDots";
import { dayLabel, formatClock, isSameDay } from "../../utils/chat";
import { imageUrl } from "../../utils/image";

const RUN_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

const isBubble = (message) => message.type === "text" || message.type === "image";

// Two bubbles belong to one run: same person, same day, less than 5 minutes apart.
const joins = (a, b) =>
  Boolean(a && b) &&
  isBubble(a) &&
  isBubble(b) &&
  a.sender === b.sender &&
  isSameDay(a.createdAt, b.createdAt) &&
  new Date(b.createdAt) - new Date(a.createdAt) < RUN_GAP_MS;

// Day separators plus where each run starts and ends.
const buildItems = (messages) =>
  messages.flatMap((message, index) => {
    const previous = messages[index - 1];
    const item = { key: message._id, message, runStart: !joins(previous, message), runEnd: !joins(message, messages[index + 1]) };
    return previous && isSameDay(previous.createdAt, message.createdAt) ? [item] : [{ key: `day-${message._id}`, day: message.createdAt }, item];
  });

// What a screen reader hears when the other person's message arrives.
const announcementFor = (message, name) => {
  if (message.type === "image") return `${name} sent a photo${message.text ? `: ${message.text}` : ""}`;
  if (message.type === "offer") return `${name} sent an offer`;
  return `New message from ${name}: ${message.text}`;
};

// Brings a card into the middle of the scroller (or its top, if it's taller) and gives it focus, with a
// short glow so the eye finds it. scrollBy works with the column-reverse scroller's negative scrollTop.
const revealCard = (scroller, card) => {
  const offset = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollBy({ top: offset - Math.max(12, (scroller.clientHeight - card.offsetHeight) / 2), behavior: "smooth" });
  card.focus({ preventScroll: true });
  card.animate?.([{ boxShadow: "0 0 0 6px rgb(245 158 11 / 0.45)" }, { boxShadow: "0 0 0 0 rgb(245 158 11 / 0)" }], {
    duration: 1600,
    easing: "ease-out",
  });
};

// My newest saved message, unless the other person has written since: it gets "Sent" or "Seen".
const latestOwnMessage = (messages, myId) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.type === "system") continue;
    return message.sender === myId && !message.status ? message : null;
  }
  return null;
};

function ChatIntro({ conversation }) {
  const { listing, otherUser } = conversation;

  return (
    <div className="mx-auto mb-2 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto size-14 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {listing.cover ? (
          <img src={imageUrl(listing.cover, { width: 112, height: 112 })} alt="" className="size-full object-cover" />
        ) : (
          listing.type && <TypeVisual type={listing.type} className="size-full [&_span]:hidden [&_svg]:size-6" />
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        This is the start of your chat with <strong className="text-slate-900 dark:text-white">{otherUser.name}</strong> about{" "}
        <strong className="text-slate-900 dark:text-white">“{listing.title}”</strong>.
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Meet at a campus safe spot and check the item before you pay. Never share OTPs or passwords in chat.
      </p>
    </div>
  );
}

// The conversation itself. The scroller is a column-reverse flexbox, so it starts at the bottom and
// stays pinned to the newest message by itself, and loading older pages at the top never makes the
// view jump. (In such a scroller scrollTop is 0 at the bottom and negative above it.)
// `ref` gets { showOffer(offerId) }: scroll to that offer's card (the pinned offer bar uses it).
export default function MessageList({
  ref,
  conversation,
  myId,
  messages,
  typing,
  hasOlder,
  loadingOlder,
  loadOlderFailed,
  pageCount,
  onLoadOlder,
  onCounter,
  onRetry,
  onDiscard,
}) {
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [unseenBelow, setUnseenBelow] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [reporting, setReporting] = useState(null); // the other person's message being reported
  const { otherUser, listing } = conversation;

  const items = useMemo(() => buildItems(messages), [messages]);
  const ownLatest = latestOwnMessage(messages, myId);
  const seen = ownLatest && conversation.otherLastReadAt && new Date(conversation.otherLastReadAt) >= new Date(ownLatest.createdAt);

  const scrollToBottom = () => scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  // The ref copy is for the effect below, which must not re-run on every scroll.
  const awayRef = useRef(false);
  const handleScroll = () => {
    const away = Math.abs(scrollerRef.current.scrollTop) > NEAR_BOTTOM_PX;
    awayRef.current = away;
    setAwayFromBottom(away);
    if (!away) setUnseenBelow(false);
  };

  // A new message at the bottom: mine always comes into view; someone else's shows a "New" pill
  // when I've scrolled up to read older ones.
  const newest = messages.at(-1);
  const newestKey = newest?._id;
  const lastNewestKey = useRef(newestKey);
  useEffect(() => {
    if (newestKey === lastNewestKey.current) return;
    lastNewestKey.current = newestKey;
    if (!newest) return;
    if (newest.sender === myId && newest.type !== "system") scrollToBottom();
    else if (awayRef.current) setUnseenBelow(true);
  }, [newestKey, newest, myId]);

  // Screen readers hear each new message from the other person once, as it arrives: not the history,
  // and not older pages loading at the top (the other person's latest message doesn't change then).
  const lastIncoming = messages.findLast((message) => message.sender && message.sender !== myId);
  const lastIncomingKey = useRef(lastIncoming?._id);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!lastIncoming || lastIncoming._id === lastIncomingKey.current) return;
    lastIncomingKey.current = lastIncoming._id;
    setAnnouncement(announcementFor(lastIncoming, otherUser.name));
  }, [lastIncoming, otherUser.name]);

  // Older messages load when the top comes near. Re-armed after every page, in case the top is
  // still in view (a short chat on a tall screen). After a failed page it waits for Retry instead of
  // firing again straight away.
  const loadOlderRef = useRef(onLoadOlder);
  useEffect(() => {
    loadOlderRef.current = onLoadOlder;
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollerRef.current;
    if (!sentinel || !root || !hasOlder || loadingOlder || loadOlderFailed) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadOlderRef.current();
      },
      { root, rootMargin: "400px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, loadingOlder, loadOlderFailed, pageCount]);

  // showOffer: the card may sit in an older page that isn't loaded yet, so older pages load one at a
  // time until it renders (each new page re-runs this), then it scrolls into view.
  const [wantedOffer, setWantedOffer] = useState(null);
  useImperativeHandle(ref, () => ({ showOffer: setWantedOffer }), []);
  useEffect(() => {
    if (!wantedOffer) return;
    const card = scrollerRef.current?.querySelector(`[data-offer-id="${wantedOffer}"]`);
    if (card) {
      setWantedOffer(null);
      revealCard(scrollerRef.current, card);
    } else if (!hasOlder || loadOlderFailed) {
      setWantedOffer(null); // nothing more to load (a failed page shows its own Retry)
    } else if (!loadingOlder) {
      loadOlderRef.current();
    }
  }, [wantedOffer, items, hasOlder, loadingOlder, loadOlderFailed]);

  const metaFor = (message) => {
    const time = formatClock(message.createdAt);
    return message === ownLatest ? `${time} · ${seen ? "Seen" : "Sent"}` : time;
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollerRef} onScroll={handleScroll} className="flex h-full flex-col-reverse overflow-y-auto overscroll-contain">
        <section aria-label={`Messages with ${otherUser.name}`} className="px-3 pt-4 pb-3 sm:px-5">
          <div ref={sentinelRef} aria-hidden />
          {loadingOlder && (
            <div className="flex justify-center py-3" role="status" aria-label="Loading older messages">
              <LoaderCircle className="size-5 animate-spin text-brand-500" />
            </div>
          )}
          {loadOlderFailed && (
            <p className="flex items-center justify-center gap-1.5 py-3 text-sm text-slate-500 dark:text-slate-400">
              Couldn't load older messages ·
              <button type="button" onClick={() => onLoadOlder()} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                Retry
              </button>
            </p>
          )}
          {!hasOlder && <ChatIntro conversation={conversation} />}

          {items.map((item) => {
            if (item.day) {
              return (
                <div key={item.key} className="flex justify-center py-3">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
                    {dayLabel(item.day)}
                  </span>
                </div>
              );
            }

            const { message } = item;
            const mine = message.sender === myId;

            if (message.type === "system") {
              return (
                <SystemMessage
                  key={item.key}
                  message={message}
                  myId={myId}
                  otherName={otherUser.name.split(" ")[0]}
                  listing={listing}
                  role={conversation.role}
                />
              );
            }

            // Centred, not on the sender's side: the card always shows the latest state of the
            // negotiation, whoever made the latest move.
            if (message.type === "offer") {
              return (
                <div key={item.key} className="flex flex-col items-center pt-3">
                  {message.offer ? (
                    <OfferCard offer={message.offer} conversation={conversation} myId={myId} onCounter={onCounter} />
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">This offer is no longer available.</p>
                  )}
                  {message === ownLatest && <p className="mt-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">{metaFor(message)}</p>}
                </div>
              );
            }

            return (
              <div key={item.key} className={item.runStart ? "pt-3" : "pt-0.5"}>
                <MessageBubble
                  message={message}
                  mine={mine}
                  groupStart={item.runStart}
                  groupEnd={item.runEnd}
                  sender={otherUser}
                  meta={item.runEnd ? metaFor(message) : null}
                  onOpenImage={setPhoto}
                  onRetry={onRetry}
                  onDiscard={onDiscard}
                  onReport={mine ? null : setReporting}
                />
              </div>
            );
          })}

          {typing && (
            <div className="flex items-end gap-2 pt-3" aria-hidden>
              <Avatar name={otherUser.name} src={otherUser.avatar?.url} size="xs" />
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700/80">
                <TypingDots />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Live regions stay in the page so changes are always announced: new messages, and typing
          (the only place it's announced; the dots above are decoration). */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p className="sr-only" aria-live="polite">
        {typing ? `${otherUser.name} is typing` : ""}
      </p>

      {awayFromBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label={unseenBelow ? "New messages, jump to the latest" : "Jump to the latest message"}
          className="absolute right-4 bottom-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700"
        >
          {unseenBelow && <span className="text-brand-600 dark:text-brand-400">New</span>}
          <ArrowDown className="size-4" />
        </button>
      )}

      <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
      <ReportDialog
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        target={
          reporting && {
            type: "message",
            id: reporting._id,
            name: otherUser.name,
            preview: reporting.text || (reporting.image ? "📷 Photo" : ""),
          }
        }
      />
    </div>
  );
}
