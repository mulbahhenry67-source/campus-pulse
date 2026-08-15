import { matchingRepository } from "./matching.repository";
import { matchingConfigService } from "./matching.config";
import { computeCompatibility, CompatibilityResult } from "./matching.algorithm";
import { AppError } from "../../middleware/errorHandler";

export const matchingService = {
  /** Compatibility between two specific users, e.g. for a profile detail view. */
  async scorePair(userIdA: string, userIdB: string): Promise<CompatibilityResult> {
    const [a, b, weights] = await Promise.all([
      matchingRepository.getCandidate(userIdA),
      matchingRepository.getCandidate(userIdB),
      matchingConfigService.getWeights(),
    ]);

    if (!a || !b) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "One or both profiles haven't completed onboarding yet.");
    }

    return computeCompatibility(a, b, weights);
  },
};
