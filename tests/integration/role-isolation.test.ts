import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db";
import {
  TEST_PASSWORD,
  browserSession,
  createClassWithStudent,
  createParent,
  createTeacher,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);

async function signedInTeacher(phoneNumber: string, ip: string) {
  const teacher = await createTeacher(phoneNumber, `老师${phoneNumber.slice(-2)}`);
  const browser = browserSession(ip);
  await browser.run((api) => api.loginTeacher({ phoneNumber, password: TEST_PASSWORD }));
  return { teacher, browser };
}

describe("tenant and role isolation", () => {
  it("does not let a teacher read another teacher's class", async () => {
    const alice = await signedInTeacher("13800000021", "192.0.2.1");
    const bob = await signedInTeacher("13800000022", "192.0.2.2");
    const { klass } = await createClassWithStudent(alice.teacher.id);

    const own = await alice.browser.run((api) => api.getClassStudents({ classId: klass.id }));
    expect(own.students).toHaveLength(1);

    await expect(bob.browser.run((api) => api.getClassStudents({ classId: klass.id }))).rejects.toMatchObject({
      code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/),
    });
    expect((await bob.browser.run((api) => api.getTeacherClasses())).classes).toHaveLength(0);
  });

  it("keeps parents out of teacher procedures and other families' submissions", async () => {
    const { teacher } = await signedInTeacher("13800000023", "192.0.2.3");
    const parent = await createParent("13900000023");
    const otherParent = await createParent("13900000024", "另一位家长");
    const { student } = await createClassWithStudent(teacher.id, { parentId: otherParent.id });
    const assignment = await db.assignment.create({
      data: { title: "作业", imageUrl: "https://example.test/a.jpg", uploadedBy: "teacher", studentId: student.id },
    });

    const browser = browserSession("192.0.2.4");
    await browser.run((api) => api.loginParent({ phoneNumber: parent.phoneNumber, password: TEST_PASSWORD }));

    await expect(browser.run((api) => api.getTeacherClasses())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      browser.run((api) => api.analyzeSubmission({ kind: "assignment", id: assignment.id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a session for protected procedures", async () => {
    await expect(browserSession().run((api) => api.getTeacherClasses())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
