import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Clock, Copy, KeyRound, Loader2, LogOut, Ticket, UserPlus, XCircle } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/trpc/root";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import { Panel } from "~/components/dashboard/ui";
import { RELATION_SUGGESTIONS } from "~/lib/parentRelations";

type ParentOverview = inferRouterOutputs<AppRouter>["getParentOverview"];
export type FamilyMember = ParentOverview["children"][number]["family"][number];
export type BindingRequest = ParentOverview["requests"][number];

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-4 text-sm focus:border-blue-400 focus:ring-0";

export function RelationInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">与孩子的关系（选填）</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list="relation-suggestions"
        maxLength={20}
        placeholder="如：爸爸、妈妈、爷爷"
        className={inputClass}
      />
      <datalist id="relation-suggestions">
        {RELATION_SUGGESTIONS.map((relation) => (
          <option key={relation} value={relation} />
        ))}
      </datalist>
    </label>
  );
}

type LinkMode = "class" | "family";

/**
 * Links a child either with the class code + name (direct for the first parent, otherwise a request
 * the teacher approves) or with a family invite code from a parent who is already linked.
 */
export function LinkChildForm({
  onLinked,
  onRequested,
}: {
  onLinked: (childId: number) => void;
  onRequested: () => void;
}) {
  const trpc = useTRPC();
  const toast = useToast();
  const { setParentAuth } = useAuthStore();
  const [mode, setMode] = useState<LinkMode>("class");
  const [classInvitationCode, setClassInvitationCode] = useState("");
  const [childName, setChildName] = useState("");
  const [familyInviteCode, setFamilyInviteCode] = useState("");
  const [relation, setRelation] = useState("");
  const linkMutation = useMutation(trpc.linkChild.mutationOptions());
  const joinMutation = useMutation(trpc.joinFamily.mutationOptions());
  const pending = linkMutation.isPending || joinMutation.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result =
        mode === "class"
          ? await linkMutation.mutateAsync({ classInvitationCode, childName, relation: relation || undefined })
          : await joinMutation.mutateAsync({ familyInviteCode, relation: relation || undefined });
      setParentAuth(result.parent);
      if (result.status === "pending") {
        toast.success("该孩子已有家长绑定，申请已提交给班主任审批");
        onRequested();
      } else {
        const child = result.parent.children.find((c) => c.id === result.studentId);
        toast.success(`已绑定 ${child?.name ?? "孩子"}`);
        onLinked(result.studentId);
      }
      setClassInvitationCode("");
      setChildName("");
      setFamilyInviteCode("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
        {(
          [
            ["class", "班级邀请码"],
            ["family", "家庭邀请码"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-md py-2 transition ${mode === value ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "class" ? (
        <>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">班级邀请码</span>
            <input
              value={classInvitationCode}
              onChange={(event) => setClassInvitationCode(event.target.value)}
              placeholder="老师提供的班级邀请码"
              className={`${inputClass} uppercase`}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">孩子姓名</span>
            <input
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder="与老师登记的姓名一致"
              className={inputClass}
              required
            />
          </label>
          <p className="text-xs leading-5 text-slate-500">
            如果孩子已经有其他家长绑定，会提交申请由班主任审批；也可以让已绑定的家人生成「家庭邀请码」，即时生效。
          </p>
        </>
      ) : (
        <label className="block">
          <span className="text-sm font-bold text-slate-700">家庭邀请码</span>
          <input
            value={familyInviteCode}
            onChange={(event) => setFamilyInviteCode(event.target.value)}
            placeholder="如 ABCD-EFGH，由已绑定的家人生成"
            className={`${inputClass} uppercase tracking-widest`}
            required
          />
        </label>
      )}

      <RelationInput value={relation} onChange={setRelation} />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {mode === "class" ? "绑定孩子" : "加入家庭"}
      </button>
    </form>
  );
}

export function BindingRequestNotice({ requests }: { requests: BindingRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {requests.map((request) => {
        const rejected = request.status === "rejected";
        return (
          <div
            key={request.id}
            className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 ${
              rejected ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-amber-50 text-amber-800 ring-amber-100"
            }`}
          >
            {rejected ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <span className="font-bold">
                {request.childName}
                {request.className ? `（${request.className}）` : ""}
              </span>
              {rejected
                ? " 的绑定申请未通过。如有疑问请联系班主任，或让已绑定的家人生成家庭邀请码。"
                : ` 的绑定申请已提交（${new Date(request.createdAt).toLocaleDateString("zh-CN")}），等待班主任审批。`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Family members linked to one child, with family invite generation and leaving. */
export function FamilyPanel({
  childId,
  childName,
  family,
  maxParents,
  onChanged,
}: {
  childId: number;
  childName: string;
  family: FamilyMember[];
  maxParents: number;
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const toast = useToast();
  const { setParentAuth } = useAuthStore();
  const [invite, setInvite] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState(false);
  const inviteMutation = useMutation(trpc.createFamilyInvite.mutationOptions());
  const leaveMutation = useMutation(trpc.leaveChild.mutationOptions());
  const full = family.length >= maxParents;

  const createInvite = async () => {
    try {
      const result = await inviteMutation.mutateAsync({ studentId: childId });
      setInvite({ code: result.code, expiresAt: new Date(result.expiresAt) });
      setCopied(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
    } catch {
      toast.error("复制失败，请手动记下邀请码");
    }
  };

  const leave = async () => {
    if (!window.confirm(`确定解除与「${childName}」的绑定吗？解除后将无法查看该孩子的报告。`)) return;
    try {
      const result = await leaveMutation.mutateAsync({ studentId: childId });
      setParentAuth(result.parent);
      toast.success("已解除绑定");
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Panel title="家庭成员" subtitle={`已绑定 ${family.length} / ${maxParents} 位家长，都能查看报告和上传作业`}>
      <div className="space-y-2">
        {family.map((member) => (
          <div key={member.parentId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                {member.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="truncate">{member.name}</span>
                  {member.relation ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      {member.relation}
                    </span>
                  ) : null}
                  {member.isMe ? <span className="text-xs font-semibold text-blue-600">（我）</span> : null}
                </div>
                <div className="text-xs text-slate-500">{member.maskedPhone}</div>
              </div>
            </div>
            {member.isMe ? (
              <button
                onClick={() => void leave()}
                disabled={leaveMutation.isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                解除绑定
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4">
        {invite ? (
          <div>
            <div className="text-xs font-semibold text-slate-500">家庭邀请码（仅可使用一次）</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-slate-900">{invite.code}</span>
              <button
                onClick={() => void copyInvite()}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {invite.expiresAt.toLocaleDateString("zh-CN")} 前有效。家人在注册或「添加孩子」时选择「家庭邀请码」并输入即可。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              {full ? "家长人数已达上限，如需调整请联系老师。" : "邀请爸爸妈妈或长辈一起关注孩子的学习。"}
            </div>
            <button
              onClick={() => void createInvite()}
              disabled={full || inviteMutation.isPending}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              生成家庭邀请码
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}