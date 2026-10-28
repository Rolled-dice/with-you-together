import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UserPlusIcon,
  ArrowClockwiseIcon,
  XIcon,
  ShieldCheckIcon,
  UsersIcon,
  PhoneIcon,
  SignOutIcon,
  CalendarBlankIcon,
  FirstAidKitIcon,
  EnvelopeSimpleIcon,
} from "@phosphor-icons/react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FamilySharingControls } from "@/components/family-sharing-controls";
import { FamilyToday } from "@/components/family-today";
import { FamilyHealth } from "@/components/family-health";
import { FamilyGlobe } from "@/components/family-globe";
import { FamilyAvatar } from "@/components/family-avatar";
import { ExtraCallPurchase } from "@/components/extra-call-purchase";
import {
  createFamily,
  deleteFamily,
  getMyFamily,
  getFamilyDeliveryConfig,
  inviteFamilyMember,
  leaveFamily,
  removeFamilyMember,
  renameFamily,
  resendFamilyInvite,
  revokeFamilyInvite,
  saveFamilySharing,
} from "@/lib/family.functions";
import {
  FAMILY_STATUS_LABELS,
  NO_SHARING,
  reservedFamilyPlaces,
  type FamilySnapshotData,
  type SharingChoices,
} from "@/lib/family.schemas";
import { getMyProfile } from "@/lib/profile.functions";
import { getFamilyPool, setAllocations } from "@/lib/family-sessions.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family | SomeoneNear" }] }),
  component: FamilyPage,
});

function FamilyPage() {
  const fn = useServerFn(getMyFamily);
  const profileFn = useServerFn(getMyProfile);
  const query = useQuery({ queryKey: ["family"], queryFn: () => fn(), refetchInterval: 30_000 });
  const profile = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  return (
    <AppShell>
      <div className="family-experience">
        <PageHeader
          eyebrow="Family"
          title={query.data?.family?.name || "Your family"}
          description="Stay close, with care that respects everyone's space."
        />
        {query.isPending ? (
          <p role="status">Loading your family...</p>
        ) : query.isError ? (
          <div role="alert">
            <p>Your family could not be loaded.</p>
            <Button className="mt-3" variant="outline" onClick={() => query.refetch()}>
              <ArrowClockwiseIcon /> Try again
            </Button>
          </div>
        ) : query.data?.family ? (
          <FamilyWorkspace
            key={query.data.family.id}
            data={query.data}
          />
        ) : (
          <FamilyEmpty data={query.data} canCreate={profile.data?.care_tier === "care_plus"} />
        )}
      </div>
    </AppShell>
  );
}

function FamilyEmpty({ data, canCreate }: { data?: FamilySnapshotData; canCreate: boolean }) {
  const create = useServerFn(createFamily);
  const qc = useQueryClient();
  const [name, setName] = useState("My family");
  const mut = useMutation({
    mutationFn: () => create({ data: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-8">
      {data && !data.pending.length && <FamilyGlobe family={data} onOpenSection={() => {}} />}
      {data?.pending.map((invite) => (
        <section key={invite.id} className="border-b border-border py-4">
          <h2 className="text-xl font-semibold">{invite.family_name}</h2>
          <p className="mt-2">{FAMILY_STATUS_LABELS[invite.status]}</p>
          <p className="mt-1 text-muted-foreground">
            {invite.status === "verification_closed"
              ? "Contact support to request another verification."
              : invite.status === "expired"
                ? "Your invitation has expired. Ask the family owner for a new invitation."
                : "Your listener will call during your preferred window."}
          </p>
          {invite.call_window && <p className="mt-2">{invite.call_window}</p>}
          <p className="mt-2 text-sm">{invite.attempts} of 3 contact attempts</p>
        </section>
      ))}
      {!data?.pending.length && (
        <section className="max-w-xl space-y-5">
          <h2 className="text-2xl font-semibold">Bring your family closer</h2>
          {canCreate ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                mut.mutate();
              }}
            >
              <Label htmlFor="family-name">Family name</Label>
              <Input
                id="family-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button disabled={mut.isPending}>
                <UsersIcon /> Create family
              </Button>
            </form>
          ) : (
            <>
              <p className="text-muted-foreground">
                Care Plus includes five people and 30 shared listener calls each month.
              </p>
              <Button asChild>
                <Link to="/settings">View membership</Link>
              </Button>
            </>
          )}
        </section>
      )}
      <Button asChild variant="outline">
        <Link to="/dashboard">My personal space</Link>
      </Button>
    </div>
  );
}

export function FamilyWorkspace({ data }: { data: FamilySnapshotData }) {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tab, setTab] = useState(data.myRole === "owner" ? "family" : "today");
  const [selectedPerson, setSelectedPerson] = useState<string>();
  const [name, setName] = useState(data.family!.name);
  const [renaming, setRenaming] = useState(false);
  const revoke = useServerFn(revokeFamilyInvite);
  const resend = useServerFn(resendFamilyInvite);
  const remove = useServerFn(removeFamilyMember);
  const rename = useServerFn(renameFamily);
  const leave = useServerFn(leaveFamily);
  const close = useServerFn(deleteFamily);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["family"] });
    void qc.invalidateQueries({ queryKey: ["family-pool"] });
    void qc.invalidateQueries({ queryKey: ["family-today"] });
  };
  const action = useMutation({
    mutationFn: async ({
      kind,
      id,
    }: {
      kind: "resend" | "revoke" | "remove" | "rename" | "leave" | "close";
      id?: string;
    }) => {
      if (kind === "resend" && id) {
        const result = await resend({ data: { id } });
        if (result.delivery_status === "failed")
          toast.error("Invitation saved, but delivery failed. Try sending again later.");
        else toast.success("Invitation sent");
      }
      if (kind === "revoke" && id) await revoke({ data: { id } });
      if (kind === "remove" && id) await remove({ data: { member_id: id } });
      if (kind === "rename") {
        await rename({ data: { name } });
        setRenaming(false);
      }
      if (kind === "leave") await leave({});
      if (kind === "close") await close({});
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const owner = data.myRole === "owner";
  const places = reservedFamilyPlaces(data);
  const me = data.members.find((m) => m.user_id === data.viewer_id);
  return (
    <>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="family-tabs mb-7 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="today">
            <CalendarBlankIcon aria-hidden className="size-4 shrink-0" />
            Today
          </TabsTrigger>
          <TabsTrigger value="family">
            <UsersIcon aria-hidden className="size-4 shrink-0" />
            Family
          </TabsTrigger>
          <TabsTrigger value="sharing">
            <ShieldCheckIcon aria-hidden className="size-4 shrink-0" />
            My sharing
          </TabsTrigger>
          <TabsTrigger value="health">
            <FirstAidKitIcon aria-hidden className="size-4 shrink-0" />
            Health
          </TabsTrigger>
          <TabsTrigger value="calls">
            <PhoneIcon aria-hidden className="size-4 shrink-0" />
            Calls
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <FamilyToday family={data} selectedPerson={selectedPerson} />
        </TabsContent>
        <TabsContent value="family" className="space-y-8">
          <FamilyGlobe
            family={data}
            onOpenSection={(section, person) => {
              setSelectedPerson(person);
              setTab(section);
            }}
          />
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Your people</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.members.length} active {data.members.length === 1 ? "member" : "members"} ·
                  5 places in your family
                </p>
              </div>
              {owner && (
                <Button
                  disabled={!data.canInvite || places >= 5}
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlusIcon /> Invite adult relative
                </Button>
              )}
            </div>
            {owner && (
              <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: 5 }, (_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 w-6 rounded-full ${index < places ? "bg-primary" : "bg-border"}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {data.canInvite
                    ? `${places} of 5 places occupied or reserved`
                    : "Upgrade to Care Plus to invite more people. Your existing family stays connected."}
                </p>
              </div>
            )}
            <div className="divide-y divide-border">
              {data.members.map((m, index) => (
                <article key={m.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary"
                    >
                      <FamilyAvatar value={m.avatar_url} fallback={index} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold">
                        {m.display_name || "Family member"}
                        {m.user_id === data.viewer_id ? " (you)" : ""}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {m.role === "owner" ? "Family owner" : "Family member"} · Active
                      </p>
                    </div>
                  </div>
                  {owner && m.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove member"
                      aria-label={`Remove ${m.display_name || "member"}`}
                      disabled={action.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "Remove this person from your family? Their personal account stays available.",
                          )
                        )
                          action.mutate({ kind: "remove", id: m.id });
                      }}
                    >
                      <XIcon />
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </section>
          {owner && data.invites.length > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
                <EnvelopeSimpleIcon aria-hidden className="size-5 shrink-0 text-brand-accent" />
                Invitation progress
              </h2>
              <div className="divide-y divide-border">
                {data.invites.map((inv) => (
                  <article
                    key={inv.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="break-words text-lg font-medium">{inv.invitee_name}</h3>
                      <p className="break-all text-sm text-muted-foreground">
                        {inv.relationship} · {inv.email || inv.contact_phone}
                      </p>
                      <p className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-sm font-semibold text-secondary-foreground">
                        {FAMILY_STATUS_LABELS[inv.status]}
                      </p>
                      {inv.status === "pending" && (
                        <p
                          className={
                            inv.delivery_status === "failed"
                              ? "text-sm text-destructive"
                              : "text-sm text-muted-foreground"
                          }
                        >
                          {
                            {
                              not_sent: "Not sent yet",
                              sending: "Sending",
                              sent: "Sent to delivery provider",
                              failed: "Delivery failed. Send again when available.",
                            }[inv.delivery_status]
                          }
                        </p>
                      )}
                      {["verification_pending", "verification_closed"].includes(inv.status) && (
                        <p className="text-sm text-muted-foreground">
                          {inv.attempts} of 3 contact attempts
                          {inv.call_window ? ` · ${inv.call_window} (${inv.call_timezone})` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {inv.status === "pending" && (
                        <Button
                          variant="outline"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ kind: "resend", id: inv.id })}
                        >
                          <ArrowClockwiseIcon /> Send again
                        </Button>
                      )}
                      {["pending", "verification_pending"].includes(inv.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Revoke invitation for ${inv.invitee_name}`}
                          title="Revoke invitation"
                          disabled={action.isPending}
                          onClick={() => {
                            if (confirm("Revoke this invitation?"))
                              action.mutate({ kind: "revoke", id: inv.id });
                          }}
                        >
                          <XIcon />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            {owner ? (
              <>
                <Button variant="outline" onClick={() => setRenaming(!renaming)}>
                  Rename family
                </Button>
                <Button
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Close this family? Everyone keeps their personal account, but family access ends.",
                      )
                    )
                      action.mutate({ kind: "close" });
                  }}
                >
                  Close family
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => {
                  if (confirm("Leave this family and stop sharing?"))
                    action.mutate({ kind: "leave" });
                }}
              >
                <SignOutIcon /> Leave family
              </Button>
            )}
          </div>
          {renaming && (
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                action.mutate({ kind: "rename" });
              }}
            >
              <Input
                aria-label="Family name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-sm"
              />
              <Button disabled={action.isPending}>Save name</Button>
            </form>
          )}
        </TabsContent>
        <TabsContent value="sharing">
          <SharingPanel key={JSON.stringify(me)} initial={me || NO_SHARING} />
        </TabsContent>
        <TabsContent value="calls">
          <FamilyCalls owner={owner} />
        </TabsContent>
        <TabsContent value="health">
          <FamilyHealth family={data} selectedPerson={selectedPerson} />
        </TabsContent>
      </Tabs>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="family-experience max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite an adult relative</DialogTitle>
          </DialogHeader>
          <InviteForm
            onSaved={() => {
              setInviteOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteForm({ onSaved }: { onSaved: () => void }) {
  const fn = useServerFn(inviteFamilyMember);
  const configFn = useServerFn(getFamilyDeliveryConfig);
  const { data: config } = useQuery({ queryKey: ["family-delivery"], queryFn: () => configFn() });
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Father");
  const [window, setWindow] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ...(channel === "email"
            ? { contact_channel: "email" as const, email: contact }
            : { contact_channel: "sms" as const, contact_phone: contact }),
          invitee_name: name,
          relationship,
          call_window: window,
          call_timezone: timezone,
        },
      }),
    onSuccess: (result) => {
      if (result.delivery_status === "failed")
        toast.error("Invitation saved, but delivery failed. You can send it again.");
      else toast.success("Invitation sent");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <div>
        <Label htmlFor="invite-name">Their name</Label>
        <Input
          id="invite-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <label className="grid gap-2">
        Relationship
        <select
          className="family-select"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        >
          {["Father", "Mother", "Partner", "Sibling", "Adult child", "Relative"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2">Send invitation by</legend>
        <div className="flex gap-6">
          {(["email", "sms"] as const).map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="invite-channel"
                checked={channel === c}
                onChange={() => {
                  setChannel(c);
                  setContact("");
                }}
                disabled={c === "sms" && !(config?.smsIndia || config?.smsUS)}
              />
              {c === "email" ? "Email" : "SMS"}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="invite-contact">
          {channel === "email" ? "Email address" : "Phone number with country code"}
        </Label>
        <Input
          id="invite-contact"
          type={channel === "email" ? "email" : "tel"}
          required
          maxLength={200}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="invite-window">Suggested call window (optional, {timezone})</Label>
        <Input
          id="invite-window"
          maxLength={160}
          placeholder="Weekdays, 10 am to noon"
          value={window}
          onChange={(e) => setWindow(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={mut.isPending}>
        {mut.isPending ? "Sending..." : "Send invitation"}
      </Button>
    </form>
  );
}

function SharingPanel({ initial }: { initial: SharingChoices }) {
  const [value, setValue] = useState<SharingChoices>({
    receive_reminders: initial.receive_reminders,
    share_updates: initial.share_updates,
    share_health: initial.share_health,
  });
  const fn = useServerFn(saveFamilySharing);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => fn({ data: value }),
    onSuccess: () => {
      toast.success("Sharing choices saved");
      void qc.invalidateQueries({ queryKey: ["family"] });
      void qc.invalidateQueries({ queryKey: ["family-today"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <section className="max-w-2xl space-y-5">
      <FamilySharingControls value={value} onChange={setValue} disabled={mut.isPending} />
      <p className="text-sm text-muted-foreground">
        Your Companion conversations stay private. You can stop sharing at any time.
      </p>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        Save sharing choices
      </Button>
    </section>
  );
}

function FamilyCalls({ owner }: { owner: boolean }) {
  const fn = useServerFn(getFamilyPool);
  const setFn = useServerFn(setAllocations);
  const qc = useQueryClient();
  const pool = useQuery({ queryKey: ["family-pool"], queryFn: () => fn() });
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const mut = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          allocations: (pool.data?.members || []).map((m) => ({
            member_user_id: m.user_id,
            allocated: drafts[m.user_id] ?? m.allocated,
          })),
        },
      }),
    onSuccess: () => {
      setDrafts({});
      void qc.invalidateQueries({ queryKey: ["family-pool"] });
      toast.success("Call allocation saved");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Family calls</h2>
      {pool.isPending && <p role="status">Loading calls...</p>}
      {pool.isError && <p role="alert">Call balance could not be loaded.</p>}
      {pool.data && (
        <>
          <p className="text-lg">
            <strong>{Math.max(0, pool.data.totalSessions - pool.data.totalUsed)}</strong> of{" "}
            {pool.data.totalSessions} monthly calls remaining
          </p>
          <div className="divide-y divide-border">
            {pool.data.members.map((m) => (
              <label key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  {m.display_name}
                  <span className="block text-sm text-muted-foreground">{m.used} used</span>
                </span>
                <Input
                  aria-label={`Calls allocated to ${m.display_name}`}
                  type="number"
                  className="w-24"
                  min={m.used}
                  max={pool.data!.totalSessions}
                  disabled={!owner || mut.isPending}
                  value={drafts[m.user_id] ?? m.allocated}
                  onChange={(e) => setDrafts({ ...drafts, [m.user_id]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          {owner && (
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !Object.keys(drafts).length}
            >
              Save allocation
            </Button>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <Button asChild>
          <Link to="/listeners">
            <PhoneIcon /> Book a call
          </Link>
        </Button>
      </div>
      <ExtraCallPurchase />
    </section>
  );
}
