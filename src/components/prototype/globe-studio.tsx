import { useState } from "react";
import { EditorialAvatar } from "@/components/identity/editorial-avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { globeThemes, type GlobeConfig, type GlobeMember } from "./globe-model";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: GlobeMember[];
  config: GlobeConfig;
  selectedId: string | null;
  onApply: (members: GlobeMember[], config: GlobeConfig, selectedId: string) => void;
  onReset: () => void;
};

export function GlobeStudio(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sn-globe-studio">
        <DialogTitle>Make the globe your own</DialogTitle>
        <DialogDescription>
          Customize this sample circle. Changes last until you reload this page and are not added to
          your family account.
        </DialogDescription>
        {props.open && <StudioForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function StudioForm({ members, config, selectedId, onApply, onReset, onOpenChange }: Props) {
  const [draftMembers, setDraftMembers] = useState(members);
  const [draftConfig, setDraftConfig] = useState(config);
  const [editing, setEditing] = useState(selectedId ?? members[0].id);
  const [error, setError] = useState("");
  const member = draftMembers.find((m) => m.id === editing)!;
  const update = (patch: Partial<GlobeMember>) => {
    setDraftMembers((current) => current.map((m) => (m.id === editing ? { ...m, ...patch } : m)));
    setError("");
  };
  const add = () => {
    if (draftMembers.length >= 12) return;
    const next: GlobeMember = {
      id: crypto.randomUUID(),
      name: "New member",
      archetype: "adult-woman",
      phi: 1.2,
      theta: (draftMembers.length * 2.4) % (Math.PI * 2),
      note: "A little hello from your circle.",
      badge: "✨ Family update",
      hasNotification: true,
      optIn: "pending",
    };
    setDraftMembers([...draftMembers, next]);
    setEditing(next.id);
    setError("");
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const invalid = draftMembers.find((m) => !m.name.trim());
        if (invalid) {
          setEditing(invalid.id);
          setError("Give each sample member a name.");
          return;
        }
        onApply(
          draftMembers.map((m) => ({ ...m, name: m.name.trim(), note: m.note.trim() })),
          draftConfig,
          editing,
        );
        onOpenChange(false);
      }}
    >
      <div className="sn-studio-member-bar">
        <label>
          Sample member
          <select
            value={editing}
            onChange={(e) => {
              setEditing(e.target.value);
              setError("");
            }}
          >
            {draftMembers.map((m, i) => (
              <option key={m.id} value={m.id}>
                {m.name || `Member ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="sn-button sn-button-outline"
          disabled={draftMembers.length >= 12}
          onClick={add}
        >
          Add member
        </button>
      </div>
      <div className="sn-studio-preview">
        <EditorialAvatar member={member} size="xl" />
        <div>
          <strong>{member.name || "Your sample member"}</strong>
          <p>{draftMembers.length} of 12 members · Avatar preview</p>
        </div>
      </div>
      <div className="sn-studio-fields">
        <label>
          Name
          <input
            value={member.name}
            maxLength={24}
            required
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          Avatar
          <select value={member.archetype} onChange={(e) => update({ archetype: e.target.value })}>
            {[
              ["aged-man", "Older man"],
              ["aged-woman", "Older woman"],
              ["adult-man", "Man"],
              ["adult-woman", "Woman"],
              ["teenager", "Teenager"],
              ["child", "Child"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Backdrop
          <select
            value={member.backdropMotif ?? "none"}
            onChange={(e) => update({ backdropMotif: e.target.value })}
          >
            {["none", "leaves", "waves", "stripes", "clouds"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Outfit pattern
          <select
            value={member.outfitPattern ?? ""}
            onChange={(e) => update({ outfitPattern: e.target.value || undefined })}
          >
            <option value="">Avatar default</option>
            {["solid", "shawl", "hearts", "polka", "collar"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Earrings
          <select
            value={member.earrings ?? ""}
            onChange={(e) => update({ earrings: e.target.value || undefined })}
          >
            <option value="">Avatar default</option>
            {[
              ["none", "None"],
              ["hoops", "Gold hoops"],
              ["tassels", "Tassels"],
              ["pink-hoops", "Coral hoops"],
              ["stud", "Stud"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Avatar frame
          <select
            value={member.frameShape ?? "circle"}
            onChange={(e) => update({ frameShape: e.target.value })}
          >
            <option value="circle">Circle</option>
            <option value="rounded">Rounded square</option>
          </select>
        </label>
        <label>
          Skin tone
          <input
            type="color"
            value={member.skinTone ?? "#E5A98A"}
            onChange={(e) => update({ skinTone: e.target.value })}
          />
        </label>
        <label>
          Background color
          <input
            type="color"
            value={member.avatarBg ?? "#EAB84B"}
            onChange={(e) => update({ avatarBg: e.target.value })}
          />
        </label>
        <label>
          Outfit color
          <input
            type="color"
            value={member.outfitColor ?? "#D95732"}
            onChange={(e) => update({ outfitColor: e.target.value })}
          />
        </label>
        <label className="sn-studio-check">
          <input
            type="checkbox"
            checked={member.glasses ?? member.archetype === "aged-man"}
            onChange={(e) => update({ glasses: e.target.checked })}
          />
          Glasses
        </label>
        <label className="sn-studio-wide">
          Sample note
          <textarea
            value={member.note}
            maxLength={140}
            rows={2}
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>
        <label>
          Position around globe · {Math.round((member.theta * 180) / Math.PI)}°
          <input
            aria-label="Position around globe"
            type="range"
            min={0}
            max={360}
            value={Math.round((member.theta * 180) / Math.PI)}
            onChange={(e) => update({ theta: (Number(e.target.value) * Math.PI) / 180 })}
          />
        </label>
        <label>
          Position from top · {Math.round((member.phi * 180) / Math.PI)}°
          <input
            aria-label="Position from top"
            type="range"
            min={20}
            max={160}
            value={Math.round((member.phi * 180) / Math.PI)}
            onChange={(e) => update({ phi: (Number(e.target.value) * Math.PI) / 180 })}
          />
        </label>
      </div>
      <label className="sn-studio-badge-field">
        Floating badge
        <input
          value={member.badge ?? ""}
          maxLength={32}
          onChange={(e) => update({ badge: e.target.value })}
        />
      </label>
      <label className="sn-studio-check">
        <input
          type="checkbox"
          checked={member.hasNotification ?? false}
          onChange={(e) => update({ hasNotification: e.target.checked })}
        />
        Show floating badge
      </label>
      <button
        type="button"
        className="sn-studio-remove"
        disabled={draftMembers.length <= 1}
        onClick={() => {
          const next = draftMembers.filter((m) => m.id !== editing);
          setDraftMembers(next);
          setEditing(next[0].id);
          setError("");
        }}
      >
        Remove this sample member
      </button>
      <fieldset className="sn-studio-settings">
        <legend>Globe appearance</legend>
        <label>
          Globe theme
          <select
            value={draftConfig.theme}
            onChange={(e) =>
              setDraftConfig({ ...draftConfig, theme: e.target.value as GlobeConfig["theme"] })
            }
          >
            {Object.entries(globeThemes).map(([id, theme]) => (
              <option value={id} key={id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rotation speed · {draftConfig.speed}×
          <input
            aria-label="Rotation speed"
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={draftConfig.speed}
            onChange={(e) => setDraftConfig({ ...draftConfig, speed: Number(e.target.value) })}
          />
        </label>
        <label className="sn-studio-check">
          <input
            type="checkbox"
            checked={draftConfig.rings}
            onChange={(e) => setDraftConfig({ ...draftConfig, rings: e.target.checked })}
          />
          Show orbit rings
        </label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="sn-studio-actions">
        <button
          type="button"
          className="sn-button sn-button-outline"
          onClick={() => {
            onReset();
            onOpenChange(false);
          }}
        >
          Reset sample
        </button>
        <button
          type="button"
          className="sn-button sn-button-outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button className="sn-button sn-button-primary" type="submit">
          Apply changes
        </button>
      </div>
    </form>
  );
}
