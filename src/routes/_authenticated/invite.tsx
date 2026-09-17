import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  acceptFamilyInvite,
  getInvitationByToken,
} from "@/lib/family.functions";
import { SpinnerGapIcon, UsersIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

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
      toast.success("Welcome to the family");
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/family" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

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
          {data?.invitation && data.family && (
            <>
              <p>
                You've been invited to join <strong>{data.family.name}</strong> as{" "}
                <strong>{data.invitation.role}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Invitation for {data.invitation.email}
                {data.current_email && data.current_email !== data.invitation.email && (
                  <>
                    {" "}
, you're signed in as {data.current_email}. Sign in with the invited email to
                    accept.
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => acceptMut.mutate()}
                  disabled={acceptMut.isPending}
                  className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                >
                  {acceptMut.isPending ? (
                    <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Accept invitation
                </Button>
                <Button
                  variant="outline"
                  className="rounded-brand"
                  onClick={() => navigate({ to: "/dashboard" })}
                >
                  Not now
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
