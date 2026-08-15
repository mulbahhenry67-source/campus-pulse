import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
  captchaToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(10).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
