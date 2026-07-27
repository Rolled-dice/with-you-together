import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Pill,
  Sparkles,
  Trash2,
  Upload,
  Check,
  X,
  Clock,
  Bell,
  Plus,
  CalendarClock,
} from "lucide-react";
import {
  listMedications,
  createMedication,
  deleteMedication,
  listFamilyMembers,
  listTodaysDoses,
  logDose,
  parsePrescription,
} from "@/lib/medications.functions";
import {
  listReminders,
  createReminder,
  completeReminder,
  deleteReminder,
} from "@/lib/reminders.functions";

export const Route = createFileRoute("/_authenticated/care")({
  head: () => ({
    meta: [
      { title: "Care Hub — Medicines & Reminders | BesideU" },
      {
        name: "description",
        content:
          "Upload prescriptions, get medicine reminders, and keep loved ones' care on track — all in one place.",
      },
      { property: "og:title", content: "BesideU Care Hub" },
      {
        property: "og:description",
        content: "Prescription scanning and gentle medicine reminders for the family.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AppShell>
        <div className="rounded-brand border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-destructive">Care Hub unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <Button
            className="mt-4"
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Try again
          </Button>
        </div>
      </AppShell>
    );
  },
  notFoundComponent: () => (
    <AppShell>
      <p className="text-muted-foreground">Not found.</p>
    </AppShell>
  ),
});

function CarePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Care Hub"
        slogan="Checking in when they can't."
        title="Medicines & Reminders"
        description="Upload a prescription, and we'll parse it and set gentle reminders — for you or someone in the family."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <TodaySection />
          <MedicationsSection />
        </div>
        <div className="space-y-6">
          <RemindersSection />
        </div>
      </div>
    </AppShell>
  );
}

// ---------------- Today's schedule ----------------
function TodaySection() {
  const fetchDoses = useServerFn(listTodaysDoses);
  const logDoseFn = useServerFn(logDose);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["care", "doses", "today"],
    queryFn: () => fetchDoses(),
    refetchInterval: 60_000,
  });

  const mark = useMutation({
    mutationFn: (v: { dose_id: string; status: "taken" | "skipped" }) => logDoseFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["care", "doses", "today"] }),
  });

  const doses = data ?? [];
  const upcoming = doses.filter((d: any) => d.status === "pending");
  const done = doses.filter((d: any) => d.status !== "pending");

  return (
    <Card className="rounded-brand-lg border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-brand-accent" /> Today's schedule
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {upcoming.length} pending · {done.length} logged
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-brand" />
            <Skeleton className="h-16 w-full rounded-brand" />
          </>
        ) : doses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No doses scheduled today. Add a medication to see reminders here.
          </p>
        ) : (
          doses.map((d: any) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-border/60 bg-surface/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.medications?.name ?? "Medicine"}
                  {d.medications?.dosage ? (
                    <span className="text-muted-foreground"> · {d.medications.dosage}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(d.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {d.medications?.instructions ? ` · ${d.medications.instructions}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {d.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mark.mutate({ dose_id: d.id, status: "skipped" })}
                      disabled={mark.isPending}
                    >
                      <X className="mr-1 h-4 w-4" /> Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => mark.mutate({ dose_id: d.id, status: "taken" })}
                      disabled={mark.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" /> Taken
                    </Button>
                  </>
                ) : (
                  <Badge variant={d.status === "taken" ? "default" : "secondary"}>{d.status}</Badge>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Medications list + add ----------------
function MedicationsSection() {
  const fetchMeds = useServerFn(listMedications);
  const delMed = useServerFn(deleteMedication);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["care", "meds"],
    queryFn: () => fetchMeds(),
  });
  const del = useMutation({
    mutationFn: (id: string) => delMed({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care", "meds"] });
      qc.invalidateQueries({ queryKey: ["care", "doses", "today"] });
      toast.success("Medication removed");
    },
  });

  return (
    <Card className="rounded-brand-lg border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pill className="h-5 w-5 text-brand-accent" /> Medications
        </CardTitle>
        <AddMedicationDialog />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-brand" />
            <Skeleton className="h-20 w-full rounded-brand" />
          </>
        ) : (data ?? []).length === 0 ? (
          <div className="rounded-brand border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No medications yet. Tap <span className="font-medium">Add</span> and upload a prescription photo — we'll extract the details for you.
          </div>
        ) : (
          (data ?? []).map((m: any) => (
            <div
              key={m.id}
              className="rounded-brand border border-border/60 bg-surface/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.dosage ? <span className="text-muted-foreground"> · {m.dosage}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(m.medication_schedules ?? [])
                      .map((s: any) => (s.time_of_day || "").slice(0, 5))
                      .join(" · ")}
                    {m.instructions ? ` · ${m.instructions}` : ""}
                  </p>
                  {m.prescribed_by ? (
                    <p className="mt-1 text-xs text-muted-foreground">Rx by {m.prescribed_by}</p>
                  ) : null}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => del.mutate(m.id)}
                  disabled={del.isPending}
                  aria-label="Remove medication"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AddMedicationDialog() {
  const [open, setOpen] = useState(false);
  const fetchFamily = useServerFn(listFamilyMembers);
  const parseFn = useServerFn(parsePrescription);
  const createFn = useServerFn(createMedication);
  const qc = useQueryClient();
  const family = useQuery({
    queryKey: ["care", "family"],
    queryFn: () => fetchFamily(),
    enabled: open,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [forUser, setForUser] = useState<string>("");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [form, setForm] = useState("tablet");
  const [instructions, setInstructions] = useState("");
  const [prescribedBy, setPrescribedBy] = useState("");
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [prescriptionPath, setPrescriptionPath] = useState<string | null>(null);
  const [parsedRaw, setParsedRaw] = useState<any>(null);

  function reset() {
    setName("");
    setDosage("");
    setForm("tablet");
    setInstructions("");
    setPrescribedBy("");
    setTimes(["09:00"]);
    setNotes("");
    setPrescriptionPath(null);
    setParsedRaw(null);
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large. Please use a photo under 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("prescriptions")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      setPrescriptionPath(path);
      toast.success("Uploaded. Reading prescription…");
      const parsed: any = await parseFn({ data: { image_path: path } });
      setParsedRaw(parsed);
      const first = parsed?.medications?.[0];
      if (first) {
        setName(first.name || "");
        setDosage(first.dosage || "");
        setForm(first.form || "tablet");
        setInstructions(first.instructions || first.when_to_take?.toString?.() || "");
        setPrescribedBy(parsed.doctor || "");
        setTimes(timesFromParsed(first));
        toast.success("Prescription parsed. Please review and save.");
      } else {
        toast.info("Couldn't read the prescription clearly. Please fill in the details.");
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Medicine name is required");
      if (!forUser) throw new Error("Choose who this is for");
      return createFn({
        data: {
          for_user_id: forUser,
          name: name.trim(),
          dosage: dosage.trim() || null,
          form: form || null,
          instructions: instructions.trim() || null,
          prescribed_by: prescribedBy.trim() || null,
          prescription_image_path: prescriptionPath,
          parsed_data: parsedRaw,
          notes: notes.trim() || null,
          schedules: times.map((t) => ({ time_of_day: t, with_food: false, days_of_week: [0, 1, 2, 3, 4, 5, 6] })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Medication saved");
      qc.invalidateQueries({ queryKey: ["care", "meds"] });
      qc.invalidateQueries({ queryKey: ["care", "doses", "today"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Could not save"),
  });

  // Default forUser to first family member (self) once loaded
  const familyList = family.data ?? [];
  if (open && !forUser && familyList[0]) setForUser(familyList[0].user_id);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add medication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-brand border border-dashed border-brand-accent/40 bg-brand-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-brand-accent" /> Scan a prescription
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a photo — we'll pull out the medicine, dose, and timing automatically.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? "Reading…" : prescriptionPath ? "Replace photo" : "Upload prescription"}
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>Who is this for?</Label>
            <Select value={forUser} onValueChange={setForUser}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {familyList.map((f: any) => (
                  <SelectItem key={f.user_id} value={f.user_id}>{f.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Medicine name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amlodipine" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Dosage</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" />
            </div>
            <div className="grid gap-2">
              <Label>Form</Label>
              <Select value={form} onValueChange={setForm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "other"].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Reminder times</Label>
            <div className="flex flex-wrap gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={t}
                    onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setTimes(times.filter((_, j) => j !== i))}
                    aria-label="Remove time"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTimes([...times, "20:00"])}
              >
                <Plus className="mr-1 h-4 w-4" /> Time
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Instructions</Label>
            <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="After food" />
          </div>
          <div className="grid gap-2">
            <Label>Prescribed by</Label>
            <Input value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} placeholder="Dr. Sharma" />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save medication"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function timesFromParsed(m: any): string[] {
  const arr: string[] = [];
  const w = m?.when_to_take;
  const bucketize = (label: string) => {
    const l = String(label).toLowerCase();
    if (l.includes("morn")) return "09:00";
    if (l.includes("noon") || l.includes("afternoon")) return "14:00";
    if (l.includes("even")) return "19:00";
    if (l.includes("night") || l.includes("bed")) return "22:00";
    return null;
  };
  if (Array.isArray(w)) {
    for (const x of w) {
      const t = bucketize(x);
      if (t && !arr.includes(t)) arr.push(t);
    }
  } else if (typeof w === "string") {
    const t = bucketize(w);
    if (t) arr.push(t);
  }
  if (arr.length === 0 && typeof m?.times_per_day === "number") {
    const defaults = ["09:00", "14:00", "19:00", "22:00"];
    for (let i = 0; i < Math.min(m.times_per_day, 4); i++) arr.push(defaults[i]);
  }
  return arr.length > 0 ? arr : ["09:00"];
}

// ---------------- Reminders ----------------
function RemindersSection() {
  const fetchFn = useServerFn(listReminders);
  const createFn = useServerFn(createReminder);
  const completeFn = useServerFn(completeReminder);
  const delFn = useServerFn(deleteReminder);
  const fetchFamily = useServerFn(listFamilyMembers);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["care", "reminders"],
    queryFn: () => fetchFn(),
  });
  const family = useQuery({
    queryKey: ["care", "family"],
    queryFn: () => fetchFamily(),
  });
  const familyList = family.data ?? [];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"general" | "appointment" | "bill" | "hydration" | "exercise" | "birthday" | "other">("appointment");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    return d.toISOString().slice(0, 16);
  });
  const [forUser, setForUser] = useState<string>("");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");

  if (open && !forUser && familyList[0]) setForUser(familyList[0].user_id);

  const create = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("Title required");
      if (!forUser) throw new Error("Choose a person");
      return createFn({
        data: {
          for_user_id: forUser,
          title: title.trim(),
          category,
          due_at: new Date(dueAt).toISOString(),
          recurrence,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care", "reminders"] });
      setOpen(false);
      setTitle("");
      toast.success("Reminder added");
    },
    onError: (e: any) => toast.error(e.message || "Could not add reminder"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["care", "reminders"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["care", "reminders"] }),
  });

  const grouped = useMemo(() => {
    const list = data ?? [];
    const today: any[] = [];
    const upcoming: any[] = [];
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    for (const r of list) {
      const d = new Date(r.due_at);
      if (d <= endOfDay) today.push(r);
      else upcoming.push(r);
    }
    return { today, upcoming };
  }, [data]);

  return (
    <Card className="rounded-brand-lg border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-brand-accent" /> Reminders
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>For</Label>
                <Select value={forUser} onValueChange={setForUser}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {familyList.map((f: any) => (
                      <SelectItem key={f.user_id} value={f.user_id}>{f.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Doctor visit" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["appointment", "bill", "hydration", "exercise", "birthday", "general", "other"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Repeat</Label>
                  <Select value={recurrence} onValueChange={(v: any) => setRecurrence(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["none", "daily", "weekly", "monthly", "yearly"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>When</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Adding…" : "Add reminder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-brand" />
        ) : (grouped.today.length + grouped.upcoming.length) === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders yet.</p>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
                {grouped.today.map((r: any) => (
                  <ReminderRow key={r.id} r={r} onDone={(id) => complete.mutate(id)} onDelete={(id) => del.mutate(id)} />
                ))}
              </div>
            )}
            {grouped.upcoming.length > 0 && (
              <div>
                <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
                {grouped.upcoming.map((r: any) => (
                  <ReminderRow key={r.id} r={r} onDone={(id) => complete.mutate(id)} onDelete={(id) => del.mutate(id)} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderRow({ r, onDone, onDelete }: { r: any; onDone: (id: string) => void; onDelete: (id: string) => void }) {
  const when = new Date(r.due_at);
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-brand border border-border/60 bg-surface/60 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{r.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {when.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {r.recurrence && r.recurrence !== "none" ? ` · ${r.recurrence}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onDone(r.id)} aria-label="Mark done">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)} aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
