import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  CalendarDotsIcon,
  CheckIcon,
  ClockIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";

type Member = { id: string; name: string; shortRole: string };
type Reminder = {
  id: string;
  title: string;
  forMemberId: string;
  forMemberName: string;
  createdBy: string;
  time: string;
  done: boolean;
};
type Medication = {
  id: string;
  forMemberId: string;
  forMemberName: string;
  medName: string;
  visualDesc: string;
  doseTime: string;
  takenToday: boolean;
  lastTakenAt: string;
};
type Post = {
  id: string;
  authorName: string;
  title: string;
  caption: string;
  fileInfo: string;
  expiresCountdown: string;
  createdAt: string;
  mediaType: string;
  url?: string;
};
type Booking = { id: string; listenerName: string; forWho: string; slot: string };
type Listener = {
  id: string;
  name: string;
  specialty: string;
  languages: string;
  nextSlot: string;
};
type Props = {
  view: string;
  members: Member[];
  reminders: Reminder[];
  setReminders: Dispatch<SetStateAction<Reminder[]>>;
  medications: Medication[];
  onToggleMedication: (id: string) => void;
  sharedFeed: Post[];
  setSharedFeed: Dispatch<SetStateAction<Post[]>>;
  bookedSessions: Booking[];
  setBookedSessions: Dispatch<SetStateAction<Booking[]>>;
  listeners: Listener[];
  openTask: (task: string) => void;
  onNavigate: (view: string) => void;
  isDark: boolean;
  onTheme: () => void;
  parentSimpleMode: boolean;
  onSimpleMode: () => void;
};

export function PreviewWorkspace(props: Props) {
  const {
    view,
    members,
    reminders,
    setReminders,
    medications,
    sharedFeed,
    bookedSessions,
    openTask,
    onNavigate,
  } = props;
  const [personId, setPersonId] = useState(members[0]?.id ?? "");
  const person = members.find((member) => member.id === personId) ?? members[0];
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [retention, setRetention] = useState("7 days");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [listenerId, setListenerId] = useState(props.listeners[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<{ id: string; role: "user" | "assistant"; text: string }[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Welcome to your Companion preview. What would you like to explore today?",
    },
  ]);
  const [sharing, setSharing] = useState<Record<string, boolean>>({});
  const [mood, setMood] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus("");
  }, [view]);
  const memberSelect = (
    <label className="preview-member-select">
      For
      <select
        aria-label="Choose family member"
        value={personId}
        onChange={(event) => setPersonId(event.target.value)}
      >
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );

  const reminderList = reminders.filter((reminder) => reminder.forMemberId === personId);
  const finishReminder = (id: string) => {
    setReminders((previous) =>
      previous.map((reminder) =>
        reminder.id === id ? { ...reminder, done: !reminder.done } : reminder,
      ),
    );
    setStatus("Reminder updated in this preview.");
  };

  const today = (
    <>
      <div className="preview-row">
        <div>
          <h2>Today with {person?.name}</h2>
          <p>A little care, one thing at a time.</p>
        </div>
        {memberSelect}
      </div>
      <div className="preview-actions">
        <button className="preview-button" data-primary onClick={() => openTask("reminder")}>
          <PlusIcon /> Add reminder
        </button>
        <button className="preview-button" onClick={() => onNavigate("My sharing")}>
          Share an update
        </button>
      </div>
      <section aria-label="Today's reminders">
        {reminderList.length === 0 && <p>No reminders for {person?.name} yet.</p>}
        {reminderList.map((reminder) => (
          <article className="preview-row" key={reminder.id}>
            <div>
              <h3>{reminder.title}</h3>
              <small>
                {reminder.time} · {reminder.done ? "Completed" : "No update yet"}
              </small>
            </div>
            <div className="preview-actions">
              <button
                className="preview-button"
                aria-pressed={reminder.done}
                onClick={() => finishReminder(reminder.id)}
              >
                <CheckIcon />
                {reminder.done ? "Undo" : "Done"}
              </button>
              {!reminder.done && (
                <button
                  className="preview-button"
                  onClick={() => {
                    setReminders((previous) =>
                      previous.map((item) =>
                        item.id === reminder.id ? { ...item, time: "In 30 minutes" } : item,
                      ),
                    );
                    setStatus("Snoozed for 30 minutes in this preview.");
                  }}
                >
                  <ClockIcon />
                  Remind me later
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section>
        <h3>How are you feeling?</h3>
        <div className="preview-actions" style={{ marginTop: 12 }}>
          {["Not great", "Okay", "Good", "Great"].map((value) => (
            <button
              key={value}
              className="preview-button"
              aria-pressed={mood === value}
              onClick={() => {
                setMood(value);
                setStatus("Your check-in is saved for this preview.");
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </section>
    </>
  );

  let content;
  switch (view) {
    case "Dashboard":
      content = (
        <>
          <h2>Good to have you here, Aarav</h2>
          <div className="preview-grid">
            <div className="preview-stat">
              <strong>{reminders.filter((item) => !item.done).length}</strong>Upcoming reminders
            </div>
            <div className="preview-stat">
              <strong>{Math.max(0, 30 - bookedSessions.length)}</strong>Sample calls remaining
            </div>
          </div>
          {today}
        </>
      );
      break;
    case "Today":
      content = today;
      break;
    case "Health":
    case "Medication":
      content = (
        <>
          <div className="preview-row">
            <div>
              <h2>Health & medication</h2>
              <p>For {person?.name}. Updates stay separate from private conversations.</p>
            </div>
            {memberSelect}
          </div>
          <button className="preview-button" data-primary onClick={() => openTask("medPhoto")}>
            <PlusIcon />
            Add medication
          </button>
          {medications
            .filter((item) => item.forMemberId === personId)
            .map((med) => (
              <article className="preview-row" key={med.id}>
                <div>
                  <h3>{med.medName}</h3>
                  <p>{med.visualDesc}</p>
                  <small>
                    {med.doseTime} · {med.takenToday ? "Marked taken" : "No update yet"}
                  </small>
                </div>
                <button
                  className="preview-button"
                  aria-pressed={med.takenToday}
                  onClick={() => props.onToggleMedication(med.id)}
                >
                  <CheckIcon />
                  {med.takenToday ? "Undo" : "Mark taken"}
                </button>
              </article>
            ))}
          {!medications.some((item) => item.forMemberId === personId) && (
            <p>No medication added for this person.</p>
          )}
          <p className="preview-status">
            Sample medication information. No prescription or dosage is being recommended.
          </p>
        </>
      );
      break;
    case "My sharing":
      content = (
        <>
          <h2>My sharing</h2>
          <p>Keep your circle close with a photo, a voice note, or a little update.</p>
          <section>
            <h3>Your sharing choices</h3>
            {[
              "Receive family-created reminders",
              "Share completion updates",
              "Share prescriptions and medication information",
            ].map((label) => (
              <label key={label} className="preview-check">
                <input
                  type="checkbox"
                  checked={sharing[label] ?? false}
                  onChange={(event) =>
                    setSharing((previous) => ({ ...previous, [label]: event.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </section>
          <form
            className="preview-compose"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              const url = attachment ? URL.createObjectURL(attachment) : undefined;
              props.setSharedFeed((previous) => [
                {
                  id: crypto.randomUUID(),
                  authorName: "Aarav (you)",
                  title: title.trim(),
                  caption: note.trim(),
                  fileInfo: attachment?.name ?? "Text update",
                  expiresCountdown: `Preview: ${retention}`,
                  createdAt: "Just now",
                  mediaType: attachment?.type ?? "text",
                  url,
                },
                ...previous,
              ]);
              setTitle("");
              setNote("");
              setAttachment(null);
              if (fileInput.current) fileInput.current.value = "";
              setStatus("Added to the local feed. Nothing has been uploaded or sent.");
            }}
          >
            <h3>Share an update</h3>
            <label>
              Title
              <input
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Your update
              <textarea
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="preview-grid">
              <label>
                <span>
                  <UploadSimpleIcon /> Photo, video, or audio
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/webm,audio/wav"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      setAttachment(null);
                      return;
                    }
                    const allowed = [
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "video/mp4",
                      "video/webm",
                      "audio/mpeg",
                      "audio/mp4",
                      "audio/webm",
                      "audio/wav",
                    ];
                    const limit = file.type.startsWith("image/")
                      ? 10
                      : file.type.startsWith("audio/")
                        ? 15
                        : 50;
                    if (!allowed.includes(file.type) || file.size > limit * 1024 * 1024) {
                      event.target.value = "";
                      setAttachment(null);
                      setStatus(`Choose a supported file under ${limit} MB.`);
                      return;
                    }
                    setAttachment(file);
                    setStatus("");
                  }}
                />
              </label>
              <label>
                Keep for
                <select value={retention} onChange={(event) => setRetention(event.target.value)}>
                  <option>24 hours</option>
                  <option>7 days</option>
                  <option>30 days</option>
                </select>
              </label>
            </div>
            <button className="preview-button" data-primary type="submit">
              <PaperPlaneTiltIcon />
              Add to preview feed
            </button>
          </form>
          <div className="preview-grid">
            {sharedFeed.map((post) => (
              <article className="preview-post" key={post.id}>
                <small>
                  {post.authorName} · {post.createdAt}
                </small>
                <h3>{post.title}</h3>
                <p>{post.caption}</p>
                {post.url && post.mediaType.startsWith("image/") && (
                  <img src={post.url} alt={post.title} />
                )}
                {post.url && post.mediaType.startsWith("audio/") && (
                  <audio src={post.url} controls />
                )}
                {post.url && post.mediaType.startsWith("video/") && (
                  <video src={post.url} controls playsInline />
                )}
                <small>
                  {post.fileInfo} · {post.expiresCountdown}
                </small>
                <div className="preview-actions" style={{ marginTop: 12 }}>
                  {post.url && (
                    <a className="preview-button" href={post.url} download={post.fileInfo}>
                      Download file
                    </a>
                  )}
                  <button
                    className="preview-button"
                    aria-label={`Remove ${post.title}`}
                    onClick={() => {
                      if (post.url) URL.revokeObjectURL(post.url);
                      props.setSharedFeed((previous) =>
                        previous.filter((item) => item.id !== post.id),
                      );
                    }}
                  >
                    <TrashIcon />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      );
      break;
    case "Calls":
    case "Listeners":
      content = (
        <>
          <h2>Your calls</h2>
          <div className="preview-stat">
            <strong>{Math.max(0, 30 - bookedSessions.length)} / 30</strong>Sample shared call
            balance
          </div>
          <form
            className="preview-compose"
            onSubmit={(event) => {
              event.preventDefault();
              const listener = props.listeners.find((item) => item.id === listenerId);
              if (!listener || !person || !scheduledFor) return;
              props.setBookedSessions((previous) => [
                ...previous,
                {
                  id: crypto.randomUUID(),
                  listenerName: listener.name,
                  forWho: person.name,
                  slot: scheduledFor.replace("T", " "),
                },
              ]);
              setStatus("Added to the preview calendar. No real call has been booked.");
              setScheduledFor("");
            }}
          >
            <h3>Plan a fifteen-minute call</h3>
            <div className="preview-grid">
              {memberSelect}
              <label>
                Listener
                <select value={listenerId} onChange={(event) => setListenerId(event.target.value)}>
                  {props.listeners.map((listener) => (
                    <option key={listener.id} value={listener.id}>
                      {listener.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Date and time
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </label>
            <button className="preview-button" data-primary disabled={bookedSessions.length >= 30}>
              <CalendarDotsIcon />
              Add preview booking
            </button>
          </form>
          {bookedSessions.map((booking) => (
            <article className="preview-row" key={booking.id}>
              <div>
                <h3>{booking.listenerName}</h3>
                <p>For {booking.forWho}</p>
                <small>{booking.slot}</small>
              </div>
              <button
                className="preview-button"
                onClick={() => {
                  props.setBookedSessions((previous) =>
                    previous.filter((item) => item.id !== booking.id),
                  );
                  setStatus("Preview booking cancelled.");
                }}
              >
                Cancel
              </button>
            </article>
          ))}
          <button className="preview-button" disabled>
            Extra calls coming later
          </button>
        </>
      );
      break;
    case "Send Later":
      content = (
        <>
          <h2>A message for later</h2>
          <p>Choose someone and a moment. Your draft stays here until you refresh.</p>
          <form
            className="preview-compose"
            onSubmit={(event) => {
              event.preventDefault();
              if (!person || !note.trim() || !scheduledFor) return;
              setReminders((previous) => [
                ...previous,
                {
                  id: crypto.randomUUID(),
                  title: note.trim(),
                  forMemberId: person.id,
                  forMemberName: person.name,
                  createdBy: "Aarav (preview)",
                  time: scheduledFor.replace("T", " "),
                  done: false,
                },
              ]);
              setStatus("Saved as a preview draft. Nothing is scheduled for delivery.");
              setNote("");
            }}
          >
            {memberSelect}
            <label>
              Message
              <textarea
                required
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <label>
              Delivery time
              <input
                required
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </label>
            <button className="preview-button" data-primary>
              Save preview draft
            </button>
          </form>
        </>
      );
      break;
    case "Companion":
      content = (
        <>
          <h2>A little company</h2>
          <p>Companion design preview. AI replies will be connected in the backend stage.</p>
          <div className="preview-chat" aria-live="polite">
            {chat.map((item) => (
              <p key={item.id} data-role={item.role}>
                {item.text}
              </p>
            ))}
          </div>
          <form
            className="preview-compose"
            onSubmit={(event) => {
              event.preventDefault();
              if (!message.trim()) return;
              setChat((previous) => [
                ...previous,
                { id: crypto.randomUUID(), role: "user", text: message.trim() },
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  text: "Your message is shown locally. The connected Companion will respond here once backend integration is ready.",
                },
              ]);
              setMessage("");
            }}
          >
            <label>
              Your message
              <textarea
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button className="preview-button" data-primary disabled={!message.trim()}>
              <PaperPlaneTiltIcon />
              Send preview message
            </button>
          </form>
        </>
      );
      break;
    case "Insights":
      content = (
        <>
          <h2>Your week, at a glance</h2>
          <p>Sample activity for the circle shown in this preview.</p>
          <div className="preview-grid">
            <div className="preview-stat">
              <strong>{reminders.filter((item) => item.done).length}</strong>Completed reminders
            </div>
            <div className="preview-stat">
              <strong>{sharedFeed.length}</strong>Shared updates
            </div>
            <div className="preview-stat">
              <strong>{bookedSessions.length}</strong>Planned calls
            </div>
            <div className="preview-stat">
              <strong>{mood || "No check-in"}</strong>Latest check-in
            </div>
          </div>
        </>
      );
      break;
    case "Safety":
      content = (
        <>
          <h2>Your comfort comes first</h2>
          <p>SomeoneNear provides companionship, not therapy or emergency care.</p>
          <section className="preview-compose">
            <h3>Sharing is your choice</h3>
            <p>Family membership does not give anyone access to private Companion conversations.</p>
            <button className="preview-button" onClick={() => onNavigate("My sharing")}>
              Review sharing choices
            </button>
          </section>
          <section>
            <h3>Need urgent help?</h3>
            <p>
              Contact local emergency services if you are in immediate danger. In the US, call or
              text 988 for crisis support.
            </p>
          </section>
        </>
      );
      break;
    case "Settings":
      content = (
        <>
          <h2>Make yourself comfortable</h2>
          <div className="preview-row">
            <div>
              <h3>Appearance</h3>
              <p>{props.isDark ? "Dark" : "Light"} theme</p>
            </div>
            <button className="preview-button" onClick={props.onTheme}>
              Use {props.isDark ? "light" : "dark"} theme
            </button>
          </div>
          <label className="preview-check">
            <input type="checkbox" checked={props.parentSimpleMode} onChange={props.onSimpleMode} />
            Larger text and simpler layout
          </label>
          <button className="preview-button" onClick={() => onNavigate("My sharing")}>
            Sharing preferences
          </button>
        </>
      );
      break;
    default:
      content = today;
  }
  return (
    <div className="preview-workspace" data-workspace-view={view}>
      {content}
      <p className="preview-status" role="status">
        {status}
      </p>
    </div>
  );
}
