import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  GlobeHemisphereWestIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
  MinusIcon,
  PlusIcon,
  ArrowCounterClockwiseIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { FamilyAvatar } from "./family-avatar";
import { FAMILY_AVATARS } from "@/lib/family-avatars";
import { updateMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFamilyToday } from "@/lib/reminders.functions";
import type { FamilySnapshotData } from "@/lib/family.schemas";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Member = FamilySnapshotData["members"][number];
export function FamilyGlobe({
  family,
  onOpenSection,
}: {
  family: FamilySnapshotData;
  onOpenSection: (section: string, person?: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const motion = useRef({ angle: -0.12, phase: 0, drag: 0, zoom: 1 });
  const pointer = useRef<{ x: number; angle: number } | null>(null);
  const membersList = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Tween | null>(null);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = family.members.find((member) => member.user_id === selectedId);
  const load = useServerFn(getFamilyToday);
  const saveProfile = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const [avatarChoice, setAvatarChoice] = useState<string | null>(null);
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null);
  const saveAvatar = useMutation({
    mutationFn: (avatar_url: string) => saveProfile({ data: { avatar_url } }),
    onSuccess: (_, avatar) => {
      setSavedAvatar(avatar);
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Avatar saved");
    },
    onError: () => toast.error("Your avatar could not be saved. Please try again."),
  });
  const reminders = useQuery({
    queryKey: ["family-today"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    enabled: family.members.length > 0,
  });
  const memberKey = family.members.map((member) => member.user_id).join(",");
  useEffect(() => {
    setAvatarChoice(null);
  }, [selectedId]);
  useEffect(() => {
    if (selectedId && !family.members.some((member) => member.user_id === selectedId))
      setSelectedId(null);
  }, [family.members, selectedId]);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;
    setFailed(false);
    if (stage.current) {
      delete stage.current.dataset.globeReady;
      delete stage.current.dataset.globeTexture;
    }
    import("./family-globe.scene")
      .then(({ createFamilyGlobe }) => {
        if (!stopped && stage.current) {
          try {
            cleanup = createFamilyGlobe(stage.current, motion.current);
          } catch {
            setFailed(true);
          }
        }
      })
      .catch(() => {
        if (!stopped) setFailed(true);
      });
    return () => {
      stopped = true;
      cleanup?.();
    };
  }, [memberKey]);
  useGSAP(
    () => {
      animation.current = gsap.to(motion.current, {
        phase: 1,
        duration: 48,
        repeat: -1,
        ease: "none",
      });
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(membersList.current, {
          y: 12,
          duration: 0.45,
          ease: "power2.out",
          scrollTrigger: { trigger: membersList.current, start: "top 95%", once: true },
        });
      });
      return () => media.revert();
    },
    { scope: stage },
  );
  useEffect(() => {
    animation.current?.paused(paused || interacting || reducedMotion || Boolean(selectedId));
  }, [paused, interacting, reducedMotion, selectedId]);
  const latestFor = (member: Member) => {
    if (member.user_id !== family.viewer_id && (family.myRole !== "owner" || !member.share_updates))
      return undefined;
    return reminders.data
      ?.filter((row) => row.for_user_id === member.user_id && (row.update_text || row.completed_at))
      .sort(
        (a, b) => Date.parse(b.completed_at || b.due_at) - Date.parse(a.completed_at || a.due_at),
      )[0];
  };
  const nameFor = (member: Member) => member.display_name || "Family member";
  const countFor = (member: Member) => {
    if (member.user_id !== family.viewer_id && (family.myRole !== "owner" || !member.share_updates))
      return 0;
    return (
      reminders.data?.filter(
        (row) => row.for_user_id === member.user_id && (row.update_text || row.completed_at),
      ).length || 0
    );
  };
  const avatarFor = (member: Member) =>
    member.user_id === family.viewer_id && savedAvatar ? savedAvatar : member.avatar_url;
  const latest = selected ? latestFor(selected) : undefined;
  const navigate = (section: string) => {
    const id = selectedId || undefined;
    setSelectedId(null);
    onOpenSection(section, id);
  };
  return (
    <section aria-labelledby="family-world-title" className="border-b border-border pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="family-world-title" className="text-xl font-bold">
            Your family, connected
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {family.members.length
              ? `${family.members.length} ${family.members.length === 1 ? "person" : "people"} in your circle`
              : "Your circle is ready to begin."}
          </p>
        </div>
        {!reducedMotion && (
          <Button
            size="icon"
            className="size-11"
            variant="outline"
            aria-label={paused ? "Play globe animation" : "Pause globe animation"}
            title={paused ? "Play globe animation" : "Pause globe animation"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Button>
        )}
      </div>
      <div
        ref={stage}
        className="family-globe relative mx-auto w-full"
        data-testid="family-globe"
        data-globe-failed={failed ? "true" : undefined}
        onPointerOver={(event) =>
          setInteracting(Boolean((event.target as HTMLElement).closest("button")))
        }
        onPointerLeave={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget.querySelector("canvas")) return;
          setInteracting(true);
          pointer.current = { x: event.clientX, angle: motion.current.drag };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!pointer.current) return;
          const delta = event.clientX - pointer.current.x;
          motion.current.drag = gsap.utils.clamp(-0.22, 0.22, pointer.current.angle + delta / 600);
        }}
        onPointerUp={() => {
          pointer.current = null;
          setInteracting(false);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setInteracting(false);
        }}
      >
        <canvas aria-label="Family connection globe" className="absolute inset-0 h-full w-full" />
        <div
          className="family-globe-placeholder absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <GlobeHemisphereWestIcon aria-hidden className="size-48 text-primary/20" />
        </div>
        {!failed &&
          family.members.map((member, index) => (
            <button
              key={member.user_id}
              data-globe-member
              type="button"
              aria-label={`Open ${nameFor(member)}'s member details`}
              onClick={() => setSelectedId(member.user_id)}
              className="family-globe-pin absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg p-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="family-globe-portrait">
                <FamilyAvatar value={avatarFor(member)} fallback={index} />
                {countFor(member) > 0 && (
                  <span
                    className="family-update-cloud"
                    aria-label={`${countFor(member)} recent shared updates`}
                    title={`${countFor(member)} recent shared updates`}
                  >
                    {countFor(member) > 9 ? "9+" : countFor(member)}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate rounded-md bg-background/95 px-2 py-0.5 text-sm font-semibold leading-snug">
                {nameFor(member)}
              </span>
            </button>
          ))}
      </div>
      <div
        className="family-globe-controls mb-5 flex flex-wrap items-center justify-center gap-2"
        aria-label="Family globe controls"
      >
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom out globe"
          title="Zoom out"
          onClick={() => {
            motion.current.zoom = Math.max(0.9, motion.current.zoom - 0.05);
          }}
        >
          <MinusIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom in globe"
          title="Zoom in"
          onClick={() => {
            motion.current.zoom = Math.min(1.1, motion.current.zoom + 0.05);
          }}
        >
          <PlusIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Reset globe view"
          title="Reset view"
          onClick={() => {
            motion.current.drag = 0;
            motion.current.zoom = 1;
          }}
        >
          <ArrowCounterClockwiseIcon />
        </Button>
        {family.members.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              membersList.current?.scrollIntoView({
                behavior: reducedMotion ? "instant" : "smooth",
                block: "center",
              })
            }
          >
            <UsersIcon />
            View all
          </Button>
        )}
      </div>
      <div ref={membersList} className="grid gap-1 sm:grid-cols-2">
        {family.members.map((member, index) => {
          const update = latestFor(member);
          return (
            <button
              key={member.user_id}
              type="button"
              onClick={() => setSelectedId(member.user_id)}
              className="flex min-h-16 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span aria-hidden className="family-member-avatar shrink-0">
                <FamilyAvatar value={avatarFor(member)} fallback={index} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {nameFor(member)}
                  {member.user_id === family.viewer_id ? " (you)" : ""}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {update
                    ? update.update_text || `Completed: ${update.title}`
                    : "No shared update yet"}
                </span>
              </span>
              <ArrowRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="family-experience max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? nameFor(selected) : "Family member"}</DialogTitle>
            <DialogDescription>Member details & sharing</DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <dl className="grid gap-3 border-b border-border pb-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Membership</dt>
                  <dd>{selected.role === "owner" ? "Family owner" : "Family member"} · Active</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Timezone</dt>
                  <dd>{selected.timezone.replaceAll("_", " ")}</dd>
                </div>
              </dl>
              {selected.user_id === family.viewer_id && (
                <fieldset disabled={saveAvatar.isPending} className="space-y-3">
                  <legend className="text-base font-semibold">Your family avatar</legend>
                  <div className="grid grid-cols-4 gap-3">
                    {FAMILY_AVATARS.map((avatar, index) => (
                      <label
                        key={avatar}
                        className="family-avatar-option relative cursor-pointer rounded-full"
                      >
                        <input
                          type="radio"
                          name="family-avatar"
                          aria-label={`Avatar ${index + 1}`}
                          checked={
                            (avatarChoice ||
                              avatarFor(selected) ||
                              FAMILY_AVATARS[family.members.indexOf(selected) % 12]) === avatar
                          }
                          onChange={() => setAvatarChoice(avatar)}
                          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        />
                        <span className="block rounded-full border-2 border-transparent p-1 peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                          <FamilyAvatar value={avatar} />
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    disabled={!avatarChoice || saveAvatar.isPending}
                    onClick={() => avatarChoice && saveAvatar.mutate(avatarChoice)}
                  >
                    {saveAvatar.isPending ? "Saving..." : "Save avatar"}
                    <CheckIcon />
                  </Button>
                </fieldset>
              )}
              <section className="space-y-2" aria-labelledby="member-latest-update">
                <h3
                  id="member-latest-update"
                  className="flex items-center gap-2 text-base font-semibold"
                >
                  <ClockIcon aria-hidden className="size-4 text-brand-accent" />
                  Latest shared update
                </h3>
                {reminders.isPending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading updates...
                  </p>
                ) : reminders.isError ? (
                  <p role="alert" className="text-sm text-muted-foreground">
                    Updates could not be loaded.
                  </p>
                ) : latest ? (
                  <>
                    <p className="text-sm font-medium">{latest.title}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {latest.update_text || "Completed"}
                    </p>
                    {latest.completed_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: latest.timezone,
                        }).format(new Date(latest.completed_at))}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selected.user_id !== family.viewer_id && !selected.share_updates
                      ? "Completion sharing is off."
                      : "No shared update yet."}
                  </p>
                )}
              </section>
              <section
                className="space-y-3 border-t border-border pt-4"
                aria-labelledby="member-sharing-title"
              >
                <h3
                  id="member-sharing-title"
                  className="flex items-center gap-2 text-base font-semibold"
                >
                  <ShieldCheckIcon aria-hidden className="size-4 text-brand-accent" />
                  Sharing preferences
                </h3>
                {[
                  ["Family reminders", selected.receive_reminders],
                  ["Completion updates", selected.share_updates],
                  ["Medication & prescriptions", selected.share_health],
                ].map(([label, enabled]) => (
                  <div
                    key={String(label)}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span>{label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      {enabled && <CheckIcon aria-hidden className="size-4" />}
                      {enabled ? "On" : "Off"}
                    </span>
                  </div>
                ))}
                {selected.user_id === family.viewer_id ? (
                  <Button variant="outline" onClick={() => navigate("sharing")}>
                    Edit my sharing
                    <ArrowRightIcon />
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {nameFor(selected)} manages their own sharing choices.
                  </p>
                )}
              </section>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {(selected.user_id === family.viewer_id || family.myRole === "owner") && (
                  <Button onClick={() => navigate("today")}>
                    View reminders
                    <ArrowRightIcon />
                  </Button>
                )}
                {(selected.user_id === family.viewer_id ||
                  (family.myRole === "owner" && selected.share_health)) && (
                  <Button variant="outline" onClick={() => navigate("health")}>
                    View health
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
