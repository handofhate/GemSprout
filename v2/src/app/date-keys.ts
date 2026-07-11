export function todayKeyForTimezone(timezone?: string, now: Date | number = new Date()): string {
  const date = now instanceof Date ? now : new Date(now);
  if (timezone) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
    } catch {
      // Fall through to the device-local date if a stored timezone is invalid.
    }
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayIndexForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getDay();
}
