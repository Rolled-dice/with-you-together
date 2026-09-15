import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PreCallCheck } from "@/components/call/PreCallCheck";
import { CallRoom } from "@/components/call/CallRoom";
import { useChimeMeeting } from "@/hooks/useChimeMeeting";

export const Route = createFileRoute("/_authenticated/call-room/$bookingId")({
  head: () => ({
    meta: [
      { title: "Chime Session | SomeoneNear" },
      {
        name: "description",
        content: "Amazon Chime session room for your SomeoneNear call.",
      },
    ],
  }),
  component: ChimeCallPage,
});

function ChimeCallPage() {
  const { bookingId } = Route.useParams();
  const meeting = useChimeMeeting(bookingId);
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <div className="fixed inset-0 z-50">
        <CallRoom meeting={meeting} onLeave={() => setJoined(false)} />
      </div>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Session"
        title="Chime session room"
        description="Device check first, then join the room."
      />
      <PreCallCheck meeting={meeting} onJoin={() => setJoined(true)} />
    </AppShell>
  );
}
