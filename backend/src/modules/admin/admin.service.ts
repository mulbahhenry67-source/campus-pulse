import { adminRepository } from "./admin.repository";
import { AppError } from "../../middleware/errorHandler";

export const adminService = {
  overview: () => adminRepository.overview(),

  listUsers: (search: string | undefined, status: string | undefined, limit: number, offset: number) =>
    adminRepository.listUsers(search, status, limit, offset),

  async getUser(userId: string) {
    const user = await adminRepository.getUserDetail(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    return user;
  },

  async suspendUser(actorId: string, userId: string, reason: string) {
    const user = await adminRepository.setStatus(userId, "suspended", reason);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    await adminRepository.revokeAllSessions(userId);
    await adminRepository.auditLog(actorId, "ADMIN_USER_SUSPENDED", { targetUserId: userId, reason });
    return user;
  },

  async banUser(actorId: string, userId: string, reason: string) {
    const user = await adminRepository.setStatus(userId, "banned", reason);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    await adminRepository.revokeAllSessions(userId);
    await adminRepository.auditLog(actorId, "ADMIN_USER_BANNED", { targetUserId: userId, reason });
    return user;
  },

  async restoreUser(actorId: string, userId: string) {
    const user = await adminRepository.setStatus(userId, "active", null);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    await adminRepository.auditLog(actorId, "ADMIN_USER_RESTORED", { targetUserId: userId });
    return user;
  },

  listReports: (status: string | undefined, targetType: string | undefined, limit: number, offset: number) =>
    adminRepository.listReports(status, targetType, limit, offset),

  async reviewReport(actorId: string, reportId: string, status: string, notes: string | undefined) {
    const report = await adminRepository.reviewReport(reportId, actorId, status, notes);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found.");
    await adminRepository.auditLog(actorId, "ADMIN_REPORT_REVIEWED", { reportId, status });
    return report;
  },

  listVerificationRequests: (status: string | undefined, limit: number, offset: number) =>
    adminRepository.listVerificationRequests(status, limit, offset),

  async decideVerification(actorId: string, id: string, approve: boolean, notes: string | undefined) {
    const result = await adminRepository.decideVerification(id, actorId, approve, notes);
    if (!result) throw new AppError(404, "REQUEST_NOT_FOUND", "Verification request not found.");
    await adminRepository.auditLog(actorId, approve ? "ADMIN_VERIFICATION_APPROVED" : "ADMIN_VERIFICATION_REJECTED", {
      requestId: id,
    });
    return result;
  },
};
