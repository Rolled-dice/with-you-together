import { Group, PerspectiveCamera, Vector3 } from "three";
import type { AvatarAppearance } from "@/components/identity/editorial-avatar";

export type GlobeMember = AvatarAppearance & {
  id: string;
  name: string;
  phi: number;
  theta: number;
  note: string;
  badge?: string;
  optIn?: "confirmed" | "ignored" | "pending";
  hasNotification?: boolean;
  notificationCount?: number;
  location?: string;
  role?: string;
  isInvite?: boolean;
  inviteToken?: string;
  email?: string;
  phone?: string;
};

export const globeArchetypes: Array<{
  archetype: string;
  avatarBg: string;
  skinTone: string;
  outfitColor: string;
  backdropMotif: string;
  glasses: boolean;
}> = [
  { archetype: "adult-man", avatarBg: "#EAB84B", skinTone: "#D69577", outfitColor: "#8B1E3F", backdropMotif: "clouds", glasses: false },
  { archetype: "aged-woman", avatarBg: "#F36D89", skinTone: "#E5A98A", outfitColor: "#102F50", backdropMotif: "leaves", glasses: false },
  { archetype: "aged-man", avatarBg: "#EAB84B", skinTone: "#D99B7E", outfitColor: "#D95732", backdropMotif: "leaves", glasses: true },
  { archetype: "adult-woman", avatarBg: "#EAB84B", skinTone: "#E0A183", outfitColor: "#A8581B", backdropMotif: "waves", glasses: false },
  { archetype: "teenager", avatarBg: "#EAB84B", skinTone: "#BC7A5C", outfitColor: "#F36D89", backdropMotif: "stripes", glasses: false },
  { archetype: "child", avatarBg: "#EAB84B", skinTone: "#E8B195", outfitColor: "#F36D89", backdropMotif: "leaves", glasses: false },
];

export const sampleMembers: GlobeMember[] = [
  {
    id: "dad",
    name: "Dad",
    location: "Pune, India",
    role: "Retired Engineer",
    archetype: "aged-man",
    skinTone: "#D99B7E",
    avatarBg: "#EAB84B",
    backdropMotif: "leaves",
    outfitColor: "#D95732",
    outfitPattern: "shawl",
    earrings: "none",
    glasses: true,
    frameShape: "circle",
    hasNotification: true,
    notificationCount: 1,
    note: "Spoke with Listener Priya for 16 mins. BP is 124/80 & took morning Telma 40.",
    badge: "🩺 Morning Call Done",
    theta: 0.0,
    phi: 1.15,
    optIn: "confirmed",
  },
  {
    id: "mum",
    name: "Mum",
    location: "Pune, India",
    role: "Home Gardener",
    archetype: "aged-woman",
    skinTone: "#E5A98A",
    avatarBg: "#F36D89",
    backdropMotif: "leaves",
    outfitColor: "#102F50",
    outfitPattern: "hearts",
    earrings: "hoops",
    glasses: false,
    frameShape: "circle",
    hasNotification: true,
    notificationCount: 1,
    note: "Watered the balcony marigolds and had ginger chai ☕🌼",
    badge: "☕ Balcony Chai Note",
    theta: 1.047,
    phi: 1.52,
    optIn: "confirmed",
  },
  {
    id: "aarav",
    name: "Aarav (you)",
    location: "Bangalore, India",
    role: "Circle Coordinator",
    archetype: "adult-man",
    skinTone: "#D69577",
    avatarBg: "#EAB84B",
    backdropMotif: "clouds",
    outfitColor: "#8B1E3F",
    outfitPattern: "solid",
    earrings: "none",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    note: "Scheduled Dad’s evening check-in & Sunday mango delivery.",
    badge: "✨ Circle Host",
    theta: 2.094,
    phi: 1.25,
    optIn: "confirmed",
  },
  {
    id: "priya",
    name: "Priya",
    location: "London, UK",
    role: "Sister · Architect",
    archetype: "adult-woman",
    skinTone: "#E0A183",
    avatarBg: "#EAB84B",
    backdropMotif: "waves",
    outfitColor: "#A8581B",
    outfitPattern: "solid",
    earrings: "tassels",
    glasses: false,
    frameShape: "circle",
    hasNotification: true,
    notificationCount: 1,
    note: "Sent fresh Alphonso mangoes for Sunday family lunch 🥭",
    badge: "🥭 Sunday Family Share",
    theta: 3.141,
    phi: 1.48,
    optIn: "confirmed",
  },
  {
    id: "rohan",
    name: "Rohan",
    location: "Delhi, India",
    role: "High School Senior",
    archetype: "teenager",
    skinTone: "#BC7A5C",
    avatarBg: "#EAB84B",
    backdropMotif: "stripes",
    outfitColor: "#F36D89",
    outfitPattern: "polka",
    earrings: "stud",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    note: "Just aced my physics mock test! Sent Dada a voice note 🎉",
    badge: "🚀 Aced Physics!",
    theta: 4.188,
    phi: 0.92,
    optIn: "ignored",
  },
  {
    id: "mia",
    name: "Mia",
    location: "London, UK",
    role: "Granddaughter",
    archetype: "child",
    skinTone: "#E8B195",
    avatarBg: "#EAB84B",
    backdropMotif: "leaves",
    outfitColor: "#F36D89",
    outfitPattern: "collar",
    earrings: "pink-hoops",
    glasses: false,
    frameShape: "circle",
    hasNotification: true,
    notificationCount: 1,
    note: "Painted a giant yellow sunshine for Nani & Dada! 🎨",
    badge: "🎨 New Drawing",
    theta: 5.235,
    phi: 1.35,
    optIn: "pending",
  },
];

export function createPreviewGlobeMembers(userProfile?: { display_name?: string | null; timezone?: string | null } | null): GlobeMember[] {
  const hostName = userProfile?.display_name ? `${userProfile.display_name} (You)` : "You (Circle Host)";
  const hostLocation = userProfile?.timezone ? userProfile.timezone.replace("_", " ") : "Your City";
  return [
    {
      id: "preview-host",
      name: hostName,
      location: hostLocation,
      role: "Circle Host",
      archetype: "adult-man",
      skinTone: "#D69577",
      avatarBg: "#EAB84B",
      backdropMotif: "clouds",
      outfitColor: "#8B1E3F",
      outfitPattern: "solid",
      earrings: "none",
      glasses: false,
      frameShape: "circle",
      hasNotification: true,
      notificationCount: 1,
      note: "Ready to start your family circle! Name your circle below to connect loved ones.",
      badge: "✨ Ready to Connect",
      theta: 2.094,
      phi: 1.25,
      optIn: "confirmed",
    },
    ...sampleMembers.filter((m) => m.id !== "aarav"),
  ];
}

export function createGlobeMembersFromFamily(params: {
  family: { id: string; name: string; owner_id: string } | null;
  members: Array<{ id: string; user_id: string; role: string; joined_at?: string; display_name: string | null }>;
  invites?: Array<{ id: string; email?: string | null; invitee_name: string; invitee_phone?: string | null; role: string; status: string; verification_status: string; token: string }>;
  currentUserId?: string;
  userProfile?: { display_name?: string | null; timezone?: string | null } | null;
}): GlobeMember[] {
  if (!params.family) {
    return createPreviewGlobeMembers(params.userProfile);
  }

  const result: GlobeMember[] = [];
  const members = params.members ?? [];
  const invites = (params.invites ?? []).filter((inv) => inv.status !== "revoked");
  const totalCount = members.length + invites.length;

  members.forEach((m, idx) => {
    const isOwner = m.role === "owner";
    const isMe = m.user_id === params.currentUserId;
    const name = m.display_name || (isMe ? "You (Host)" : isOwner ? "Circle Host" : "Family Member");
    const style = globeArchetypes[idx % globeArchetypes.length];
    const theta = (idx * 2 * Math.PI) / Math.max(1, totalCount);
    const phi = 1.05 + ((idx % 3) * 0.24);

    result.push({
      id: m.id,
      name,
      role: isOwner ? "Circle Host" : m.role === "adult" ? "Adult Caregiver" : "Family Member",
      location: isMe && params.userProfile?.timezone ? params.userProfile.timezone.replace("_", " ") : "Circle Member",
      note: isOwner
        ? `${params.family!.name} Circle Host · Keeping everyone connected.`
        : "Active family member · Sharing daily check-ins & care.",
      badge: isOwner ? "👑 Host" : "💚 Active Member",
      optIn: "confirmed",
      hasNotification: isOwner,
      notificationCount: isOwner ? 1 : 0,
      theta,
      phi,
      ...style,
    });
  });

  invites.forEach((inv, idx) => {
    const overallIndex = members.length + idx;
    const name = inv.invitee_name || inv.email || "Invited Loved One";
    const isCallPending = inv.verification_status === "awaiting_call";
    const style = globeArchetypes[overallIndex % globeArchetypes.length];
    const theta = (overallIndex * 2 * Math.PI) / Math.max(1, totalCount);
    const phi = 1.05 + ((overallIndex % 3) * 0.24);

    result.push({
      id: inv.id,
      name,
      role: "Invitation Pending",
      location: inv.invitee_phone || inv.email || "Awaiting consent",
      note: isCallPending
        ? "Care team verification call pending with SomeoneNear care team."
        : `Invitation link generated. Link: ${inv.token}`,
      badge: isCallPending ? "📞 Call Pending" : "✉️ Invited",
      optIn: "pending",
      hasNotification: true,
      notificationCount: 1,
      theta,
      phi,
      isInvite: true,
      inviteToken: inv.token,
      email: inv.email ?? undefined,
      phone: inv.invitee_phone ?? undefined,
      ...style,
    });
  });

  // If there is only 1 member and 0 invites, add a friendly "+ Invite a loved one" preview pin
  if (result.length === 1) {
    result.push({
      id: "invite-placeholder",
      name: "+ Invite a loved one",
      location: "Anywhere in the world",
      role: "Next Family Member",
      archetype: "child",
      skinTone: "#E8B195",
      avatarBg: "#EAB84B",
      backdropMotif: "leaves",
      outfitColor: "#F36D89",
      outfitPattern: "collar",
      earrings: "none",
      glasses: false,
      frameShape: "circle",
      hasNotification: true,
      notificationCount: 1,
      note: "Tap 'Invite family member' below to add parents, siblings, or children to your 3D globe.",
      badge: "💌 Ready to Invite",
      theta: Math.PI,
      phi: 1.35,
      optIn: "pending",
      isInvite: true,
    });
  }

  return result;
}

// Artwork palettes and pin coordinates from the deployed test_front prototype.
export const globeThemes = {
  navy: {
    label: "Deep navy",
    inner: "#1E4A7A",
    mid: "#102F50",
    outer: "#091D34",
    land: "#F36D89",
    coast: "#EAB84B",
    ocean: "#D957326B",
  },
  terracotta: {
    label: "Warm terracotta",
    inner: "#8B1E3F",
    mid: "#5A1228",
    outer: "#2F0814",
    land: "#EAB84B",
    coast: "#FFFDF9",
    ocean: "#F36D8966",
  },
  emerald: {
    label: "Garden sage",
    inner: "#245E4E",
    mid: "#133C31",
    outer: "#09221B",
    land: "#EAB84B",
    coast: "#F36D89",
    ocean: "#FFFDF959",
  },
};
export type GlobeConfig = { theme: keyof typeof globeThemes; speed: number; rings: boolean };
export const defaultGlobeConfig: GlobeConfig = { theme: "navy", speed: 1, rings: true };
export type Point = { x: number; y: number; z: number };
// Directly preserves the supplied ThreeJsFamilyStage camera/group projection.
export function createGlobeProjection() {
  const camera = new PerspectiveCamera(42, 540 / 395, 0.1, 100);
  camera.position.set(0, 0, 4.3);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const group = new Group();
  let width = 540,
    height = 395;
  return {
    update(nextWidth: number, nextHeight: number, zoom: number, yaw: number, pitch: number) {
      width = nextWidth;
      height = nextHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      group.scale.setScalar(zoom);
      group.rotation.y = yaw;
      group.rotation.x = pitch;
      group.updateMatrixWorld(true);
    },
    project(point: Point) {
      const world = new Vector3(point.x, point.y, point.z).applyMatrix4(group.matrixWorld);
      const ndc = world.clone().project(camera);
      return {
        x: (ndc.x * 0.5 + 0.5) * width,
        y: (-ndc.y * 0.5 + 0.5) * height,
        z: world.z,
        visible: world.z > -0.12,
      };
    },
  };
}

export function memberPoint(member: Pick<GlobeMember, "phi" | "theta">): Point {
  return {
    x: 1.28 * Math.sin(member.phi) * Math.sin(member.theta),
    y: 1.28 * Math.cos(member.phi),
    z: 1.28 * Math.sin(member.phi) * Math.cos(member.theta),
  };
}

// This changing core inside the outer dot shell is part of the supplied design.
export function projectedCoreRadius(edge: { x: number; y: number }, width: number, height: number) {
  const distance = Math.hypot(edge.x - width / 2, edge.y - height / 2);
  return Number.isFinite(distance) && distance > 10 ? Math.max(85, distance) : 130;
}
