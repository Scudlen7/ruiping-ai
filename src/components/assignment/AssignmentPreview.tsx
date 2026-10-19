import { useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle,
  FileText,
  ImageIcon,
  Loader2,
  Pause,
  RotateCcw,
  Trash2,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";

interface RecognitionResult {
  studentName: string;
  className: string;
  confidence: number;
  reasoning: string;
}

interface AssignmentFile {
  id: string;
  file: File;
  compressedFile?: File;
  previewUrl: string;
  status:
    | "pending"
    | "compressing"
    | "uploading"
    | "recognizing"
    | "needs_review"
    | "processing"
    | "complete"
    | "error"
    | "paused";
  progress: number;
  error?: string;
  assignmentId?: number;
  retryCount: number;
  recognition?: RecognitionResult;
  selectedStudentId?: number;
  uploadedImageUrl?: string;
}

interface AssignmentPreviewProps {
  files: AssignmentFile[];
  maxFiles: number;
  students: Array<{ id: number; name: string }>;
  confidenceThreshold: number;
  queueStatus: string;
  completedCount: number;
  onRemoveFile: (fileId: string) => void;
  onClearCompleted: () => void;
  onRetryFile: (fileId: string) => void;
  onConfirmStudent: (fileId: string, studentId: number) => void;
}

const getStatusColor = (status: AssignmentFile["status"]) => {
  switch (status) {
    case "complete":
      return "text-emerald-600";
    case "error":
      return "text-rose-600";
    case "needs_review":
      return "text-amber-600";
    case "uploading":
    case "processing":
      return "text-blue-600";
    case "recognizing":
      return "text-violet-600";
    case "compressing":
      return "text-amber-600";
    case "paused":
      return "text-slate-600";
    default:
      return "text-slate-500";
  }
};

const getStatusIcon = (status: AssignmentFile["status"]) => {
  switch (status) {
    case "complete":
      return <CheckCircle className="h-4 w-4" />;
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    case "needs_review":
      return <UserCheck className="h-4 w-4" />;
    case "uploading":
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "recognizing":
      return <Brain className="h-4 w-4 animate-pulse" />;
    case "compressing":
      return <ImageIcon className="h-4 w-4 animate-pulse" />;
    case "paused":
      return <Pause className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusMessage = (status: AssignmentFile["status"]) => {
  switch (status) {
    case "compressing":
      return "正在压缩图片";
    case "uploading":
      return "正在上传文件";
    case "recognizing":
      return "正在识别学生信息";
    case "needs_review":
      return "未能自动匹配学生，请手动指定";
    case "processing":
      return "正在生成归档记录";
    case "complete":
      return "已归档，AI 批改在后台进行";
    case "error":
      return "处理失败";
    case "paused":
      return "已暂停";
    default:
      return "等待处理";
  }
};

export type { AssignmentFile, RecognitionResult };

export function AssignmentPreview({
  files,
  maxFiles,
  students,
  confidenceThreshold,
  queueStatus,
  completedCount,
  onRemoveFile,
  onClearCompleted,
  onRetryFile,
  onConfirmStudent,
}: AssignmentPreviewProps) {
  const completedPercent =
    files.length > 0 ? Math.round((completedCount / files.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-slate-900">处理队列</h4>
          <p className="mt-1 text-sm text-slate-500">
            已选 {files.length}/{maxFiles}{" "}
            份图片，系统会依次完成压缩、识别和归档。
          </p>
        </div>

        {files.some((file) => file.status === "complete") ? (
          <button
            type="button"
            onClick={onClearCompleted}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            清除已完成
          </button>
        ) : null}
      </div>

      {files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Brain className="h-7 w-7" />
            </span>
            <h5 className="mt-4 text-lg font-bold text-slate-900">
              还没有加入待处理图片
            </h5>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              上传后会先展示文件预览，再逐步展示压缩、识别学生、自动分配和处理结果。
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "自动识别",
                description: "优先识别图片中的学生姓名和班级信息。",
                iconClassName: "text-amber-600",
                wrapperClassName: "bg-amber-50",
              },
              {
                icon: Users,
                title: "自动归档",
                description: "识别置信度足够高时，自动关联到对应学生。",
                iconClassName: "text-emerald-600",
                wrapperClassName: "bg-emerald-50",
              },
              {
                icon: CheckCircle,
                title: "批量处理",
                description: "统一执行上传和分析，减少老师重复操作。",
                iconClassName: "text-blue-600",
                wrapperClassName: "bg-blue-50",
              },
            ].map(
              ({
                icon: Icon,
                title,
                description,
                iconClassName,
                wrapperClassName,
              }) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${wrapperClassName}`}
                  >
                    <Icon className={`h-5 w-5 ${iconClassName}`} />
                  </span>
                  <div className="mt-3 text-sm font-semibold text-slate-900">
                    {title}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {description}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <QueueStatCard
              label="待处理"
              value={files.length}
              hint="已加入队列"
            />
            <QueueStatCard
              label="已完成"
              value={completedCount}
              hint={`${completedPercent}%`}
            />
            <QueueStatCard
              label="自动分配阈值"
              value={`${Math.round(confidenceThreshold * 100)}%`}
              hint="低于阈值将保留人工确认"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={getStatusColor(file.status)}>
                        {getStatusIcon(file.status)}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {file.file.name}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {file.compressedFile ? (
                        <span className="text-emerald-600">
                          压缩后{" "}
                          {(file.compressedFile.size / 1024 / 1024).toFixed(2)}{" "}
                          MB
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {getStatusMessage(file.status)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={file.previewUrl}
                      alt="文件预览"
                      className="h-28 w-full object-cover"
                    />
                    {file.status !== "pending" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                        <div
                          className={`rounded-full bg-white p-2 shadow ${getStatusColor(file.status)}`}
                        >
                          {getStatusIcon(file.status)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {file.status !== "pending" &&
                    file.status !== "complete" &&
                    file.status !== "needs_review" &&
                    file.status !== "error" ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span>处理进度</span>
                          <span>{Math.round(file.progress)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {file.recognition ? (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-blue-800">
                            识别结果
                          </span>
                          <span className="text-xs font-bold text-blue-600">
                            {Math.round(file.recognition.confidence * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                          <p>
                            <span className="font-medium text-slate-800">
                              学生：
                            </span>
                            {file.recognition.studentName || "未识别"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">
                              班级：
                            </span>
                            {file.recognition.className || "未识别"}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {file.status === "needs_review" ? (
                      <ManualStudentAssign
                        students={students}
                        hint={
                          file.recognition
                            ? file.recognition.confidence < confidenceThreshold
                              ? "识别置信度低于阈值，请确认这份内容属于哪位学生"
                              : "识别出的姓名不在本班名单中，请手动指定"
                            : "未能识别学生信息，请手动指定"
                        }
                        error={file.error}
                        onConfirm={(studentId) =>
                          onConfirmStudent(file.id, studentId)
                        }
                      />
                    ) : null}

                    {file.status === "error" ? (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                        <p className="text-xs leading-5 text-rose-700">
                          {file.error}
                        </p>
                        {file.retryCount < 3 ? (
                          <button
                            type="button"
                            onClick={() => onRetryFile(file.id)}
                            className="mt-2 inline-flex items-center text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            重新尝试（{file.retryCount}/3）
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {queueStatus !== "idle" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {queueStatus === "running" ? (
                <Zap className="h-4 w-4 animate-pulse text-blue-600" />
              ) : null}
              {queueStatus === "paused" ? (
                <Pause className="h-4 w-4 text-amber-600" />
              ) : null}
              {queueStatus === "completed" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : null}

              <span className="text-sm font-semibold text-slate-700">
                {queueStatus === "running" && "系统正在批量处理上传队列"}
                {queueStatus === "paused" && "上传队列已暂停"}
                {queueStatus === "completed" && "上传队列已处理完成"}
              </span>
            </div>

            <span className="text-xs font-medium text-slate-500">
              {completedCount}/{files.length}
            </span>
          </div>

          <div className="h-2 rounded-full bg-white">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${completedPercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ManualStudentAssign({
  students,
  hint,
  error,
  onConfirm,
}: {
  students: Array<{ id: number; name: string }>;
  hint: string;
  error?: string;
  onConfirm: (studentId: number) => void;
}) {
  const [studentId, setStudentId] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
      <label className="mb-2 block text-xs font-medium text-amber-800">
        {hint}
      </label>
      <div className="flex gap-2">
        <select
          value={studentId ?? ""}
          onChange={(event) =>
            setStudentId(event.target.value ? Number(event.target.value) : null)
          }
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">选择学生</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={studentId === null}
          onClick={() => studentId !== null && onConfirm(studentId)}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          确认归档
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs leading-5 text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

function QueueStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
