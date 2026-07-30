import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import type { ChimeMeeting } from "@/hooks/useChimeMeeting";

/** Active Chime session UI: recording banner, tiles, visualizer and controls. */
export function CallRoom({
  meeting,
  onLeave,
}: {
  meeting: ChimeMeeting;
  onLeave: () => void;
}) {
  const {
    error,
    muted,
    cameraOn,
    volume,
    localVideoRef,
    remoteVideoRef,
    audioElRef,
    startCall,
    muteMic,
    unmuteMic,
    toggleCamera,
    leaveCall,
  } = meeting;

  useEffect(() => {
    void startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bars = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Persistent, non-dismissable recording notice */}
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-xs font-medium text-destructive-foreground"
      >
        <span aria-hidden>🔴</span>
        This session is being recorded for safety and quality. You consented to
        this upon account creation.
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-brand bg-muted">
          <video
            ref={remoteVideoRef}
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px]">
            Them
          </span>
        </div>

        <div className="relative overflow-hidden rounded-brand bg-muted">
          <video
            ref={localVideoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px]">
            You
          </span>
          {/* Mic level visualizer on the local tile */}
          <div className="absolute bottom-3 left-3 flex items-end gap-1 rounded-full bg-background/80 px-2 py-1.5">
            {muted ? (
              <MicOff className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <>
                <Mic className="mr-1 h-3.5 w-3.5 text-brand-primary" />
                {bars.map((threshold, i) => (
                  <span
                    key={threshold}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      volume >= threshold * 0.6
                        ? "bg-brand-primary"
                        : "bg-muted-foreground/30"
                    }`}
                    style={{ height: `${6 + i * 4}px` }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-brand border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 border-t border-border bg-card/60 px-4 py-3">
        <Button
          variant={muted ? "destructive" : "outline"}
          size="sm"
          onClick={() => (muted ? unmuteMic() : muteMic())}
        >
          {muted ? (
            <MicOff className="mr-1.5 h-4 w-4" />
          ) : (
            <Mic className="mr-1.5 h-4 w-4" />
          )}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant={cameraOn ? "outline" : "destructive"}
          size="sm"
          onClick={() => void toggleCamera()}
        >
          {cameraOn ? (
            <Video className="mr-1.5 h-4 w-4" />
          ) : (
            <VideoOff className="mr-1.5 h-4 w-4" />
          )}
          {cameraOn ? "Camera on" : "Camera off"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            await leaveCall();
            onLeave();
          }}
        >
          <PhoneOff className="mr-1.5 h-4 w-4" /> Leave
        </Button>
      </div>

      <audio ref={audioElRef} className="hidden" />
    </div>
  );
}
