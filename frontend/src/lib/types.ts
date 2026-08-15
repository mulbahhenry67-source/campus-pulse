export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

export interface Profile {
  user_id: string;
  bio: string;
  gender: string | null;
  gender_preference: string[];
  school_id: string | null;
  major_id: string | null;
  academic_year: string | null;
  relationship_goal: string | null;
  personality: Record<string, number>;
  lifestyle: Record<string, string>;
  latitude: number | null;
  longitude: number | null;
  min_age_preference: number;
  max_age_preference: number;
  max_distance_km: number;
  discoverable: boolean;
  show_distance: boolean;
  onboarding_completed_at: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  verified: boolean;
}

export interface Interest {
  id: string;
  name: string;
  category: string;
}

export interface Photo {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
}

export interface AvailabilityBlock {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DiscoverResult {
  userId: string;
  firstName: string;
  age: number;
  bio: string;
  verified: boolean;
  photoUrl: string | null;
  relationshipGoal: string | null;
  distanceKm: number | null;
  compatibility: { score: number; factors: string[]; note: string };
}

export interface MatchSummary {
  id: string;
  other_user_id: string;
  matched_at: string;
  first_name: string;
  photo_url: string | null;
}

export interface ConversationSummary {
  match_id: string;
  other_user_id: string;
  first_name: string;
  photo_url: string | null;
  last_message_at: string;
  last_message: { content: string | null; imageUrl: string | null; senderId: string; createdAt: string } | null;
  unread_count: number;
  online: boolean;
}

export interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
  reactions: { emoji: string; userId: string }[];
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  rules?: string;
  category: string | null;
  member_count: number;
  joined: boolean;
}

export interface CommunityPost {
  id: string;
  content: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  author_name: string;
  liked_by_me: boolean;
}

export interface PostComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
}

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const DATE_ACTIVITIES = ["coffee", "restaurant", "walk", "study_session", "gaming", "sports", "movie", "campus_event", "other"] as const;

export interface DatePlan {
  id: string;
  match_id: string;
  proposed_by: string;
  activity: (typeof DATE_ACTIVITIES)[number];
  custom_activity: string | null;
  proposed_date: string;
  proposed_time: string;
  location_note: string | null;
  status: "proposed" | "confirmed" | "declined" | "cancelled";
  confirmed_by_proposer: boolean;
  confirmed_by_recipient: boolean;
  created_at: string;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  verifiedUsers: number;
  totalMatches: number;
  totalMessages: number;
  pendingReports: number;
  suspendedUsers: number;
  deletedAccounts: number;
  communityPosts: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  email_verified_at: string | null;
  student_verified_at: string | null;
  created_at: string;
}

export interface AdminReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: string;
  moderator_notes: string | null;
  created_at: string;
  reporter_name: string;
  reporter_email: string;
}

export interface AdminVerificationRow {
  id: string;
  method: "school_email" | "student_id";
  school_email: string | null;
  student_id_image_url: string | null;
  status: string;
  created_at: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const RELATIONSHIP_GOALS = ["serious", "casual", "friendship", "new_connections", "not_sure"] as const;
export const ACADEMIC_YEARS = ["freshman", "sophomore", "junior", "senior", "graduate", "alumni"] as const;
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
