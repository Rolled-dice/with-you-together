import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMedications, getPrescriptionUrl } from "@/lib/medications.functions";
import type { FamilySnapshotData } from "@/lib/family.schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileTextIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export function FamilyHealth({
  family,
  selectedPerson,
}: {
  family: FamilySnapshotData;
  selectedPerson?: string;
}) {
  const members = family.members.filter(
    (member) =>
      member.user_id === family.viewer_id || (family.myRole === "owner" && member.share_health),
  );
  const [person, setPerson] = useState(selectedPerson || family.viewer_id);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const list = useServerFn(listMedications);
  const prescription = useServerFn(getPrescriptionUrl);
  const query = useQuery({
    queryKey: ["family-health"],
    queryFn: () => list(),
    refetchInterval: 30000,
  });
  const open = useMutation({
    mutationFn: (id: string) => prescription({ data: { medication_id: id } }),
    onSuccess: ({ url }) => setPrescriptionUrl(url),
    onError: (error) => toast.error(error.message),
  });
  const visiblePerson = members.some((member) => member.user_id === person)
    ? person
    : family.viewer_id;
  const rows = query.data?.filter((medication) => medication.for_user_id === visiblePerson) || [];
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Medications & prescriptions</h2>
      <label className="grid max-w-sm gap-2">
        For
        <select
          className="family-select"
          value={visiblePerson}
          onChange={(event) => setPerson(event.target.value)}
        >
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.user_id === family.viewer_id ? "Me" : member.display_name || "Family member"}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Each person manages their own medicines. Only information they choose to share appears here.
      </p>
      {query.isPending && <p role="status">Loading medications...</p>}
      {query.isError && <p role="alert">Medications could not be loaded.</p>}
      {query.isSuccess && !rows.length && <p>No medications to show.</p>}
      <div className="divide-y divide-border">
        {rows.map((medication) => (
          <article key={medication.id} className="space-y-2 py-4">
            <h3 className="break-words text-lg font-medium">{medication.name}</h3>
            <p>{[medication.dosage, medication.form].filter(Boolean).join(" / ")}</p>
            {medication.instructions && <p className="break-words">{medication.instructions}</p>}
            <p className="text-sm text-muted-foreground">
              {medication.medication_schedules
                .map((schedule) => schedule.time_of_day.slice(0, 5))
                .join(", ")}
            </p>
            {medication.prescription_image_path && (
              <Button
                variant="outline"
                disabled={open.isPending}
                onClick={() => open.mutate(medication.id)}
              >
                <FileTextIcon /> View prescription
              </Button>
            )}
          </article>
        ))}
      </div>
      <Dialog
        open={Boolean(prescriptionUrl)}
        onOpenChange={(value) => {
          if (!value) setPrescriptionUrl(null);
        }}
      >
        <DialogContent className="family-experience max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription</DialogTitle>
          </DialogHeader>
          {prescriptionUrl && (
            <img
              src={prescriptionUrl}
              alt="Shared prescription"
              className="h-auto w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
