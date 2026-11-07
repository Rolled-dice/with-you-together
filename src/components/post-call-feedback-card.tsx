import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SpinnerGapIcon, StarIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { submitSessionFeedback } from "@/lib/session-feedback.functions";

/**
 * Prompts the member to rate their most recently ended listener call.
 * Shown on /listeners when a completed booking has no feedback yet.
 */
export function PostCallFeedbackCard({
  bookingId,
  listenerName,
  onDone,
}: {
  bookingId: string;
  listenerName: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitSessionFeedback);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      submitFn({ data: { booking_id: bookingId, rating: rating || 1, note, follow_up: followUp } }),
    onSuccess: () => {
      toast.success("Thanks for the feedback");
      qc.invalidateQueries({ queryKey: ["session-feedback-prompt"] });
      qc.invalidateQueries({ queryKey: ["listener-bookings"] });
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="rounded-brand border-border bg-card animate-slide-in-up">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-medium">How was your call with {listenerName}?</h3>
          <p className="text-xs text-muted-foreground">
            Private to you, used to improve your matches.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
              className="p-1"
            >
              <StarIcon
                className={`h-6 w-6 transition-colors ${
                  rating >= n
                    ? "fill-brand-primary text-brand-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pcf-note" className="text-xs">
            Anything you'd like to remember? (optional)
          </Label>
          <Textarea
            id="pcf-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What helped, what didn't, how you're feeling now…"
            maxLength={2000}
          />
        </div>
        <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
          <Label htmlFor="pcf-follow" className="cursor-pointer">
            I'd like a follow-up with this listener
          </Label>
          <Switch id="pcf-follow" checked={followUp} onCheckedChange={setFollowUp} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => mut.mutate()}
            disabled={rating === 0 || mut.isPending}
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            {mut.isPending && <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />}
            Submit feedback
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
