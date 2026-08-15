import { Router } from "express";
import { authController } from "./auth.controller";
import { validateBody } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { authRateLimiter } from "../../middleware/security";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
} from "./auth.validators";

export const authRouter = Router();

// Public endpoints — rate limited to blunt brute-force / credential-stuffing.
authRouter.post("/register", authRateLimiter, validateBody(registerSchema), authController.register);
authRouter.post("/login", authRateLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/verify-email", authRateLimiter, validateBody(verifyEmailSchema), authController.verifyEmail);
authRouter.post("/refresh", authRateLimiter, validateBody(refreshSchema.partial()), authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  "/reset-password",
  authRateLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

// Authenticated endpoints.
authRouter.get("/me", authenticate, authController.me);
authRouter.post("/logout-all", authenticate, authController.logoutAll);
authRouter.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword,
);
authRouter.delete("/account", authenticate, authController.deleteAccount);
