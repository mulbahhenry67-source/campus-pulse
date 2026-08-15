import { messagesRepository } from "./messages.repository";
import { notificationsRepository } from "../notifications/notifications.service";
import { reportsRepository, ReportReason } from "../reports/reports.repository";
import { connectionHub } from "../../ws/hub";
import { AppError } from "../../middleware/errorHandler";

async function assertParticipant(matchId: string, userId: string) {
  const isParticipant = await messagesRepository.isActiveParticipant(matchId, userId);
  if (!isParticipant) {
    throw new AppError(403, "NOT_A_PARTICIPANT", "You don't have access to this conversation.");
  }
}

export const messagesService = {
  async listConversations(userId: string) {
    const conversations = await messagesRepository.listConversations(userId);
    return conversations.map((c) => ({ ...c, online: connectionHub.isOnline(c.other_user_id) }));
  },

  async searchConversations(userId: string, query: string) {
    return messagesRepository.searchConversations(userId, query);
  },

  async listMessages(matchId: string, userId: string, limit: number, before?: string) {
    await assertParticipant(matchId, userId);
    return messagesRepository.listForMatch(matchId, limit, before);
  },

  async send(matchId: string, senderId: string, content: string | null, imageUrl: string | null) {
    await assertParticipant(matchId, senderId);

    const otherUserId = await messagesRepository.getOtherParticipant(matchId, senderId);
    if (!otherUserId) throw new AppError(404, "MATCH_NOT_FOUND", "Conversation not found.");

    if (await messagesRepository.areBlocked(senderId, otherUserId)) {
      throw new AppError(403, "BLOCKED", "You can't message this user.");
    }

    const message = await messagesRepository.send(matchId, senderId, content, imageUrl);

    // Live push if the recipient has an open connection; always create an
    // in-app notification too, so it's there whether or not they were online.
    connectionHub.pushToUser(otherUserId, { type: "message:new", matchId, message });
    await notificationsRepository.create(otherUserId, "new_message", { matchId, fromUserId: senderId });

    return message;
  },

  async deleteMessage(messageId: string, userId: string) {
    const message = await messagesRepository.findById(messageId);
    if (!message || message.deleted_at) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    if (message.sender_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "You can only delete your own messages.");
    }
    await messagesRepository.softDelete(messageId);

    const otherUserId = await messagesRepository.getOtherParticipant(message.match_id, userId);
    if (otherUserId) {
      connectionHub.pushToUser(otherUserId, { type: "message:deleted", matchId: message.match_id, messageId });
    }
    return { deleted: true };
  },

  async react(messageId: string, userId: string, emoji: string) {
    const message = await messagesRepository.findById(messageId);
    if (!message || message.deleted_at) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    await assertParticipant(message.match_id, userId);

    await messagesRepository.upsertReaction(messageId, userId, emoji);

    const otherUserId = await messagesRepository.getOtherParticipant(message.match_id, userId);
    if (otherUserId) {
      connectionHub.pushToUser(otherUserId, { type: "message:reaction", matchId: message.match_id, messageId, userId, emoji });
    }
    return { reacted: true };
  },

  async removeReaction(messageId: string, userId: string) {
    const message = await messagesRepository.findById(messageId);
    if (!message) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    await messagesRepository.removeReaction(messageId, userId);
    return { removed: true };
  },

  async markRead(matchId: string, userId: string) {
    await assertParticipant(matchId, userId);
    await messagesRepository.markRead(matchId, userId);

    const otherUserId = await messagesRepository.getOtherParticipant(matchId, userId);
    if (otherUserId) {
      connectionHub.pushToUser(otherUserId, { type: "message:read", matchId, userId });
    }
    return { read: true };
  },

  async reportMessage(reporterId: string, messageId: string, reason: string, description?: string) {
    const message = await messagesRepository.findById(messageId);
    if (!message) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    await assertParticipant(message.match_id, reporterId);

    const reportId = await reportsRepository.create({
      reporterId,
      targetType: "message",
      targetId: messageId,
      reason: reason as ReportReason,
      description,
    });
    return { reportId };
  },
};
