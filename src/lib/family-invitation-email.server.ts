import * as React from "react";
import { render } from "@react-email/render";
import { InviteEmail } from "@/lib/email-templates/invite";

type FamilyInvitationEmail = {
  to: string;
  familyName: string;
  inviterName: string;
  role: "adult";
  inviteUrl: string;
  approved?: boolean;
};

type FamilyInvitationSupportAlert = {
  familyName: string;
  inviteeName: string;
  inviteePhone: string;
  ownerName: string;
  ownerEmail: string | null;
  outcome: "declined" | "verification_closed";
  attempts: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export async function sendFamilyInvitationEmail(invitation: FamilyInvitationEmail) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return false;

  const senderEmail =
    process.env.FAMILY_EMAIL_FROM?.trim() ||
    process.env.CALENDAR_ORGANIZER_EMAIL?.trim() ||
    "care@someonenear.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return false;

  const htmlContent = await render(
    React.createElement(InviteEmail, {
      siteName: "SomeoneNear",
      siteUrl: "https://www.someonenear.com",
      confirmationUrl: invitation.inviteUrl,
      familyName: invitation.familyName,
      inviterName: invitation.inviterName,
      role: invitation.role,
      approved: invitation.approved,
    }),
  );
  const textContent = [
    invitation.approved
      ? `Your family invitation to ${invitation.familyName} is approved. Sign in or create an account with this email address to join.`
      : `${invitation.inviterName} invited you to join ${invitation.familyName}. SomeoneNear's care team will call the number shared by your family member to confirm that you would like to join. You do not need to respond in the app.`,
    invitation.inviteUrl,
    "If you weren't expecting this invitation, you can ignore this email.",
  ].join("\n\n");

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "SomeoneNear", email: senderEmail },
        to: [{ email: invitation.to }],
        subject: invitation.approved
          ? `Your SomeoneNear family invitation is approved`
          : `You've been invited to join ${invitation.familyName}`,
        htmlContent,
        textContent,
      }),
    });
    if (!response.ok) console.error(`Brevo family invitation failed [${response.status}]`);
    return response.ok;
  } catch {
    console.error("Brevo family invitation request failed");
    return false;
  }
}

export async function sendFamilyInvitationSupportAlert(alert: FamilyInvitationSupportAlert) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return false;

  const senderEmail =
    process.env.FAMILY_EMAIL_FROM?.trim() ||
    process.env.CALENDAR_ORGANIZER_EMAIL?.trim() ||
    "care@someonenear.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return false;

  const outcomeText =
    alert.outcome === "declined"
      ? "The invitee declined the family invitation."
      : "The team could not reach the invitee after three contact attempts.";
  const rows = [
    ["Family", alert.familyName],
    ["Invitee", alert.inviteeName],
    ["Mobile", alert.inviteePhone],
    ["Family admin", alert.ownerName],
    ["Admin email", alert.ownerEmail || "Not available"],
    ["Recorded attempts", String(alert.attempts)],
  ];
  const textContent = [
    "Family invitation needs support follow-up",
    outcomeText,
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n\n");
  const htmlContent = `<html><body><h2>Family invitation needs support follow-up</h2><p>${escapeHtml(outcomeText)}</p><dl>${rows
    .map(
      ([label, value]) =>
        `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join("")}</dl></body></html>`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "SomeoneNear", email: senderEmail },
        to: [{ email: "care@someonenear.com" }],
        subject: `Family invitation follow-up: ${alert.outcome === "declined" ? "declined" : "unreachable"}`,
        htmlContent,
        textContent,
      }),
    });
    if (!response.ok) console.error(`Brevo family support alert failed [${response.status}]`);
    return response.ok;
  } catch {
    console.error("Brevo family support alert request failed");
    return false;
  }
}
