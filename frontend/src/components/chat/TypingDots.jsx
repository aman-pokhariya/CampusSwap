// Three bouncing dots: "the other person is typing".
export default function TypingDots({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden>
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}
