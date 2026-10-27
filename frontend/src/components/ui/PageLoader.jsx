import { LoaderCircle } from "lucide-react";

// Shown inside a layout while a lazily loaded page's code downloads (usually a few milliseconds).
export default function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Loading page">
      <LoaderCircle className="size-6 animate-spin text-brand-500" />
    </div>
  );
}
