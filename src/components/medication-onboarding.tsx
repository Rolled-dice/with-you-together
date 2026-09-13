import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  Clock3,
  ImagePlus,
  Loader2,
  MoonStar,
  Pill,
  Plus,
  ScanLine,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { GentleNudge, gentleProblem, gentleToast } from "@/components/gentle-nudge";
import { QuietEmptyState } from "@/components/quiet-empty-state";
import { cn } from "@/lib/utils";
import {
  createMedication,
  deleteMedication,
  listFamilyMembers,
  listMedications,
  listTodaysDoses,
  logDose,
  parsePrescription,
} from "@/lib/medications.functions";
import { supabase } from "@/integrations/supabase/client";

type SetupMode = "scan" | "manual";
type TimeChoice = { id: string; label: string; time: string; icon: typeof Sun };
type ScheduleDraft = { id: string; time: string; withFood: boolean };
type MedicationRow = {
  id: string;
  name: string;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  for_user_id: string;
  medication_schedules?: Array<{ id: string; time_of_day: string; with_food: boolean }>;
};
type DoseRow = {
  id: string;
  status: string;
  scheduled_at: string;
  medications: { name: string; dosage: string | null; form: string | null } | null;
};

const PRESET_TIMES: TimeChoice[] = [
  { id: "morning", label: "Morning", time: "08:00", icon: Sunrise },
  { id: "afternoon", label: "Afternoon", time: "13:00", icon: Sun },
  { id: "evening", label: "Evening", time: "18:00", icon: Sparkles },
  { id: "bedtime", label: "Bedtime", time: "21:00", icon: MoonStar },
];

const FORMS = ["Tablet", "Capsule", "Liquid", "Drops", "Inhaler", "Injection", "Other"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function newSchedule(time = "08:00"): ScheduleDraft {
  return { id: crypto.randomUUID(), time, withFood: false };
}

function timeLabel(value: string) {
  const [hoursText, minutes = "00"] = value.split(":");
  const hours = Number(hoursText);
  if (!Number.isFinite(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.slice(0, 2)} ${suffix}`;
}

export function MedicationOnboarding() {
  const qc = useQueryClient();
  const listMedsFn = useServerFn(listMedications);
  const listDosesFn = useServerFn(listTodaysDoses);
  const listFamilyFn = useServerFn(listFamilyMembers);
  const createFn = useServerFn(createMedication);
  const deleteFn = useServerFn(deleteMedication);
  const logFn = useServerFn(logDose);
  const parseFn = useServerFn(parsePrescription);

  const medications = useQuery({ queryKey: ["medications"], queryFn: () => listMedsFn() });
  const doses = useQuery({ queryKey: ["medications", "today"], queryFn: () => listDosesFn() });
  const family = useQuery({ queryKey: ["medications", "family"], queryFn: () => listFamilyFn() });

  const [mode, setMode] = useState<SetupMode>("scan");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [form, setForm] = useState("Tablet");
  const [instructions, setInstructions] = useState("");
  const [forUserId, setForUserId] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([newSchedule()]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const firstMember = family.data?.[0];
    if (!forUserId && firstMember?.user_id) setForUserId(firstMember.user_id);
  }, [family.data, forUserId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = useCallback((candidate?: File) => {
    if (!candidate) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(candidate.type)) {
      gentleProblem("That file is not a photo we can read", "Choose a JPG, PNG, WEBP, HEIC, or HEIF image.");
      return;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      gentleProblem("That photo is a little too large", "Choose an image smaller than 10 MB. Nothing has been uploaded.");
      return;
    }
    setFile(candidate);
    setImagePath(null);
    setParsedData(null);
  }, []);

  const scan = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a clear photo first.");
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Please sign in again before uploading.");
      const safeExtension = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : file.type.includes("hei") ? "heic" : "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${safeExtension}`;
      const { error: uploadError } = await supabase.storage.from("prescriptions").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("We could not upload that photo. Please try it once more.");
      setImagePath(path);
      try {
        const result = await parseFn({ data: { image_path: path } });
        return { result, path };
      } catch (error) {
        await supabase.storage.from("prescriptions").remove([path]);
        setImagePath(null);
        throw error;
      }
    },
    onSuccess: ({ result, path }) => {
      const first = result.medications[0];
      setParsedData(result);
      setImagePath(path);
      if (first) {
        setName(first.name ?? "");
        setDosage(first.dosage ?? "");
        setForm(first.form ?? "Tablet");
        setInstructions(first.instructions ?? first.frequency ?? "");
        const suggestedTimes = Array.isArray(first.when_to_take) ? first.when_to_take : [first.when_to_take];
        const matched = suggestedTimes
          .map((suggestion) => PRESET_TIMES.find((preset) => preset.id === suggestion))
          .filter((preset): preset is TimeChoice => Boolean(preset));
        if (matched.length > 0) setSchedules(matched.map((preset) => newSchedule(preset.time)));
        else if (first.times_per_day && first.times_per_day > 1) {
          setSchedules(PRESET_TIMES.slice(0, Math.min(first.times_per_day, 4)).map((preset) => newSchedule(preset.time)));
        }
      }
      gentleToast("We found the details", "Please check everything below before saving.");
    },
    onError: (error: Error) => gentleProblem("We could not read that photo", error.message),
  });

  function resetForm() {
    setFile(null);
    setImagePath(null);
    setParsedData(null);
    setName("");
    setDosage("");
    setForm("Tablet");
    setInstructions("");
    setSchedules([newSchedule()]);
  }

  const create = useMutation({
    mutationFn: () => {
      if (!forUserId) throw new Error("Choose who this medicine is for.");
      if (!name.trim()) throw new Error("Add the medicine name so we know what to remind you about.");
      if (schedules.some((schedule) => !/^\d{2}:\d{2}$/.test(schedule.time))) {
        throw new Error("Check each reminder time before saving.");
      }
      return createFn({
        data: {
          for_user_id: forUserId,
          name: name.trim(),
          dosage: dosage.trim() || null,
          form: form.trim() || null,
          instructions: instructions.trim() || null,
          prescription_image_path: imagePath,
          parsed_data: parsedData,
          schedules: schedules.map((schedule) => ({
            time_of_day: schedule.time,
            with_food: schedule.withFood,
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
          })),
        },
      });
    },
    onSuccess: async () => {
      gentleToast("Your daily check-in is ready", `${name.trim()} will appear with today’s doses.`);
      resetForm();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["medications"] }),
        qc.invalidateQueries({ queryKey: ["medications", "today"] }),
      ]);
    },
    onError: (error: Error) => gentleProblem("We could not save this medicine", error.message),
  });

  const removeMedication = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      gentleToast("Medicine removed", "You will no longer receive check-ins for it.");
      await qc.invalidateQueries({ queryKey: ["medications"] });
    },
    onError: (error: Error) => gentleProblem("We could not remove it", error.message),
  });

  const log = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "taken" | "skipped" }) =>
      logFn({ data: { dose_id: id, status } }),
    onSuccess: async (_, variables) => {
      gentleToast(variables.status === "taken" ? "Marked as taken" : "Skipped for now");
      await qc.invalidateQueries({ queryKey: ["medications", "today"] });
    },
    onError: (error: Error) => gentleProblem("We could not update this dose", error.message),
  });

  function togglePreset(preset: TimeChoice) {
    const existing = schedules.find((schedule) => schedule.time === preset.time);
    if (existing) {
      if (schedules.length > 1) setSchedules((current) => current.filter((schedule) => schedule.id !== existing.id));
      return;
    }
    setSchedules((current) => [...current, newSchedule(preset.time)]);
  }

  const isReviewingScan = mode === "scan" && parsedData !== null;
  const medicationRows = (medications.data ?? []) as MedicationRow[];
  const doseRows = (doses.data ?? []) as DoseRow[];

  return (
    <div className="space-y-12">
      <section aria-labelledby="medication-setup-title" className="overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-gentle">
        <div className="border-b border-border bg-surface px-5 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary" aria-hidden>
              <Pill className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">Medication check-in</p>
              <h2 id="medication-setup-title" className="mt-1 font-display text-2xl font-medium text-foreground sm:text-3xl">
                Let’s set up your daily check-in
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Start with a photo, or enter the details yourself. You will always get to review them before saving.
              </p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-8 p-5 sm:p-8">
          <div className="grid grid-cols-2 rounded-2xl bg-muted p-1.5" aria-label="Choose how to add a medicine">
            <Button
              type="button"
              variant="ghost"
              className={cn("min-h-12 rounded-xl text-base", mode === "scan" && "bg-card text-foreground shadow-soft hover:bg-card")}
              onClick={() => setMode("scan")}
              aria-pressed={mode === "scan"}
            >
              <ScanLine /> <span className="hidden sm:inline">Scan prescription</span><span className="sm:hidden">Scan</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn("min-h-12 rounded-xl text-base", mode === "manual" && "bg-card text-foreground shadow-soft hover:bg-card")}
              onClick={() => setMode("manual")}
              aria-pressed={mode === "manual"}
            >
              <Pill /> <span className="hidden sm:inline">Enter manually</span><span className="sm:hidden">Manual</span>
            </Button>
          </div>

          {mode === "scan" && !isReviewingScan ? (
            <div className="space-y-4 animate-gentle-rise">
              <div
                className={cn(
                  "relative flex min-h-72 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/35 bg-primary/5 px-6 py-10 text-center transition-colors",
                  isDragging && "border-primary bg-primary/10",
                  previewUrl && "border-solid bg-surface",
                )}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files[0]); }}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Prescription selected for review" className="max-h-60 w-auto max-w-full rounded-2xl object-contain shadow-soft" />
                    <Button type="button" variant="secondary" className="mt-5 min-h-11 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus /> Choose a different photo
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex size-16 items-center justify-center rounded-full bg-surface text-primary shadow-soft" aria-hidden>
                      <ImagePlus className="size-7" />
                    </span>
                    <h3 className="mt-5 font-display text-xl font-medium text-foreground">Add a clear photo</h3>
                    <p className="mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
                      A pill bottle label or prescription works well. Keep the name and instructions in focus.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Button type="button" className="min-h-11 rounded-xl px-5 text-base" onClick={() => fileInputRef.current?.click()}>
                        <ImagePlus /> Choose photo
                      </Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl px-5 text-base" onClick={() => cameraInputRef.current?.click()}>
                        <Camera /> Use camera
                      </Button>
                    </div>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">JPG, PNG, WEBP or HEIC · up to 10 MB</p>
                <Button type="button" className="min-h-12 rounded-xl px-6 text-base" disabled={!file || scan.isPending} onClick={() => scan.mutate()}>
                  {scan.isPending ? <><Loader2 className="animate-spin" /> Reading the photo…</> : <><Sparkles /> Read this photo</>}
                </Button>
              </div>
              <div role="status" aria-live="polite" className="sr-only">{scan.isPending ? "Uploading and reading your prescription photo" : ""}</div>
            </div>
          ) : (
            <MedicationForm
              familyMembers={family.data ?? []}
              forUserId={forUserId}
              setForUserId={setForUserId}
              name={name}
              setName={setName}
              dosage={dosage}
              setDosage={setDosage}
              form={form}
              setForm={setForm}
              instructions={instructions}
              setInstructions={setInstructions}
              schedules={schedules}
              setSchedules={setSchedules}
              togglePreset={togglePreset}
              fromScan={isReviewingScan}
            />
          )}

          {(mode === "manual" || isReviewingScan) && (
            <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              {isReviewingScan ? (
                <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={() => { setParsedData(null); setName(""); setDosage(""); setInstructions(""); }}>
                  <X /> Try another photo
                </Button>
              ) : <span />}
              <Button type="button" className="min-h-12 rounded-xl px-7 text-base" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? <><Loader2 className="animate-spin" /> Saving gently…</> : <><Check /> Save my check-in</>}
              </Button>
              <div role="status" aria-live="polite" className="sr-only">{create.isPending ? "Saving medication and reminder times" : ""}</div>
            </div>
          )}
        </CardContent>
      </section>

      <TodayDoses rows={doseRows} isLoading={doses.isLoading} onLog={(id, status) => log.mutate({ id, status })} isPending={log.isPending} />

      <section aria-labelledby="medications-title" className="space-y-4">
        <div>
          <p className="text-sm font-medium text-primary">Your medicines</p>
          <h2 id="medications-title" className="font-display text-2xl font-medium text-foreground">Everything in one calm place</h2>
        </div>
        {medications.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-40 rounded-3xl" /></div>
        ) : medicationRows.length === 0 ? (
          <QuietEmptyState variant="note" title="No medicines here yet" body="When you are ready, add the first one above. We will take it one step at a time." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {medicationRows.map((medication) => (
              <Card key={medication.id} className="rounded-3xl border-border bg-card shadow-gentle">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><Pill className="size-5 text-primary" /><h3 className="truncate font-display text-lg font-medium">{medication.name}</h3></div>
                      <p className="mt-1 text-base text-muted-foreground">{[medication.dosage, medication.form].filter(Boolean).join(" · ") || "Dose not added"}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-xl" aria-label={`Remove ${medication.name}`} disabled={removeMedication.isPending} onClick={() => removeMedication.mutate(medication.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                  {medication.medication_schedules && medication.medication_schedules.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {medication.medication_schedules.map((schedule) => (
                        <span key={schedule.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm text-foreground">
                          <Clock3 className="size-4 text-primary" /> {timeLabel(schedule.time_of_day)} {schedule.with_food ? "· with food" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {medication.instructions && <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">{medication.instructions}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MedicationForm({
  familyMembers,
  forUserId,
  setForUserId,
  name,
  setName,
  dosage,
  setDosage,
  form,
  setForm,
  instructions,
  setInstructions,
  schedules,
  setSchedules,
  togglePreset,
  fromScan,
}: {
  familyMembers: Array<{ user_id: string; display_name: string; role: string }>;
  forUserId: string;
  setForUserId: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  dosage: string;
  setDosage: (value: string) => void;
  form: string;
  setForm: (value: string) => void;
  instructions: string;
  setInstructions: (value: string) => void;
  schedules: ScheduleDraft[];
  setSchedules: React.Dispatch<React.SetStateAction<ScheduleDraft[]>>;
  togglePreset: (preset: TimeChoice) => void;
  fromScan: boolean;
}) {
  return (
    <div className="space-y-8 animate-gentle-rise">
      {fromScan && <GentleNudge title="We filled in what we could read" body="Please check the medicine, dose, and reminder times. You are in control of what gets saved." />}

      <fieldset className="space-y-5">
        <legend className="font-display text-xl font-medium text-foreground">The medicine</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {familyMembers.length > 1 && (
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-base" htmlFor="medication-person">Who is this for?</Label>
              <Select value={forUserId} onValueChange={setForUserId}>
                <SelectTrigger id="medication-person" className="min-h-12 rounded-xl bg-background px-4 text-base"><SelectValue placeholder="Choose a family member" /></SelectTrigger>
                <SelectContent>{familyMembers.map((member) => <SelectItem key={member.user_id} value={member.user_id} className="py-3 text-base">{member.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-base" htmlFor="medication-name">Medicine name</Label>
            <Input id="medication-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="For example, Metformin" className="min-h-12 rounded-xl bg-background px-4 text-base md:text-base" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="medication-dosage">Dose</Label>
            <Input id="medication-dosage" value={dosage} onChange={(event) => setDosage(event.target.value)} maxLength={100} placeholder="For example, 500 mg" className="min-h-12 rounded-xl bg-background px-4 text-base md:text-base" />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="medication-form">Type</Label>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger id="medication-form" className="min-h-12 rounded-xl bg-background px-4 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>{FORMS.map((option) => <SelectItem key={option} value={option} className="py-3 text-base">{option}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-base" htmlFor="medication-instructions">Anything helpful to remember? <span className="font-normal text-muted-foreground">Optional</span></Label>
            <Textarea id="medication-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={500} placeholder="For example, take after breakfast" className="min-h-24 rounded-xl bg-background p-4 text-base md:text-base" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-border pt-7">
        <legend className="pr-3 font-display text-xl font-medium text-foreground">When should we check in?</legend>
        <p className="text-base leading-relaxed text-muted-foreground">Choose the moments that feel natural. You can adjust the exact time below.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRESET_TIMES.map((preset) => {
            const Icon = preset.icon;
            const selected = schedules.some((schedule) => schedule.time === preset.time);
            return (
              <Button key={preset.id} type="button" variant="outline" className={cn("h-auto min-h-20 flex-col rounded-2xl px-3 py-4 text-base", selected && "border-primary bg-primary/10 text-foreground hover:bg-primary/10")} onClick={() => togglePreset(preset)} aria-pressed={selected}>
                <Icon className="size-5 text-primary" /><span>{preset.label}</span><span className="text-xs font-normal text-muted-foreground">{timeLabel(preset.time)}</span>
              </Button>
            );
          })}
        </div>
        <div className="space-y-3">
          {schedules.map((schedule, index) => (
            <div key={schedule.id} className="grid gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="space-y-2">
                <Label className="text-base" htmlFor={`medication-time-${schedule.id}`}>Reminder {index + 1}</Label>
                <Input id={`medication-time-${schedule.id}`} type="time" value={schedule.time} onChange={(event) => setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, time: event.target.value } : item))} className="min-h-12 rounded-xl bg-background px-4 text-base md:text-base" />
              </div>
              <Button type="button" variant={schedule.withFood ? "secondary" : "outline"} className="min-h-12 rounded-xl px-4 text-base" onClick={() => setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, withFood: !item.withFood } : item))} aria-pressed={schedule.withFood}>
                <Utensils /> {schedule.withFood ? "With food" : "Add with food"}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-xl justify-self-end sm:self-end" aria-label={`Remove reminder ${index + 1}`} disabled={schedules.length === 1} onClick={() => setSchedules((current) => current.filter((item) => item.id !== schedule.id))}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl text-base" onClick={() => setSchedules((current) => [...current, newSchedule("12:00")])}>
          <Plus /> Add another time
        </Button>
      </fieldset>
    </div>
  );
}

function TodayDoses({ rows, isLoading, onLog, isPending }: { rows: DoseRow[]; isLoading: boolean; onLog: (id: string, status: "taken" | "skipped") => void; isPending: boolean }) {
  return (
    <section aria-labelledby="today-title" className="space-y-4">
      <div>
        <p className="text-sm font-medium text-primary">Today</p>
        <h2 id="today-title" className="font-display text-2xl font-medium text-foreground">One dose at a time</h2>
      </div>
      {isLoading ? <Skeleton className="h-28 rounded-3xl" /> : rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-6 text-base leading-relaxed text-muted-foreground">Nothing is due today. Your next check-in will appear here when it is ready.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((dose) => {
            const isDone = dose.status === "taken" || dose.status === "skipped";
            return (
              <div key={dose.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-gentle sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", dose.status === "taken" ? "bg-mint text-foreground" : "bg-surface text-primary")} aria-hidden>{dose.status === "taken" ? <Check /> : <Pill />}</span>
                  <div><h3 className="font-display text-lg font-medium">{dose.medications?.name ?? "Medicine"}</h3><p className="text-base text-muted-foreground">{timeLabel(new Date(dose.scheduled_at).toTimeString().slice(0, 5))}{dose.medications?.dosage ? ` · ${dose.medications.dosage}` : ""}</p></div>
                </div>
                {isDone ? <span className="rounded-full bg-surface px-4 py-2 text-sm font-medium capitalize text-muted-foreground">{dose.status}</span> : (
                  <div className="flex gap-2">
                    <Button type="button" className="min-h-11 flex-1 rounded-xl sm:flex-none" disabled={isPending} onClick={() => onLog(dose.id, "taken")}><Check /> Taken</Button>
                    <Button type="button" variant="ghost" className="min-h-11 flex-1 rounded-xl sm:flex-none" disabled={isPending} onClick={() => onLog(dose.id, "skipped")}>Skip</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}