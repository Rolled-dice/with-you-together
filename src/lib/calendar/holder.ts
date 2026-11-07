export type ConnectedHolder = { user_id: string; calendar_id: string };
export type FamilyAdultLink = { admin_user_id: string; member_user_id: string };

export function resolveHolder(input: {
  forUserId: string;
  connected: ConnectedHolder[];
  familyAdults: FamilyAdultLink[];
}): ConnectedHolder | null {
  const connectedById = new Map(input.connected.map((c) => [c.user_id, c]));

  const adminLink = input.familyAdults.find(
    (l) => l.member_user_id === input.forUserId && connectedById.has(l.admin_user_id),
  );
  if (adminLink) return connectedById.get(adminLink.admin_user_id)!;

  return connectedById.get(input.forUserId) ?? null;
}
