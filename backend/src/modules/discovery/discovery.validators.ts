import { z } from "zod";

export const discoverQuerySchema = z.object({
  minAge: z.coerce.number().min(18).max(120).optional(),
  maxAge: z.coerce.number().min(18).max(120).optional(),
  maxDistanceKm: z.coerce.number().min(1).max(500).optional(),
  schoolId: z.string().uuid().optional(),
  majorId: z.string().uuid().optional(),
  relationshipGoal: z.enum(["serious", "casual", "friendship", "new_connections", "not_sure"]).optional(),
  interestIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .optional()
    .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : [v])),
  verifiedOnly: z.coerce.boolean().optional(),
  minCompatibility: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});
