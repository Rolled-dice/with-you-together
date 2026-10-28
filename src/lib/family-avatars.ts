export const FAMILY_AVATARS = Array.from(
  { length: 12 },
  (_, index) => `/family-avatars.png#avatar-${index + 1}`,
);

export function familyAvatarIndex(value?: string | null) {
  return value ? FAMILY_AVATARS.indexOf(value) : -1;
}
