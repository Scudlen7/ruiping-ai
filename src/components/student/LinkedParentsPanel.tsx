import { useMutation } from "@tanstack/react-query";
import { Phone, UserMinus, Users } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import { EmptyState, Panel } from "~/components/dashboard/ui";

export type LinkedParent = {
  id: number;
  name: string;
  phoneNumber: string;
  relation: string | null;
  linkedAt: Date | string;
};

/** Teacher view of the parents linked to a student, with unlinking. */
export function LinkedParentsPanel({
  studentId,
  studentName,
  parents,
  onChanged,
}: {
  studentId: number;
  studentName: string;
  parents: LinkedParent[];
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const toast = useToast();
  const unbindMutation = useMutation(trpc.unbindParent.mutationOptions());

  const unbind = async (parent: LinkedParent) => {
    if (!window.confirm(`确定解除「${parent.name}」与「${studentName}」的绑定吗？对方将立即无法查看该学生的报告。`)) {
      return;
    }
    try {
      await unbindMutation.mutateAsync({ studentId, parentId: parent.id });
      toast.success(`已解除 ${parent.name} 的绑定`);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Panel title="绑定家长" subtitle={parents.length > 0 ? `共 ${parents.length} 位家长可查看报告` : "家长可凭班级邀请码绑定"}>
      {parents.length > 0 ? (
        <div className="space-y-2">
          {parents.map((parent) => (
            <div key={parent.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="truncate">{parent.name}</span>
                  {parent.relation ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      {parent.relation}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {parent.phoneNumber}
                  <span className="text-slate-300">·</span>
                  {new Date(parent.linkedAt).toLocaleDateString("zh-CN")} 绑定
                </div>
              </div>
              <button
                onClick={() => void unbind(parent)}
                disabled={unbindMutation.isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <UserMinus className="h-3.5 w-3.5" />
                解绑
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="暂无绑定家长" description="把班级邀请码发给家长，家长注册时输入孩子姓名即可绑定。" />
      )}
    </Panel>
  );
}
