import { capabilities } from "@/lib/frontend/capabilities";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { useIdentity } from "@/features/session/session-store";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { MemberAvatar } from "@/components/prototype/member-avatar";
import { FamilyGlobe } from "@/components/prototype/family-globe";
import {
  createGlobeMembersFromFamily,
  createPreviewGlobeMembers,
} from "@/components/prototype/globe-model";
import { PLAN_DISPLAY } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createFamily,
  deleteFamily,
  getMyFamily,
  inviteFamilyMember,
  leaveFamily,
  removeFamilyMember,
  renameFamily,
  revokeFamilyInvite,
} from "@/lib/family.functions";
import { getFamilyPool, setAllocations } from "@/lib/family-sessions.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PhoneNumberField } from "@/components/phone-number-field";
import {
  CalendarCheckIcon,
  CopyIcon,
  CrownIcon,
  SpinnerGapIcon,
  EnvelopeSimpleIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({
    meta: [
      { title: "Family | SomeoneNear" },
      {
        name: "description",
        content: "Invite family members, manage roles, and share your Care Membership.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-6">
        <DataError
          retry={reset}
          message={error?.message || "We couldn't load your family circle. Please try again."}
        />
      </div>
    </AppShell>
  ),
  component: FamilyPage,
});

function FamilyPage() {
  const { userId } = useIdentity();
  const familyFn = useServerFn(getMyFamily);
  const profileFn = useServerFn(getMyProfile);

  const {
    data: profile,
    isPending: profileLoading,
    isError: profileError,
    refetch: retryProfile,
  } = useQuery({
    queryKey: ["me", userId],
    queryFn: () => profileFn(),
    enabled: !!userId,
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["family", userId],
    queryFn: () => familyFn(),
    enabled: !!userId,
  });

  const previewMembers = useMemo(() => {
    try {
      return createPreviewGlobeMembers(profile);
    } catch {
      return [];
    }
  }, [profile]);

  const realGlobeMembers = useMemo(() => {
    if (!data?.family) return [];
    try {
      return createGlobeMembersFromFamily({
        family: data.family,
        members: data.members,
        invites: data.invites,
        currentUserId: userId ?? undefined,
        userProfile: profile,
      });
    } catch {
      return [];
    }
  }, [data, profile, userId]);

  if (isError || profileError)
    return (
      <AppShell>
        <DataError
          retry={() => {
            void refetch();
            void retryProfile();
          }}
        />
      </AppShell>
    );
  if (isLoading || profileLoading) {
    return (
      <AppShell>
        <DataSkeleton />
      </AppShell>
    );
  }

  // Mirrors the server gate in family.functions.ts: any paid plan.
  const hasFamilyTier = profile?.care_tier === "care" || profile?.care_tier === "care_plus";

  return (
    <AppShell>
      <PageHeader
        eyebrow="👨‍👩‍👧‍👦 Page 2 · Family Circle"
        slogan="Closer, even from far."
        title="Manage your loved ones & call participation"
        description="Your people, together. Companion conversations stay private, and family access follows each member’s role."
      />

      {!data?.family ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="font-display text-2xl font-medium">Family Circle Worldwide</h3>
              <p className="text-sm text-muted-foreground">
                Your family's connected presence across time zones. Create your circle below to bring your loved ones onto your personal 3D globe.
              </p>
            </div>
            <FamilyGlobe
              familyName="Your Family Circle"
              isLiveFamily={false}
              initialMembers={previewMembers}
            />
          </section>
          <EmptyState hasFamilyTier={hasFamilyTier} />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="font-display text-2xl font-medium">
                {data.family.name} · Live Family Globe
              </h3>
              <p className="text-sm text-muted-foreground">
                Connected presence for {data.family.name} across time zones ({data.members.length}{" "}
                active member{data.members.length === 1 ? "" : "s"}
                {data.invites.length > 0 ? `, ${data.invites.length} pending invite${data.invites.length === 1 ? "" : "s"}` : ""}).
              </p>
            </div>
            <FamilyGlobe
              familyName={data.family.name}
              isLiveFamily={true}
              initialMembers={realGlobeMembers}
            />
          </section>
          <FamilyView data={data} />
          <div>
            {capabilities.outboundCallBooking && <SessionAllocationPanel />}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ hasFamilyTier }: { hasFamilyTier: boolean }) {
  const createFn = useServerFn(createFamily);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: () => createFn({ data: { name } }),
    onSuccess: () => {
      toast.success("Family created");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card data-page-reveal className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <UsersIcon className="h-4 w-4 text-brand-accent" />
          Start a family circle
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasFamilyTier ? (
          <div className="rounded-brand border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Family sharing requires an eligible Care membership. Review your current access in
            Settings. New purchases are not available in this release.
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Give your circle a name. You can invite members and set roles after.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="e.g. The Rivera family"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-brand"
              />
              <Button
                disabled={!name.trim() || mut.isPending}
                onClick={() => mut.mutate()}
                className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
              >
                {mut.isPending ? <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create circle
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FamilyView({ data }: { data: Awaited<ReturnType<typeof getMyFamily>> }) {
  const qc = useQueryClient();
  const renameFn = useServerFn(renameFamily);
  const inviteFn = useServerFn(inviteFamilyMember);
  const revokeFn = useServerFn(revokeFamilyInvite);
  const removeFn = useServerFn(removeFamilyMember);
  const leaveFn = useServerFn(leaveFamily);
  const deleteFn = useServerFn(deleteFamily);

  const { family, members, invites, myRole } = data;
  const isAdmin = myRole === "owner";
  const isOwner = myRole === "owner";

  const [name, setName] = useState(family!.name);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteCountry, setInviteCountry] = useState("IN");
  const [inviteOpen, setInviteOpen] = useState(false);
  const memberLimit = PLAN_DISPLAY.care_plus.members;

  const renameMut = useMutation({
    mutationFn: () => renameFn({ data: { name } }),
    onSuccess: () => {
      toast.success("Renamed");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const inviteMut = useMutation({
    mutationFn: () =>
      inviteFn({ data: { name: inviteName, email: inviteEmail, phone: invitePhone } }),
    onSuccess: (res: any) => {
      const link = `${window.location.origin}/invite?token=${res.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      if (res.alreadyMember) {
        toast.info("This loved one is already an active member of your family circle.");
      } else if (res.alreadyPending) {
        toast.success("Existing invitation found! Invite link copied to clipboard.");
      } else if (res.emailSent) {
        toast.success("Invitation email sent; our care team will call to confirm consent");
      } else {
        toast.success("Invitation created! Link copied to clipboard to share directly.");
      }
      setInviteEmail("");
      setInviteName("");
      setInvitePhone("");
      setInviteCountry("IN");
      setInviteOpen(false);
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const invitationLink = (token: string) => `${window.location.origin}/invite?token=${token}`;
  const reservedInvites = invites.filter(
    (invite) => invite.status === "pending" && invite.verification_status !== "closed",
  ).length;

  return (
    <div className="grid gap-6">
      <Card data-page-reveal className="sn-worker-family-hub rounded-brand border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <UsersIcon className="h-4 w-4 text-brand-accent" />
            {family!.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isOwner && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Family name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 rounded-brand"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => renameMut.mutate()}
                disabled={renameMut.isPending || name === family!.name || !name.trim()}
                className="rounded-brand self-end"
              >
                Rename
              </Button>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">
                Members ({members.length}/{memberLimit})
              </p>
              {isAdmin && members.length + reservedInvites < memberLimit && (
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                    >
                      <UserPlusIcon className="mr-2 h-4 w-4" /> Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-brand">
                    <DialogHeader>
                      <DialogTitle>Invite family member</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Invitee name
                        </Label>
                        <Input
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Full name"
                          className="mt-1 rounded-brand"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Email (optional)
                        </Label>
                        <Input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="mt-1 rounded-brand"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Mobile number
                        </Label>
                        <PhoneNumberField
                          value={invitePhone}
                          country={inviteCountry}
                          onChange={(next, country) => { setInvitePhone(next); setInviteCountry(country); }}
                          className="mt-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A care team member will call this number to ask for consent. If you add an
                        email, we’ll also send the invitation there. Their Companion chats stay
                        private.
                      </p>
                      {inviteMut.error && (
                        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                          {(inviteMut.error as Error).message || "Unable to send invitation. Please try again."}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => inviteMut.mutate()}
                        disabled={
                          inviteMut.isPending ||
                          !inviteName.trim() ||
                          !invitePhone.trim()
                        }
                        className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                      >
                        {inviteMut.isPending ? (
                          <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <EnvelopeSimpleIcon className="mr-2 h-4 w-4" />
                        )}
                        Send invite
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="sn-live-family-grid">
              {members.map((m) => (
                <div key={m.id} className="sn-live-family-card">
                  <div className="sn-family-card-heading">
                    <MemberAvatar id={m.user_id} size="md" />
                    <div>
                      {m.role === "owner" ? (
                        <CrownIcon className="h-4 w-4 text-brand-accent" />
                      ) : m.role === "adult" ? (
                        <ShieldCheckIcon className="h-4 w-4 text-brand-accent" />
                      ) : (
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3>{m.display_name ?? "Member"}</h3>
                      <Badge variant="secondary" className="rounded-full text-[10px] uppercase">
                        {m.role}
                      </Badge>
                    </div>
                  </div>
                  <p className="sn-family-card-note">
                    {m.role === "owner"
                      ? "Keeping your family circle connected."
                      : m.role === "adult"
                        ? "Sharing the everyday care, together."
                        : "Part of your family’s own little space."}
                  </p>
                  {isAdmin && m.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${m.display_name ?? "member"}`}
                      onClick={() => {
                        if (confirm(`Remove ${m.display_name ?? "this member"}?`)) {
                          removeFn({ data: { member_id: m.id } })
                            .then(() => {
                              toast.success("Removed");
                              qc.invalidateQueries({ queryKey: ["family"] });
                            })
                            .catch((e) => toast.error((e as Error).message));
                        }
                      }}
                    >
                      <UserMinusIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && invites.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Family invitations</p>
              <div className="grid gap-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-brand border border-dashed border-border px-3 py-2 text-sm"
                  >
                  <div className="flex min-w-0 items-center gap-2">
                      <EnvelopeSimpleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{inv.invitee_name || inv.email || inv.invitee_phone}</span>
                      <Badge variant="secondary" className="rounded-full text-[10px] uppercase">
                        {inv.verification_status === "awaiting_call"
                          ? `Call pending · ${inv.verification_attempts}/3`
                          : inv.verification_status === "approved"
                            ? inv.status === "accepted"
                              ? "Added successfully"
                              : inv.email
                                ? "Invitation accepted · account setup"
                                : "Consent recorded · account linking needed"
                            : inv.verification_status === "declined"
                              ? "Declined"
                              : "Verification closed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {inv.status === "pending" &&
                        ["awaiting_call", "approved"].includes(inv.verification_status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(invitationLink(inv.token));
                              toast.success("Link copied");
                            }}
                          >
                            <CopyIcon className="h-4 w-4" />
                          </Button>
                        )}
                      {["declined", "closed"].includes(inv.verification_status) && (
                        <a
                          className="text-xs font-medium text-brand-primary underline"
                          href={`mailto:care@someonenear.com?subject=${encodeURIComponent("Family invitation follow-up")}`}
                        >
                          Contact support
                        </a>
                      )}
                      {inv.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Revoke invitation for ${inv.invitee_name || inv.invitee_phone}`}
                          onClick={() => {
                            revokeFn({ data: { id: inv.id } })
                              .then(() => {
                                toast.success("Invite revoked");
                                qc.invalidateQueries({ queryKey: ["family"] });
                              })
                              .catch((e) => toast.error((e as Error).message));
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            {isOwner ? (
              <Button
                variant="outline"
                className="rounded-brand text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Delete the family circle? Members will lose access.")) {
                    deleteFn({})
                      .then(() => {
                        toast.success("Family deleted");
                        qc.invalidateQueries({ queryKey: ["family"] });
                      })
                      .catch((e) => toast.error((e as Error).message));
                  }
                }}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete family
              </Button>
            ) : (
              <Button
                variant="outline"
                className="rounded-brand"
                onClick={() => {
                  if (confirm("Leave this family?")) {
                    leaveFn({})
                      .then(() => {
                        toast.success("You left the family");
                        qc.invalidateQueries({ queryKey: ["family"] });
                      })
                      .catch((e) => toast.error((e as Error).message));
                  }
                }}
              >
                Leave family
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-page-reveal className="rounded-brand border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium">Privacy in your circle</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Family members share the Care Membership tier and the roster. Moods and Companion
          conversations remain private to each person and are protected by row-level security.
        </CardContent>
      </Card>
    </div>
  );
}

function SessionAllocationPanel() {
  const poolFn = useServerFn(getFamilyPool);
  const setAllocFn = useServerFn(setAllocations);
  const qc = useQueryClient();

  const { data: pool, isLoading } = useQuery({
    queryKey: ["family-pool"],
    queryFn: () => poolFn(),
  });

  const [drafts, setDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!pool) return;
    const d: Record<string, number> = {};
    for (const m of pool.members) d[m.user_id] = m.allocated;
    setDrafts(d);
  }, [pool]);

  const mut = useMutation({
    mutationFn: () =>
      setAllocFn({
        data: {
          allocations: Object.entries(drafts).map(([user_id, allocated]) => ({
            member_user_id: user_id,
            allocated: Number(allocated) || 0,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Allocations saved");
      qc.invalidateQueries({ queryKey: ["family-pool"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <Card data-page-reveal className="rounded-brand border-border bg-card">
        <CardContent className="flex h-24 items-center justify-center">
          <SpinnerGapIcon className="h-4 w-4 animate-spin text-brand-primary" />
        </CardContent>
      </Card>
    );
  }
  if (!pool) return null;

  const canEdit = pool.role === "owner" || pool.role === "adult";
  const draftSum = Object.values(drafts).reduce((s, n) => s + (Number(n) || 0), 0);
  const remainingIfSaved = pool.totalSessions - draftSum;
  const overAllocated = draftSum > pool.totalSessions;

  return (
    <Card data-page-reveal className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CalendarCheckIcon className="h-4 w-4 text-brand-accent" />
          Listener sessions, this month
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatBlock label="Total this month" value={`${pool.totalUsed} / ${pool.totalSessions}`} />
          <StatBlock label="Unallocated (family pool)" value={`${pool.unallocated}`} />
          <StatBlock
            label="Reschedules used"
            value={`${pool.reschedulesUsed} / ${pool.reschedulesTotal}`}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            Allocate to members {canEdit ? "" : "(view-only for teens)"}
          </p>
          <div className="grid gap-2">
            {pool.members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between gap-3 rounded-brand border border-border bg-background/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.display_name}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">
                    {m.role} · used {m.used}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={pool.totalSessions}
                  disabled={!canEdit}
                  value={drafts[m.user_id] ?? 0}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [m.user_id]: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-24 rounded-brand text-center"
                />
              </div>
            ))}
          </div>
          {overAllocated && (
            <p className="mt-2 text-xs text-destructive">
              Allocations ({draftSum}) exceed monthly total ({pool.totalSessions}).
            </p>
          )}
          {!overAllocated && (
            <p className="mt-2 text-xs text-muted-foreground">
              After save: {remainingIfSaved} sessions stay in the shared family pool, available to
              any member.
            </p>
          )}
          {canEdit && (
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || overAllocated}
                className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
              >
                {mut.isPending ? <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save allocation
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          The monthly session balance belongs to the family. Allocations reset each month, sessions
          don't roll over. Rescheduling requires at least 2 hours before the session.
        </p>
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand border border-border bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
