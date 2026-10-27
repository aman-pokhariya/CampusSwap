import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { HandCoins, ImagePlus, LoaderCircle, SendHorizontal, X } from "lucide-react";
import { sendChatMessage, stashOutgoingPhoto } from "../../api/chat.api";
import { sendTyping } from "../../socket/socket";
import { newClientId } from "../../utils/chat";
import { compressImage } from "../../utils/image";

const MAX_LENGTH = 2000;
// "Stopped typing" after this long without a keystroke (socket.js limits how often "typing" goes out).
const TYPING_IDLE_MS = 2500;

const iconButton =
  "grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white";

// The message box: grows up to 5 lines, Enter sends, Shift+Enter adds a line. A photo can go with
// a caption (the text). Sending is optimistic and in order: see sendChatMessage in api/chat.api.js.
export default function Composer({ conversationId, offerDisabled, onMakeOffer }) {
  const dispatch = useDispatch();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null); // { file, url }
  const [preparing, setPreparing] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const idleTimer = useRef(null);

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    sendTyping(conversationId, false);
  };

  // Leaving the chat ends "typing…" and frees an unsent photo's preview. (ChatView gives every
  // conversation its own Composer, so conversationId never changes during one's lifetime.)
  const photoRef = useRef(photo);
  photoRef.current = photo;
  useEffect(
    () => () => {
      clearTimeout(idleTimer.current);
      sendTyping(conversationId, false);
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    },
    [conversationId],
  );

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`; // max-h-32 caps it at about 5 lines
  };

  const handleChange = (event) => {
    setText(event.target.value);
    resize();

    if (!event.target.value.trim()) return stopTyping();
    sendTyping(conversationId, true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    setPreparing(true);
    try {
      const compressed = await compressImage(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ file: compressed, url: URL.createObjectURL(compressed) });
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPreparing(false);
    }
  };

  const removePhoto = () => {
    URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  const canSend = (text.trim().length > 0 || photo) && !preparing;

  const send = () => {
    if (!canSend) return;
    const clientId = newClientId();
    // The outbox owns the photo from here (it's released once the server has it).
    if (photo) stashOutgoingPhoto(clientId, photo);
    dispatch(sendChatMessage({ conversationId, clientId, text: text.trim(), imageUrl: photo?.url }));

    stopTyping();
    setText("");
    setPhoto(null);
    requestAnimationFrame(resize);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-slate-200 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 dark:border-slate-800 dark:bg-slate-900">
      {(photo || preparing) && (
        <div className="mb-2 flex items-center gap-3 px-1">
          <div className="relative size-16 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            {photo ? (
              <img src={photo.url} alt="Photo to send" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center">
                <LoaderCircle className="size-5 animate-spin text-brand-500" aria-label="Preparing photo" />
              </span>
            )}
            {photo && (
              <button
                type="button"
                onClick={removePhoto}
                aria-label="Remove photo"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-slate-950/70 text-white hover:bg-rose-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add a caption below, or just send the photo.</p>
        </div>
      )}

      <div className="flex items-end gap-1">
        <button
          type="button"
          onClick={onMakeOffer}
          disabled={offerDisabled}
          aria-label="Make an offer"
          title={offerDisabled ? "Offers are closed for this listing" : "Make an offer"}
          className={iconButton}
        >
          <HandCoins className="size-5" />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={preparing} aria-label="Attach a photo" className={iconButton}>
          <ImagePlus className="size-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter (or an IME still composing a word) doesn't.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base leading-snug outline-hidden transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
        />

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-95 disabled:pointer-events-none disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>

      {text.length > MAX_LENGTH - 200 && (
        <p className="mt-1 px-2 text-right text-[11px] text-slate-400 tabular-nums">
          {text.length}/{MAX_LENGTH}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          pickPhoto(event.target.files[0]);
          event.target.value = ""; // lets you pick the same photo again
        }}
      />
    </div>
  );
}
