import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FamilyWorkspace } from "../../../src/routes/_authenticated/family";
import { InvitationForm } from "../../../src/routes/_authenticated/invite";
import { FamilyToday } from "../../../src/components/family-today";
import { FamilyVerificationQueue } from "../../../src/components/family-verification-queue";
import { AppShell, PageHeader } from "../../../src/components/app-shell";
import { AppThemeSync, ThemePreferences } from "../../../src/components/app-theme";
import * as familyFunctions from "../../../src/lib/family.functions";
import * as reminderFunctions from "../../../src/lib/reminders.functions";
import * as sessionFunctions from "../../../src/lib/family-sessions.functions";
import * as callFunctions from "../../../src/lib/call-credits.functions";
import * as pushFunctions from "../../../src/lib/push.functions";
import * as medicationFunctions from "../../../src/lib/medications.functions";
import * as profileFunctions from "../../../src/lib/profile.functions";
import type { FamilySnapshotData } from "../../../src/lib/family.schemas";
import "../../../src/styles.css";

const owner = "10000000-0000-4000-8000-000000000001";
const parent = "10000000-0000-4000-8000-000000000002";
const mode = new URLSearchParams(location.search).get("mode") || "owner";
const now = new Date().toISOString();
const invitation = {
  id: "10000000-0000-4000-8000-000000000003",
  invitee_name: "Dad",
  relationship: "Father",
  email: "dad@example.test",
  contact_phone: null,
  contact_channel: "email" as const,
  status: "pending" as const,
  delivery_status: "sent" as const,
  attempts: 0,
  call_window: "Weekdays, 10 am to noon",
  call_timezone: "Asia/Kolkata",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  created_at: now,
  family_name: "Our family",
  call_phone: "+919876543210",
};
const data: FamilySnapshotData = {
  viewer_id: mode === "parent" ? parent : owner,
  family: { id: "family", name: "Our family", owner_id: owner, created_at: now },
  myRole: mode === "parent" ? "adult" : "owner",
  canInvite: mode !== "parent",
  pending: [],
  invites: [invitation],
  members: [
    {
      id: "owner",
      user_id: owner,
      role: "owner",
      display_name: "Aarav",
      avatar_url: "/family-avatars.png#avatar-1",
      timezone: "Asia/Kolkata",
      joined_at: now,
      receive_reminders: false,
      share_updates: false,
      share_health: false,
    },
    {
      id: "parent",
      user_id: parent,
      role: "adult",
      display_name: "Dad",
      avatar_url: "/family-avatars.png#avatar-5",
      timezone: "America/New_York",
      joined_at: now,
      receive_reminders: true,
      share_updates: true,
      share_health: false,
    },
  ],
};
if (mode === "globe") {
  data.invites = [];
  for (const [index, display_name] of ["Mum", "Priya", "Rohan"].entries()) {
    data.members.push({
      ...data.members[1],
      id: `relative-${index}`,
      user_id: `relative-${index}`,
      display_name,
      avatar_url: [
        "/family-avatars.png#avatar-6",
        "/family-avatars.png#avatar-2",
        "/family-avatars.png#avatar-12",
      ][index],
      share_updates: false,
    });
  }
}
let completed = false;
const queueRow = {
  ...invitation,
  status: "verification_pending",
  assigned_to: owner,
  history: [],
  attempts: 2,
};
const functions = {
  ...familyFunctions,
  ...reminderFunctions,
  ...sessionFunctions,
  ...callFunctions,
  ...pushFunctions,
  ...medicationFunctions,
  ...profileFunctions,
};
const paths = new Map(
  Object.entries(functions)
    .filter(([, fn]) => typeof fn === "function" && Reflect.get(fn, "url"))
    .map(([name, fn]) => [new URL(Reflect.get(fn, "url"), location.origin).pathname, name]),
);
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.pathname === "/rest/v1/notifications") return Response.json([]);
  const name = paths.get(url.pathname);
  if (!name) return originalFetch(input, init);
  Reflect.set(window, "familyLastCall", { name, body: init?.body || "" });
  let result: unknown = { ok: true };
  if (name === "getFamilyDeliveryConfig")
    result = { email: true, smsIndia: false, smsUS: false, phoneLogin: false };
  if (name === "getPushConfig") result = { enabled: false, publicKey: "" };
  if (name === "inviteFamilyMember" || name === "resendFamilyInvite")
    result = { id: invitation.id, delivery_status: "sent" };
  if (name === "getMyExtraCalls")
    result = {
      enabled: false,
      can_buy: true,
      available: 0,
      expires_at: null,
      purchase_expires_at: null,
      offers: [],
    };
  if (name === "completeReminder") completed = true;
  if (name === "getFamilyToday")
    result = [
      {
        id: "10000000-0000-4000-8000-000000000004",
        reminder_id: "reminder",
        for_user_id: parent,
        created_by: owner,
        title: "Visit Dr. Mehta",
        description: "Bring your prescription",
        category: "appointment",
        recurrence: "none",
        timezone: "America/New_York",
        due_at: now,
        status: completed || mode === "globe" ? "done" : "pending",
        update_text: mode === "globe" ? "I visited the doctor. Feeling better." : null,
        completed_at: completed || mode === "globe" ? now : null,
        can_complete: mode === "parent",
      },
    ];
  if (name === "getFamilyPool")
    result = {
      familyId: "family",
      role: data.myRole,
      totalSessions: 30,
      totalUsed: 2,
      members: data.members.map((member) => ({
        user_id: member.user_id,
        display_name: member.display_name,
        allocated: 5,
        used: 1,
      })),
    };
  if (name === "listMedications") result = [];
  if (name === "getVerificationQueue")
    result = { viewer_id: owner, is_admin: false, rows: [queueRow] };
  return Response.json({ result });
};
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
function Fixture() {
  return (
    <AppShell>
      <div className="family-experience">
        <PageHeader
          eyebrow="Family"
          title="Our family"
          description="Stay close, with care that respects everyone's space."
        />
        {mode === "theme" ? (
          <ThemePreferences />
        ) : mode === "invite" ? (
          <InvitationForm invitation={invitation} token="fixture-invitation" />
        ) : mode === "parent" ? (
          <FamilyToday family={data} />
        ) : mode === "staff" ? (
          <FamilyVerificationQueue />
        ) : (
          <FamilyWorkspace data={data} />
        )}
      </div>
    </AppShell>
  );
}
const root = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <AppThemeSync />
      <Outlet />
    </QueryClientProvider>
  ),
});
const authenticated = createRoute({
  getParentRoute: () => root,
  id: "_authenticated",
  beforeLoad: () => ({ isAdmin: false, isAgent: false }),
});
const route = createRoute({
  getParentRoute: () => authenticated,
  path: "/__family_test__",
  component: Fixture,
});
const router = createRouter({
  routeTree: root.addChildren([authenticated.addChildren([route])]),
  context: { queryClient },
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
