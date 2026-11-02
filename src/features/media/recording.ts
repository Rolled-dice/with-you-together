export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export function recordingMime(
  kind: "voice" | "video",
  supported: (type: string) => boolean,
): string {
  const candidates =
    kind === "voice"
      ? ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]
      : ["video/webm;codecs=vp8,opus", "video/mp4", "video/webm"];
  const mime = candidates.find((type) => supported(type));
  if (!mime) throw new Error("Recording isn’t supported here. Please upload a file instead.");
  return mime;
}
export function mediaFile(blob: Blob, kind: "voice" | "video"): File {
  if (!blob.size || blob.size > MAX_MEDIA_BYTES)
    throw new Error("Choose a recording between 1 byte and 25 MiB.");
  const mime = blob.type.split(";")[0].toLowerCase();
  const extensions: Record<string, string> = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/mp4": "mp4",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  const extension = extensions[mime];
  if (!extension || !mime.startsWith(kind === "voice" ? "audio/" : "video/"))
    throw new Error("Choose a supported recording for this message type.");
  return new File([blob], `message.${extension}`, { type: blob.type });
}
