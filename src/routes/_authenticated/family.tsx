import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Copy,
  Crown,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({
    meta: [
      { title: "Family — WithU" },
      {
        name: "description",
        content: "Invite family members, manage roles, and share your Care Membership.",
      },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const familyFn = useServerFn(getMyFamily);
  const profileFn = useServerFn(getMyProfile);

  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const { data, isLoading } = useQuery({ queryKey: ["family"], queryFn: () => familyFn() });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
        </div>
      </AppShell>
    );
  }

  const hasFamilyTier = profile?.care_tier === "family" || profile?.care_tier === "care";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Family"
        slogan="Closer, even from far."
        title="Your circle"
        description="Journals and Companion chats stay private. Owner allocates the family's monthly Listener sessions."
      />

      {!data?.family ? (
        <EmptyState hasFamilyTier={hasFamilyTier} />
      ) : (
        <>
          <FamilyView data={data} />
          <div className="mt-6">
            <SessionAllocationPanel />
          </div>
        </>
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
    <Card className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Users className="h-4 w-4 text-brand-accent" />
          Start a family circle
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasFamilyTier ? (
          <div className="rounded-brand border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Family sharing is included with the <strong>Family</strong> Care Membership. Upgrade
            from Settings to invite up to 4 members.
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
                {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create circle
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FamilyView({
  data,
}: {
  data: Awaited<ReturnType<typeof getMyFamily>>;
}) {
  const qc = useQueryClient();
  const renameFn = useServerFn(renameFamily);
  const inviteFn = useServerFn(inviteFamilyMember);
  const revokeFn = useServerFn(revokeFamilyInvite);
  const removeFn = useServerFn(removeFamilyMember);
  const leaveFn = useServerFn(leaveFamily);
  const deleteFn = useServerFn(deleteFamily);

  const { family, members, invites, myRole } = data;
  const isAdmin = myRole === "owner" || myRole === "adult";
  const isOwner = myRole === "owner";

  const [name, setName] = useState(family!.name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"adult" | "teen">("adult");
  const [inviteOpen, setInviteOpen] = useState(false);

  const renameMut = useMutation({
    mutationFn: () => renameFn({ data: { name } }),
    onSuccess: () => {
      toast.success("Renamed");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { email: inviteEmail, role: inviteRole } }),
    onSuccess: (res) => {
      const link = `${window.location.origin}/invite?token=${res.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invite created — link copied");
      setInviteEmail("");
      setInviteOpen(false);
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const invitationLink = (token: string) => `${window.location.origin}/invite?token=${token}`;

  return (
    <div className="grid gap-6">
      <Card className="rounded-brand border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Users className="h-4 w-4 text-brand-accent" />
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
              <p className="text-sm font-medium">Members ({members.length}/4)</p>
              {isAdmin && members.length < 4 && (
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                    >
                      <UserPlus className="mr-2 h-4 w-4" /> Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-brand">
                    <DialogHeader>
                      <DialogTitle>Invite family member</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Email
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
                          Role
                        </Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(v) => setInviteRole(v as "adult" | "teen")}
                        >
                          <SelectTrigger className="mt-1 rounded-brand">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="adult">Adult — can invite others</SelectItem>
                            <SelectItem value="teen">Teen — member only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Their journal and Companion chats stay private — only the tier and roster
                        are shared.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => inviteMut.mutate()}
                        disabled={inviteMut.isPending || !inviteEmail.trim()}
                        className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
                      >
                        {inviteMut.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-4 w-4" />
                        )}
                        Send invite
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="grid gap-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-brand border border-border bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {m.role === "owner" ? (
                      <Crown className="h-4 w-4 text-brand-accent" />
                    ) : m.role === "adult" ? (
                      <ShieldCheck className="h-4 w-4 text-brand-accent" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{m.display_name ?? "Member"}</span>
                    <Badge variant="secondary" className="rounded-full text-[10px] uppercase">
                      {m.role}
                    </Badge>
                  </div>
                  {isAdmin && m.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
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
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && invites.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Pending invites</p>
              <div className="grid gap-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-brand border border-dashed border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{inv.email}</span>
                      <Badge variant="secondary" className="rounded-full text-[10px] uppercase">
                        {inv.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(invitationLink(inv.token));
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          revokeFn({ data: { id: inv.id } })
                            .then(() => {
                              toast.success("Invite revoked");
                              qc.invalidateQueries({ queryKey: ["family"] });
                            })
                            .catch((e) => toast.error((e as Error).message));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                <Trash2 className="mr-2 h-4 w-4" />
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

      <Card className="rounded-brand border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium">Privacy in your circle</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Family members share the Care Membership tier and the roster. Journals, moods, and
          Companion conversations remain private to each person and are protected by row-level
          security.
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
      <Card className="rounded-brand border-border bg-card">
        <CardContent className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
        </CardContent>
      </Card>
    );
  }
  if (!pool) return null;

  const canEdit = pool.role === "owner" || pool.role === "adult";
  const draftSum = Object.values(drafts).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );
  const remainingIfSaved = pool.totalSessions - draftSum;
  const overAllocated = draftSum > pool.totalSessions;

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CalendarCheck className="h-4 w-4 text-brand-accent" />
          Listener sessions — this month
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatBlock
            label="Total this month"
            value={`${pool.totalUsed} / ${pool.totalSessions}`}
          />
          <StatBlock
            label="Unallocated (family pool)"
            value={`${pool.unallocated}`}
          />
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
              After save: {remainingIfSaved} sessions stay in the shared family pool,
              available to any member.
            </p>
          )}
          {canEdit && (
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || overAllocated}
                className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
              >
                {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save allocation
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          The monthly session balance belongs to the family. Allocations reset each
          month — sessions don't roll over. Rescheduling requires at least 2 hours
          before the session.
        </p>
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand border border-border bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
