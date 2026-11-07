import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_MEDIA_BYTES, mediaFile, recordingMime } from "./recording";

export function useRecording() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resource = useRef<{ stream?: MediaStream; recorder?: MediaRecorder; generation: number }>({
    generation: 0,
  });
  const release = useCallback(() => {
    const r = resource.current;
    r.generation++;
    if (r.recorder) {
      r.recorder.ondataavailable = null;
      r.recorder.onstop = null;
      r.recorder.onerror = null;
      if (r.recorder.state !== "inactive") r.recorder.stop();
    }
    r.stream?.getTracks().forEach((track) => track.stop());
    r.stream = undefined;
    r.recorder = undefined;
  }, []);
  function cancel() {
    release();
    setRecording(false);
    setRequesting(false);
    setBlob(null);
    setDuration(0);
    setError(null);
  }
  useEffect(() => () => release(), [release]);
  async function start(kind: "voice" | "video") {
    cancel();
    setRequesting(true);
    const generation = resource.current.generation;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Please upload a recording in this browser.");
      const mimeType = recordingMime(kind, (type) => MediaRecorder.isTypeSupported(type));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      });
      if (resource.current.generation !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      resource.current.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      resource.current.recorder = recorder;
      const parts: Blob[] = [];
      let bytes = 0;
      const started = Date.now();
      recorder.ondataavailable = (event) => {
        if (resource.current.generation !== generation) return;
        bytes += event.data.size;
        if (bytes > MAX_MEDIA_BYTES) {
          release();
          setRecording(false);
          setError("Recording reached 25 MiB. Please make a shorter recording.");
          return;
        }
        parts.push(event.data);
      };
      recorder.onerror = () => {
        release();
        setRecording(false);
        setError("Recording stopped unexpectedly. Please try again.");
      };
      recorder.onstop = () => {
        if (resource.current.generation !== generation) return;
        stream.getTracks().forEach((track) => track.stop());
        resource.current.stream = undefined;
        resource.current.recorder = undefined;
        const result = new Blob(parts, { type: recorder.mimeType || mimeType });
        try {
          mediaFile(result, kind);
          setBlob(result);
          setDuration((Date.now() - started) / 1000);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Recording failed.");
        }
        setRecording(false);
      };
      recorder.start(1000);
      setRequesting(false);
      setRecording(true);
    } catch (reason) {
      if (resource.current.generation !== generation) return;
      release();
      setRecording(false);
      setRequesting(false);
      setError(
        reason instanceof Error ? reason.message : "Microphone access failed. Please try again.",
      );
    }
  }
  function stop() {
    const rec = resource.current.recorder;
    if (rec?.state === "recording") rec.stop();
  }
  function upload(file: File, kind: "voice" | "video") {
    cancel();
    try {
      mediaFile(file, kind);
      setBlob(file);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "File unavailable.");
    }
  }
  return { blob, duration, recording, requesting, error, cancel, start, stop, upload };
}
export function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
