import { z } from "zod";

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(2000).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((v) => v.content || v.imageUrl, { message: "A message needs content or an image." });

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

export const reportMessageSchema = z.object({
  reason: z.enum(["harassment", "spam", "fake_profile", "scam", "inappropriate_content", "impersonation", "other"]),
  description: z.string().max(1000).optional(),
});
