import { jsPDF } from "jspdf";

export type JournalEntryForExport = {
  id: string;
  mood: number | null;
  title: string | null;
  body: string | null;
  created_at: string;
};

const MOOD_LABEL: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Bright",
};

export function exportJournalToPdf(
  entries: JournalEntryForExport[],
  opts: { displayName?: string | null } = {},
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Cover header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text("WithU Journal", margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110, 110, 110);
  const who = opts.displayName ? `For ${opts.displayName}` : "Your private entries";
  doc.text(who, margin, y);
  y += 16;
  const exportedOn = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
  doc.text(`Exported ${exportedOn} · ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`, margin, y);
  y += 12;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y + 6, pageW - margin, y + 6);
  y += 22;

  if (entries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text("No entries yet.", margin, y);
  }

  for (const entry of entries) {
    const date = new Date(entry.created_at).toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    });
    const moodLabel = entry.mood ? MOOD_LABEL[entry.mood] ?? null : null;

    ensureSpace(60);

    // Date + mood line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(130, 130, 130);
    const meta = moodLabel ? `${date}  ·  Mood: ${moodLabel}` : date;
    doc.text(meta, margin, y);
    y += 14;

    // Title
    if (entry.title && entry.title.trim().length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      const titleLines = doc.splitTextToSize(entry.title, contentW) as string[];
      for (const line of titleLines) {
        ensureSpace(18);
        doc.text(line, margin, y);
        y += 16;
      }
    }

    // Body
    if (entry.body && entry.body.trim().length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      const paragraphs = entry.body.split(/\n+/);
      for (const p of paragraphs) {
        const lines = doc.splitTextToSize(p, contentW) as string[];
        for (const line of lines) {
          ensureSpace(15);
          doc.text(line, margin, y);
          y += 14;
        }
        y += 4;
      }
    }

    // Separator between entries
    ensureSpace(20);
    doc.setDrawColor(235, 230, 225);
    doc.line(margin, y + 6, pageW - margin, y + 6);
    y += 22;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `WithU · Private journal export · Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 24,
      { align: "center" },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`withu-journal-${stamp}.pdf`);
}
