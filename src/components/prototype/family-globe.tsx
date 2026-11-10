import { useEffect, useRef, useState } from "react";
import {
  MinusIcon,
  PlusIcon,
  ArrowClockwiseIcon,
  PauseIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { EditorialAvatar } from "@/components/identity/editorial-avatar";
import { GlobeStudio } from "./globe-studio";
import {
  defaultGlobeConfig,
  createGlobeProjection,
  projectedCoreRadius,
  globeThemes,
  memberPoint,
  sampleMembers,
  type GlobeConfig,
  type GlobeMember,
} from "./globe-model";

type Projection = ReturnType<ReturnType<typeof createGlobeProjection>["project"]>;
const dots = Array.from({ length: 1800 }, (_, i) => {
  const y = 1 - (i / 1799) * 2;
  const r = Math.sqrt(1 - y * y);
  const angle = (2 * Math.PI * i) / ((1 + Math.sqrt(5)) / 2);
  const x = Math.cos(angle) * r,
    z = Math.sin(angle) * r;
  const mask = Math.sin(x * 4.2 + 0.5) * Math.cos(y * 3.8) + Math.sin(z * 4.5 - 0.3) * 0.6;
  const shellRadius = mask > -0.12 ? 1.245 : 1.22;
  return { x: x * shellRadius, y: y * shellRadius, z: z * shellRadius, mask };
});

export interface FamilyGlobeProps {
  initialMembers?: GlobeMember[];
  familyName?: string;
  isLiveFamily?: boolean;
}

export function FamilyGlobe({
  initialMembers,
  familyName,
  isLiveFamily = false,
}: FamilyGlobeProps = {}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rotation = useRef({ yaw: 0.35, pitch: 0.12 });
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<GlobeMember[]>(
    initialMembers && initialMembers.length > 0 ? initialMembers : sampleMembers,
  );
  const [config, setConfig] = useState<GlobeConfig>(defaultGlobeConfig);
  const [studioOpen, setStudioOpen] = useState(false);
  const [positions, setPositions] = useState<(Projection & { id: string })[]>([]);
  const settings = useRef({ zoom, playing, members, config, studioOpen });
  const selectedMember = members.find((m) => m.id === selected);
  const selectedPosition = positions.find((point) => point.id === selected && point.visible);
  const [stageSize, setStageSize] = useState({ width: 540, height: 395, top: 60 });
  const popover = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(145);
  const popoverInteraction = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (initialMembers && initialMembers.length > 0) {
      setMembers(initialMembers);
      setSelected((prev) => (prev && initialMembers.some((m) => m.id === prev) ? prev : initialMembers[0].id));
    }
  }, [initialMembers]);

  useEffect(() => {
    if (!popover.current) return;
    const element = popover.current;
    const observer = new ResizeObserver(() => setPopoverHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedPosition?.visible]);

  useEffect(() => {
    settings.current = { zoom, playing, members, config, studioOpen };
  }, [zoom, playing, members, config, studioOpen]);

  useEffect(() => {
    setReady(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;
    setPlaying(!media.matches);
    const change = () => {
      reducedMotion.current = media.matches;
      setPlaying(!media.matches);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const element = canvas.current,
      container = stage.current;
    if (!element || !container) return;
    const context = element.getContext("2d", { alpha: true });
    if (!context) {
      setCanvasReady(false);
      return;
    }
    setCanvasReady(true);
    const projection = createGlobeProjection();
    let clock = 0;
    let frame = 0,
      last = 0,
      width = 540,
      height = 395,
      revision = 0;
    const size = () => {
      const cw = container.clientWidth || 540;
      const ch = container.clientHeight || 395;
      width = Math.max(cw, 280);
      height = Math.max(ch, 200);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      setStageSize({ width, height, top: container.offsetTop });
      revision++;
    };
    const observer = new ResizeObserver(size);
    observer.observe(container);
    size();
    let previous = "",
      visible = true;
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibility.observe(container);
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || time - last < 16) return;
      if (!width || !height || width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) return;
      try {
        const elapsed = Math.min(time - last, 100);
        last = time;
        const current = settings.current;
        if (current.playing && !drag.current && !current.studioOpen && !popoverInteraction.current)
          rotation.current.yaw += elapsed * 0.000192 * current.config.speed;
        if (!reducedMotion.current && current.playing && !current.studioOpen)
          clock += elapsed * 0.0009;
        const signature = JSON.stringify([
          clock,
          rotation.current,
          current.zoom,
          current.members,
          current.config,
          revision,
        ]);
        if (signature === previous) return;
        previous = signature;
        const theme = globeThemes[current.config.theme];
        // Same 42-degree camera, 4.3 distance and Three.js group as the supplied source.
        projection.update(width, height, current.zoom, rotation.current.yaw, rotation.current.pitch);
        const project = projection.project;
        const radius = projectedCoreRadius(project({ x: 1.23, y: 0, z: 0 }), width, height);
        const scaleX = width > 0 ? element.width / width : 1;
        const scaleY = height > 0 ? element.height / height : 1;
        if (Number.isFinite(scaleX) && Number.isFinite(scaleY)) {
          context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        }
        context.clearRect(0, 0, width, height);
      if (current.config.rings)
        for (const extra of [15, 30]) {
          context.beginPath();
          context.arc(
            width / 2,
            height / 2,
            radius + extra + Math.sin(clock * 2 + extra / 15) * 3,
            0,
            Math.PI * 2,
          );
          context.strokeStyle = extra === 15 ? "#EAB84B42" : "#F36D8938";
          context.lineWidth = 1.4;
          context.stroke();
        }
      const gradient = context.createRadialGradient(
        width / 2 - radius * 0.3,
        height / 2 - radius * 0.3,
        radius * 0.1,
        width / 2,
        height / 2,
        radius,
      );
      gradient.addColorStop(0, theme.inner);
      gradient.addColorStop(0.65, theme.mid);
      gradient.addColorStop(1, theme.outer);
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = "#EAB84B73";
      context.lineWidth = 2;
      context.stroke();
      context.save();
      for (const dot of dots) {
        const point = project(dot);
        if (point.z < 0.05) continue;
        context.globalAlpha = Math.min(1, Math.max(0.15, (point.z - 0.05) / 1.15));
        context.fillStyle =
          dot.mask > 0.35 ? theme.land : dot.mask > -0.08 ? theme.coast : theme.ocean;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          (dot.mask > -0.12 ? 2.3 : 1.3) * current.zoom,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.restore();
      setPositions(
        current.members.map((member) => ({ ...project(memberPoint(member)), id: member.id })),
      );
      } catch (err) {
        console.warn("[family-globe] Canvas draw warning:", err);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
    };
  }, []);

  const focusMember = (member: GlobeMember) => {
    setSelected(member.id);
    rotation.current.yaw = -member.theta;
  };

  return (
    <section className="sn-globe sn-family-globe" aria-label="Interactive sample family globe">
      <div className="sn-globe-intro">
        <strong>
          {familyName ? `🌍 ${familyName} · Live 3D Family Globe` : "🌍 Interactive 3D Family Globe · Drag to Rotate"}
        </strong>
        <span>
          {isLiveFamily
            ? "Your family circle connected across time zones · Tap any pin for details"
            : "Tap a family pin for an update & call participation"}
        </span>
      </div>
      <div
        ref={stage}
        className="sn-globe-stage"
        tabIndex={0}
        role="group"
        aria-label="Rotate globe with arrow keys or drag"
        onKeyDown={(e) => {
          if (
            e.target !== e.currentTarget ||
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          )
            return;
          e.preventDefault();
          setPlaying(false);
          if (e.key === "ArrowLeft") rotation.current.yaw -= 0.15;
          if (e.key === "ArrowRight") rotation.current.yaw += 0.15;
          if (e.key === "ArrowUp")
            rotation.current.pitch = Math.min(0.6, rotation.current.pitch + 0.15);
          if (e.key === "ArrowDown")
            rotation.current.pitch = Math.max(-0.6, rotation.current.pitch - 0.15);
        }}
        onPointerDown={(e) => {
          if (
            e.button !== 0 ||
            drag.current ||
            (e.target as HTMLElement).closest("button, [data-globe-popover]")
          )
            return;
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || drag.current.id !== e.pointerId) return;
          rotation.current.yaw += (e.clientX - drag.current.x) * 0.007;
          rotation.current.pitch = Math.max(
            -0.6,
            Math.min(0.6, rotation.current.pitch + (e.clientY - drag.current.y) * 0.007),
          );
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          if (drag.current?.id === e.pointerId) drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <canvas ref={canvas} className="sn-globe-canvas" aria-hidden="true" data-testid="family-globe-canvas" />
        {positions.map((point) => {
          const member = members.find((m) => m.id === point.id);
          return member && point.visible ? (
            <div
              key={member.id}
              className="sn-globe-node"
              style={{ left: point.x, top: point.y, zIndex: Math.round((point.z + 2) * 10) }}
            >
              {member.hasNotification && selected !== member.id && (
                <button
                  className="sn-globe-badge"
                  onClick={() => setSelected(member.id)}
                  aria-label={`Read ${member.name}'s sample update`}
                >
                  <span className="sn-globe-pulse" />
                  {member.badge || "Family update"}
                </button>
              )}
              <button
                className="sn-globe-pin"
                onClick={() => setSelected(selected === member.id ? null : member.id)}
                disabled={!ready}
                aria-label={`Meet ${member.name}`}
                aria-pressed={selected === member.id}
              >
                <EditorialAvatar member={member} size="sm" />
                <span>{member.name}</span>
              </button>
            </div>
          ) : null;
        })}
        {selectedMember && selectedPosition && (
          <div
            ref={popover}
            className="sn-globe-popover"
            data-globe-popover
            role="group"
            aria-label={`${selectedMember.name}'s sample update`}
            style={{
              left: Math.max(8, Math.min(stageSize.width - 232, selectedPosition.x - 112)),
              top: Math.max(10 - stageSize.top, selectedPosition.y - popoverHeight - 40),
            }}
            onPointerEnter={() => {
              popoverInteraction.current = true;
            }}
            onPointerLeave={() => {
              popoverInteraction.current = false;
            }}
            onFocusCapture={() => {
              popoverInteraction.current = true;
            }}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                popoverInteraction.current = false;
            }}
          >
            <div className="sn-globe-popover-heading">
              <strong>{selectedMember.badge || "Family update"}</strong>
              <button
                aria-label="Close sample update"
                onClick={() => {
                  setSelected(null);
                  popoverInteraction.current = false;
                }}
              >
                <XIcon />
              </button>
            </div>
            {(selectedMember.role || selectedMember.location) && (
              <div className="flex flex-col gap-0.5 mb-1.5">
                <span className="text-xs font-semibold text-brand-primary">
                  {selectedMember.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {[selectedMember.role, selectedMember.location].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            <p>“{selectedMember.note}”</p>

            {selectedMember.inviteToken && (
              <div className="mt-2 mb-1">
                <button
                  type="button"
                  className="w-full text-xs py-1.5 px-2 rounded-brand bg-brand-primary text-primary-foreground font-medium hover:bg-brand-primary/90 flex items-center justify-center gap-1 transition-colors"
                  onClick={() => {
                    const link = `${window.location.origin}/invite?token=${selectedMember.inviteToken}`;
                    navigator.clipboard.writeText(link).catch(() => {});
                    toast.success("Invitation link copied to clipboard!");
                  }}
                >
                  📋 Copy Invite Link
                </button>
              </div>
            )}

            {isLiveFamily && !selectedMember.isInvite && (
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[11px]">
                <a
                  href="/send-later"
                  className="text-brand-accent hover:underline font-medium"
                >
                  💌 Time Capsule
                </a>
                <span className="text-muted-foreground">·</span>
                <a
                  href="/listeners"
                  className="text-brand-accent hover:underline font-medium"
                >
                  📞 Listener Call
                </a>
              </div>
            )}

            <div className="sn-globe-opt-in">
              <span>{isLiveFamily ? "Call participation" : "Call opt-in · demo"}</span>
              <strong aria-live="polite">{selectedMember.optIn || "pending"}</strong>
            </div>
            <div className="sn-globe-opt-actions">
              {(["confirmed", "ignored"] as const).map((status) => (
                <button
                  key={status}
                  className={status === "confirmed" ? "sn-globe-confirm" : "sn-globe-ignore"}
                  aria-label={
                    status === "confirmed"
                      ? "Confirm sample call opt-in"
                      : "Ignore sample call opt-in"
                  }
                  onClick={() => {
                    setMembers((current) =>
                      current.map((m) => (m.id === selected ? { ...m, optIn: status } : m)),
                    );
                    if (isLiveFamily) {
                      toast.success(
                        `${selectedMember.name}'s call participation updated to ${status}`,
                      );
                    }
                  }}
                >
                  {status === "confirmed" ? "✓ Confirm" : "✕ Ignore"}
                </button>
              ))}
            </div>
            <small>
              {isLiveFamily
                ? `Connected to ${familyName || "your family circle"}`
                : "Sample only · No calls are placed."}
            </small>
          </div>
        )}
      </div>
      <div className="sn-globe-bottom">
        <div className="sn-globe-people">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => focusMember(m)}
              disabled={!ready}
              aria-pressed={selected === m.id}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="sn-globe-controls">
          <button
            aria-label="Zoom out"
            disabled={!ready || zoom <= 0.75}
            onClick={() => setZoom(Math.max(0.75, +(zoom - 0.12).toFixed(2)))}
          >
            <MinusIcon />
          </button>
          <button
            aria-label="Zoom in"
            disabled={!ready || zoom >= 1.35}
            onClick={() => setZoom(Math.min(1.35, +(zoom + 0.12).toFixed(2)))}
          >
            <PlusIcon />
          </button>
          <button
            disabled={!ready}
            aria-label={playing ? "Pause globe rotation" : "Start globe rotation"}
            aria-pressed={playing}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <PauseIcon /> : <ArrowClockwiseIcon />}
          </button>
        </div>
      </div>
      <p className="sn-globe-note sr-only" aria-live="polite">
        {selectedMember
          ? selectedMember.note
          : "An illustrated sample circle. Select a member or make it your own."}
      </p>
      <div className="sn-globe-toolbar">
        <button
          className="sn-globe-customize"
          disabled={!ready}
          onClick={() => setStudioOpen(true)}
        >
          <SlidersHorizontalIcon /> Customize globe
        </button>
        <small>Interactive sample · Make it your own</small>
      </div>
      <GlobeStudio
        open={studioOpen}
        onOpenChange={setStudioOpen}
        members={members}
        config={config}
        selectedId={selected}
        onApply={(nextMembers, nextConfig, focusId) => {
          setMembers(nextMembers);
          setConfig(nextConfig);
          const member = nextMembers.find((m) => m.id === focusId);
          if (member) focusMember(member);
          else setSelected(null);
        }}
        onReset={() => {
          setMembers(initialMembers && initialMembers.length > 0 ? initialMembers : sampleMembers);
          setConfig(defaultGlobeConfig);
          setSelected(null);
          setZoom(1);
          rotation.current = { yaw: 0.35, pitch: 0.12 };
        }}
      />
    </section>
  );
}
