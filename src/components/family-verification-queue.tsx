import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  PhoneCallIcon,
  SpinnerGapIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  getFamilyVerificationQueue,
  recordFamilyVerificationCall,
  startFamilyVerificationCallFn,
} from "@/lib/family-verification.functions";

type CallOutcome =
  "connected_yes" | "connected_no" | "no_answer" | "voicemail" | "wrong_number" | "tech_failure";

export function FamilyVerificationQueue({
  ensurePhoneReady,
  phoneBusy,
}: {
  ensurePhoneReady: () => Promise<void>;
  phoneBusy: boolean;
}) {
  const listFn = useServerFn(getFamilyVerificationQueue);
  const recordFn = useServerFn(recordFamilyVerificationCall);
  const startCallFn = useServerFn(startFamilyVerificationCallFn);
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = useQuery({
    queryKey: ["family-verification-queue"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
  });
  const record = useMutation({
    mutationFn: ({ invitation_id, call_session_id, outcome }: { invitation_id: string; call_session_id: string; outcome: CallOutcome }) =>
      recordFn({
        data: {
          invitation_id,
          call_session_id,
          outcome,
          verbal_consent: outcome === "connected_yes" && Boolean(consent[invitation_id]),
          notes: notes[invitation_id] ?? "",
        },
      }),
    onSuccess: (result) => {
      if (
        ["declined", "closed"].includes(result.verification_status) &&
        "support_email_sent" in result &&
        result.support_email_sent === false
      ) {
        toast.error(
          "Call outcome saved, but support could not be emailed. Please alert care@someonenear.com.",
        );
      } else if (
        result.verification_status === "approved" &&
        !result.member_added &&
        !result.email
      ) {
        toast.success(
          "Consent recorded. The invitee still needs an account linked before family access.",
        );
      } else if (
        result.verification_status === "approved" &&
        !result.member_added &&
        "approval_email_sent" in result &&
        !result.approval_email_sent
      ) {
        toast.error(
          "Approved, but the email could not be sent. Ask the family owner to share the invite link.",
        );
      } else {
        toast.success(
          result.verification_status === "approved"
            ? result.member_added
              ? "Invitation approved and member added"
              : "Approved; invitee can claim their place from the email"
            : result.verification_status === "declined"
              ? "Invitation declined; the owner will see the support contact"
              : result.verification_status === "closed"
                ? "Three unsuccessful attempts recorded"
                : "Call outcome saved",
        );
      }
      setConsent({});
      setNotes({});
      void queryClient.invalidateQueries({ queryKey: ["family-verification-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["agent-queue"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save call outcome"),
  });
  const startCall = useMutation({
    mutationFn: async (invitation_id: string) => {
      await ensurePhoneReady();
      return startCallFn({ data: { invitation_id } });
    },
    onSuccess: () => {
      toast.success("Calling your headset first; the invitee will ring after you answer.");
      void queryClient.invalidateQueries({ queryKey: ["family-verification-queue"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start the verification call"),
  });

  return (
    <Card className="mt-6 rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          Family verification calls
          <Badge variant="secondary">{queue.data?.length ?? 0} waiting</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {queue.isLoading && <SpinnerGapIcon className="h-5 w-5 animate-spin" />}
        {queue.isError && (
          <p role="alert" className="text-sm text-destructive">
            Could not load family verification calls.
          </p>
        )}
        {queue.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No family confirmation calls are waiting.</p>
        )}
        {queue.data?.map((invite) => (
          <article
            key={invite.id}
            className="grid gap-3 rounded-brand border border-border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]"
          >
            <div className="min-w-0 space-y-2">
              <div>
                <h3 className="font-medium">{invite.invitee_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {invite.family_name} · invited by {invite.inviter_name}
                </p>
              </div>
              <p className="text-sm font-medium">{invite.invitee_phone}</p>
              <p className="break-all text-xs text-muted-foreground">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                Attempts: {invite.verification_attempts}/3
              </p>
              {invite.call_status && (
                <p className="text-xs text-muted-foreground">
                  Latest call: {invite.call_status.replaceAll("_", " ")}
                </p>
              )}
              {!invite.call_status || ["ended", "failed"].includes(invite.call_status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startCall.mutate(invite.id)}
                  disabled={startCall.isPending || phoneBusy}
                >
                  {startCall.isPending ? (
                    <SpinnerGapIcon className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCallIcon className="mr-1.5 h-4 w-4" />
                  )}
                  Call through SomeoneNear
                </Button>
              ) : (
                <p className="text-xs text-primary" role="status">
                  Call in progress. Save an outcome after it ends.
                </p>
              )}
            </div>
            <div className="grid content-start gap-2">
              <Textarea
                value={notes[invite.id] ?? ""}
                onChange={(event) =>
                  setNotes((value) => ({ ...value, [invite.id]: event.target.value }))
                }
                placeholder="Brief verification notes (optional)"
                rows={2}
                maxLength={1000}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(consent[invite.id])}
                  onCheckedChange={(checked) =>
                    setConsent((value) => ({ ...value, [invite.id]: checked === true }))
                  }
                />
                Invitee verbally agreed to join
              </label>
              {invite.call_session_id && invite.call_status && ["ended", "failed"].includes(invite.call_status) && (
                <div className="flex flex-wrap gap-2">
                  {invite.call_status === "ended" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "connected_yes" })
                        }
                        disabled={!consent[invite.id] || record.isPending}
                      >
                        <CheckCircleIcon className="mr-1.5 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "connected_no" })
                        }
                        disabled={record.isPending}
                      >
                        <XCircleIcon className="mr-1.5 h-4 w-4" /> Declined
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "no_answer" })
                        }
                        disabled={record.isPending}
                      >
                        No answer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "voicemail" })
                        }
                        disabled={record.isPending}
                      >
                        Voicemail
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "wrong_number" })
                        }
                        disabled={record.isPending}
                      >
                        Wrong number
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => record.mutate({ invitation_id: invite.id, call_session_id: invite.call_session_id!, outcome: "tech_failure" })}
                    disabled={record.isPending}
                  >
                    Technical failure
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
