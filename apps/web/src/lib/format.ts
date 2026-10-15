const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: string | Date) {
  return dateFormat.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: string | Date) {
  return dateTimeFormat.format(typeof value === "string" ? new Date(value) : value);
}

/** Kalenderdatum `YYYY-MM-DD` ohne Zeitzonenverschiebung formatieren. */
export function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormat.format(new Date(year!, month! - 1, day!));
}

export function ageFromIsoDate(value: string, today = new Date()) {
  const [year, month, day] = value.split("-").map(Number);
  let age = today.getFullYear() - year!;
  if (
    today.getMonth() + 1 < month! ||
    (today.getMonth() + 1 === month! && today.getDate() < day!)
  ) {
    age -= 1;
  }
  return age;
}

const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
