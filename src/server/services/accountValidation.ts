import { z } from "zod";

export const phoneSchema = z.string().trim().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码");

export const passwordSchema = z
  .string()
  .min(8, "密码至少需要8个字符")
  .max(72, "密码不能超过72个字符")
  .regex(/(?=.*[a-z])/, "密码需要包含至少一个小写字母")
  .regex(/(?=.*[A-Z])/, "密码需要包含至少一个大写字母")
  .regex(/(?=.*\d)/, "密码需要包含至少一个数字");
