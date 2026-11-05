import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EditorialAvatar, type AvatarAppearance } from "@/components/identity/editorial-avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIdentity } from "@/features/session/session-store";

type AppearanceMap = Record<string, AvatarAppearance>;
const AppearanceContext = createContext<AppearanceMap>({});
const archetypes = [
  ["adult-woman", "Woman"],
  ["adult-man", "Man"],
  ["aged-woman", "Older woman"],
  ["aged-man", "Older man"],
  ["teenager", "Teen"],
  ["child", "Child"],
];
export function MemberAvatar({
  id,
  size = "sm",
}: {
  id: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const appearances = useContext(AppearanceContext);
  return <EditorialAvatar member={appearances[id]} size={size} />;
}
export function MemberAppearanceProvider({
  children,
  members,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  members: { user_id: string; display_name: string | null }[];
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { userId } = useIdentity();
  const [saved, setSaved] = useState<AppearanceMap>({});
  const [draft, setDraft] = useState<AppearanceMap>({});
  const [selected, setSelected] = useState("");
  useEffect(() => {
    setSaved({});
    if (!userId) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(`sn_member_art_${userId}`) ?? "{}");
      const next: AppearanceMap = {};
      for (const [id, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object") continue;
        const item = value as Record<string, unknown>;
        next[id] = {
          archetype: archetypes.some(([key]) => key === item.archetype)
            ? String(item.archetype)
            : undefined,
          avatarBg:
            typeof item.avatarBg === "string" && /^#[0-9a-f]{6}$/i.test(item.avatarBg)
              ? item.avatarBg
              : undefined,
          glasses: item.glasses === true,
        };
      }
      setSaved(next);
    } catch {
      /* A default illustration remains available. */
    }
  }, [userId]);
  const firstMemberId = members[0]?.user_id ?? "";
  useEffect(() => {
    if (open) {
      setDraft(saved);
      setSelected(firstMemberId);
    }
  }, [open, saved, firstMemberId]);
  const appearance = draft[selected] ?? {};
  function update(patch: AvatarAppearance) {
    setDraft((previous) => ({ ...previous, [selected]: { ...previous[selected], ...patch } }));
  }
  return (
    <AppearanceContext.Provider value={saved}>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sn-worker-dialog">
          <DialogTitle>Avatar customizer studio</DialogTitle>
          <DialogDescription>
            Choose an illustrated look for your circle. Saved on this browser for your account;
            profile photos and shared account settings are unchanged.
          </DialogDescription>
          {members.length ? (
            <>
              <div className="sn-avatar-editor">
                <EditorialAvatar member={appearance} size="xl" />
                <div>
                  <label>
                    Family member
                    <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                      {members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name ?? "Family member"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Illustration
                    <select
                      value={appearance.archetype ?? "adult-woman"}
                      onChange={(event) => update({ archetype: event.target.value })}
                    >
                      {archetypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Backdrop
                    <input
                      type="color"
                      value={appearance.avatarBg ?? "#EAB84B"}
                      onChange={(event) => update({ avatarBg: event.target.value })}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={appearance.glasses ?? false}
                      onChange={(event) => update({ glasses: event.target.checked })}
                    />{" "}
                    Glasses
                  </label>
                </div>
              </div>
              <button
                className="sn-worker-button"
                type="button"
                onClick={() => {
                  setSaved(draft);
                  try {
                    localStorage.setItem(`sn_member_art_${userId}`, JSON.stringify(draft));
                  } catch {
                    /* Session-only appearance. */
                  }
                  onOpenChange(false);
                }}
              >
                Save appearance
              </button>
            </>
          ) : (
            <p>Add a family circle to customize its member illustrations.</p>
          )}
        </DialogContent>
      </Dialog>
    </AppearanceContext.Provider>
  );
}
