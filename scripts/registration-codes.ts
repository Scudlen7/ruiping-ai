/**
 * Teacher registration invitation codes.
 *
 *   pnpm codes create [--uses 5] [--days 30] [--note "某某学校"] [--code EDU-XXXX-XXXX] [--count 1]
 *   pnpm codes list [--all]
 *   pnpm codes revoke <CODE>
 */
import { db } from "../src/server/db";
import { generateRegistrationCode } from "../src/server/services/registration";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} 必须是正整数`);
  return parsed;
}

function status(code: { usedCount: number; maxUses: number; expiresAt: Date | null; revokedAt: Date | null }) {
  if (code.revokedAt) return "已作废";
  if (code.expiresAt && code.expiresAt <= new Date()) return "已过期";
  if (code.usedCount >= code.maxUses) return "已用完";
  return "可用";
}

async function create(args: string[]) {
  const maxUses = positiveInt(option(args, "uses"), 1, "uses");
  const days = option(args, "days");
  const count = positiveInt(option(args, "count"), 1, "count");
  const custom = option(args, "code")?.trim().toUpperCase();
  if (custom && count > 1) throw new Error("--code 不能与 --count 同时使用");

  const expiresAt = days ? new Date(Date.now() + positiveInt(days, 1, "days") * 86_400_000) : null;
  const note = option(args, "note") ?? null;

  for (let i = 0; i < count; i++) {
    const created = await db.registrationCode.create({
      data: { code: custom ?? generateRegistrationCode(), maxUses, expiresAt, note },
    });
    console.log(
      `${created.code}  可用 ${maxUses} 次  ${expiresAt ? `有效期至 ${expiresAt.toLocaleString("zh-CN")}` : "永久有效"}${note ? `  备注：${note}` : ""}`,
    );
  }
}

async function list(args: string[]) {
  const codes = await db.registrationCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { teachers: { select: { name: true, phoneNumber: true } } },
  });
  const shown = args.includes("--all") ? codes : codes.filter((c) => status(c) === "可用");
  if (shown.length === 0) {
    console.log(args.includes("--all") ? "还没有邀请码" : "没有可用的邀请码（--all 查看全部）");
    return;
  }
  for (const c of shown) {
    console.log(
      `${c.code.padEnd(16)} ${status(c).padEnd(4)} 已用 ${c.usedCount}/${c.maxUses}  ` +
        `${c.expiresAt ? `至 ${c.expiresAt.toLocaleDateString("zh-CN")}` : "永久"}${c.note ? `  ${c.note}` : ""}`,
    );
    for (const t of c.teachers) console.log(`    └ ${t.name} (${t.phoneNumber})`);
  }
}

async function revoke(args: string[]) {
  const code = args[0]?.trim().toUpperCase();
  if (!code) throw new Error("用法：pnpm codes revoke <CODE>");
  const result = await db.registrationCode.updateMany({ where: { code, revokedAt: null }, data: { revokedAt: new Date() } });
  console.log(result.count ? `已作废 ${code}` : `${code} 不存在或已作废`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "create":
      return create(args);
    case "list":
      return list(args);
    case "revoke":
      return revoke(args);
    default:
      console.log("用法：pnpm codes <create|list|revoke> ...（详见 scripts/registration-codes.ts 顶部说明）");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
