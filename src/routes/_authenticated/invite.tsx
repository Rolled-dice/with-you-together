import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FamilySharingControls } from "@/components/family-sharing-controls";
import {
  acceptFamilyInvite,
  declineFamilyInvite,
  getInvitationByToken,
} from "@/lib/family.functions";
import { FAMILY_STATUS_LABELS, NO_SHARING } from "@/lib/family.schemas";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeCurrentPushDevice } from "@/lib/push-browser";

export const Route = createFileRoute("/_authenticated/invite")({
  validateSearch: (s) => z.object({ token: z.string().max(200).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Your family invitation | SomeoneNear" },
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});
function InvitePage() {
  const { token } = Route.useSearch();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  async function switchAccount() {
    setSwitching(true);
    try {
      await removeCurrentPushDevice(true);
      await supabase.auth.signOut();
      await qc.cancelQueries();
      qc.clear();
      await navigate({
        to: "/auth",
        search: { redirect: `/invite?token=${encodeURIComponent(token || "")}` },
        replace: true,
      });
    } catch {
      toast.error("Could not switch accounts. Please try again.");
    } finally {
      setSwitching(false);
    }
  }
  const lookup = useServerFn(getInvitationByToken);
  const query = useQuery({
    queryKey: ["invite", token],
    queryFn: () => lookup({ data: { token: token! } }),
    enabled: Boolean(token),
    retry: false,
  });
  return (
    <AppShell>
      <div className="family-experience mx-auto max-w-2xl">
        <PageHeader eyebrow="Family" title="Your invitation" />
        {!token ? (
          <p>No invitation was provided. Open the link you received.</p>
        ) : query.isPending ? (
          <p role="status">Checking your invitation...</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button className="mt-4" variant="outline" disabled={switching} onClick={switchAccount}>
              Sign in with another account
            </Button>
          </div>
        ) : (
          query.data && <InvitationForm key={query.data.id} invitation={query.data} token={token} />
        )}
      </div>
    </AppShell>
  );
}
export function InvitationForm({
  invitation,
  token,
}: {
  invitation: Awaited<ReturnType<typeof getInvitationByToken>>;
  token: string;
}) {
  const [name, setName] = useState(invitation.invitee_name);
  const [phone, setPhone] = useState(invitation.call_phone || invitation.contact_phone || "");
  const [window, setWindow] = useState(invitation.call_window || "");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [adult, setAdult] = useState(false);
  const [sharing, setSharing] = useState(NO_SHARING);
  const accept = useServerFn(acceptFamilyInvite);
  const decline = useServerFn(declineFamilyInvite);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (response: "accept" | "decline") => {
      if (response === "decline") return decline({ data: { token } });
      if (!adult) throw new Error("Confirm that you are at least 18.");
      return accept({
        data: {
          token,
          display_name: name,
          call_phone: phone,
          call_window: window,
          call_timezone: timezone,
          adult_confirmed: true,
          ...sharing,
        },
      });
    },
    onSuccess: (_, response) => {
      void qc.invalidateQueries({ queryKey: ["family"] });
      void qc.invalidateQueries({ queryKey: ["invite"] });
      toast.success(
        response === "accept" ? "Your verification call is requested" : "Invitation declined",
      );
      void navigate({ to: "/family" });
    },
    onError: (e) => toast.error(e.message),
  });
  if (invitation.status !== "pending")
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{invitation.family_name}</h2>
        <p>{FAMILY_STATUS_LABELS[invitation.status]}</p>
        <Button asChild>
          <Link to="/family">View my family</Link>
        </Button>
        {invitation.status === "verification_pending" && (
          <Button
            variant="outline"
            disabled={mut.isPending}
            onClick={() => {
              if (confirm("Decline this family invitation and stop the welcome calls?"))
                mut.mutate("decline");
            }}
          >
            Decline invitation
          </Button>
        )}
      </div>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate("accept");
      }}
    >
      <h2 className="text-xl font-semibold">Join {invitation.family_name}</h2>
      <div>
        <Label htmlFor="recipient-name">Your name</Label>
        <Input
          id="recipient-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="recipient-phone">Number for your welcome call</Label>
        <Input
          id="recipient-phone"
          type="tel"
          required
          placeholder="+91 or +1, then your number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="recipient-window">When may we call?</Label>
        <Input
          id="recipient-window"
          required
          maxLength={160}
          placeholder="Weekdays, 10 am to noon"
          value={window}
          onChange={(e) => setWindow(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="recipient-timezone">Your timezone</Label>
        <Input
          id="recipient-timezone"
          required
          list="family-timezones"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
        <datalist id="family-timezones">
          {[
            "Asia/Kolkata",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "Pacific/Honolulu",
            "America/Anchorage",
          ].map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>
      <FamilySharingControls value={sharing} onChange={setSharing} disabled={mut.isPending} />
      <label className="flex items-start gap-3 py-3">
        <input
          className="mt-1 h-5 w-5 shrink-0"
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
          required
        />
        <span>
          I am at least 18 and agree to a welcome call to confirm that I want to join this family.
        </span>
      </label>
      <p className="text-sm text-muted-foreground">
        Joining is your choice. Your Companion chats stay private. Family access starts after your
        welcome call.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!adult || mut.isPending}>
          {mut.isPending ? "Saving..." : "Accept and request call"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mut.isPending}
          onClick={() => {
            if (confirm("Decline this family invitation?")) mut.mutate("decline");
          }}
        >
          Decline invitation
        </Button>
      </div>
    </form>
  );
}
