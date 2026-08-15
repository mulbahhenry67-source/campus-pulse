import { verifyCaptcha } from "../src/utils/captcha";

// CAPTCHA_PROVIDER defaults to "none" in .env.example / test env, so this
// should be a true no-op — no network call, no throw, regardless of token.
describe("verifyCaptcha (default provider = none)", () => {
  it("does not throw when no token is provided", async () => {
    await expect(verifyCaptcha(undefined)).resolves.toBeUndefined();
  });

  it("does not throw even with a token present (still a no-op when provider is none)", async () => {
    await expect(verifyCaptcha("some-token")).resolves.toBeUndefined();
  });
});
