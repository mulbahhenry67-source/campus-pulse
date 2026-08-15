import { Router } from "express";
import { profileRepository } from "./profile.repository";
import { updateProfileSchema, setInterestsSchema, addPhotoSchema } from "./profile.validators";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";

export const profileRouter = Router();

// ---- Reference data (still requires auth, to keep the platform closed) ----
profileRouter.get("/schools", authenticate, asyncHandler(async (_req, res) => {
  res.json({ items: await profileRepository.listSchools() });
}));

profileRouter.get("/majors", authenticate, asyncHandler(async (_req, res) => {
  res.json({ items: await profileRepository.listMajors() });
}));

profileRouter.get("/interest-options", authenticate, asyncHandler(async (_req, res) => {
  res.json({ items: await profileRepository.listInterestOptions() });
}));

// ---- The current user's own profile ----
profileRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    await profileRepository.ensureExists(req.user!.id);
    const [profile, interests, photos] = await Promise.all([
      profileRepository.get(req.user!.id),
      profileRepository.getInterests(req.user!.id),
      profileRepository.getPhotos(req.user!.id),
    ]);
    res.json({ profile, interests, photos });
  }),
);

profileRouter.patch(
  "/me",
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    await profileRepository.ensureExists(req.user!.id);
    await profileRepository.update(req.user!.id, req.body);
    const profile = await profileRepository.get(req.user!.id);
    res.json({ profile });
  }),
);

profileRouter.post(
  "/me/complete-onboarding",
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await profileRepository.get(req.user!.id);
    if (!profile) throw new AppError(409, "PROFILE_NOT_FOUND", "Start onboarding before completing it.");
    await profileRepository.markOnboardingComplete(req.user!.id);
    res.json({ completed: true });
  }),
);

profileRouter.put(
  "/me/interests",
  authenticate,
  validateBody(setInterestsSchema),
  asyncHandler(async (req, res) => {
    await profileRepository.setInterests(req.user!.id, req.body.interestIds);
    res.json({ items: await profileRepository.getInterests(req.user!.id) });
  }),
);

profileRouter.get(
  "/me/photos",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ items: await profileRepository.getPhotos(req.user!.id) });
  }),
);

// NOTE: this accepts an already-hosted URL. Direct upload (presigned S3 POST,
// validation of file type/size/dimensions, thumbnail generation) is real
// object-storage integration work that belongs in the dedicated storage
// phase — the endpoint shape here is what that phase will plug into.
profileRouter.post(
  "/me/photos",
  authenticate,
  validateBody(addPhotoSchema),
  asyncHandler(async (req, res) => {
    const existing = await profileRepository.getPhotos(req.user!.id);
    if (existing.length >= 9) {
      throw new AppError(422, "TOO_MANY_PHOTOS", "You can have up to 9 profile photos.");
    }
    const id = await profileRepository.addPhoto(req.user!.id, req.body.url, req.body.isPrimary);
    res.status(201).json({ id });
  }),
);

profileRouter.delete(
  "/me/photos/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await profileRepository.removePhoto(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);

// ---- Viewing someone else's profile (e.g. from Discover) ----
profileRouter.get(
  "/:userId",
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await profileRepository.get(req.params.userId);
    if (!profile || !profile.discoverable) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "This profile isn't available.");
    }
    const [interests, photos] = await Promise.all([
      profileRepository.getInterests(req.params.userId),
      profileRepository.getPhotos(req.params.userId),
    ]);
    // Never expose exact coordinates to other users.
    const { latitude, longitude, ...safeProfile } = profile;
    void latitude;
    void longitude;
    res.json({ profile: safeProfile, interests, photos });
  }),
);
