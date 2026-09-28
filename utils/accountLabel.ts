/**
 * accountLabel.ts — the line under "Signed in" on the Profile screen.
 *
 * Apple may share no email at all, and the auth API reports that as `""`
 * rather than null. An empty string has to count as missing, or the line
 * renders blank.
 */
export function accountLabel(linked: {
  email: string | null;
  hasApple: boolean;
  hasGoogle: boolean;
}): string {
  const email = linked.email?.trim();
  if (email) return email;
  if (linked.hasApple) return "Apple account";
  if (linked.hasGoogle) return "Google account";
  return "Cruxe account";
}
