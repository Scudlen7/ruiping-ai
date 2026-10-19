import {
  AlertCircle,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  formatScore,
  MASTERY_LEVEL_LABELS,
  type MasteryLevel,
} from "~/lib/grading";
import type { SubmissionRef } from "~/components/student/SubmissionAnalysisModal";

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type SubmissionRecordItem = {
  id: number;
  kind: "assignment" | "exam";
  title: string;
  date: string;
  status: AnalysisStatus;
  error: string | null;
  score: number | null;
  type: string;
};

const STATUS_BADGES: Record<
  AnalysisStatus,
  { label: string; className: string; icon: typeof CheckCircle; spin?: boolean }
> = {
  pending: { label: "待批改", className: "bg-slate-100 text-slate-600", icon: Clock },
  processing: { label: "批改中", className: "bg-blue-50 text-blue-700", icon: Loader2, spin: true },
  completed: { label: "已批改", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle },
  failed: { label: "批改失败", className: "bg-rose-50 text-rose-700", icon: AlertCircle },
};

export function SubmissionRecordList({
  items,
  onOpen,
  onReanalyze,
  reanalyzing,
}: {
  items: SubmissionRecordItem[];
  onOpen: (submission: SubmissionRef) => void;
  onReanalyze: (submission: SubmissionRef) => void;
  reanalyzing: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const badge = STATUS_BADGES[item.status];
        const BadgeIcon = badge.icon;
        const ref = { kind: item.kind, id: item.id };
        return (
          <div
            key={`${item.kind}-${item.id}`}
            className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100"
          >
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => onOpen(ref)}
                className="min-w-0 text-left"
              >
                <div className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600">
                  {item.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {item.type} · {item.date}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {item.status === "completed" ? (
                  <span className="text-lg font-bold text-slate-900">
                    {formatScore(item.score)}
                    {item.score !== null ? (
                      <span className="ml-0.5 text-xs font-medium text-slate-400">分</span>
                    ) : null}
                  </span>
                ) : null}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                >
                  <BadgeIcon className={`h-3.5 w-3.5 ${badge.spin ? "animate-spin" : ""}`} />
                  {badge.label}
                </span>
              </div>
            </div>

            {item.status !== "processing" ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-rose-600" title={item.error ?? undefined}>
                  {item.status === "failed" ? item.error ?? "未知错误" : ""}
                </p>
                <div className="flex shrink-0 gap-2">
                  {item.status === "failed" || item.status === "pending" ? (
                    <button
                      type="button"
                      disabled={reanalyzing}
                      onClick={() => onReanalyze(ref)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:text-blue-600 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {item.status === "failed" ? "重新分析" : "开始分析"}
                    </button>
                  ) : null}
                  {item.status === "completed" ? (
                    <button
                      type="button"
                      onClick={() => onOpen(ref)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      查看批改
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RecordListEmpty({
  icon: Icon,
  label,
}: {
  icon: typeof FileText;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

const MASTERY_BADGE_CLASSES: Record<MasteryLevel, string> = {
  advanced: "bg-emerald-50 text-emerald-700",
  intermediate: "bg-amber-50 text-amber-700",
  beginner: "bg-rose-50 text-rose-700",
};

const MASTERY_BAR_CLASSES: Record<MasteryLevel, string> = {
  advanced: "bg-emerald-500",
  intermediate: "bg-amber-500",
  beginner: "bg-rose-500",
};

export function KnowledgeMasteryGrid({
  items,
}: {
  items: Array<{
    id: number;
    mastery: number;
    evidenceCount: number;
    proficiencyLevel: MasteryLevel;
    knowledgeArea: { name: string };
  }>;
}) {
  if (items.length === 0) {
    return <RecordListEmpty icon={Brain} label="暂无知识点掌握记录" />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">
              {item.knowledgeArea.name}
            </div>
            <span
              className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${MASTERY_BADGE_CLASSES[item.proficiencyLevel]}`}
            >
              {MASTERY_LEVEL_LABELS[item.proficiencyLevel]}
            </span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white">
            <div
              className={`h-1.5 rounded-full ${MASTERY_BAR_CLASSES[item.proficiencyLevel]}`}
              style={{ width: `${Math.round(item.mastery * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>掌握度 {Math.round(item.mastery * 100)}%</span>
            <span>依据 {item.evidenceCount} 次批改</span>
          </div>
        </div>
      ))}
    </div>
  );
}
