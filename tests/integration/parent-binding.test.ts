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

let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter += 1)}`;

async function signedInParent(phoneNumber: string, name = `家长${phoneNumber.slice(-2)}`) {
  const parent = await createParent(phoneNumber, name);
  const browser = browserSession(nextIp());
  await browser.run((api) => api.loginParent({ phoneNumber, password: TEST_PASSWORD }));
  return { parent, browser };
}

async function signedInTeacher(phoneNumber = "13800000101") {
  const teacher = await createTeacher(phoneNumber);
  const browser = browserSession(nextIp());
  await browser.run((api) => api.loginTeacher({ phoneNumber, password: TEST_PASSWORD }));
  return { teacher, browser };
}

type Session = Awaited<ReturnType<typeof signedInParent>>["browser"];

async function childIds(browser: Session) {
  const overview = await browser.run((api) => api.getParentOverview());
  return overview.children.map((child) => child.id);
}

describe("multi-parent binding", () => {
  it("links the first parent directly with the class code and child name", async () => {
    const { teacher } = await signedInTeacher();
    const { klass, student } = await createClassWithStudent(teacher.id);
    const dad = await signedInParent("13900000101");

    const result = await dad.browser.run((api) =>
      api.linkChild({ classInvitationCode: klass.invitationCode, childName: student.name, relation: "爸爸" }),
    );
    expect(result.status).toBe("linked");
    expect(await childIds(dad.browser)).toEqual([student.id]);
  });

  it("lets a linked parent invite another parent with a single-use code", async () => {
    const { teacher } = await signedInTeacher();
    const dad = await signedInParent("13900000102");
    const { student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });
    const mom = await signedInParent("13900000103");
    const grandma = await signedInParent("13900000104");

    const invite = await dad.browser.run((api) => api.createFamilyInvite({ studentId: student.id }));
    expect(invite.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const joined = await mom.browser.run((api) =>
      api.joinFamily({ familyInviteCode: invite.code.toLowerCase().replace("-", " "), relation: "妈妈" }),
    );
    expect(joined.status).toBe("linked");
    expect(await childIds(mom.browser)).toEqual([student.id]);
    expect(await childIds(dad.browser)).toEqual([student.id]);

    await expect(
      grandma.browser.run((api) => api.joinFamily({ familyInviteCode: invite.code })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const family = (await dad.browser.run((api) => api.getParentOverview())).children[0]?.family ?? [];
    expect(family.map((member) => member.relation).sort()).toEqual(["妈妈", null].sort());
    expect(family.every((member) => !member.maskedPhone.includes("0000010"))).toBe(true);
  });

  it("rejects expired invites and invites from a parent who has since left", async () => {
    const { teacher } = await signedInTeacher();
    const dad = await signedInParent("13900000105");
    const { student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });
    const mom = await signedInParent("13900000106");

    const expired = await dad.browser.run((api) => api.createFamilyInvite({ studentId: student.id }));
    await db.familyInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(
      mom.browser.run((api) => api.joinFamily({ familyInviteCode: expired.code })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const fresh = await dad.browser.run((api) => api.createFamilyInvite({ studentId: student.id }));
    await dad.browser.run((api) => api.leaveChild({ studentId: student.id }));
    await expect(
      mom.browser.run((api) => api.joinFamily({ familyInviteCode: fresh.code })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/BAD_REQUEST|FORBIDDEN/) });
    expect(await childIds(mom.browser)).toEqual([]);
  });

  it("turns a class-code bind for an already linked child into a request the teacher decides", async () => {
    const { teacher, browser: teacherBrowser } = await signedInTeacher();
    const dad = await signedInParent("13900000107");
    const { klass, student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });
    const stranger = await signedInParent("13900000108");
    const uncle = await signedInParent("13900000109");

    const pending = await stranger.browser.run((api) =>
      api.linkChild({ classInvitationCode: klass.invitationCode, childName: student.name }),
    );
    expect(pending.status).toBe("pending");
    expect(await childIds(stranger.browser)).toEqual([]);
    await expect(
      stranger.browser.run((api) => api.getStudentProfileData({ studentId: student.id })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/) });
    await expect(
      stranger.browser.run((api) =>
        api.linkChild({ classInvitationCode: klass.invitationCode, childName: student.name }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await uncle.browser.run((api) =>
      api.linkChild({ classInvitationCode: klass.invitationCode, childName: student.name, relation: "舅舅" }),
    );

    const requests = await teacherBrowser.run((api) => api.getBindingRequests());
    expect(requests).toHaveLength(2);
    const notifications = await teacherBrowser.run((api) => api.getTeacherNotifications());
    expect(notifications.pendingBindingCount).toBe(2);
    expect(notifications.attentionCount).toBeGreaterThanOrEqual(2);

    const strangerRequest = requests.find((request) => request.parent.id === stranger.parent.id)!;
    const uncleRequest = requests.find((request) => request.parent.id === uncle.parent.id)!;
    await teacherBrowser.run((api) => api.decideBindingRequest({ requestId: strangerRequest.id, approve: false }));
    await teacherBrowser.run((api) => api.decideBindingRequest({ requestId: uncleRequest.id, approve: true }));

    expect(await childIds(stranger.browser)).toEqual([]);
    expect(await childIds(uncle.browser)).toEqual([student.id]);
    const strangerOverview = await stranger.browser.run((api) => api.getParentOverview());
    expect(strangerOverview.requests.map((request) => request.status)).toEqual(["rejected"]);

    await expect(
      teacherBrowser.run((api) => api.decideBindingRequest({ requestId: uncleRequest.id, approve: true })),
    ).rejects.toBeTruthy();
  });

  it("does not let another teacher decide or unbind", async () => {
    const { teacher } = await signedInTeacher("13800000102");
    const other = await signedInTeacher("13800000103");
    const dad = await signedInParent("13900000110");
    const { klass, student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });
    const mom = await signedInParent("13900000111");
    await mom.browser.run((api) =>
      api.linkChild({ classInvitationCode: klass.invitationCode, childName: student.name }),
    );
    const request = await db.parentBindingRequest.findFirstOrThrow();

    expect(await other.browser.run((api) => api.getBindingRequests())).toEqual([]);
    await expect(
      other.browser.run((api) => api.decideBindingRequest({ requestId: request.id, approve: true })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      other.browser.run((api) => api.unbindParent({ studentId: student.id, parentId: dad.parent.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("revokes access immediately when the teacher unbinds a parent", async () => {
    const { teacher, browser: teacherBrowser } = await signedInTeacher();
    const dad = await signedInParent("13900000112");
    const { student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });

    const profile = await teacherBrowser.run((api) => api.getStudentProfileData({ studentId: student.id }));
    expect(profile.linkedParents?.map((parent) => parent.id)).toEqual([dad.parent.id]);

    expect(await dad.browser.run((api) => api.getStudentProfileData({ studentId: student.id }))).toMatchObject({
      linkedParents: null,
    });

    await teacherBrowser.run((api) => api.unbindParent({ studentId: student.id, parentId: dad.parent.id }));
    expect(await childIds(dad.browser)).toEqual([]);
    await expect(
      dad.browser.run((api) => api.getStudentProfileData({ studentId: student.id })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/) });
  });

  it("caps a child at six parents", async () => {
    const { teacher } = await signedInTeacher();
    const parents = await Promise.all(
      Array.from({ length: 6 }, (_, index) => createParent(`1390000020${index}`, `家长${index}`)),
    );
    const { student } = await createClassWithStudent(teacher.id, { parentId: parents[0]!.id });
    await db.parentStudent.createMany({
      data: parents.slice(1).map((parent) => ({ parentId: parent.id, studentId: student.id })),
    });

    const first = browserSession(nextIp());
    await first.run((api) => api.loginParent({ phoneNumber: parents[0]!.phoneNumber, password: TEST_PASSWORD }));
    await expect(first.run((api) => api.createFamilyInvite({ studentId: student.id }))).rejects.toMatchObject({
      code: "CONFLICT",
    });

    await db.familyInvite.create({
      data: {
        code: "CAPTEST1",
        studentId: student.id,
        createdByParentId: parents[0]!.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const seventh = await signedInParent("13900000299");
    await expect(seventh.browser.run((api) => api.joinFamily({ familyInviteCode: "CAPT-EST1" }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("registers a parent through either the class code or a family invite", async () => {
    const { teacher } = await signedInTeacher();
    const { klass, student } = await createClassWithStudent(teacher.id);

    const dadBrowser = browserSession(nextIp());
    const dad = await dadBrowser.run((api) =>
      api.registerParent({
        name: "新爸爸",
        phoneNumber: "13900000301",
        password: TEST_PASSWORD,
        classInvitationCode: klass.invitationCode,
        childName: student.name,
        relation: "爸爸",
      }),
    );
    expect(dad.status).toBe("linked");
    const invite = await dadBrowser.run((api) => api.createFamilyInvite({ studentId: student.id }));

    const momBrowser = browserSession(nextIp());
    const mom = await momBrowser.run((api) =>
      api.registerParent({
        name: "新妈妈",
        phoneNumber: "13900000302",
        password: TEST_PASSWORD,
        familyInviteCode: invite.code,
        relation: "妈妈",
      }),
    );
    expect(mom.status).toBe("linked");
    expect(await childIds(momBrowser)).toEqual([student.id]);

    const auntBrowser = browserSession(nextIp());
    const aunt = await auntBrowser.run((api) =>
      api.registerParent({
        name: "新姑姑",
        phoneNumber: "13900000303",
        password: TEST_PASSWORD,
        classInvitationCode: klass.invitationCode,
        childName: student.name,
      }),
    );
    expect(aunt.status).toBe("pending");

    await expect(
      browserSession(nextIp()).run((api) =>
        api.registerParent({
          name: "无效",
          phoneNumber: "13900000304",
          password: TEST_PASSWORD,
          familyInviteCode: invite.code,
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.parent.count({ where: { phoneNumber: "13900000304" } })).toBe(0);
  });

  it("deletes a student with exams, analyses and parent links", async () => {
    const { teacher, browser: teacherBrowser } = await signedInTeacher();
    const dad = await signedInParent("13900000401");
    const { student } = await createClassWithStudent(teacher.id, { parentId: dad.parent.id });
    const area = await db.knowledgeArea.create({ data: { name: "删除测试知识点", description: "" } });
    const exam = await db.exam.create({
      data: {
        title: "期中",
        imageUrl: "https://example.test/e.jpg",
        uploadedBy: "teacher",
        studentId: student.id,
        analysisStatus: "completed",
        analysis: { create: { score: 72, feedback: "ok", strengths: [], improvements: [] } },
      },
      include: { analysis: true },
    });
    await db.examMistake.create({
      data: { description: "错", studentId: student.id, analysisId: exam.analysis!.id, knowledgeAreaId: area.id },
    });
    await db.assignment.create({
      data: {
        title: "作业",
        imageUrl: "https://example.test/a.jpg",
        uploadedBy: "parent",
        studentId: student.id,
        analysis: { create: { score: 88, feedback: "ok", strengths: [], improvements: [] } },
      },
    });
    await db.studentKnowledgeArea.create({ data: { studentId: student.id, knowledgeAreaId: area.id, mastery: 0.4 } });
    await dad.browser.run((api) => api.createFamilyInvite({ studentId: student.id }));

    await teacherBrowser.run((api) => api.deleteStudentFromClass({ studentId: student.id }));

    expect(await db.student.count()).toBe(0);
    expect(await db.exam.count()).toBe(0);
    expect(await db.examAnalysis.count()).toBe(0);
    expect(await db.assignmentAnalysis.count()).toBe(0);
    expect(await db.parentStudent.count()).toBe(0);
    expect(await db.familyInvite.count()).toBe(0);
    expect(await childIds(dad.browser)).toEqual([]);
  });
});
