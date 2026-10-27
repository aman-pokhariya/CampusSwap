import { useEffect } from "react";
import { useSelector } from "react-redux";
import { watchPresence } from "../socket/socket";

// Someone's online status: { online, lastSeenAt }. Until the socket has answered, lastSeenAt is the
// `fallbackLastSeen` the API sent with the conversation.
export function usePresence(userId, fallbackLastSeen = null) {
  useEffect(() => {
    if (userId) watchPresence([userId]);
  }, [userId]);

  const presence = useSelector((state) => (userId ? state.chat.presence[userId] : undefined));
  return { online: presence?.online ?? false, lastSeenAt: presence?.lastSeenAt ?? fallbackLastSeen };
}
