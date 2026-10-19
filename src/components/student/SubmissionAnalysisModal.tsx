import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Lightbulb,
  Loader2,
  Target,
  X,
} from "lucide-react";
import { ModalWrapper } from "~/components/ModalWrapper";
import { useTRPC } from "~/trpc/react";
import { getErrorMessage } from "~/utils/trpcError";
import {
  formatScore,
  SCORE_LEVEL_LABELS,
  scoreToLevel,
} from "~/lib/grading";

export type SubmissionRef = { kind: "assignment" | "exam"; id: number };

const STATUS_LABELS = {
  pending: "等待批改",
  processing: "AI 批改中",
  completed: "已批改",
  failed: "批改失败",
} as const;

export function SubmissionAnalysisModal({
  submission,
  onClose,
}: {
  submission: SubmissionRef | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();

  const detailQuery = useQuery({
    ...trpc.getSubmissionAnalysis.queryOptions({
      kind: submission?.kind ?? "assignment",
      id: submission?.id ?? 0,
    }),
    enabled: !!submission,
    retry: false,
  });

  const detail = detailQuery.data;
  const analysis = detail?.analysis;
  const label = submission?.kind === "exam" ? "试卷" : "作业";

  return (
    <ModalWrapper isOpen={!!submission} onClose={onClose} maxWidth="max-w-5xl">
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-900">
              {detail?.title ?? `${label}批改报告`}
            </h3>
            {detail ? (
              <p className="mt-1 text-xs text-slate-500">
                {detail.student?.name ?? "未关联学生"}
                {detail.student?.className ? ` · ${detail.student.className}` : ""}
                {" · "}
                {new Date(detail.createdAt).toLocaleString("zh-CN")}
                {" · "}
                {STATUS_LABELS[detail.analysisStatus]}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              正在加载批改结果…
            </div>
          ) : detailQuery.isError ? (
            <Notice tone="error" text={getErrorMessage(detailQuery.error)} />
          ) : !detail ? null : !analysis ? (
            <Notice
              tone={detail.analysisStatus === "failed" ? "error" : "info"}
              text={
                detail.analysisStatus === "failed"
                  ? `批改失败：${detail.analysisError ?? "未知原因"}。可在列表中点击「重新分析」。`
                  : "AI 正在批改，完成后这里会显示分数、错题和知识点分析。"
              }
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <section className="flex flex-wrap items-end gap-6 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-100">
                  <div>
                    <div className="text-xs font-medium text-slate-500">得分（百分制）</div>
                    <div className="mt-1 text-4xl font-bold text-slate-900">
                      {formatScore(analysis.score)}
                    </div>
                  </div>
                  {analysis.score !== null ? (
                    <span className="mb-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                      {SCORE_LEVEL_LABELS[scoreToLevel(analysis.score)]}
                    </span>
                  ) : null}
                  <div className="mb-1 text-xs text-slate-500">
                    {analysis.grade
                      ? `卷面标注：${analysis.grade}`
                      : analysis.score !== null
                        ? "卷面无分数，由 AI 根据作答估算"
                        : "无法判断分数"}
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-bold text-slate-900">总体评价</h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {analysis.feedback}
                  </p>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  <BulletList
                    title="做得好的地方"
                    icon={CheckCircle}
                    iconClassName="text-emerald-600"
                    items={analysis.strengths}
                  />
                  <BulletList
                    title="需要改进"
                    icon={Lightbulb}
                    iconClassName="text-amber-600"
                    items={analysis.improvements}
                  />
                </div>

                <section>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Target className="h-4 w-4 text-rose-600" />
                    错题明细（{analysis.mistakes.length}）
                  </h4>
                  {analysis.mistakes.length === 0 ? (
                    <p className="text-sm text-slate-500">本次没有识别到错题。</p>
                  ) : (
                    <div className="space-y-3">
                      {analysis.mistakes.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                              {m.knowledgeArea ?? "未分类"}
                            </span>
                            <span className="text-sm font-medium text-slate-900">
                              {m.description}
                            </span>
                          </div>
                          <dl className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                            {m.originalQuestionText ? (
                              <div><dt className="inline font-medium text-slate-800">题目：</dt><dd className="inline">{m.originalQuestionText}</dd></div>
                            ) : null}
                            {m.studentAnswer ? (
                              <div><dt className="inline font-medium text-slate-800">学生作答：</dt><dd className="inline">{m.studentAnswer}</dd></div>
                            ) : null}
                            {m.correctAnswer ? (
                              <div><dt className="inline font-medium text-slate-800">正确答案：</dt><dd className="inline">{m.correctAnswer}</dd></div>
                            ) : null}
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <p className="text-xs text-slate-400">
                  批改模型：{analysis.modelUsed ?? "未知"} · 批改时间：
                  {new Date(analysis.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>

              <aside>
                <h4 className="mb-2 text-sm font-bold text-slate-900">原始{label}</h4>
                {detail.imageUrl ? (
                  <a
                    href={detail.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <img
                      src={detail.imageUrl}
                      alt={`${label}原图`}
                      className="max-h-[60vh] w-full object-contain"
                    />
                    <span className="flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-500 group-hover:text-blue-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                      查看原图
                    </span>
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">原图不可用</p>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

function Notice({ tone, text }: { tone: "error" | "info"; text: string }) {
  const className =
    tone === "error"
      ? "border-rose-100 bg-rose-50 text-rose-700"
      : "border-blue-100 bg-blue-50 text-blue-700";
  const Icon = tone === "error" ? AlertCircle : Loader2;
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "info" ? "animate-spin" : ""}`} />
      <span>{text}</span>
    </div>
  );
}

function BulletList({
  title,
  icon: Icon,
  iconClassName,
  items,
}: {
  title: string;
  icon: typeof CheckCircle;
  iconClassName: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Icon className={`h-4 w-4 ${iconClassName}`} />
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">暂无</p>
      ) : (
        <ul className="space-y-1 text-sm leading-6 text-slate-700">
          {items.map((item, index) => (
            <li key={index}>• {item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
