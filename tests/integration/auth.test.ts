import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db";
import { TEST_PASSWORD, browserSession, createParent, createTeacher, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("cookie sessions", () => {
  it("logs a teacher in with an httpOnly cookie instead of a token in the response", async () => {
    const teacher = await createTeacher();
    const browser = browserSession();

    const result = await browser.run((api) =>
      api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }),
    );
    expect(result).not.toHaveProperty("authToken");
    expect(browser.token).toBeTruthy();

    const session = await browser.run((api) => api.getSession());
    expect(session).toMatchObject({ role: "teacher", teacher: { id: teacher.id, name: teacher.name } });
  });

  it("rejects a wrong password without issuing a cookie", async () => {
    const teacher = await createTeacher();
    const browser = browserSession();
    await expect(
      browser.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: "Wrong1234" })),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "手机号码或密码无效" });
    expect(browser.token).toBeNull();
  });

  it("revokes every outstanding token on logout", async () => {
    const teacher = await createTeacher();
    const laptop = browserSession();
    const phone = browserSession("203.0.113.11");
    await laptop.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
    await phone.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
    const stolenToken = laptop.token;

    await laptop.run((api) => api.logout());
    expect(laptop.token).toBeNull();

    laptop.setToken(stolenToken);
    expect(await laptop.run((api) => api.getSession())).toBeNull();
    await expect(laptop.run((api) => api.getTeacherClasses())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(phone.run((api) => api.getTeacherClasses())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("treats forged tokens as signed out", async () => {
    const browser = browserSession();
    browser.setToken("not-a-jwt");
    expect(await browser.run((api) => api.getSession())).toBeNull();
  });

  it("logs parents in with the parent role", async () => {
    const parent = await createParent();
    const browser = browserSession();
    await browser.run((api) => api.loginParent({ phoneNumber: parent.phoneNumber, password: TEST_PASSWORD }));
    expect(await browser.run((api) => api.getSession())).toMatchObject({ role: "parent", parent: { id: parent.id } });
  });
});

describe("teacher registration with invitation codes", () => {
  it("consumes a code, signs the teacher in and refuses the code once used up", async () => {
    await db.registrationCode.create({ data: { code: "EDU-TEST-0001", maxUses: 1 } });
    const first = browserSession();

    await first.run((api) =>
      api.registerTeacher({
        phoneNumber: "13700000001",
        name: "新老师",
        password: "Teach3rPass",
        invitationCode: "edu-test-0001",
      }),
    );
    expect(await first.run((api) => api.getSession())).toMatchObject({ role: "teacher" });
    expect((await db.registrationCode.findUniqueOrThrow({ where: { code: "EDU-TEST-0001" } })).usedCount).toBe(1);

    const second = browserSession("203.0.113.20");
    await expect(
      second.run((api) =>
        api.registerTeacher({
          phoneNumber: "13700000002",
          name: "另一位老师",
          password: "Teach3rPass",
          invitationCode: "EDU-TEST-0001",
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.teacher.count()).toBe(1);
  });

  it("requires a code when open registration is off", async () => {
    const browser = browserSession();
    await expect(
      browser.run((api) => api.registerTeacher({ phoneNumber: "13700000003", name: "老师", password: "Teach3rPass" })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "请输入邀请码" });
  });
});
