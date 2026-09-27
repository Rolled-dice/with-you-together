import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowsClockwiseIcon, CameraIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Facing = "environment" | "user";

/**
 * In-app camera that asks for the REAR lens explicitly.
 *
 * `<input capture="environment">` is only a hint and several Android browsers
 * open the selfie camera anyway. getUserMedia with `facingMode: environment`
 * is honoured far more reliably, and the switch button covers devices that
 * still pick the wrong lens. If the camera can't be opened at all (no
 * permission, insecure origin, unsupported browser) we hand back to the
 * native picker via `onFallback`.
 */
export function RearCameraDialog({
  open,
  onOpenChange,
  onCapture,
  onFallback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Parent callbacks are often inline arrows; keep them in refs so a parent
  // re-render doesn't tear down and reopen the camera stream.
  const onFallbackRef = useRef(onFallback);
  const onOpenChangeRef = useRef(onOpenChange);
  onFallbackRef.current = onFallback;
  onOpenChangeRef.current = onOpenChange;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        onOpenChangeRef.current(false);
        onFallbackRef.current();
        return;
      }
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow the camera in your browser settings, or choose a photo instead."
            : "We couldn't open the camera. You can choose a photo instead.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `prescription-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 rounded-3xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Photograph the prescription</DialogTitle>
          <DialogDescription>
            Hold the label flat, fill the frame, and keep it in good light.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-foreground/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-background">
              <SpinnerGapIcon className="h-7 w-7 animate-spin" aria-label="Opening camera" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-background">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            disabled={!!error}
          >
            <ArrowsClockwiseIcon /> Switch camera
          </Button>
          {error ? (
            <Button
              type="button"
              className="min-h-11 rounded-xl"
              onClick={() => {
                onOpenChange(false);
                onFallback();
              }}
            >
              Choose a photo
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11 rounded-xl px-6"
              onClick={capture}
              disabled={!ready}
            >
              <CameraIcon /> Take photo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
