import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStatus } from "ai";
import { z } from "zod";
import {
  MicrophoneIcon,
  StopIcon,
  XIcon,
  ArrowClockwiseIcon,
  ArrowUpIcon,
} from "@phosphor-icons/react";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCompanionVoice } from "@/hooks/use-companion-voice";
import { supabase } from "@/integrations/supabase/client";
import {
  appendDictation,
  MAX_COMPANION_TEXT,
  transcriptionSchema,
  voiceLanguageSchema,
  type VoiceLanguage,
  VoiceTranscriptionError,
} from "@/lib/companion-voice";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

async function transcribe(audio: Blob, language: VoiceLanguage, signal: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in again to use voice input.");
  const response = await fetch(
    `/api/companion-transcription?language=${encodeURIComponent(language)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": audio.type },
      body: audio,
      signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
    },
  );
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(payload);
    throw new VoiceTranscriptionError(
      error.success ? error.data.message : "Could not transcribe this recording. Please try again.",
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  return transcriptionSchema.parse(payload).text;
}

export function CompanionComposer(props: {
  status: ChatStatus;
  disabled: boolean;
  onSend: (text: string) => void | Promise<void>;
  initialText?: string;
  inputLabel?: string;
  sendLabel?: string;
  placeholder?: string;
}) {
  return (
    <TooltipProvider>
      <PromptInputProvider initialInput={props.initialText || ""}>
        <ComposerInput {...props} />
      </PromptInputProvider>
    </TooltipProvider>
  );
}

function ComposerInput({
  status,
  disabled,
  onSend,
  inputLabel = "Message to Companion",
  sendLabel = "Send message",
  placeholder = "What's on your mind?",
}: {
  status: ChatStatus;
  disabled: boolean;
  onSend: (text: string) => void | Promise<void>;
  inputLabel?: string;
  sendLabel?: string;
  placeholder?: string;
}) {
  const { textInput } = usePromptInputController();
  const { setInput } = textInput;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draft = useRef(textInput.value);
  const cancelVoice = useRef<() => void>(() => {});
  const [language, setLanguage] = useState<VoiceLanguage>("en-US");
  const [consentOpen, setConsentOpen] = useState(false);
  const consent = useRef(false);
  const [draftError, setDraftError] = useState("");
  const appendSpeech = useCallback(
    (text: string) => {
      const next = appendDictation(draft.current, text);
      if (next.length > MAX_COMPANION_TEXT) {
        setDraftError("Your message is full. Send or shorten it before adding more speech.");
        cancelVoice.current();
        return;
      }
      draft.current = next;
      setInput(next);
    },
    [setInput],
  );
  const voice = useCompanionVoice({ language, disabled, onTranscript: appendSpeech, transcribe });

  useEffect(() => {
    draft.current = textInput.value;
  }, [textInput.value]);
  useEffect(() => {
    cancelVoice.current = voice.cancel;
  }, [voice.cancel]);
  useEffect(() => {
    let saved: unknown;
    try {
      saved = localStorage.getItem("someonenear:voice-language");
      consent.current = sessionStorage.getItem("someonenear:voice-consent:v1") === "yes";
    } catch {
      /* Storage can be disabled. */
    }
    const parsed = voiceLanguageSchema.safeParse(saved);
    setLanguage(
      parsed.success
        ? parsed.data
        : navigator.language === "hi-IN" || navigator.language === "hi"
          ? "hi-IN"
          : navigator.language === "en-IN" ||
              /^(Asia\/Calcutta|Asia\/Kolkata)$/.test(
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              )
            ? "en-IN"
            : "en-US",
    );
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!disabled && !voice.isActive) inputRef.current?.focus();
  }, [disabled, voice.isActive]);

  const begin = () => {
    setDraftError("");
    if (!consent.current) {
      setConsentOpen(true);
      return;
    }
    void voice.start();
  };
  const elapsed = `${Math.floor(voice.elapsed / 60)}:${String(voice.elapsed % 60).padStart(2, "0")}`;
  const error = draftError || (voice.state.kind === "error" ? voice.state.message : "");
  const voiceLabel =
    voice.state.kind === "starting"
      ? "Waiting for microphone"
      : voice.state.kind === "listening"
        ? "Listening"
        : voice.state.kind === "finishing"
          ? "Finishing"
          : voice.state.kind === "transcribing"
            ? "Turning your voice into text"
            : "";

  return (
    <>
      <div className="text-sm empty:hidden">
        {error ? (
          <p role="alert" className="pb-2 text-destructive">
            {error}
          </p>
        ) : voiceLabel ? (
          <p role="status" className="flex items-center gap-2 pb-2 text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
            {voiceLabel}
            {voice.state.kind === "listening" && (
              <span className="ml-auto tabular-nums text-muted-foreground" aria-hidden="true">
                {elapsed}
              </span>
            )}
          </p>
        ) : !voice.available ? (
          <p className="pb-2 text-muted-foreground">Voice input is unavailable in this browser.</p>
        ) : null}
      </div>
      {voice.interim && (
        <p
          className="mb-2 max-h-16 overflow-y-auto break-words text-base text-muted-foreground"
          aria-label="Speech being recognized"
        >
          {voice.interim}
        </p>
      )}
      <PromptInput
        onSubmit={async (message) => {
          const text = message.text.trim();
          if (!text || disabled || voice.isActive) throw new Error("Message is not ready to send.");
          voice.cancel();
          await onSend(text);
          draft.current = "";
          setDraftError("");
        }}
      >
        <PromptInputTextarea
          ref={inputRef}
          aria-label={inputLabel}
          placeholder={disabled ? "Please wait to continue" : placeholder}
          maxLength={MAX_COMPANION_TEXT}
          className="max-h-32 min-h-16 text-base leading-relaxed md:text-base"
          disabled={disabled}
          onChange={(event) => {
            draft.current = event.currentTarget.value;
            setDraftError("");
          }}
          onKeyDown={(event) => {
            if (voice.isActive && event.key === "Enter" && !event.shiftKey) event.preventDefault();
            if (voice.isActive && event.key === "Escape") {
              event.preventDefault();
              voice.cancel();
            }
          }}
        />
        <PromptInputFooter className="flex-wrap gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <PromptInputButton
              size="icon-sm"
              variant="outline"
              className={cn(
                "size-11 shrink-0 text-foreground [&_svg]:size-5",
                voice.state.kind === "listening" && "bg-brand-accent/15 text-foreground",
              )}
              aria-label={
                voice.state.kind === "listening"
                  ? "Stop listening"
                  : voice.state.kind === "starting"
                    ? "Cancel microphone request"
                    : "Start voice input"
              }
              aria-pressed={voice.isActive}
              tooltip={voice.state.kind === "listening" ? "Stop listening" : "Voice input"}
              disabled={
                disabled ||
                !voice.available ||
                voice.state.kind === "finishing" ||
                voice.state.kind === "transcribing"
              }
              onClick={
                voice.state.kind === "listening"
                  ? voice.stop
                  : voice.state.kind === "starting"
                    ? voice.cancel
                    : begin
              }
            >
              {voice.state.kind === "listening" ? (
                <StopIcon className="size-5" />
              ) : (
                <MicrophoneIcon className="size-5" />
              )}
            </PromptInputButton>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {voice.state.kind === "error" && voice.state.retryable && (
              <PromptInputButton
                className="size-11 [&_svg]:size-5"
                size="icon-sm"
                aria-label="Retry transcription"
                tooltip="Retry transcription"
                onClick={voice.retry}
                disabled={disabled}
              >
                <ArrowClockwiseIcon className="size-5" />
              </PromptInputButton>
            )}
            {(voice.isActive || (voice.state.kind === "error" && voice.state.retryable)) && (
              <PromptInputButton
                className="size-11 [&_svg]:size-5"
                size="icon-sm"
                aria-label="Cancel voice input"
                tooltip="Cancel voice input"
                onClick={voice.cancel}
              >
                <XIcon className="size-5" />
              </PromptInputButton>
            )}
            <PromptInputSubmit
              className="size-11 shrink-0 rounded-md [&_svg]:size-5"
              status={status === "error" ? "ready" : status}
              aria-label={sendLabel}
              title={sendLabel}
              disabled={disabled || voice.isActive || !textInput.value.trim()}
            >
              {status !== "submitted" && status !== "streaming" ? <ArrowUpIcon /> : undefined}
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
      <AlertDialog open={consentOpen} onOpenChange={setConsentOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Use voice input?</AlertDialogTitle>
            <AlertDialogDescription>
              Your browser&apos;s speech service or Google Gemini processes your audio to turn it
              into text. SomeoneNear does not save these audio recordings. The text stays as a draft
              until you send it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                consent.current = true;
                try {
                  sessionStorage.setItem("someonenear:voice-consent:v1", "yes");
                } catch {
                  /* Consent remains in memory. */
                }
                void voice.start();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
