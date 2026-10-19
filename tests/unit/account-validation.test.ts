import { describe, expect, it } from "vitest";
import { passwordSchema, phoneSchema } from "~/server/services/accountValidation";
import { generateRegistrationCode } from "~/server/services/registration";

describe("phoneSchema", () => {
  it("accepts mainland mobile numbers and trims whitespace", () => {
    expect(phoneSchema.parse(" 13812345678 ")).toBe("13812345678");
  });

  it.each(["12812345678", "1381234567", "138123456789", "abcdefghijk"])("rejects %s", (value) => {
    expect(phoneSchema.safeParse(value).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts a password with lower, upper case and a digit", () => {
    expect(passwordSchema.safeParse("Abcdefg1").success).toBe(true);
  });

  it.each([
    ["Ab1", "密码至少需要8个字符"],
    ["ABCDEFG1", "密码需要包含至少一个小写字母"],
    ["abcdefg1", "密码需要包含至少一个大写字母"],
    ["Abcdefgh", "密码需要包含至少一个数字"],
  ])("rejects %s with a Chinese message", (value, message) => {
    const result = passwordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("generateRegistrationCode", () => {
  it("produces EDU-XXXX-XXXX codes without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRegistrationCode()).toMatch(/^EDU-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    }
  });
});
