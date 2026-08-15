import { Request, Response } from "express";
import { authService } from "./auth.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";
import { verifyCaptcha } from "../../utils/captcha";

function deviceContext(req: Request) {
  return { userAgent: req.headers["user-agent"], ipAddress: req.ip };
}

/** Refresh token is delivered as an httpOnly cookie, not readable by JS. */
function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

export const authController = {
  register: asyncHandler(async (req, res) => {
    await verifyCaptcha(req.body.captchaToken, req.ip);
    const result = await authService.register(req.body, deviceContext(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.body.token);
    res.json(result);
  }),

  login: asyncHandler(async (req, res) => {
    await verifyCaptcha(req.body.captchaToken, req.ip);
    const { email, password } = req.body;
    const result = await authService.login(email, password, deviceContext(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  }),

  refresh: asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (!token) throw new AppError(401, "MISSING_REFRESH_TOKEN", "No refresh token provided.");
    const result = await authService.refresh(token, deviceContext(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  }),

  logout: asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (token) await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).send();
  }),

  logoutAll: asyncHandler(async (req, res) => {
    await authService.logoutAllSessions(req.user!.id);
    clearRefreshCookie(res);
    res.status(204).send();
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json(result);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.json(result);
  }),

  deleteAccount: asyncHandler(async (req, res) => {
    const result = await authService.deleteAccount(req.user!.id);
    clearRefreshCookie(res);
    res.json(result);
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ id: req.user!.id, role: req.user!.role });
  }),
};
