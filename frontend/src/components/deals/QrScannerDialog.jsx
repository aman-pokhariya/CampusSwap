import { useEffect, useRef, useState } from "react";
import { CameraOff, Keyboard, LoaderCircle, RotateCcw, X } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { parseHandoverQr } from "../../utils/deals";

const INSECURE_COPY = "The camera only works on the https site. On a laptop, use the 6-digit code instead.";
const NO_CAMERA_COPY = "Couldn't open the camera. Allow camera access for this site in your browser, or use the 6-digit code instead.";

// The scan area qr-scanner reads by default: the middle two thirds of the picture.
function ScanFrame() {
  const corner = "absolute size-9 border-white";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[16.67%]">
      <span className={`${corner} top-0 left-0 rounded-tl-2xl border-t-4 border-l-4`} />
      <span className={`${corner} top-0 right-0 rounded-tr-2xl border-t-4 border-r-4`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-2xl border-r-4 border-b-4`} />
      <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse rounded-full bg-emerald-400" />
    </div>
  );
}

function Overlay({ children }) {
  return <div className="absolute inset-0 grid place-items-center bg-slate-950/70 p-6 text-center text-sm font-medium text-white">{children}</div>;
}

// Scans the seller's handover QR with the camera (the back one on phones). qr-scanner is downloaded
// only when this opens, so the rest of the app never carries it. The content mounts only while the
// dialog is open (Modal), and unmounting stops the camera.
// `onToken(token)` sends the token; it resolves to an error message, or null when the deal is done
// (the deal page then moves on by itself). `onUseCode` switches to typing the 6-digit code.
export default function QrScannerDialog({ open, dealId, onToken, onUseCode, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="qr-scanner-title">
      <Scanner dealId={dealId} onToken={onToken} onUseCode={onUseCode} onClose={onClose} />
    </Modal>
  );
}

function Scanner({ dealId, onToken, onUseCode, onClose }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const busyRef = useRef(false); // a scanned token is being checked: ignore further reads
  const [phase, setPhase] = useState("starting"); // starting | scanning | checking | retry | unavailable
  const [hint, setHint] = useState(null); // a QR that isn't this deal's handover code
  const [error, setError] = useState(null);

  // The scanner's decode handler is created once; it calls whatever onToken is current.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const handleDecode = async ({ data }) => {
      if (busyRef.current) return;
      const parsed = parseHandoverQr(data, dealId);
      if (parsed.error) {
        setHint(parsed.error);
        return;
      }
      busyRef.current = true;
      setHint(null);
      setPhase("checking");
      scanner.pause();
      const problem = await onTokenRef.current(parsed.token);
      if (cancelled || !problem) return;
      setError(problem);
      setPhase("retry");
    };

    const start = async () => {
      // Browsers only give the camera to secure pages (https, or localhost).
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(INSECURE_COPY);
        setPhase("unavailable");
        return;
      }
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) return;
        scanner = new QrScanner(videoRef.current, handleDecode, {
          preferredCamera: "environment",
          maxScansPerSecond: 10,
          returnDetailedScanResult: true,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setPhase("scanning");
      } catch {
        if (cancelled) return;
        setError(NO_CAMERA_COPY);
        setPhase("unavailable");
      }
    };
    start();

    return () => {
      cancelled = true;
      scannerRef.current = null;
      if (!scanner) return;
      scanner.pause(true); // stops the camera at once (stop() alone waits 300 ms)
      scanner.destroy();
    };
  }, [dealId]);

  const scanAgain = async () => {
    setError(null);
    setPhase("starting");
    busyRef.current = false;
    try {
      await scannerRef.current?.start();
      setPhase("scanning");
    } catch {
      setError(NO_CAMERA_COPY);
      setPhase("unavailable");
    }
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="qr-scanner-title" className="text-lg font-bold">
            Scan the seller's QR
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Point your camera at the code on their screen.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the scanner"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl bg-slate-950">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" className="size-full object-cover" />
        {phase === "scanning" && <ScanFrame />}
        {(phase === "starting" || phase === "checking") && (
          <Overlay>
            <span className="flex flex-col items-center gap-3" role="status">
              <LoaderCircle className="size-7 animate-spin" aria-hidden />
              {phase === "starting" ? "Starting the camera…" : "Checking the code…"}
            </span>
          </Overlay>
        )}
        {phase === "unavailable" && (
          <Overlay>
            <span className="flex flex-col items-center gap-3">
              <CameraOff className="size-8" aria-hidden />
              No camera here
            </span>
          </Overlay>
        )}
      </div>

      <p className="mt-3 min-h-5 text-sm font-medium text-amber-700 dark:text-amber-300" aria-live="polite">
        {hint}
      </p>
      {error && (
        <Alert type="error" className="mt-1">
          {error}
        </Alert>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {phase === "retry" && (
          <Button onClick={scanAgain}>
            <RotateCcw className="size-4" /> Scan again
          </Button>
        )}
        <Button variant="secondary" onClick={onUseCode}>
          <Keyboard className="size-4" /> Type the code instead
        </Button>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        The camera needs the https site — on your laptop, use the code.
      </p>
    </div>
  );
}
