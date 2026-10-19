import {
  AlertCircle,
  Brain,
  CheckCircle,
  Pause,
  Play,
  Upload,
} from "lucide-react";

interface UploadSubmitSectionProps {
  uploadType: "assignment" | "exam";
  files: Array<{ id: string }>;
  queueStatus: "idle" | "running" | "paused" | "completed";
  completedCount: number;
  onPause: () => void;
  onResume: () => void;
}

export function UploadSubmitSection({
  uploadType,
  files,
  queueStatus,
  completedCount,
  onPause,
  onResume,
}: UploadSubmitSectionProps) {
  const contentLabel = uploadType === "exam" ? "试卷" : "作业";

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-bold text-slate-900">开始处理</h4>
        <p className="mt-1 text-sm text-slate-500">
          确认上传内容后开始批量识别和归档，归档后自动进入 AI 批改。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryChip label="已选" value={`${files.length} 份`} />
        <SummaryChip label="已完成" value={`${completedCount} 份`} />
      </div>

      {files.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-600 ring-1 ring-amber-200">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">提交前检查</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
                <li>确保图片中的学生姓名、题目区域和分数标注清晰可见。</li>
                <li>检查标题是否准确，便于后续在班级中回看。</li>
                <li>预计处理时间约 {Math.max(files.length * 12, 12)} 秒。</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={files.length === 0 || queueStatus === "running"}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {queueStatus === "running" ? (
            <>
              <Brain className="mr-2 h-4 w-4 animate-pulse" />
              正在处理（{completedCount}/{files.length}）
            </>
          ) : queueStatus === "completed" ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              {contentLabel}处理完成
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              开始批量处理 {files.length > 0 ? `（${files.length} 份）` : ""}
            </>
          )}
        </button>

        {queueStatus === "running" ? (
          <button
            type="button"
            onClick={onPause}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            <Pause className="mr-2 h-4 w-4" />
            暂停队列
          </button>
        ) : null}

        {queueStatus === "paused" ? (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <Play className="mr-2 h-4 w-4" />
            继续处理
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
