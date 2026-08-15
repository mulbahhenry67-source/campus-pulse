import {
  personalityScore,
  interestScore,
  goalScore,
  lifestyleScore,
  educationScore,
  scheduleScore,
  distanceScore,
  haversineDistanceKm,
  computeCompatibility,
  DEFAULT_WEIGHTS,
  MatchCandidate,
} from "../src/modules/matching/matching.algorithm";

describe("personalityScore", () => {
  it("returns 100 for identical personalities", () => {
    const p = { openness: 80, conscientiousness: 60, extraversion: 40, agreeableness: 70, neuroticism: 30 };
    expect(personalityScore(p, p)).toBe(100);
  });

  it("returns a lower score for very different personalities", () => {
    const a = { openness: 90, conscientiousness: 90, extraversion: 90, agreeableness: 90, neuroticism: 90 };
    const b = { openness: 10, conscientiousness: 10, extraversion: 10, agreeableness: 10, neuroticism: 10 };
    expect(personalityScore(a, b)).toBe(20); // avg diff 80 -> 100-80
  });

  it("returns neutral 50 when there is no overlapping trait data", () => {
    expect(personalityScore({}, {})).toBe(50);
  });
});

describe("interestScore", () => {
  it("returns 100 for identical interest sets", () => {
    const { score } = interestScore(["a", "b", "c"], ["a", "b", "c"]);
    expect(score).toBe(100);
  });

  it("returns 0 for completely disjoint sets", () => {
    const { score } = interestScore(["a", "b"], ["c", "d"]);
    expect(score).toBe(0);
  });

  it("computes Jaccard similarity for partial overlap", () => {
    const { score, shared } = interestScore(["a", "b", "c"], ["b", "c", "d"]);
    // intersection {b,c} = 2, union {a,b,c,d} = 4 -> 50%
    expect(score).toBe(50);
    expect(shared.sort()).toEqual(["b", "c"]);
  });
});

describe("goalScore", () => {
  it("scores identical goals as fully compatible", () => {
    expect(goalScore("serious", "serious")).toBe(100);
  });

  it("scores serious vs casual as low compatibility", () => {
    expect(goalScore("serious", "casual")).toBeLessThan(30);
  });

  it("treats not_sure as broadly compatible", () => {
    expect(goalScore("not_sure", "serious")).toBeGreaterThanOrEqual(60);
  });
});

describe("lifestyleScore", () => {
  it("returns 100 when all shared lifestyle answers match", () => {
    const a = { smoking: "never", drinking: "socially" };
    const b = { smoking: "never", drinking: "socially" };
    expect(lifestyleScore(a, b)).toBe(100);
  });

  it("returns a partial score for partial agreement", () => {
    const a = { smoking: "never", drinking: "socially" };
    const b = { smoking: "never", drinking: "often" };
    expect(lifestyleScore(a, b)).toBe(50);
  });
});

describe("educationScore", () => {
  it("scores highest when both school and major match", () => {
    const a = { schoolId: "s1", majorId: "m1" };
    expect(educationScore(a, a)).toBe(100);
  });

  it("gives a moderate score when only the school matches", () => {
    const a = { schoolId: "s1", majorId: "m1" };
    const b = { schoolId: "s1", majorId: "m2" };
    expect(educationScore(a, b)).toBe(75);
  });
});

describe("scheduleScore", () => {
  it("finds overlapping availability on the same day", () => {
    const a = [{ dayOfWeek: 5, startMinutes: 16 * 60, endMinutes: 20 * 60 }]; // Fri 4-8pm
    const b = [{ dayOfWeek: 5, startMinutes: 17 * 60, endMinutes: 19 * 60 }]; // Fri 5-7pm
    const { score, overlaps } = scheduleScore(a, b);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toEqual({ dayOfWeek: 5, startMinutes: 17 * 60, endMinutes: 19 * 60 });
    expect(score).toBeGreaterThan(0);
  });

  it("returns zero overlap for non-overlapping days", () => {
    const a = [{ dayOfWeek: 1, startMinutes: 600, endMinutes: 700 }];
    const b = [{ dayOfWeek: 2, startMinutes: 600, endMinutes: 700 }];
    const { score, overlaps } = scheduleScore(a, b);
    expect(overlaps).toHaveLength(0);
    expect(score).toBe(0);
  });
});

describe("haversineDistanceKm", () => {
  it("returns ~0 for identical coordinates", () => {
    expect(haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006)).toBeCloseTo(0, 3);
  });

  it("returns a sane distance between two known cities (NYC to Philadelphia, ~130km)", () => {
    const d = haversineDistanceKm(40.7128, -74.006, 39.9526, -75.1652);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(160);
  });
});

describe("distanceScore", () => {
  it("returns 0 when distance exceeds both users' max preference", () => {
    const a = { latitude: 40.7128, longitude: -74.006, maxDistanceKm: 10 };
    const b = { latitude: 39.9526, longitude: -75.1652, maxDistanceKm: 10 };
    const { score } = distanceScore(a, b);
    expect(score).toBe(0);
  });

  it("returns neutral score when coordinates are missing", () => {
    const a = { maxDistanceKm: 50 };
    const b = { latitude: 40, longitude: -74, maxDistanceKm: 50 };
    const { score, distanceKm } = distanceScore(a, b);
    expect(score).toBe(50);
    expect(distanceKm).toBeNull();
  });
});

describe("computeCompatibility (integration of sub-scores)", () => {
  function makeCandidate(overrides: Partial<MatchCandidate>): MatchCandidate {
    return {
      userId: "u1",
      personality: { openness: 70, conscientiousness: 60, extraversion: 50, agreeableness: 60, neuroticism: 40 },
      interestIds: ["football", "gaming"],
      interestNames: ["Football", "Gaming"],
      relationshipGoal: "serious",
      lifestyle: { smoking: "never" },
      schoolId: "school-1",
      majorId: "major-1",
      latitude: 40.7128,
      longitude: -74.006,
      maxDistanceKm: 50,
      availability: [{ dayOfWeek: 5, startMinutes: 16 * 60, endMinutes: 20 * 60 }],
      ...overrides,
    };
  }

  it("gives near-perfect compatibility for near-identical profiles", () => {
    const a = makeCandidate({ userId: "a" });
    const b = makeCandidate({ userId: "b" });
    const result = computeCompatibility(a, b, DEFAULT_WEIGHTS);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("produces a human-readable factor for shared interests", () => {
    const a = makeCandidate({ userId: "a" });
    const b = makeCandidate({ userId: "b" });
    const result = computeCompatibility(a, b, DEFAULT_WEIGHTS);
    expect(result.factors.some((f) => f.toLowerCase().includes("football"))).toBe(true);
  });

  it("scores stay within 0-100 bounds regardless of weight configuration", () => {
    const a = makeCandidate({ userId: "a" });
    const b = makeCandidate({
      userId: "b",
      personality: { openness: 5, conscientiousness: 5, extraversion: 95, agreeableness: 5, neuroticism: 95 },
      interestIds: ["anime"],
      interestNames: ["Anime"],
      relationshipGoal: "casual",
      schoolId: "school-2",
      majorId: "major-2",
      latitude: -33.8688,
      longitude: 151.2093, // Sydney — far from NYC
    });
    const result = computeCompatibility(a, b, DEFAULT_WEIGHTS);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("respects custom admin-configured weights (distance-only weighting)", () => {
    const closeWeights = { personality: 0, interests: 0, goals: 0, lifestyle: 0, education: 0, schedule: 0, distance: 1 };
    const a = makeCandidate({ userId: "a", latitude: 40.7128, longitude: -74.006, maxDistanceKm: 500 });
    const near = makeCandidate({ userId: "b", latitude: 40.73, longitude: -74.0, maxDistanceKm: 500 });
    const far = makeCandidate({ userId: "c", latitude: -33.8688, longitude: 151.2093, maxDistanceKm: 500 });

    const nearResult = computeCompatibility(a, near, closeWeights);
    const farResult = computeCompatibility(a, far, closeWeights);
    expect(nearResult.score).toBeGreaterThan(farResult.score);
  });
});
