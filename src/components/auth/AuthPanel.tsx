import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Baby,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  NotebookTabs,
  Phone,
  School,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { RELATION_SUGGESTIONS } from "~/lib/parentRelations";
import { useSignIn } from "~/components/auth/useSignIn";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";

type Role = "teacher" | "parent";
type Mode = "login" | "register";

const ROLE_LABELS: Record<Role, string> = { teacher: "教师", parent: "家长" };

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "至少 8 位" },
  { test: (p: string) => /[a-z]/.test(p), label: "小写字母" },
  { test: (p: string) => /[A-Z]/.test(p), label: "大写字母" },
  { test: (p: string) => /\d/.test(p), label: "数字" },
];

const emptyForm = {
  name: "",
  phoneNumber: "",
  password: "",
  invitationCode: "",
  classInvitationCode: "",
  childName: "",
  familyInviteCode: "",
  relation: "",
};

type ParentBindMode = "class" | "family";

export function AuthPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const trpc = useTRPC();
  const signIn = useSignIn();

  const [role, setRole] = useState<Role>("teacher");
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [parentBindMode, setParentBindMode] = useState<ParentBindMode>("class");

  const policyQuery = useQuery(trpc.getRegistrationPolicy.queryOptions());
  const invitationCodeRequired = policyQuery.data?.teacherInvitationCodeRequired ?? true;

  const loginTeacher = useMutation(trpc.loginTeacher.mutationOptions());
  const loginParent = useMutation(trpc.loginParent.mutationOptions());
  const registerTeacher = useMutation(trpc.registerTeacher.mutationOptions());
  const registerParent = useMutation(trpc.registerParent.mutationOptions());
  const demoTeacher = useMutation(trpc.loginDemo.mutationOptions());
  const demoParent = useMutation(trpc.loginDemoParent.mutationOptions());

  const submitting =
    loginTeacher.isPending || loginParent.isPending || registerTeacher.isPending || registerParent.isPending;

  const update = (field: keyof typeof emptyForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const goHome = (target: Role) =>
    void navigate({ to: target === "teacher" ? "/dashboard" : "/parent-dashboard", replace: true });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const phoneNumber = form.phoneNumber.trim();
    try {
      if (mode === "login") {
        if (role === "teacher") {
          const result = await loginTeacher.mutateAsync({ phoneNumber, password: form.password });
          signIn.teacher(result.teacher);
          toast.success(`欢迎回来，${result.teacher.name}`);
        } else {
          const result = await loginParent.mutateAsync({ phoneNumber, password: form.password });
          signIn.parent(result.parent);
          toast.success(`欢迎回来，${result.parent.name}`);
        }
      } else if (role === "teacher") {
        const result = await registerTeacher.mutateAsync({
          name: form.name.trim(),
          phoneNumber,
          password: form.password,
          invitationCode: form.invitationCode.trim() || undefined,
        });
        signIn.teacher(result.teacher);
        toast.success("注册成功，欢迎使用睿评 AI");
      } else {
        const result = await registerParent.mutateAsync({
          name: form.name.trim(),
          phoneNumber,
          password: form.password,
          relation: form.relation.trim() || undefined,
          ...(parentBindMode === "family"
            ? { familyInviteCode: form.familyInviteCode.trim() }
            : { classInvitationCode: form.classInvitationCode.trim(), childName: form.childName.trim() }),
        });
        signIn.parent(result.parent);
        if (result.status === "pending") {
          toast.success("注册成功。该孩子已有家长绑定，申请已提交给班主任审批");
        } else {
          const child = result.parent.children.find((c) => c.id === result.studentId);
          toast.success(`注册成功，已绑定 ${child?.name ?? "孩子"}`);
        }
      }
      goHome(role);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDemo = async (target: Role) => {
    try {
      if (target === "teacher") {
        const result = await demoTeacher.mutateAsync({});
        signIn.teacher(result.teacher);
      } else {
        const result = await demoParent.mutateAsync();
        signIn.parent(result.parent);
      }
      goHome(target);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setForm((current) => ({ ...emptyForm, phoneNumber: current.phoneNumber }));
  };

  const isRegister = mode === "register";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <NotebookTabs className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
          {isRegister ? `注册${ROLE_LABELS[role]}账号` : "登录账号"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {isRegister
            ? role === "teacher"
              ? invitationCodeRequired
                ? "教师注册需要管理员发放的邀请码"
                : "填写信息即可创建教师账号"
              : "使用老师提供的班级邀请码，或家人分享的家庭邀请码绑定孩子"
            : "输入手机号和密码登录，或直接体验演示环境"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-md bg-slate-100 p-1">
        {(["teacher", "parent"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={`h-10 rounded-md text-sm font-bold transition ${
              role === item ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {ROLE_LABELS[item]}{isRegister ? "注册" : "登录"}
          </button>
        ))}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {isRegister ? (
          <Field icon={User} label={role === "teacher" ? "姓名" : "家长姓名"}>
            <input
              value={form.name}
              onChange={(e) => update("name")(e.target.value)}
              placeholder={role === "teacher" ? "请输入您的姓名" : "例如：张明轩妈妈"}
              autoComplete="name"
              required
              className={inputClass}
            />
          </Field>
        ) : null}

        <Field icon={Phone} label="手机号">
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(e) => update("phoneNumber")(e.target.value)}
            placeholder="请输入 11 位手机号"
            autoComplete="tel"
            inputMode="numeric"
            maxLength={11}
            required
            className={inputClass}
          />
        </Field>

        <Field
          icon={Lock}
          label="密码"
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              className="text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
        >
          <input
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(e) => update("password")(e.target.value)}
            placeholder={isRegister ? "设置登录密码" : "请输入密码"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            className={inputClass}
          />
        </Field>
        {isRegister && form.password ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {PASSWORD_RULES.map((rule) => (
              <span
                key={rule.label}
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  rule.test(form.password) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {rule.label}
              </span>
            ))}
          </div>
        ) : null}

        {isRegister && role === "teacher" ? (
          <Field icon={KeyRound} label={invitationCodeRequired ? "邀请码" : "邀请码（可选）"}>
            <input
              value={form.invitationCode}
              onChange={(e) => update("invitationCode")(e.target.value)}
              placeholder="例如 EDU-XXXX-XXXX"
              required={invitationCodeRequired}
              className={`${inputClass} uppercase`}
            />
          </Field>
        ) : null}

        {isRegister && role === "parent" ? (
          <>
            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 text-xs font-bold">
              {(
                [
                  ["class", "用班级邀请码"],
                  ["family", "用家庭邀请码"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setParentBindMode(value)}
                  className={`h-8 rounded-md transition ${
                    parentBindMode === value ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {parentBindMode === "class" ? (
              <>
                <Field icon={School} label="班级邀请码">
                  <input
                    value={form.classInvitationCode}
                    onChange={(e) => update("classInvitationCode")(e.target.value)}
                    placeholder="向孩子的老师获取"
                    required
                    className={`${inputClass} uppercase`}
                  />
                </Field>
                <Field icon={Baby} label="孩子姓名">
                  <input
                    value={form.childName}
                    onChange={(e) => update("childName")(e.target.value)}
                    placeholder="与老师登记的姓名一致"
                    required
                    className={inputClass}
                  />
                </Field>
              </>
            ) : (
              <Field icon={Ticket} label="家庭邀请码">
                <input
                  value={form.familyInviteCode}
                  onChange={(e) => update("familyInviteCode")(e.target.value)}
                  placeholder="如 ABCD-EFGH，由已绑定的家人生成"
                  required
                  className={`${inputClass} uppercase tracking-widest`}
                />
              </Field>
            )}
            <Field icon={Users} label="与孩子的关系（选填）">
              <input
                value={form.relation}
                onChange={(e) => update("relation")(e.target.value)}
                list="register-relation-suggestions"
                maxLength={20}
                placeholder="如：爸爸、妈妈、爷爷"
                className={inputClass}
              />
              <datalist id="register-relation-suggestions">
                {RELATION_SUGGESTIONS.map((relation) => (
                  <option key={relation} value={relation} />
                ))}
              </datalist>
            </Field>
          </>
        ) : null}

        {!isRegister ? (
          <div className="flex justify-end text-sm">
            <button
              type="button"
              onClick={() =>
                toast.info(role === "teacher" ? "请联系管理员重置密码" : "请联系孩子的老师或管理员重置密码")
              }
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              忘记密码？
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isRegister ? "注册并登录" : "登录"}
        </button>
      </form>

      {!isRegister ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleDemo("teacher")}
            disabled={demoTeacher.isPending}
            className="h-11 rounded-md border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
          >
            {demoTeacher.isPending ? "进入中..." : "体验教师端"}
          </button>
          <button
            type="button"
            onClick={() => void handleDemo("parent")}
            disabled={demoParent.isPending}
            className="h-11 rounded-md border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            {demoParent.isPending ? "进入中..." : "体验家长端"}
          </button>
        </div>
      ) : null}

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        {isRegister ? "已有账号？" : "还没有账号？"}
        <button
          type="button"
          onClick={() => switchMode(isRegister ? "login" : "register")}
          className="ml-1 font-bold text-blue-600 hover:text-blue-700"
        >
          {isRegister ? "去登录" : "立即注册"}
        </button>
      </p>
    </div>
  );
}

const inputClass =
  "w-full border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0";

function Field({
  icon: Icon,
  label,
  trailing,
  children,
}: {
  icon: typeof User;
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="mt-2 flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
        {children}
        {trailing}
      </span>
    </label>
  );
}
