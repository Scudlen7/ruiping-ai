import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";

const demoTeachingMaterialSamples = [
  {
    title: "分数加减法讲评提纲",
    description: "覆盖通分、同分母与异分母运算的课堂讲评提纲。",
    contentType: "text" as const,
    knowledgeAreaName: "分数运算",
    textContent:
      "一、先确认分母是否一致。二、异分母必须先通分。三、结果要化成最简分数。常见错因：只看分子相加减、通分后漏改分子、结果没有约分。",
  },
  {
    title: "分数应用题错因清单",
    description: "整理学生在单位“1”、分率和数量关系上的典型错误。",
    contentType: "document" as const,
    knowledgeAreaName: "分数运算",
    textContent:
      "重点提醒：先找单位“1”，再判断已知量与对应分率。若求部分量，用单位“1”乘分率；若求单位“1”，用部分量除以分率。",
  },
  {
    title: "小数与百分数转换口诀",
    description: "适合课前热身和随堂抽查的小抄版讲义。",
    contentType: "text" as const,
    knowledgeAreaName: "小数与百分数",
    textContent:
      "小数化百分数，小数点向右移动两位并加百分号；百分数化小数，去掉百分号后小数点向左移动两位。注意补 0 与末尾 0 的处理。",
  },
  {
    title: "面积与周长辨析表",
    description: "用表格对比长方形、正方形、平行四边形和三角形的计算方式。",
    contentType: "document" as const,
    knowledgeAreaName: "几何图形",
    textContent:
      "周长关注边长总和，面积关注所占平面大小。平行四边形面积=底×高，三角形面积=底×高÷2。常见错误是把斜边当成高。",
  },
  {
    title: "几何图形课堂板书整理",
    description: "总结面积、体积与单位换算的课堂板书内容。",
    contentType: "text" as const,
    knowledgeAreaName: "几何图形",
    textContent:
      "面积单位之间每相邻两级进率是 100，体积单位之间每相邻两级进率是 1000。题目若混用单位，要先统一再计算。",
  },
  {
    title: "应用题数量关系模板",
    description: "把和差倍、工程、行程等题型拆成数量关系模板。",
    contentType: "text" as const,
    knowledgeAreaName: "应用题",
    textContent:
      "先画线段图，再写已知量、未知量和对应关系。对“比……多/少”“比值”“每份量”这类关键词要先转成算式关系。",
  },
  {
    title: "方程移项易错点提醒",
    description: "适合课后巩固的方程变形提醒卡。",
    contentType: "text" as const,
    knowledgeAreaName: "方程",
    textContent:
      "移项时本质是等式两边同时加减同一个数，不是把符号随意改掉。去括号、去分母之后要及时合并同类项并验算。",
  },
  {
    title: "统计图阅读提示卡",
    description: "帮助学生区分条形图、折线图与平均数问题的阅读顺序。",
    contentType: "text" as const,
    knowledgeAreaName: "数据统计",
    textContent:
      "先读标题和单位，再读横纵轴含义，最后比较数据变化趋势。涉及平均数时要先求总量，再除以份数。",
  },
];

async function ensureDemoTeachingMaterials(teacherId: number) {
  const existingMaterials = await db.teachingMaterial.findMany({
    where: { teacherId },
    select: { title: true },
  });

  const existingTitles = new Set(existingMaterials.map((item) => item.title));
  const missingSamples = demoTeachingMaterialSamples.filter(
    (sample) => !existingTitles.has(sample.title),
  );

  if (missingSamples.length === 0) {
    return;
  }

  const knowledgeAreas = await db.knowledgeArea.findMany({
    where: {
      name: {
        in: [
          ...new Set(missingSamples.map((sample) => sample.knowledgeAreaName)),
        ],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const knowledgeAreaMap = new Map(
    knowledgeAreas.map((area) => [area.name, area.id]),
  );

  await db.teachingMaterial.createMany({
    data: missingSamples.map((sample) => ({
      teacherId,
      title: sample.title,
      description: sample.description,
      contentType: sample.contentType,
      textContent: sample.textContent,
      knowledgeAreaId: knowledgeAreaMap.get(sample.knowledgeAreaName),
    })),
  });
}

export const loginDemo = baseProcedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    try {
      // Find the demo teacher by phone number
      const teacher = await db.teacher.findUnique({
        where: {
          phoneNumber: "13800000001",
        },
      });

      if (!teacher) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "演示账户尚未初始化，请联系管理员",
        });
      }

      await ensureDemoTeachingMaterials(teacher.id);

      startSession(ctx, { teacherId: teacher.id }, teacher.tokenVersion);

      return {
        success: true,
        teacher: {
          id: teacher.id,
          phoneNumber: teacher.phoneNumber,
          name: teacher.name,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "登录失败，请稍后重试",
      });
    }
  });
