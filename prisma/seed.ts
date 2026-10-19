import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PHONE = "13800000001";
const DEMO_PASSWORD = "Demo1234";
const DEMO_TEACHER_NAME = "示范教师";
// Must match DEMO_PARENT_PHONE in src/server/trpc/procedures/loginDemoParent.ts
const DEMO_PARENT_PHONE = "13900000001";
const DEMO_PARENT_PASSWORD = "Parent1234";
const DEMO_PARENT_NAME = "张明轩家长";
const DEMO_PARENT_CHILD = "张明轩";
const DEMO_SECOND_PARENT_PHONE = "13900000002";
const DEMO_SECOND_PARENT_NAME = "张明轩妈妈";
const DEMO_REGISTRATION_CODE = "EDU-DEMO-2026";

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Seed data index ${index} out of range`);
  return item;
}

function pick<T>(items: readonly T[]): T {
  return at(items, Math.floor(Math.random() * items.length));
}

async function main() {
  console.log("=== 智评 EduReview - Demo Seed Script ===\n");

  try {
    // -------------------------------------------------------
    // 1. Clean up existing demo data (idempotent)
    // -------------------------------------------------------
    const existingTeacher = await prisma.teacher.findUnique({
      where: { phoneNumber: DEMO_PHONE },
    });

    if (existingTeacher) {
      console.log(
        `Demo teacher already exists (id=${existingTeacher.id}). Removing old data...`,
      );

      // Delete in dependency order
      await prisma.teacherKnowledgeArea.deleteMany({
        where: { teacherId: existingTeacher.id },
      });
      await prisma.teachingMaterial.deleteMany({
        where: { teacherId: existingTeacher.id },
      });
      // Delete mistakes linked to demo students' analyses
      await prisma.mistake.deleteMany({
        where: {
          OR: [
            { student: { class: { teacherId: existingTeacher.id } } },
            {
              analysis: {
                assignment: { class: { teacherId: existingTeacher.id } },
              },
            },
          ],
        },
      });
      await prisma.examMistake.deleteMany({
        where: {
          OR: [
            { student: { class: { teacherId: existingTeacher.id } } },
            { analysis: { exam: { class: { teacherId: existingTeacher.id } } } },
          ],
        },
      });
      await prisma.studentKnowledgeArea.deleteMany({
        where: {
          student: { class: { teacherId: existingTeacher.id } },
        },
      });
      // Also clean up knowledge areas created by previous seed runs
      const demoKaNames = [
        "分数运算",
        "小数与百分数",
        "几何图形",
        "应用题",
        "方程",
        "数据统计",
      ];
      await prisma.knowledgeArea.deleteMany({
        where: { name: { in: demoKaNames } },
      });
      await prisma.student.deleteMany({
        where: { class: { teacherId: existingTeacher.id } },
      });
      await prisma.studentGroup.deleteMany({
        where: { class: { teacherId: existingTeacher.id } },
      });
      await prisma.assignmentAnalysis.deleteMany({
        where: {
          assignment: { class: { teacherId: existingTeacher.id } },
        },
      });
      await prisma.assignment.deleteMany({
        where: { class: { teacherId: existingTeacher.id } },
      });
      await prisma.examAnalysis.deleteMany({
        where: {
          exam: { class: { teacherId: existingTeacher.id } },
        },
      });
      await prisma.exam.deleteMany({
        where: { class: { teacherId: existingTeacher.id } },
      });
      await prisma.class.deleteMany({
        where: { teacherId: existingTeacher.id },
      });
      await prisma.teacher.delete({
        where: { id: existingTeacher.id },
      });
      console.log("Old demo data removed.\n");
    }

    // -------------------------------------------------------
    // 2. Create demo teacher
    // -------------------------------------------------------
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    const teacher = await prisma.teacher.create({
      data: {
        phoneNumber: DEMO_PHONE,
        name: DEMO_TEACHER_NAME,
        password: hashedPassword,
      },
    });
    console.log(`[1] Teacher created: ${teacher.name} (id=${teacher.id})`);
    console.log(`    Phone: ${DEMO_PHONE}, Password: ${DEMO_PASSWORD}\n`);

    // -------------------------------------------------------
    // 3. Create classes
    // -------------------------------------------------------
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const classesData = [
      {
        name: "三年级一班",
        description: "2025年春季学期三年级一班数学课",
        invitationCode: "MATH3A",
      },
      {
        name: "四年级二班",
        description: "2025年春季学期四年级二班数学课",
        invitationCode: "MATH4B",
      },
      {
        name: "五年级三班",
        description: "2025年春季学期五年级三班数学课",
        invitationCode: "MATH5C",
      },
    ];

    const classes = await Promise.all(
      classesData.map((c) =>
        prisma.class.create({
          data: {
            name: c.name,
            description: c.description,
            invitationCode: c.invitationCode,
            invitationCodeExpiresAt: sevenDaysFromNow,
            status: "active",
            teacherId: teacher.id,
          },
        }),
      ),
    );
    console.log(
      `[2] Created ${classes.length} classes: ${classes.map((c) => c.name).join(", ")}\n`,
    );

    // -------------------------------------------------------
    // 4. Create students (8-12 per class, ~30 total)
    // -------------------------------------------------------
    // Special attention student indices (0-based within allStudents)
    const specialAttentionIndices = new Set([2, 8, 17, 25]);

    const studentsByClass: {
      name: string;
      grade: string;
      specialAttention: boolean;
    }[][] = [
      // 三年级一班 (10 students)
      [
        { name: "张明轩", grade: "三年级", specialAttention: false },
        { name: "李思涵", grade: "三年级", specialAttention: false },
        { name: "王子墨", grade: "三年级", specialAttention: true }, // special
        { name: "刘雨桐", grade: "三年级", specialAttention: false },
        { name: "陈浩然", grade: "三年级", specialAttention: false },
        { name: "杨梓萱", grade: "三年级", specialAttention: false },
        { name: "赵子涵", grade: "三年级", specialAttention: false },
        { name: "黄诗琪", grade: "三年级", specialAttention: false },
        { name: "周子轩", grade: "三年级", specialAttention: true }, // special
        { name: "吴雨欣", grade: "三年级", specialAttention: false },
      ],
      // 四年级二班 (10 students)
      [
        { name: "郑浩宇", grade: "四年级", specialAttention: false },
        { name: "孙思远", grade: "四年级", specialAttention: false },
        { name: "朱雨萱", grade: "四年级", specialAttention: false },
        { name: "马子豪", grade: "四年级", specialAttention: false },
        { name: "胡欣怡", grade: "四年级", specialAttention: false },
        { name: "林梓涵", grade: "四年级", specialAttention: false },
        { name: "何宇轩", grade: "四年级", specialAttention: false },
        { name: "高思琪", grade: "四年级", specialAttention: true }, // special
        { name: "罗子铭", grade: "四年级", specialAttention: false },
        { name: "谢雨涵", grade: "四年级", specialAttention: false },
      ],
      // 五年级三班 (10 students)
      [
        { name: "韩浩轩", grade: "五年级", specialAttention: false },
        { name: "唐子瑜", grade: "五年级", specialAttention: false },
        { name: "曹思颖", grade: "五年级", specialAttention: false },
        { name: "邓宇辰", grade: "五年级", specialAttention: false },
        { name: "许雨桐", grade: "五年级", specialAttention: false },
        { name: "冯子轩", grade: "五年级", specialAttention: false },
        { name: "曾诗涵", grade: "五年级", specialAttention: false },
        { name: "彭浩然", grade: "五年级", specialAttention: false },
        { name: "萧雨欣", grade: "五年级", specialAttention: false },
        { name: "田子涵", grade: "五年级", specialAttention: true }, // special
      ],
    ];

    const allStudents: {
      id: number;
      name: string;
      classId: number;
      specialAttention: boolean;
    }[] = [];

    for (const [i, cls] of classes.entries()) {
      const studentDefs = at(studentsByClass, i);
      const created = await Promise.all(
        studentDefs.map((s) =>
          prisma.student.create({
            data: {
              name: s.name,
              grade: s.grade,
              className: cls.name,
              specialAttention: s.specialAttention,
              classId: cls.id,
            },
          }),
        ),
      );
      created.forEach((s) =>
        allStudents.push({
          id: s.id,
          name: s.name,
          classId: cls.id,
          specialAttention: s.specialAttention,
        }),
      );
      const specialCount = created.filter((s) => s.specialAttention).length;
      console.log(
        `    ${cls.name}: ${created.length} students` +
          (specialCount > 0 ? ` (${specialCount} with special attention)` : ""),
      );
    }
    console.log(`[3] Created ${allStudents.length} students total\n`);

    // -------------------------------------------------------
    // 4b. Demo parent account + teacher invitation code
    // -------------------------------------------------------
    const demoChild = allStudents.find((s) => s.name === DEMO_PARENT_CHILD);
    if (!demoChild) throw new Error(`Demo child ${DEMO_PARENT_CHILD} not found`);
    const demoParent = await prisma.parent.upsert({
      where: { phoneNumber: DEMO_PARENT_PHONE },
      update: { name: DEMO_PARENT_NAME, password: await bcrypt.hash(DEMO_PARENT_PASSWORD, 12) },
      create: {
        phoneNumber: DEMO_PARENT_PHONE,
        name: DEMO_PARENT_NAME,
        password: await bcrypt.hash(DEMO_PARENT_PASSWORD, 12),
      },
    });
    const demoSecondParent = await prisma.parent.upsert({
      where: { phoneNumber: DEMO_SECOND_PARENT_PHONE },
      update: { name: DEMO_SECOND_PARENT_NAME, password: await bcrypt.hash(DEMO_PARENT_PASSWORD, 12) },
      create: {
        phoneNumber: DEMO_SECOND_PARENT_PHONE,
        name: DEMO_SECOND_PARENT_NAME,
        password: await bcrypt.hash(DEMO_PARENT_PASSWORD, 12),
      },
    });
    await prisma.parentStudent.createMany({
      data: [
        { parentId: demoParent.id, studentId: demoChild.id, relation: "爸爸" },
        { parentId: demoSecondParent.id, studentId: demoChild.id, relation: "妈妈" },
      ],
      skipDuplicates: true,
    });
    console.log(`    Parent: ${DEMO_PARENT_NAME} (${DEMO_PARENT_PHONE} / ${DEMO_PARENT_PASSWORD}) → ${DEMO_PARENT_CHILD}`);
    console.log(`    Parent: ${DEMO_SECOND_PARENT_NAME} (${DEMO_SECOND_PARENT_PHONE} / ${DEMO_PARENT_PASSWORD}) → ${DEMO_PARENT_CHILD}`);

    const codeExpiresAt = new Date();
    codeExpiresAt.setDate(codeExpiresAt.getDate() + 30);
    await prisma.registrationCode.upsert({
      where: { code: DEMO_REGISTRATION_CODE },
      update: { maxUses: 20, expiresAt: codeExpiresAt, revokedAt: null },
      create: { code: DEMO_REGISTRATION_CODE, note: "本地开发用（seed 生成）", maxUses: 20, expiresAt: codeExpiresAt },
    });
    console.log(`    Teacher invitation code: ${DEMO_REGISTRATION_CODE} (20 uses, 30 days)\n`);

    // -------------------------------------------------------
    // 5. Create student groups (2-3 per class)
    // -------------------------------------------------------
    const groupsData: {
      name: string;
      color: string;
      classIndex: number;
      description?: string;
    }[] = [
      {
        name: "第一组",
        color: "blue",
        classIndex: 0,
        description: "基础提升小组",
      },
      {
        name: "第二组",
        color: "green",
        classIndex: 0,
        description: "拓展提高小组",
      },
      {
        name: "数学兴趣小组",
        color: "purple",
        classIndex: 0,
        description: "数学兴趣探究小组",
      },
      {
        name: "第一组",
        color: "blue",
        classIndex: 1,
        description: "基础提升小组",
      },
      {
        name: "第二组",
        color: "orange",
        classIndex: 1,
        description: "拓展提高小组",
      },
      {
        name: "第一组",
        color: "blue",
        classIndex: 2,
        description: "基础提升小组",
      },
      {
        name: "第二组",
        color: "green",
        classIndex: 2,
        description: "拓展提高小组",
      },
      {
        name: "数学兴趣小组",
        color: "red",
        classIndex: 2,
        description: "数学兴趣探究小组",
      },
    ];

    const allGroups: { id: number; classIndex: number }[] = [];

    for (const gd of groupsData) {
      const group = await prisma.studentGroup.create({
        data: {
          name: gd.name,
          color: gd.color,
          description: gd.description || null,
          classId: at(classes, gd.classIndex).id,
        },
      });
      allGroups.push({ id: group.id, classIndex: gd.classIndex });
    }
    console.log(
      `[4] Created ${allGroups.length} student groups across ${classes.length} classes\n`,
    );

    // -------------------------------------------------------
    // 6. Assign some students to groups
    // -------------------------------------------------------
    // Assign first 3-4 students of each class to the first group, next 3-4 to second
    let groupAssignCount = 0;
    // First group: students 0-2, second: 3-6, third (if any): the rest
    const groupSlices: Array<[number, number | undefined]> = [[0, 3], [3, 7], [7, undefined]];
    for (const [ci, cls] of classes.entries()) {
      const classStudents = allStudents.filter((s) => s.classId === cls.id);
      const classGroups = allGroups.filter((g) => g.classIndex === ci);

      for (const [gi, group] of classGroups.entries()) {
        const bounds = groupSlices[gi];
        if (!bounds) break;
        const slice = classStudents.slice(bounds[0], bounds[1]);
        await Promise.all(
          slice.map((s) =>
            prisma.student.update({
              where: { id: s.id },
              data: { groupId: group.id },
            }),
          ),
        );
        groupAssignCount += slice.length;
      }
    }
    console.log(`[5] Assigned ${groupAssignCount} students to groups\n`);

    // -------------------------------------------------------
    // 7. Create knowledge areas
    // -------------------------------------------------------
    const knowledgeAreasData = [
      { name: "分数运算", description: "分数的加减乘除运算及混合运算" },
      { name: "小数与百分数", description: "小数的认识、运算及百分数应用" },
      { name: "几何图形", description: "平面图形与立体图形的认识与计算" },
      { name: "应用题", description: "数学应用题的审题、分析与解答" },
      { name: "方程", description: "一元一次方程的建立与求解" },
      { name: "数据统计", description: "数据的收集、整理、描述与分析" },
    ];

    const knowledgeAreas = await Promise.all(
      knowledgeAreasData.map((ka) =>
        prisma.knowledgeArea.create({
          data: {
            name: ka.name,
            description: ka.description,
          },
        }),
      ),
    );
    console.log(
      `[6] Created ${knowledgeAreas.length} knowledge areas: ${knowledgeAreas.map((ka) => ka.name).join(", ")}\n`,
    );

    // -------------------------------------------------------
    // 8. Link teacher to all knowledge areas
    // -------------------------------------------------------
    const teacherKAs = await Promise.all(
      knowledgeAreas.map((ka) =>
        prisma.teacherKnowledgeArea.create({
          data: {
            teacherId: teacher.id,
            knowledgeAreaId: ka.id,
          },
        }),
      ),
    );
    console.log(`[7] Linked teacher to ${teacherKAs.length} knowledge areas\n`);

    // -------------------------------------------------------
    // 9. Link some students to knowledge areas
    // -------------------------------------------------------
    let studentKACount = 0;

    // Give each student 2-3 knowledge areas
    for (const student of allStudents) {
      // Pick 2-3 random knowledge areas
      const shuffled = [...knowledgeAreas].sort(() => Math.random() - 0.5);
      const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
      const selected = shuffled.slice(0, count);

      await Promise.all(
        selected.map((ka) =>
          prisma.studentKnowledgeArea.create({
            data: {
              studentId: student.id,
              knowledgeAreaId: ka.id,
              mastery: Math.round((0.25 + Math.random() * 0.7) * 100) / 100,
              evidenceCount: 1 + Math.floor(Math.random() * 6),
            },
          }),
        ),
      );
      studentKACount += selected.length;
    }
    console.log(`[8] Created ${studentKACount} student-knowledge area links\n`);

    // -------------------------------------------------------
    // 10. Create teaching materials
    // -------------------------------------------------------
    const teachingMaterialsData = [
      {
        title: "分数加减法讲评提纲",
        description: "覆盖通分、同分母与异分母运算的课堂讲评提纲。",
        contentType: "text",
        knowledgeAreaIndex: 0,
        textContent:
          "一、先确认分母是否一致。二、异分母必须先通分。三、结果要化成最简分数。常见错因：只看分子相加减、通分后漏改分子、结果没有约分。",
      },
      {
        title: "分数应用题错因清单",
        description: "整理学生在单位“1”、分率和数量关系上的典型错误。",
        contentType: "document",
        knowledgeAreaIndex: 0,
        textContent:
          "重点提醒：先找单位“1”，再判断已知量与对应分率。若求部分量，用单位“1”乘分率；若求单位“1”，用部分量除以分率。",
      },
      {
        title: "小数与百分数转换口诀",
        description: "适合课前热身和随堂抽查的小抄版讲义。",
        contentType: "text",
        knowledgeAreaIndex: 1,
        textContent:
          "小数化百分数，小数点向右移动两位并加百分号；百分数化小数，去掉百分号后小数点向左移动两位。注意补 0 与末尾 0 的处理。",
      },
      {
        title: "面积与周长辨析表",
        description: "用表格对比长方形、正方形、平行四边形和三角形的计算方式。",
        contentType: "document",
        knowledgeAreaIndex: 2,
        textContent:
          "周长关注边长总和，面积关注所占平面大小。平行四边形面积=底×高，三角形面积=底×高÷2。常见错误是把斜边当成高。",
      },
      {
        title: "几何图形课堂板书整理",
        description: "总结面积、体积与单位换算的课堂板书内容。",
        contentType: "text",
        knowledgeAreaIndex: 2,
        textContent:
          "面积单位之间每相邻两级进率是 100，体积单位之间每相邻两级进率是 1000。题目若混用单位，要先统一再计算。",
      },
      {
        title: "应用题数量关系模板",
        description: "把和差倍、工程、行程等题型拆成数量关系模板。",
        contentType: "text",
        knowledgeAreaIndex: 3,
        textContent:
          "先画线段图，再写已知量、未知量和对应关系。对“比……多/少”“比值”“每份量”这类关键词要先转成算式关系。",
      },
      {
        title: "方程移项易错点提醒",
        description: "适合课后巩固的方程变形提醒卡。",
        contentType: "text",
        knowledgeAreaIndex: 4,
        textContent:
          "移项时本质是等式两边同时加减同一个数，不是把符号随意改掉。去括号、去分母之后要及时合并同类项并验算。",
      },
      {
        title: "统计图阅读提示卡",
        description: "帮助学生区分条形图、折线图与平均数问题的阅读顺序。",
        contentType: "text",
        knowledgeAreaIndex: 5,
        textContent:
          "先读标题和单位，再读横纵轴含义，最后比较数据变化趋势。涉及平均数时要先求总量，再除以份数。",
      },
    ];

    const materials = await Promise.all(
      teachingMaterialsData.map((m) =>
        prisma.teachingMaterial.create({
          data: {
            title: m.title,
            description: m.description,
            contentType: m.contentType,
            textContent: m.textContent,
            teacherId: teacher.id,
            knowledgeAreaId: at(knowledgeAreas, m.knowledgeAreaIndex).id,
          },
        }),
      ),
    );
    console.log(
      `[9] Created ${materials.length} teaching materials: ${materials.map((m) => m.title).join(", ")}\n`,
    );

    // -------------------------------------------------------
    // 10. Create demo assignments with analyses
    // -------------------------------------------------------
    const demoImageUrl = "https://placeholder.com/demo-assignment.jpg";

    // 4 assignment titles per class — all students get the same assignments
    const assignmentTitlesByClass = [
      ["分数加减法练习", "小数乘法作业", "几何周长计算", "应用题专项训练"],
      ["异分母运算练习", "方程求解作业", "面积体积计算", "数据统计练习"],
      ["综合运算训练", "方程应用题", "圆与扇形计算", "统计图表分析"],
    ];

    // Raw grade marks as they might appear on paper, with their 0-100 equivalents
    const gradeSamples: Array<{ grade: string; score: number }> = [
      { grade: "A", score: 95 },
      { grade: "B+", score: 88 },
      { grade: "A-", score: 92 },
      { grade: "B", score: 85 },
      { grade: "A", score: 95 },
      { grade: "C+", score: 78 },
      { grade: "B-", score: 82 },
      { grade: "A", score: 95 },
      { grade: "B+", score: 88 },
      { grade: "A-", score: 92 },
    ];

    const feedbackTemplates = [
      "整体完成质量较好，计算过程清晰，建议加强应用题的分析步骤。",
      "基础计算能力不错，但在复杂题型中容易出错，需要多加练习。",
      "作业完成认真，解题思路正确，少数计算错误需要仔细检查。",
      "进步明显！对分数运算的理解更加深入了，继续保持。",
      "应用题的审题能力需要提高，建议先读懂题目再列算式。",
      "数据统计部分表现优秀，图表绘制规范，分析到位。",
      "方程求解步骤完整，但在检验环节容易遗漏，需要养成验算习惯。",
      "几何图形计算准确，公式运用熟练，建议多做拓展练习。",
    ];

    const strengthsTemplates = [
      "计算过程规范",
      "解题思路清晰",
      "作业书写工整",
      "公式运用正确",
      "审题仔细认真",
      "验算习惯良好",
      "图表绘制规范",
      "步骤完整有序",
    ];

    const improvementsTemplates = [
      "应用题分析能力有待提高",
      "计算粗心，需要养成检查习惯",
      "复杂题型解题速度较慢",
      "建议多做课外拓展练习",
      "方程检验环节容易遗漏",
      "几何证明过程不够严谨",
      "需要加强对概念的理解",
      "建议多练习综合题型",
    ];

    const mistakeDescriptions = [
      "分数异分母相加时忘记通分",
      "小数乘法中位数对齐错误",
      "圆的面积公式中半径取值错误",
      "应用题中单位换算遗漏",
      "方程移项时符号出错",
      "计算结果忘记写单位",
      "长方形周长公式混淆",
      "统计图坐标轴标注错误",
    ];

    const originalQuestions = [
      "计算: 2/3 + 1/4 = ?",
      "计算: 3.5 × 0.8 = ?",
      "求圆的面积，已知直径 d=6cm",
      "小明有12个苹果，吃了1/3，还剩多少？",
      "解方程: 3x + 5 = 20",
      "把0.75化为百分数",
      "长方形长8cm宽5cm，求周长",
      "某班考试成绩如下，请画条形统计图",
    ];

    let assignmentCount = 0;
    let analysisCount = 0;
    let mistakeCount = 0;

    for (const [ci, cls] of classes.entries()) {
      const classStudents = allStudents.filter((s) => s.classId === cls.id);
      const titles = at(assignmentTitlesByClass, ci);

      // Each student gets ALL 4 assignments
      for (const [ai, title] of titles.entries()) {
        // Spread dates over last 60 days, more recent assignments more common
        const baseDaysAgo = ai * 14 + Math.floor(Math.random() * 7);

        for (const student of classStudents) {
          const daysAgo = baseDaysAgo + Math.floor(Math.random() * 5);
          const createdAt = new Date();
          createdAt.setDate(createdAt.getDate() - daysAgo);

          const assignment = await prisma.assignment.create({
            data: {
              title: `${student.name} - ${title}`,
              imageUrl: demoImageUrl,
              uploadedBy: "teacher",
              createdAt,
              studentId: student.id,
              classId: cls.id,
            },
          });
          assignmentCount++;

          // Create analysis for ~85% of assignments; the rest stay pending
          if (Math.random() > 0.15) {
            const { grade, score } = pick(gradeSamples);
            await prisma.assignment.update({
              where: { id: assignment.id },
              data: { analysisStatus: "completed" },
            });
            const shuffledStrengths = [...strengthsTemplates].sort(
              () => Math.random() - 0.5,
            );
            const shuffledImprovements = [...improvementsTemplates].sort(
              () => Math.random() - 0.5,
            );

            const analysis = await prisma.assignmentAnalysis.create({
              data: {
                score,
                grade,
                feedback: pick(feedbackTemplates),
                strengths: shuffledStrengths.slice(0, 2),
                improvements: shuffledImprovements.slice(0, 2),
                modelUsed: "demo",
                createdAt,
                assignmentId: assignment.id,
              },
            });
            analysisCount++;

            // Create 1-2 mistakes for ~55% of analyses
            if (Math.random() > 0.45) {
              const numMistakes = Math.random() > 0.6 ? 2 : 1;
              for (let mi = 0; mi < numMistakes; mi++) {
                const mistakeIdx = Math.floor(
                  Math.random() * mistakeDescriptions.length,
                );

                await prisma.mistake.create({
                  data: {
                    description: at(mistakeDescriptions, mistakeIdx),
                    originalQuestionText: at(originalQuestions, mistakeIdx),
                    correctAnswer: "参考标准答案",
                    createdAt,
                    analysisId: analysis.id,
                    studentId: student.id,
                    knowledgeAreaId: pick(knowledgeAreas).id,
                  },
                });
                mistakeCount++;
              }
            }
          }
        }
      }
    }
    console.log(
      `[10] Created ${assignmentCount} assignments across ${classes.length} classes`,
    );
    console.log(
      `     ${analysisCount} with AI analysis, ${mistakeCount} mistakes recorded\n`,
    );

    // -------------------------------------------------------
    // 11. Create exam records with analyses and exam mistakes
    // -------------------------------------------------------
    const examTitlesByClass = [
      ["第一次月考", "期中考试", "第三次月考"],
      ["第一次月考", "期中考试", "第三次月考"],
      ["第一次月考", "期中考试", "第三次月考"],
    ];

    const examFeedbackTemplates = [
      "本次考试整体表现不错，基础题得分率较高，但应用题部分失分较多，需要加强综合题型的训练。",
      "考试成绩有所进步，计算题准确率明显提高。建议在几何证明题上多下功夫，注意逻辑严密性。",
      "考试发挥正常，选择题和填空题完成较好。解答题步骤不够完整，需要养成规范答题的习惯。",
      "整体表现优秀！各题型得分均衡。继续保持良好的学习状态，可以适当挑战更高难度的题目。",
      "考试成绩有波动，基础概念掌握不够牢固。建议回归课本，先把基本知识点吃透再做题。",
      "进步很大！相比上次考试，应用题得分率提高了不少。继续保持这种学习势头。",
    ];

    let examCount = 0;
    let examAnalysisCount = 0;
    let examMistakeCount = 0;

    for (const [ci, cls] of classes.entries()) {
      const classStudents = allStudents.filter((s) => s.classId === cls.id);
      const examTitles = at(examTitlesByClass, ci);

      for (const [ei, title] of examTitles.entries()) {
        // Exams spread over last 3 months
        const baseDaysAgo = (2 - ei) * 30 + 15 + Math.floor(Math.random() * 7);

        for (const student of classStudents) {
          const daysAgo = baseDaysAgo + Math.floor(Math.random() * 3);
          const createdAt = new Date();
          createdAt.setDate(createdAt.getDate() - daysAgo);

          // Special attention students get lower scores on average
          const baseScore = student.specialAttention ? 62 : 72;
          const range = student.specialAttention ? 25 : 28;
          const score = Math.min(
            100,
            Math.max(45, baseScore + Math.floor(Math.random() * range)),
          );

          const exam = await prisma.exam.create({
            data: {
              title: `${student.name} - ${title}`,
              imageUrl: "https://placeholder.com/demo-exam.jpg",
              uploadedBy: "teacher",
              analysisStatus: "completed",
              createdAt,
              studentId: student.id,
              classId: cls.id,
            },
          });
          examCount++;

          // All exams have analysis
          const shuffledStrengths = [...strengthsTemplates].sort(
            () => Math.random() - 0.5,
          );
          const shuffledImprovements = [...improvementsTemplates].sort(
            () => Math.random() - 0.5,
          );

          const examAnalysis = await prisma.examAnalysis.create({
            data: {
              score,
              grade: `${score}`,
              feedback: pick(examFeedbackTemplates),
              strengths: shuffledStrengths.slice(0, 2),
              improvements: shuffledImprovements.slice(0, 2),
              modelUsed: "demo",
              createdAt,
              examId: exam.id,
            },
          });
          examAnalysisCount++;

          // Create 1-3 exam mistakes for students with score < 85
          if (score < 85) {
            const numMistakes = score < 60 ? 3 : score < 75 ? 2 : 1;
            for (let mi = 0; mi < numMistakes; mi++) {
              const mistakeIdx = Math.floor(
                Math.random() * mistakeDescriptions.length,
              );

              await prisma.examMistake.create({
                data: {
                  description: at(mistakeDescriptions, mistakeIdx),
                  originalQuestionText: at(originalQuestions, mistakeIdx),
                  correctAnswer: "参考标准答案",
                  createdAt,
                  analysisId: examAnalysis.id,
                  studentId: student.id,
                  knowledgeAreaId: pick(knowledgeAreas).id,
                },
              });
              examMistakeCount++;
            }
          }
        }
      }
    }
    console.log(
      `[11] Created ${examCount} exams across ${classes.length} classes`,
    );
    console.log(
      `     ${examAnalysisCount} with analysis, ${examMistakeCount} exam mistakes recorded\n`,
    );

    // -------------------------------------------------------
    // Summary
    // -------------------------------------------------------
    console.log("=== Seed Complete ===");
    console.log(`Teacher:        ${teacher.name} (${DEMO_PHONE} / ${DEMO_PASSWORD})`);
    console.log(`Parent:         ${DEMO_PARENT_NAME} (${DEMO_PARENT_PHONE} / ${DEMO_PARENT_PASSWORD})`);
    console.log(`Parent 2:       ${DEMO_SECOND_PARENT_NAME} (${DEMO_SECOND_PARENT_PHONE} / ${DEMO_PARENT_PASSWORD})`);
    console.log(`Invite code:    ${DEMO_REGISTRATION_CODE} (teacher registration)`);
    console.log(`Class codes:    ${classes.map((c) => `${c.name}=${c.invitationCode}`).join(", ")} (parent registration)`);
    console.log(`Classes:        ${classes.length}`);
    console.log(
      `Students:       ${allStudents.length} (${allStudents.filter((s) => s.specialAttention).length} with special attention)`,
    );
    console.log(`Student Groups: ${allGroups.length}`);
    console.log(`Knowledge Areas:${knowledgeAreas.length}`);
    console.log(`Materials:      ${materials.length}`);
    console.log(
      `Assignments:    ${assignmentCount} (${analysisCount} analyzed, ${mistakeCount} mistakes)`,
    );
    console.log(
      `Exams:          ${examCount} (${examAnalysisCount} analyzed, ${examMistakeCount} exam mistakes)`,
    );
    console.log("===================\n");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
