const SYDNEY_TZ = "Australia/Sydney";
const LOCALE = "en-AU";

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/** Time only: 14:23:45 */
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: SYDNEY_TZ,
  });
}

/** Full date+time: 7 Feb 2026, 14:23:45 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: SYDNEY_TZ,
  });
}

/** Short date+time: 7 Feb, 14:23 */
export function formatDateTimeShort(dateString: string): string {
  return new Date(dateString).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SYDNEY_TZ,
  });
}

/** Date only: 7 Feb 2026 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SYDNEY_TZ,
  });
}

/** Current timestamp string for log display */
export function sydneyTimestamp(): string {
  return new Date().toLocaleString(LOCALE, {
    timeZone: SYDNEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
