import { useState } from "react";
import { Bug, Lightbulb, MessageSquareHeart, Sparkles, Headphones, LifeBuoy, Send, CheckCircle2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Category =
  | "feature_request"
  | "bug_report"
  | "product_feedback"
  | "ai_feedback"
  | "listener_feedback"
  | "support";

const CATEGORIES: {
  value: Category;
  label: string;
  hint: string;
  Icon: typeof Bug;
  tone: string;
}[] = [
  { value: "feature_request", label: "Feature request", hint: "Something you wish WithU could do", Icon: Lightbulb, tone: "bg-mint/40 text-neutral-900" },
  { value: "bug_report", label: "Bug report", hint: "Something looks or works wrong", Icon: Bug, tone: "bg-blush/50 text-neutral-900" },
  { value: "product_feedback", label: "Product feedback", hint: "General thoughts on WithU", Icon: MessageSquareHeart, tone: "bg-peach/60 text-neutral-900" },
  { value: "ai_feedback", label: "AI Companion", hint: "How the AI felt to you", Icon: Sparkles, tone: "bg-lilac/40 text-neutral-900" },
  { value: "listener_feedback", label: "Listener feedback", hint: "About a listener session", Icon: Headphones, tone: "bg-sage/40 text-neutral-900" },
  { value: "support", label: "Support / help", hint: "You need a hand from our team", Icon: LifeBuoy, tone: "bg-sunrise/40 text-neutral-900" },
];

type Props = {
  trigger: React.ReactNode;
  defaultCategory?: Category;
};

export function FeedbackDialog({ trigger, defaultCategory = "product_feedback" }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | {
    category: Category;
    subject: string | null;
    email: string | null;
    ticketId: string;
  }>(null);

  const reset = () => {
    setCategory(defaultCategory);
    setSubject("");
    setMessage("");
    setEmail("");
    setSubmitted(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 4) {
      toast.error("Please share a little more — at least a few words.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const page = typeof window !== "undefined" ? window.location.pathname : null;
      const effectiveEmail = email.trim() || sess.user?.email || null;
      const { data, error } = await supabase.from("feedback_submissions").insert({
        user_id: sess.user?.id ?? null,
        category,
        subject: subject.trim() || null,
        message: message.trim(),
        email: effectiveEmail,
        page,
      }).select("id").maybeSingle();
      if (error) throw error;
      const rawId = (data?.id ?? crypto.randomUUID()).toString().replace(/-/g, "");
      const shortId = `WU-${rawId.slice(0, 6).toUpperCase()}`;
      setSubmitted({
        category,
        subject: subject.trim() || null,
        email: effectiveEmail,
        ticketId: shortId,
      });
      toast.success("Feedback received ❤️");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send that just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };


  const activeCategory = CATEGORIES.find((c) => c.value === (submitted?.category ?? category))!;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl">
        {submitted ? (
          <div className="space-y-5">
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mint/60 text-neutral-900 shadow-soft">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <DialogTitle className="text-xl">Thank you — we've got it</DialogTitle>
              <DialogDescription>
                Your feedback is safely in our product review queue. Every note is read by a human.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Reference</span>
                <span className="font-mono text-xs text-neutral-700">{submitted.ticketId}</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activeCategory.tone}`}>
                  <activeCategory.Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold">{activeCategory.label}</div>
                  {submitted.subject ? (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">"{submitted.subject}"</div>
                  ) : (
                    <div className="mt-0.5 text-xs text-muted-foreground">{activeCategory.hint}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl bg-peach/25 p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-700">What happens next</div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p>Our team reviews new feedback within <strong>2 business days</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p>
                  {submitted.email
                    ? <>We'll follow up at <strong className="break-all">{submitted.email}</strong> if we need more detail.</>
                    : <>No email provided — we won't be able to reply, but your note still shapes the roadmap.</>}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageSquareHeart className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p>Need help now? Email <a className="underline underline-offset-2" href="mailto:withU.customercare@support.com">withU.customercare@support.com</a>.</p>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSubmitted(null)}
                className="rounded-2xl"
              >
                Send another
              </Button>
              <Button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                className="rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Help shape WithU</DialogTitle>
              <DialogDescription>
                Every note lands in our product review queue. We read them all — promise.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">What's this about?</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map(({ value, label, Icon, tone }) => {
                    const active = category === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setCategory(value)}
                        className={`group flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left text-xs transition-all ${
                          active
                            ? "border-neutral-900 bg-neutral-900 text-white shadow-soft"
                            : "border-border bg-card hover:-translate-y-0.5 hover:shadow-soft"
                        }`}
                      >
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-white/15 text-white" : tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-semibold">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {CATEGORIES.find((c) => c.value === category)?.hint}
                </p>
              </div>

              <div>
                <Label htmlFor="fb-subject">Subject <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="fb-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="One-line summary"
                  className="mt-1.5"
                  maxLength={120}
                />
              </div>

              <div>
                <Label htmlFor="fb-message">Your message</Label>
                <Textarea
                  id="fb-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what happened, what you'd love, or what didn't feel right..."
                  className="mt-1.5 min-h-[120px]"
                  maxLength={4000}
                  required
                />
                <div className="mt-1 flex justify-end text-[11px] text-muted-foreground">{message.length}/4000</div>
              </div>

              <div>
                <Label htmlFor="fb-email">Email to follow up <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="fb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting} className="rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800">
                  <Send className="mr-2 h-4 w-4" />
                  {submitting ? "Sending..." : "Send feedback"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
