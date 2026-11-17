export type Role = "TENANT" | "OWNER" | "ADMIN";
export type RoomType = "SINGLE" | "DOUBLE" | "SHARED" | "STUDIO" | "APARTMENT";
export type Furnishing = "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
export type ListingStatus = "ACTIVE" | "FILLED";
export type GenderPreference = "ANY" | "MALE" | "FEMALE";
export type SleepSchedule = "EARLY_BIRD" | "NIGHT_OWL" | "FLEXIBLE";
export type WorkSchedule = "OFFICE" | "REMOTE" | "HYBRID" | "SHIFTS" | "STUDENT";
export type FoodPreference = "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN" | "EGGETARIAN" | "NO_PREFERENCE";
export type SmokingHabit = "NON_SMOKER" | "OCCASIONAL" | "SMOKER";
export type RoomSharing = "PRIVATE_ROOM" | "SHARED_ROOM" | "ENTIRE_PLACE" | "NO_PREFERENCE";
export type InterestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface Photo {
  id: string;
  url: string;
  altText?: string | null;
  order: number;
}

export interface PublicOwner {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface CompatibilitySummary {
  score: number;
  explanation: string;
  computedVia: "LLM" | "FALLBACK";
}

export interface FactorResult {
  key: string;
  label: string;
  points: number;
  max: number;
  status: "match" | "partial" | "conflict";
  detail: string;
}

export interface Compatibility extends CompatibilitySummary {
  computedAt: string;
  factors: {
    breakdown: FactorResult[];
    notAssessed: string[];
    positives: string[];
    conflicts: string[];
    recommendations: string[];
    ruleBasedScore?: number;
    model?: string;
  } | null;
}

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  location: string;
  locality: string | null;
  address: string | null;
  rent: number;
  deposit: number | null;
  availableFrom: string;
  roomType: RoomType;
  furnishingStatus: Furnishing;
  amenities: string[];
  rules: string[];
  maxOccupants: number;
  status: ListingStatus;
  genderPreference: GenderPreference;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  foodPolicy: FoodPreference | null;
  householdSleepSchedule: SleepSchedule | null;
  householdCleanliness: number | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
  owner?: PublicOwner;
  isSaved?: boolean;
  compatibility?: CompatibilitySummary | Compatibility | null;
}

export interface OwnerListing extends Listing {
  pendingInterests: number;
  _count: { interestRequests: number; savedBy: number };
}

export interface TenantProfile {
  id: string;
  userId: string;
  preferredLocation: string;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
  occupation: string | null;
  lifestyle: string | null;
  bio: string | null;
  cleanliness: number | null;
  sleepSchedule: SleepSchedule | null;
  workSchedule: WorkSchedule | null;
  foodPreference: FoodPreference | null;
  smoking: SmokingHabit | null;
  hasPets: boolean | null;
  roomSharing: RoomSharing | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  tempId?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ConversationSummary {
  id: string;
  otherUser: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; online: boolean };
  listing: { id: string; title: string; photoUrl: string | null };
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}
