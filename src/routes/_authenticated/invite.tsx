import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { acceptFamilyInvite, getInvitationByToken } from "@/lib/family.functions";
import { SpinnerGapIcon, UsersIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/invite")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Join family | SomeoneNear" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lookupFn = useServerFn(getInvitationByToken);
  const acceptFn = useServerFn(acceptFamilyInvite);

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => lookupFn({ data: { token: token! } }),
    enabled: !!token,
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptFn({ data: { token: token! } }),
    onSuccess: () => {
      toast.success("You're now part of the family circle");
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/family" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    const invite = data?.invitation;
    if (
      invite?.status === "pending" &&
      invite.verification_status === "approved" &&
      data?.current_email?.toLowerCase() === invite.email.toLowerCase() &&
      !acceptMut.isPending &&
      !acceptMut.isSuccess
    ) {
      acceptMut.mutate();
    }
  }, [data, acceptMut.isPending, acceptMut.isSuccess]);

  return (
    <AppShell>
      <PageHeader eyebrow="Family" title="Join a family circle" />
      <Card className="rounded-brand border-border bg-card max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <UsersIcon className="h-4 w-4 text-brand-accent" />
            Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {!token && <p className="text-muted-foreground">No invitation token provided.</p>}
          {isLoading && <SpinnerGapIcon className="h-4 w-4 animate-spin text-brand-primary" />}
          {error && <p className="text-destructive">{(error as Error).message}</p>}
          {data && !data.invitation && (
            <p className="text-muted-foreground">This invitation link is not valid.</p>
          )}
          {data?.invitation &&
            data.family &&
            data.invitation.status === "pending" &&
            data.invitation.verification_status === "awaiting_call" && (
              <>
                <p>
                  <strong>{data.invitation.email}</strong> was invited to join{" "}
                  <strong>{data.family.name}</strong>.
                </p>
                <p className="text-muted-foreground">
                  SomeoneNear’s care team will call the number shared by your family member. You do
                  not need to accept or confirm in the app.
                </p>
              </>
            )}
          {data?.invitation &&
            data.family &&
            data.invitation.verification_status === "declined" && (
              <p className="text-muted-foreground">
                This family invitation was not approved during the confirmation call. Please contact
                the person who invited you if you have questions.
              </p>
            )}
          {data?.invitation && data.family && data.invitation.verification_status === "closed" && (
            <p className="text-muted-foreground">
              The care team could not reach the invitee after three attempts. The family owner can
              contact{" "}
              <a className="underline" href="mailto:care@someonenear.com">
                care@someonenear.com
              </a>{" "}
              for help.
            </p>
          )}
          {data?.invitation &&
            data.family &&
            data.invitation.status === "pending" &&
            data.invitation.verification_status === "approved" && (
              <>
                <p>
                  Your invitation to join <strong>{data.family.name}</strong> has been approved.
                </p>
                <p className="text-xs text-muted-foreground">
                  To join, sign in or create an account with {data.invitation.email}. Your family
                  membership will then be linked automatically.
                  {data.current_email &&
                    data.current_email.toLowerCase() !== data.invitation.email.toLowerCase() &&
                    ` You’re signed in as ${data.current_email}; please switch to the invited email.`}
                </p>
                {acceptMut.isPending && (
                  <SpinnerGapIcon className="h-4 w-4 animate-spin text-brand-primary" />
                )}
              </>
            )}
          {data?.invitation && data.invitation.status === "accepted" && (
            <p>You’re already connected to this family circle.</p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
