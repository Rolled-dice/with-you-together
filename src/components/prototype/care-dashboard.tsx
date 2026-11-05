import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { getMyProfile } from "@/lib/profile.functions";
import { getMyFamily } from "@/lib/family.functions";
import { listReminders } from "@/lib/reminders.functions";
import { listMedications } from "@/lib/medications.functions";
import { listMyBookings } from "@/lib/listeners.functions";
import { useIdentity } from "@/features/session/session-store";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { MemberAvatar } from "./member-avatar";

const categories = [
  { id: "circle", label: "👨‍👩‍👧‍👦 ① Family Circle", description: "Call opt-in & live status" },
  { id: "meds", label: "💊 ② Photo Meds", description: "Medication records" },
  { id: "calls", label: "📞 ③ Listener Calls", description: "Monthly plan quota" },
  { id: "reminders", label: "⏰ ④ Care Reminders", description: "Your care schedule" },
] as const;
type Category = (typeof categories)[number]["id"];

export function CareDashboard() {
  const { userId } = useIdentity();
  const profileFn = useServerFn(getMyProfile),
    familyFn = useServerFn(getMyFamily),
    remindersFn = useServerFn(listReminders),
    medicationsFn = useServerFn(listMedications),
    bookingsFn = useServerFn(listMyBookings);
  const profile = useQuery({
    queryKey: ["me", userId],
    queryFn: () => profileFn(),
    enabled: !!userId,
  });
  const family = useQuery({
    queryKey: ["family", userId],
    queryFn: () => familyFn(),
    enabled: !!userId,
  });
  const reminders = useQuery({
    queryKey: ["dashboard-reminders", userId],
    queryFn: () => remindersFn(),
    enabled: !!userId,
  });
  const medications = useQuery({
    queryKey: ["dashboard-medications", userId],
    queryFn: () => medicationsFn(),
    enabled: !!userId,
  });
  const bookings = useQuery({
    queryKey: ["listener-bookings", userId],
    queryFn: () => bookingsFn(),
    enabled: !!userId,
  });
  const [selected, setSelected] = useState<Category>("circle");
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  const members = family.data?.members ?? [];
  const name = profile.data?.display_name?.split(" ")[0] || "there";
  const counts = [
    family.isPending
      ? "Loading…"
      : family.isError
        ? "Open family circle"
        : `${members.length} Loved ${members.length === 1 ? "One" : "Ones"}`,
    medications.isPending
      ? "Loading…"
      : medications.isError
        ? "Open medication records"
        : `${medications.data?.length ?? 0} Active`,
    bookings.isPending
      ? "Loading…"
      : bookings.isError
        ? "Open call history"
        : `${bookings.data?.length ?? 0} Bookings`,
    reminders.isPending
      ? "Loading…"
      : reminders.isError
        ? "Open reminders"
        : `${reminders.data?.length ?? 0} Active`,
  ];
  return (
    <AppShell>
      <div className="sn-worker-dashboard">
        <PageHeader
          eyebrow="🏡 Page 1 · Family Care Dashboard"
          title={`${greeting}, ${name}. ${family.isPending ? "Your family space is here." : members.length === 1 ? "Your family circle is connected." : members.length ? `All ${members.length} family members are connected.` : "Your circle starts with you."}`}
          description="Your family’s everyday care, updates and little moments, together in one place."
        >
          <Link to="/listeners" className="sn-worker-button">
            📞 Book Listener Call
          </Link>
          <Link to="/family" className="sn-worker-secondary sn-worker-manage-family">
            + Manage Family Circle
          </Link>
        </PageHeader>
        <div className="sn-worker-categories" role="tablist" aria-label="Care dashboard categories">
          {categories.map((category, index) => (
            <button
              type="button"
              key={category.id}
              id={`category-${category.id}`}
              role="tab"
              aria-selected={selected === category.id}
              aria-controls="care-detail-panel"
              tabIndex={selected === category.id ? 0 : -1}
              onClick={() => setSelected(category.id)}
              onKeyDown={(event) => {
                if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : (index + (event.key === "ArrowRight" ? 1 : 3)) % 4;
                  setSelected(categories[next].id);
                  document.getElementById(`category-${categories[next].id}`)?.focus();
                }
              }}
            >
              <span>{category.description}</span>
              <h2>{category.label}</h2>
              <strong>{counts[index]}</strong>
            </button>
          ))}
        </div>
        <section
          id="care-detail-panel"
          role="tabpanel"
          aria-labelledby={`category-${selected}`}
          className="sn-worker-detail"
          tabIndex={0}
          key={selected}
        >
          {selected === "circle" && (
            <>
              <div className="sn-worker-panel-title">
                <h2>Family Circle &amp; Call Opt-In Status</h2>
                <Link to="/family">Open Full Family Hub →</Link>
              </div>
              {family.isPending ? (
                <DataSkeleton />
              ) : family.isError ? (
                <DataError retry={() => void family.refetch()} />
              ) : members.length ? (
                <div className="sn-worker-family-summary">
                  {members.map((member) => (
                    <article key={member.id}>
                      <MemberAvatar id={member.user_id} />
                      <div>
                        <div>
                          <h3>{member.display_name || "Family member"}</h3>
                          <span className="sn-worker-status">{member.role}</span>
                        </div>
                        <p>
                          {member.role === "owner"
                            ? "Keeping your family circle connected."
                            : "Part of your family’s everyday circle of care."}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Your circle is ready when you are."
                  description="Invite the people you want to share everyday care with."
                  to="/family"
                  action="Start your family circle"
                />
              )}
            </>
          )}
          {selected === "meds" && (
            <>
              <div className="sn-worker-panel-title">
                <h2>Today’s Medications</h2>
                <Link to="/reminders">Open Full Meds Log →</Link>
              </div>
              {medications.isPending ? (
                <DataSkeleton />
              ) : medications.isError ? (
                <DataError retry={() => void medications.refetch()} />
              ) : medications.data?.length ? (
                <div className="sn-worker-mini-grid">
                  {medications.data.map((medication) => (
                    <article key={medication.id}>
                      <h3>{medication.name}</h3>
                      <p>{medication.dosage || "See your medication schedule"}</p>
                      <Link to="/reminders">View schedule →</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="A gentle start to your medication routine."
                  description="Add your first medication and its schedule. Photo verification appears here when available."
                  to="/reminders"
                  action="Add a medication"
                />
              )}
            </>
          )}
          {selected === "calls" && (
            <>
              <div className="sn-worker-panel-title">
                <h2>Your Listener Calls</h2>
                <Link to="/listeners">Open Full Calls Hub →</Link>
              </div>
              {bookings.isPending ? (
                <DataSkeleton />
              ) : bookings.isError ? (
                <DataError retry={() => void bookings.refetch()} />
              ) : bookings.data?.length ? (
                <div className="sn-worker-mini-grid">
                  {bookings.data.slice(0, 6).map((booking) => (
                    <article key={booking.id}>
                      <h3>{booking.listeners?.name ?? "Your Listener"}</h3>
                      <span className="sn-worker-status">{booking.status}</span>
                      <p>
                        {new Date(booking.requested_at).toLocaleDateString()} ·{" "}
                        {booking.duration_minutes} minutes
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="A friendly voice, at your pace."
                  description="Your scheduled calls and their status will appear here."
                  to="/listeners"
                  action="Explore listener calls"
                />
              )}
              <p className="sn-worker-footnote">
                For your current call allowance and purchased membership terms,{" "}
                <Link to="/settings">open membership settings</Link>.
              </p>
            </>
          )}
          {selected === "reminders" && (
            <>
              <div className="sn-worker-panel-title">
                <h2>Parent &amp; Self Reminders</h2>
                <Link to="/reminders">Manage Reminders →</Link>
              </div>
              {reminders.isPending ? (
                <DataSkeleton />
              ) : reminders.isError ? (
                <DataError retry={() => void reminders.refetch()} />
              ) : reminders.data?.length ? (
                <div className="sn-worker-mini-grid">
                  {reminders.data.map((reminder) => (
                    <article key={reminder.id}>
                      <span>{new Date(reminder.due_at).toLocaleString()}</span>
                      <h3>{reminder.title}</h3>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="A little help remembering."
                  description="Add a reminder for a routine, an appointment, or a moment that matters."
                  to="/reminders"
                  action="Create a reminder"
                />
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
function Empty({
  title,
  description,
  to,
  action,
}: {
  title: string;
  description: string;
  to: string;
  action: string;
}) {
  return (
    <div className="sn-worker-empty">
      <h3>{title}</h3>
      <p>{description}</p>
      <Link to={to} className="sn-worker-button">
        {action}
      </Link>
    </div>
  );
}
