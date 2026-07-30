import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mic, Video } from "lucide-react";
import type { ChimeMeeting } from "@/hooks/useChimeMeeting";

/** Device selection + preview before joining a Chime session. */
export function PreCallCheck({
  meeting,
  onJoin,
}: {
  meeting: ChimeMeeting;
  onJoin: () => void;
}) {
  const {
    status,
    error,
    audioInputs,
    videoInputs,
    selectedAudioInput,
    selectedVideoInput,
    chooseAudioInputDevice,
    chooseVideoInputDevice,
    localVideoRef,
    initialize,
    volume,
  } = meeting;

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-medium">Check your devices</h3>
          <p className="text-xs text-muted-foreground">
            Pick the microphone and camera you want to use before joining.
          </p>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-brand bg-muted">
          <video
            ref={localVideoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-background/70">
            <div
              className="h-full rounded-full bg-brand-primary transition-[width] duration-100"
              style={{ width: `${Math.min(100, Math.round(volume * 140))}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" /> Microphone
            </span>
            <Select
              value={selectedAudioInput}
              onValueChange={(v) => void chooseAudioInputDevice(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a microphone" />
              </SelectTrigger>
              <SelectContent>
                {audioInputs.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" /> Camera
            </span>
            <Select
              value={selectedVideoInput}
              onValueChange={(v) => void chooseVideoInputDevice(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a camera" />
              </SelectTrigger>
              <SelectContent>
                {videoInputs.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {error && (
          <p className="rounded-brand border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            {error}
          </p>
        )}

        <Button
          onClick={onJoin}
          disabled={status === "initializing"}
          className="self-start"
        >
          {status === "initializing" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Join session
        </Button>
      </CardContent>
    </Card>
  );
}
