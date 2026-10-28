import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  claimVerification,
  getVerificationQueue,
  recordVerification,
  reopenVerification,
} from "@/lib/family.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhoneIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

type QueueData = Awaited<ReturnType<typeof getVerificationQueue>>;
export function FamilyVerificationQueue() {
  const fn = useServerFn(getVerificationQueue);
  const query = useQuery({
    queryKey: ["family-verification"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  return (
    <section className="family-experience mb-8 border-y border-border py-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <ShieldCheckIcon /> Family verification
      </h2>
      {query.isPending && <p role="status">Loading verification requests...</p>}
      {query.isError && <p role="alert">Verification requests could not be loaded.</p>}
      {query.data && !query.data.rows.length && (
        <p className="text-muted-foreground">No verification calls waiting.</p>
      )}
      {query.data?.rows.map((row) => (
        <VerificationRow
          key={row.id}
          row={row}
          viewer={query.data!.viewer_id}
          admin={query.data!.is_admin}
        />
      ))}
    </section>
  );
}
function VerificationRow({
  row,
  viewer,
  admin,
}: {
  row: QueueData["rows"][number];
  viewer: string;
  admin: boolean;
}) {
  const claim = useServerFn(claimVerification);
  const record = useServerFn(recordVerification);
  const reopen = useServerFn(reopenVerification);
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<
    "verified" | "no_answer" | "declined" | "technical_failure"
  >("no_answer");
  const [confirmed, setConfirmed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [note, setNote] = useState("");
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const mut = useMutation({
    mutationFn: (action: "claim" | "record" | "reopen") => {
      if (action === "claim") return claim({ data: { id: row.id } });
      if (action === "reopen") {
        if (!requested) throw new Error("Record the recipient's request first.");
        return reopen({
          data: { id: row.id, attempt_id: attemptId, recipient_requested: true, note },
        });
      }
      return record({
        data: { id: row.id, attempt_id: attemptId, outcome, consent_confirmed: confirmed, note },
      });
    },
    onSuccess: () => {
      setAttemptId(crypto.randomUUID());
      setConfirmed(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["family-verification"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const assigned = row.assigned_to === viewer || (admin && Boolean(row.assigned_to));
  return (
    <article className="space-y-4 border-t border-border py-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{row.invitee_name}</h3>
          <p className="text-sm text-muted-foreground">
            {row.relationship} · {row.attempts} of 3 contact attempts
          </p>
          <p className="mt-1">
            {row.call_window} ({row.call_timezone})
          </p>
        </div>
        {row.status !== "verification_closed" && !assigned && (
          <Button variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("claim")}>
            Claim verification
          </Button>
        )}
        {assigned && row.call_phone && row.status !== "verification_closed" && (
          <Button asChild variant="outline">
            <a href={`tel:${row.call_phone}`}>
              <PhoneIcon /> Call {row.call_phone}
            </a>
          </Button>
        )}
      </div>
      {(assigned || (admin && row.status === "verification_closed")) && (
        <div className="grid max-w-xl gap-3">
          {row.status !== "verification_closed" ? (
            <>
              <label className="grid gap-2">
                Call outcome
                <select
                  className="family-select"
                  value={outcome}
                  onChange={(e) => {
                    setOutcome(e.target.value as typeof outcome);
                    setConfirmed(false);
                    setAttemptId(crypto.randomUUID());
                  }}
                >
                  <option value="no_answer">No answer</option>
                  <option value="verified">Identity and consent confirmed</option>
                  <option value="declined">Declined joining</option>
                  <option value="technical_failure">Technical failure (does not count)</option>
                </select>
              </label>
              {outcome === "verified" && (
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I spoke with the recipient, confirmed their identity, age, and consent to join.
                  </span>
                </label>
              )}
            </>
          ) : (
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={requested}
                onChange={(e) => setRequested(e.target.checked)}
              />
              The recipient asked support to reopen this verification.
            </label>
          )}
          <label className="grid gap-2">
            Staff note
            {row.status === "verification_closed"
              ? " (record the recipient's request)"
              : " (private)"}
            <Textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button
            disabled={
              mut.isPending ||
              (row.status === "verification_closed"
                ? !requested || note.trim().length < 10
                : outcome === "verified" && !confirmed)
            }
            onClick={() => mut.mutate(row.status === "verification_closed" ? "reopen" : "record")}
          >
            {row.status === "verification_closed" ? "Reopen verification" : "Save call outcome"}
          </Button>
          {row.history.length > 0 && (
            <details>
              <summary className="cursor-pointer py-2">Previous attempts</summary>
              {row.history.map((entry, index) => (
                <p key={index} className="border-t border-border py-2 text-sm">
                  {new Date(entry.created_at).toLocaleString()} ·{" "}
                  {entry.outcome.replaceAll("_", " ")}
                  <span className="block whitespace-pre-wrap break-words">{entry.note}</span>
                </p>
              ))}
            </details>
          )}
        </div>
      )}
    </article>
  );
}
