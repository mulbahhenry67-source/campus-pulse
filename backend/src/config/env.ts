import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: z.enum(["true","false"]).default("false").transform(v => v === "true"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be set and reasonably long"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be set and reasonably long"),
  JWT_ACCESS_TTL_MIN: z.coerce.number().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(15).default(12),

  MIN_AGE_YEARS: z.coerce.number().min(13).default(18),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  APP_URL: z.string().default("http://localhost:5173"),
  API_URL: z.string().default("http://localhost:4000"),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Campus Pulse <no-reply@campuspulse.app>"),

  AUTH_RATE_LIMIT_WINDOW_MIN: z.coerce.number().default(15),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),

  CAPTCHA_PROVIDER: z.enum(["none", "turnstile", "hcaptcha"]).default("none"),
  CAPTCHA_SECRET_KEY: z.string().optional(),

  LOG_LEVEL: z.string().default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsAllowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
};
