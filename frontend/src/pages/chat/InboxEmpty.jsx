import { MessagesSquare } from "lucide-react";

// The right-hand pane on wide screens before a chat is picked (phones show the list instead). Only
// shown when there are chats to pick: an empty inbox is one message across the page (Inbox).
export default function InboxEmpty() {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-xs text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-linear-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-brand-500/30">
          <MessagesSquare className="size-8" />
        </span>
        <h2 className="mt-5 text-xl font-bold">Your chats</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick a chat to read and reply. Offers, counters and deals all happen right inside it.
        </p>
      </div>
    </div>
  );
}
