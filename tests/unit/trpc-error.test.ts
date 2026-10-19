import { describe, expect, it } from "vitest";
import { getErrorMessage } from "~/utils/trpcError";

describe("getErrorMessage", () => {
  it("prefers the first zod field error", () => {
    const error = { message: "x", data: { zodError: { fieldErrors: { phoneNumber: ["请输入有效的手机号码"] } } } };
    expect(getErrorMessage(error)).toBe("请输入有效的手机号码");
  });

  it("shows Chinese server messages as-is", () => {
    expect(getErrorMessage(new Error("今日 AI 使用次数已达上限"))).toBe("今日 AI 使用次数已达上限");
  });

  it("maps known tRPC codes when the message is not user-facing", () => {
    expect(getErrorMessage({ message: "Forbidden", data: { code: "FORBIDDEN" } })).toBe("您没有权限执行此操作");
  });

  it("recognizes network failures", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toBe("网络连接错误，请检查网络连接");
  });

  it("falls back for empty input", () => {
    expect(getErrorMessage(null)).toBe("操作失败，请稍后重试");
    expect(getErrorMessage("自定义")).toBe("自定义");
  });
});
