/**
 * Campus Pulse compatibility algorithm.
 *
 * Deliberately pure and side-effect-free: no DB, no I/O. Each sub-score is
 * 0-100 and independently unit-testable. `computeCompatibility` combines them
 * using admin-configurable weights and also returns a human-readable list of
 * "why you matched" factors, which the API surfaces directly (see section 7
 * of the spec: "explain major compatibility factors").
 *
 * The output is explicitly an application-generated estimate, not a claim of
 * scientific accuracy — the API response includes that framing (see
 * discovery.controller.ts / matching.service.ts).
 */

export interface PersonalityScores {
  openness?: number; // 0-100
  conscientiousness?: number;
  extraversion?: number;
  agreeableness?: number;
  neuroticism?: number;
}

export interface LifestyleAnswers {
  smoking?: string;
  drinking?: string;
  exercise?: string;
  diet?: string;
  sleep_schedule?: string;
  [key: string]: string | undefined;
}

export interface AvailabilityBlock {
  dayOfWeek: number; // 0-6, 0 = Sunday
  startMinutes: number; // minutes since midnight
  endMinutes: number;
}

export interface MatchCandidate {
  userId: string;
  personality: PersonalityScores;
  interestIds: string[];
  interestNames: string[]; // parallel to interestIds, for explanation text
  relationshipGoal?: string | null;
  lifestyle: LifestyleAnswers;
  schoolId?: string | null;
  majorId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxDistanceKm: number;
  availability: AvailabilityBlock[];
}

export interface MatchingWeights {
  personality: number;
  interests: number;
  goals: number;
  lifestyle: number;
  education: number;
  schedule: number;
  distance: number;
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  personality: 0.25,
  interests: 0.2,
  goals: 0.2,
  lifestyle: 0.1,
  education: 0.05,
  schedule: 0.1,
  distance: 0.1,
};

export interface CompatibilityResult {
  score: number; // 0-100, rounded
  breakdown: Record<keyof MatchingWeights, number>; // each sub-score 0-100
  factors: string[]; // human-readable "you both..." explanations
}

// ----------------------------------------------------------------------
// Sub-scores
// ----------------------------------------------------------------------

const PERSONALITY_TRAITS: (keyof PersonalityScores)[] = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
];

export function personalityScore(a: PersonalityScores, b: PersonalityScores): number {
  const shared = PERSONALITY_TRAITS.filter((t) => a[t] != null && b[t] != null);
  if (shared.length === 0) return 50; // neutral when data is missing
  const totalDiff = shared.reduce((sum, t) => sum + Math.abs((a[t] as number) - (b[t] as number)), 0);
  const avgDiff = totalDiff / shared.length; // 0-100
  return clamp(100 - avgDiff);
}

export function interestScore(a: string[], b: string[]): { score: number; shared: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return { score: 50, shared: [] };
  const shared = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  const jaccard = shared.length / union.size;
  return { score: clamp(jaccard * 100), shared };
}

const GOAL_COMPATIBILITY: Record<string, Record<string, number>> = {
  serious: { serious: 100, casual: 20, friendship: 30, new_connections: 40, not_sure: 60 },
  casual: { serious: 20, casual: 100, friendship: 50, new_connections: 70, not_sure: 65 },
  friendship: { serious: 30, casual: 50, friendship: 100, new_connections: 70, not_sure: 60 },
  new_connections: { serious: 40, casual: 70, friendship: 70, new_connections: 100, not_sure: 75 },
  not_sure: { serious: 60, casual: 65, friendship: 60, new_connections: 75, not_sure: 70 },
};

export function goalScore(a?: string | null, b?: string | null): number {
  if (!a || !b) return 50;
  return GOAL_COMPATIBILITY[a]?.[b] ?? 50;
}

export function lifestyleScore(a: LifestyleAnswers, b: LifestyleAnswers): number {
  const keys = Object.keys(a).filter((k) => a[k] != null && b[k] != null);
  if (keys.length === 0) return 50;
  const matches = keys.filter((k) => a[k] === b[k]).length;
  return clamp((matches / keys.length) * 100);
}

export function educationScore(
  a: { schoolId?: string | null; majorId?: string | null },
  b: { schoolId?: string | null; majorId?: string | null },
): number {
  let score = 40; // baseline for "different everything but both students"
  if (a.schoolId && b.schoolId && a.schoolId === b.schoolId) score += 35;
  if (a.majorId && b.majorId && a.majorId === b.majorId) score += 25;
  return clamp(score);
}

/** Overlap in weekly recurring availability, as a fraction of each person's total free time. */
export function scheduleScore(
  a: AvailabilityBlock[],
  b: AvailabilityBlock[],
): { score: number; overlaps: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] } {
  if (a.length === 0 || b.length === 0) return { score: 50, overlaps: [] };

  const overlaps: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] = [];
  let overlapMinutes = 0;

  for (const blockA of a) {
    for (const blockB of b) {
      if (blockA.dayOfWeek !== blockB.dayOfWeek) continue;
      const start = Math.max(blockA.startMinutes, blockB.startMinutes);
      const end = Math.min(blockA.endMinutes, blockB.endMinutes);
      if (end > start) {
        overlapMinutes += end - start;
        overlaps.push({ dayOfWeek: blockA.dayOfWeek, startMinutes: start, endMinutes: end });
      }
    }
  }

  const totalA = a.reduce((s, x) => s + (x.endMinutes - x.startMinutes), 0);
  const totalB = b.reduce((s, x) => s + (x.endMinutes - x.startMinutes), 0);
  const avgTotal = (totalA + totalB) / 2;
  if (avgTotal === 0) return { score: 50, overlaps: [] };

  const score = clamp((overlapMinutes / avgTotal) * 100);
  return { score, overlaps };
}

/** Great-circle distance in km. */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function distanceScore(
  a: { latitude?: number | null; longitude?: number | null; maxDistanceKm: number },
  b: { latitude?: number | null; longitude?: number | null; maxDistanceKm: number },
): { score: number; distanceKm: number | null } {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return { score: 50, distanceKm: null };
  }
  const distanceKm = haversineDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
  const maxAcceptable = Math.min(a.maxDistanceKm, b.maxDistanceKm);
  if (distanceKm > maxAcceptable) return { score: 0, distanceKm };
  const score = clamp(100 - (distanceKm / maxAcceptable) * 100);
  return { score, distanceKm };
}

// ----------------------------------------------------------------------
// Combined score
// ----------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

export function computeCompatibility(
  a: MatchCandidate,
  b: MatchCandidate,
  weights: MatchingWeights = DEFAULT_WEIGHTS,
): CompatibilityResult {
  const personality = personalityScore(a.personality, b.personality);
  const interests = interestScore(a.interestIds, b.interestIds);
  const goals = goalScore(a.relationshipGoal, b.relationshipGoal);
  const lifestyle = lifestyleScore(a.lifestyle, b.lifestyle);
  const education = educationScore(a, b);
  const schedule = scheduleScore(a.availability, b.availability);
  const distance = distanceScore(a, b);

  const weightSum =
    weights.personality +
    weights.interests +
    weights.goals +
    weights.lifestyle +
    weights.education +
    weights.schedule +
    weights.distance;

  const raw =
    personality * weights.personality +
    interests.score * weights.interests +
    goals * weights.goals +
    lifestyle * weights.lifestyle +
    education * weights.education +
    schedule.score * weights.schedule +
    distance.score * weights.distance;

  const score = Math.round(clamp(raw / (weightSum || 1)));

  const factors: string[] = [];

  if (interests.shared.length > 0) {
    const nameMap = new Map(a.interestIds.map((id, i) => [id, a.interestNames[i]]));
    const names = interests.shared.map((id) => nameMap.get(id)).filter(Boolean).slice(0, 3);
    if (names.length === 1) factors.push(`You both enjoy ${names[0]}`);
    else if (names.length > 1) factors.push(`You both enjoy ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
  }

  if (a.relationshipGoal && a.relationshipGoal === b.relationshipGoal) {
    factors.push(`You have the same relationship goal: ${a.relationshipGoal.replace("_", " ")}`);
  } else if (goals >= 70) {
    factors.push("Your relationship goals are compatible");
  }

  if (a.schoolId && a.schoolId === b.schoolId) factors.push("You attend the same school");
  if (a.majorId && a.majorId === b.majorId) factors.push("You're in the same major");

  if (schedule.overlaps.length > 0) {
    const first = schedule.overlaps[0];
    factors.push(
      `You're both free ${DAY_NAMES[first.dayOfWeek]} from ${formatTime(first.startMinutes)} to ${formatTime(first.endMinutes)}`,
    );
  }

  if (distance.distanceKm != null && distance.distanceKm < 5) {
    factors.push("You're nearby each other");
  }

  return {
    score,
    breakdown: {
      personality: Math.round(personality),
      interests: Math.round(interests.score),
      goals: Math.round(goals),
      lifestyle: Math.round(lifestyle),
      education: Math.round(education),
      schedule: Math.round(schedule.score),
      distance: Math.round(distance.score),
    },
    factors,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
