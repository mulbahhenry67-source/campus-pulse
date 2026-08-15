import { z } from "zod";

const personalitySchema = z
  .object({
    openness: z.number().min(0).max(100).optional(),
    conscientiousness: z.number().min(0).max(100).optional(),
    extraversion: z.number().min(0).max(100).optional(),
    agreeableness: z.number().min(0).max(100).optional(),
    neuroticism: z.number().min(0).max(100).optional(),
  })
  .partial();

const lifestyleSchema = z.record(z.string(), z.string()).refine((obj) => Object.keys(obj).length <= 20, {
  message: "Too many lifestyle keys",
});

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  gender: z.string().max(30).optional(),
  genderPreference: z.array(z.string().max(30)).max(10).optional(),
  schoolId: z.string().uuid().nullable().optional(),
  majorId: z.string().uuid().nullable().optional(),
  academicYear: z.enum(["freshman", "sophomore", "junior", "senior", "graduate", "alumni"]).optional(),
  relationshipGoal: z.enum(["serious", "casual", "friendship", "new_connections", "not_sure"]).optional(),
  personality: personalitySchema.optional(),
  lifestyle: lifestyleSchema.optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  minAgePreference: z.number().int().min(18).max(120).optional(),
  maxAgePreference: z.number().int().min(18).max(120).optional(),
  maxDistanceKm: z.number().int().min(1).max(500).optional(),
  discoverable: z.boolean().optional(),
  showDistance: z.boolean().optional(),
});

export const setInterestsSchema = z.object({
  interestIds: z.array(z.string().uuid()).max(30),
});

export const addPhotoSchema = z.object({
  url: z.string().url(),
  isPrimary: z.boolean().optional().default(false),
});

export const reorderPhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()),
});
