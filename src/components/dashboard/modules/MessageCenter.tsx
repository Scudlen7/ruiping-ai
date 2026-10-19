import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RotateCcw,
  TrendingDown,
  UserPlus,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import { EmptyState, Panel } from "../ui";

function formatTime(value: Date | string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const KIND_LABEL = { assignment: "作业", exam: "试卷" } as const;

/** Real reminders: failed gradings, binding requests, low scores, weak areas and recent results. */
export function MessageCenter() {
  const trpc = useTRPC();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery(trpc.getTeacherNotifications.queryOptions());
  const requestsQuery = useQuery(trpc.getBindingRequests.queryOptions());

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.getTeacherNotifications.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.getBindingRequests.queryKey() }),
    ]);

  const retryMutation = useMutation(
    trpc.analyzeSubmission.mutationOptions({
      onSuccess: () => {
        toast.success("已重新提交 AI 批改");
        void refresh();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );
  const decideMutation = useMutation(
    trpc.decideBindingRequest.mutationOptions({
      onSuccess: (_, variables) => {
        toast.success(variables.approve ? "已同意绑定" : "已拒绝申请");
        void refresh();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const openStudent = (classId: number | null, studentId: number | null) => {
    if (classId == null || studentId == null) return;
    void navigate({
      to: "/classes/$classId/students/$studentId",
      params: { classId: String(classId), studentId: String(studentId) },
    });
  };

  if (notificationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const data = notificationsQuery.data;
  const requests = requestsQuery.data ?? [];
  const failed = data?.failed ?? [];
  const attentionEmpty = failed.length === 0 && requests.length === 0;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-7">
        <Panel
          title="待处理"
          subtitle={attentionEmpty ? "没有需要处理的事项" : `${failed.length + requests.length} 项需要您处理`}
        >
          {attentionEmpty ? (
            <EmptyState icon={CheckCircle2} title="全部处理完毕" description="批改失败的作业和家长绑定申请会出现在这里。" />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <MessageRow
                  key={`request-${request.id}`}
                  icon={<UserPlus className="h-5 w-5" />}
                  iconClassName="bg-amber-500"
                  title={`${request.parent.name}${request.relation ? `（${request.relation}）` : ""} 申请绑定 ${request.student.name}`}
                  text={`${request.class?.name ?? ""} · 手机 ${request.parent.phoneNumber} · 已绑定 ${request.linkedParentCount} 位家长 · ${formatTime(request.createdAt)}`}
                  actions={
                    <>
                      <button
                        onClick={() => decideMutation.mutate({ requestId: request.id, approve: true })}
                        disabled={decideMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        同意
                      </button>
                      <button
                        onClick={() => decideMutation.mutate({ requestId: request.id, approve: false })}
                        disabled={decideMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        拒绝
                      </button>
                    </>
                  }
                />
              ))}
              {failed.map((item) => (
                <MessageRow
                  key={`failed-${item.kind}-${item.id}`}
                  icon={<AlertCircle className="h-5 w-5" />}
                  iconClassName="bg-rose-500"
                  title={`${item.studentName} 的${KIND_LABEL[item.kind]}「${item.title}」批改失败`}
                  text={`${item.className} · ${formatTime(item.createdAt)}${item.error ? ` · ${item.error}` : ""}`}
                  onClick={() => openStudent(item.classId, item.studentId)}
                  actions={
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        retryMutation.mutate({ kind: item.kind, id: item.id });
                      }}
                      disabled={retryMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      重新批改
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="最近完成的批改" subtitle="近 7 天 AI 批改完成的作业与试卷">
          {data && data.completed.length > 0 ? (
            <div className="space-y-2">
              {data.completed.map((item) => (
                <MessageRow
                  key={`done-${item.kind}-${item.id}`}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  iconClassName="bg-emerald-500"
                  title={`${item.studentName} ·「${item.title}」`}
                  text={`${item.className} · ${KIND_LABEL[item.kind]} · ${item.analyzedAt ? formatTime(item.analyzedAt) : ""}`}
                  onClick={() => openStudent(item.classId, item.studentId)}
                  actions={
                    item.score !== null ? (
                      <span className={`text-sm font-bold ${item.score < 60 ? "text-rose-600" : "text-slate-900"}`}>
                        {item.score.toFixed(0)} 分
                      </span>
                    ) : null
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="近 7 天没有完成的批改" description="上传作业或试卷后，批改结果会出现在这里。" />
          )}
        </Panel>
      </div>

      <div className="space-y-6 xl:col-span-5">
        <Panel title="低分学生" subtitle="近 30 天个人均分低于 60 分">
          {data && data.lowScores.length > 0 ? (
            <div className="space-y-2">
              {data.lowScores.map((student) => (
                <MessageRow
                  key={student.studentId}
                  icon={<TrendingDown className="h-5 w-5" />}
                  iconClassName="bg-orange-500"
                  title={student.studentName}
                  text={`${student.className} · ${student.gradedCount} 次已批改`}
                  onClick={() => openStudent(student.classId, student.studentId)}
                  actions={<span className="text-sm font-bold text-rose-600">{student.averageScore.toFixed(1)}</span>}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={TrendingDown} title="暂无低分学生" description="近 30 天有成绩的学生均分都在 60 分以上。" />
          )}
        </Panel>

        <Panel title="薄弱知识点" subtitle="所有班级中掌握度低于 60% 的知识点">
          {data && data.weakAreas.length > 0 ? (
            <div className="space-y-2">
              {data.weakAreas.map((area) => (
                <MessageRow
                  key={area.knowledgeAreaId}
                  icon={<Brain className="h-5 w-5" />}
                  iconClassName="bg-violet-500"
                  title={area.name}
                  text={`${area.studentCount} 名学生有记录`}
                  onClick={() => void navigate({ to: "/dashboard/knowledge-map" })}
                  actions={<span className="text-sm font-bold text-violet-700">{area.mastery.toFixed(0)}%</span>}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Brain} title="暂无薄弱知识点" description="当某个知识点的平均掌握度低于 60% 时会在这里提醒。" />
          )}
        </Panel>
      </div>
    </section>
  );
}

function MessageRow({
  icon,
  iconClassName,
  title,
  text,
  actions,
  onClick,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  text: string;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 ${
        onClick ? "cursor-pointer transition hover:bg-blue-50" : ""
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${iconClassName}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-bold text-slate-900">{title}</h4>
        <p className="mt-0.5 truncate text-xs text-slate-500" title={text}>
          {text}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {onClick && !actions ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
    </div>
  );
}
