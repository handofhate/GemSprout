export type DailyComboTaskOrder = {
  id?: unknown;
  gems?: unknown;
  diamonds?: unknown;
  title?: unknown;
};

// Firestore collection reads do not promise the same order as the client task list.
// Use the app's visible task order before applying the seeded daily shuffle.
export function compareDailyComboTasks(left: DailyComboTaskOrder, right: DailyComboTaskOrder): number {
  const byGems = Number(left.gems ?? left.diamonds ?? 0) - Number(right.gems ?? right.diamonds ?? 0);
  if (byGems !== 0) return byGems;
  const byTitle = String(left.title || '').localeCompare(String(right.title || ''));
  if (byTitle !== 0) return byTitle;
  return String(left.id || '').localeCompare(String(right.id || ''));
}
