import type {
  FoodPreference,
  Furnishing,
  GenderPreference,
  RoomSharing,
  RoomType,
  SleepSchedule,
  SmokingHabit,
  WorkSchedule,
} from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatCurrency = (n: number) => inr.format(n);

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(d).toLocaleDateString("en-IN", opts);
}

export function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d: string | Date): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d, { day: "numeric", month: "short" });
}

/** "Available now" / "From 12 Dec" */
export function availability(d: string): string {
  const date = new Date(d);
  return date.getTime() <= Date.now() ? "Available now" : `From ${formatDate(date, { day: "numeric", month: "short" })}`;
}

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  SINGLE: "Single room",
  DOUBLE: "Double room",
  SHARED: "Shared room",
  STUDIO: "Studio",
  APARTMENT: "Entire apartment",
};

export const FURNISHING_LABEL: Record<Furnishing, string> = {
  FURNISHED: "Furnished",
  SEMI_FURNISHED: "Semi-furnished",
  UNFURNISHED: "Unfurnished",
};

export const GENDER_LABEL: Record<GenderPreference, string> = {
  ANY: "Open to all",
  MALE: "Male flatmates",
  FEMALE: "Female flatmates",
};

export const SLEEP_LABEL: Record<SleepSchedule, string> = {
  EARLY_BIRD: "Early bird",
  NIGHT_OWL: "Night owl",
  FLEXIBLE: "Flexible",
};

export const WORK_LABEL: Record<WorkSchedule, string> = {
  OFFICE: "Office",
  REMOTE: "Work from home",
  HYBRID: "Hybrid",
  SHIFTS: "Shift work",
  STUDENT: "Student",
};

export const FOOD_LABEL: Record<FoodPreference, string> = {
  VEGETARIAN: "Vegetarian",
  NON_VEGETARIAN: "Non-vegetarian",
  VEGAN: "Vegan",
  EGGETARIAN: "Eggetarian",
  NO_PREFERENCE: "No preference",
};

export const SMOKING_LABEL: Record<SmokingHabit, string> = {
  NON_SMOKER: "Non-smoker",
  OCCASIONAL: "Occasional smoker",
  SMOKER: "Smoker",
};

export const ROOM_SHARING_LABEL: Record<RoomSharing, string> = {
  PRIVATE_ROOM: "Private room",
  SHARED_ROOM: "Shared room is fine",
  ENTIRE_PLACE: "Entire place",
  NO_PREFERENCE: "No preference",
};

export const CLEANLINESS_LABEL = ["", "Relaxed", "Easy-going", "Average", "Tidy", "Very tidy"];

export const AMENITIES = [
  "wifi", "ac", "washing-machine", "power-backup", "parking", "gym", "security", "elevator",
  "kitchen-access", "laundry", "balcony", "swimming-pool", "housekeeping", "geyser", "tv", "fridge",
] as const;

export function humanize(slug: string): string {
  const special: Record<string, string> = { wifi: "Wi-Fi", ac: "Air conditioning", tv: "TV" };
  if (special[slug]) return special[slug];
  const s = slug.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(first?: string, last?: string) {
  return `${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase() || "?";
}

export function scoreTone(score: number): { label: string; className: string; ring: string } {
  if (score >= 80) return { label: "Excellent match", className: "text-success", ring: "stroke-success" };
  if (score >= 60) return { label: "Good match", className: "text-primary", ring: "stroke-primary" };
  if (score >= 40) return { label: "Fair match", className: "text-warning", ring: "stroke-warning" };
  return { label: "Low match", className: "text-destructive", ring: "stroke-destructive" };
}
