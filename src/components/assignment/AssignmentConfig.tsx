import type {
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
} from "react-hook-form";
import { ChevronDown, Settings2 } from "lucide-react";

type AssignmentConfigFormData = {
  title: string;
  description?: string;
  selectedModel: string;
  confidenceThreshold: number;
  autoAssignStudents: boolean;
};

interface AssignmentConfigProps {
  uploadType: "assignment" | "exam";
  register: UseFormRegister<AssignmentConfigFormData>;
  watch: UseFormWatch<AssignmentConfigFormData>;
  errors: FieldErrors<AssignmentConfigFormData>;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  models: Array<{ key: string; name: string; isDefault?: boolean }> | undefined;
}

export function AssignmentConfig({
  uploadType,
  register,
  watch,
  errors,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  models,
}: AssignmentConfigProps) {
  const confidenceThreshold = watch("confidenceThreshold");
  const contentLabel = uploadType === "exam" ? "试卷" : "作业";

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-bold text-slate-900">上传设置</h4>
        <p className="mt-1 text-sm text-slate-500">
          先补充基础信息，再决定自动识别的策略和分配方式。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label
            htmlFor="title"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            {contentLabel}标题
          </label>
          <input
            {...register("title")}
            type="text"
            id="title"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={
              uploadType === "exam"
                ? "例如：期中数学试卷"
                : "例如：第 5 课时课堂作业"
            }
          />
          {errors.title ? (
            <p className="mt-2 text-sm text-rose-600">{errors.title.message}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="selectedModel"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            识别模型
          </label>
          <select
            {...register("selectedModel")}
            id="selectedModel"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {models?.map((model) => (
              <option key={model.key} value={model.key}>
                {model.name}
                {model.isDefault ? "（默认）" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            备注（可选）
          </label>
          <input
            {...register("description")}
            type="text"
            id="description"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="例如：本次重点关注计算步骤和书写规范"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={onToggleAdvancedSettings}
          className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-slate-100/80"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                识别策略
              </div>
              <div className="mt-1 text-xs text-slate-500">
                控制自动分配的谨慎程度和识别后的归档方式
              </div>
            </div>
          </div>

          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition ${
              showAdvancedSettings ? "rotate-180" : ""
            }`}
          />
        </button>

        {showAdvancedSettings ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <label
                    htmlFor="confidenceThreshold"
                    className="font-semibold text-slate-700"
                  >
                    自动匹配阈值
                  </label>
                  <span className="font-bold text-blue-600">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  {...register("confidenceThreshold", { valueAsNumber: true })}
                  type="range"
                  id="confidenceThreshold"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full accent-blue-600"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  阈值越高，系统自动分配给学生时会更保守；阈值越低，处理速度更快。
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  {...register("autoAssignStudents")}
                  type="checkbox"
                  id="autoAssignStudents"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">
                    识别后自动分配学生
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    当识别结果达到阈值时，系统会直接归档到对应学生名下。
                  </span>
                </span>
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
