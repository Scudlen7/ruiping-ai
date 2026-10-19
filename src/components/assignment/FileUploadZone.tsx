import { useRef } from "react";
import { Brain, Camera, ImagePlus, Sparkles } from "lucide-react";

interface FileUploadZoneProps {
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartCamera: () => void;
  maxFiles: number;
  allowMultiple: boolean;
  uploadType: "assignment" | "exam";
}

export function FileUploadZone({
  dragActive,
  onDrag,
  onDrop,
  onFileSelect,
  onStartCamera,
  maxFiles,
  allowMultiple,
  uploadType,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUseCamera =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
  const fileLabel = uploadType === "exam" ? "试卷图片" : "作业图片";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-slate-900">上传图片</h4>
          <p className="mt-1 text-sm text-slate-500">
            支持拖拽上传和拍照录入，系统会自动压缩并尝试识别学生信息。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
            最多 {maxFiles} 份
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            {allowMultiple ? "批量处理" : "单份上传"}
          </span>
        </div>
      </div>

      <div
        className={`rounded-2xl border border-dashed px-6 py-10 text-center transition ${
          dragActive
            ? "border-blue-400 bg-blue-50/70 shadow-sm"
            : "border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50"
        }`}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <div className="mb-5 flex items-center gap-3">
            {[
              {
                icon: ImagePlus,
                iconClassName: "text-blue-600",
                wrapperClassName: "bg-blue-50",
              },
              {
                icon: Brain,
                iconClassName: "text-violet-600",
                wrapperClassName: "bg-violet-50",
              },
              {
                icon: Camera,
                iconClassName: "text-emerald-600",
                wrapperClassName: "bg-emerald-50",
              },
            ].map(({ icon: Icon, iconClassName, wrapperClassName }) => (
              <span
                key={iconClassName}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${wrapperClassName}`}
              >
                <Icon className={`h-6 w-6 ${iconClassName}`} />
              </span>
            ))}
          </div>

          <h5 className="text-xl font-bold text-slate-900">
            拖拽{fileLabel}到这里，或点击从本地选择
          </h5>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            支持 JPG、PNG、GIF、WebP。建议一次上传同一份
            {uploadType === "exam" ? "试卷" : "作业"}
            的多张图片，方便系统连续识别和归档。
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              选择图片
            </button>

            {canUseCamera ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartCamera();
                }}
                className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
              >
                <Camera className="mr-2 h-4 w-4" />
                拍照录入
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              自动压缩
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              学生识别
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              批量归档
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-blue-500" />
              智能分析
            </span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={onFileSelect}
        className="hidden"
      />
    </div>
  );
}
