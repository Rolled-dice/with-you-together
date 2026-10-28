import { Switch } from "@/components/ui/switch";
import type { SharingChoices } from "@/lib/family.schemas";

const choices: { key: keyof SharingChoices; label: string }[] = [
  { key: "receive_reminders", label: "Receive reminders from my family owner" },
  { key: "share_updates", label: "Share reminder progress and my updates with my family owner" },
  { key: "share_health", label: "Share prescriptions and medication records with my family owner" },
];
export function FamilySharingControls({
  value,
  onChange,
  disabled = false,
}: {
  value: SharingChoices;
  onChange: (value: SharingChoices) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-1">
      <legend className="mb-3 font-semibold">Your sharing choices</legend>
      {choices.map(({ key, label }) => (
        <label
          key={key}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-5 border-b border-border py-3"
        >
          <span className="text-base leading-relaxed">{label}</span>
          <Switch
            aria-label={label}
            checked={value[key]}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ ...value, [key]: checked })}
          />
        </label>
      ))}
    </fieldset>
  );
}
