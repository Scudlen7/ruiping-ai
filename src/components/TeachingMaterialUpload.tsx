import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  File,
  FileText,
  Image,
  Loader2,
  Music,
  Plus,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";

const uploadSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
  contentType: z.enum(["document", "image", "text", "video", "audio", "other"]),
  textContent: z.string().optional(),
  knowledgeAreaId: z.number().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;
type MaterialContentType = UploadFormData["contentType"];
type UploadVariant = "modal" | "page";
type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "generic";
type SupportedUploadFileType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/heic"
  | "image/heif"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "video/mp4"
  | "video/quicktime"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/x-m4a"
  | "audio/mp4"
  | "text/plain";

interface KnowledgeArea {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface TeachingMaterialFormValue {
  id?: number;
  title: string;
  description?: string | null;
  contentType: MaterialContentType;
  fileUrl?: string | null;
  textContent?: string | null;
  knowledgeAreaId?: number;
}

export interface TeachingMaterialSaveResult {
  id: number;
  title: string;
  description?: string | null;
  contentType: string;
  fileUrl?: string | null;
  textContent?: string | null;
  knowledgeArea?: KnowledgeArea | null;
  createdAt: Date;
  updatedAt?: Date;
}

interface TeachingMaterialUploadProps {
  mode?: "create" | "edit";
  initialMaterial?: TeachingMaterialFormValue | null;
  onSuccess?: (material?: TeachingMaterialSaveResult) => void;
  onClose?: () => void;
  variant?: UploadVariant;
}

const CONTENT_TYPE_OPTIONS: Array<{
  value: MaterialContentType;
  label: string;
  description: string;
}> = [
  {
    value: "text",
    label: "文本资料",
    description: "直接录入讲义、讲评或知识点摘录",
  },
  {
    value: "document",
    label: "文档",
    description: "支持 PDF、Word、Excel、TXT",
  },
  { value: "image", label: "图片", description: "上传板书、题图或课堂截图" },
  { value: "video", label: "视频", description: "上传讲解视频或录屏素材" },
  { value: "audio", label: "音频", description: "上传语音讲解或听力材料" },
  { value: "other", label: "其他", description: "保留给暂不分类的辅助资料" },
];

const CONTENT_TYPE_META: Record<
  Exclude<MaterialContentType, "text">,
  {
    accept: string;
    helper: string;
    supportedMimeTypes: readonly SupportedUploadFileType[];
  }
> = {
  document: {
    accept: ".pdf,.docx,.xlsx,.txt",
    helper: "支持 PDF、Word、Excel 和 TXT，单次上传 1 个文件。",
    supportedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ],
  },
  image: {
    accept: "image/*",
    helper: "支持 JPG、PNG、GIF、WebP、HEIC 等图片格式。",
    supportedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
  },
  video: {
    accept: "video/mp4,video/quicktime",
    helper: "支持 MP4、MOV，适合课堂讲解和录屏素材。",
    supportedMimeTypes: ["video/mp4", "video/quicktime"],
  },
  audio: {
    accept: "audio/mpeg,audio/wav,audio/x-m4a,audio/mp4",
    helper: "支持 MP3、WAV、M4A，适合语音讲解和听力素材。",
    supportedMimeTypes: ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4"],
  },
  other: {
    accept:
      ".pdf,.docx,.xlsx,.txt,image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4",
    helper: "当前建议上传常用教学文件，便于后续统一管理。",
    supportedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
      "video/mp4",
      "video/quicktime",
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
      "audio/mp4",
    ],
  },
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function getContentTypeIcon(type: MaterialContentType) {
  switch (type) {
    case "image":
      return Image;
    case "video":
      return Video;
    case "audio":
      return Music;
    case "text":
      return FileText;
    default:
      return File;
  }
}

function detectContentTypeFromFile(
  file: File,
): Exclude<MaterialContentType, "text"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function getPreviewKind(
  contentType: MaterialContentType,
  file: File | null,
  textContent: string,
): PreviewKind {
  if (contentType === "text" && textContent.trim()) {
    return "text";
  }

  if (!file) return "generic";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/plain") return "text";
  return "generic";
}

function isSupportedUploadFileType(
  value: string,
): value is SupportedUploadFileType {
  return Object.values(CONTENT_TYPE_META).some((meta) =>
    meta.supportedMimeTypes.includes(value as SupportedUploadFileType),
  );
}

export function TeachingMaterialUpload({
  mode = "create",
  initialMaterial = null,
  onSuccess,
  onClose,
  variant = "modal",
}: TeachingMaterialUploadProps) {
  const toast = useToast();
  const trpc = useTRPC();
  const fileInputId = useId();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileTextPreview, setFileTextPreview] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      contentType: "text",
    },
  });

  const contentType = watch("contentType");
  const title = watch("title");
  const description = watch("description");
  const textContent = watch("textContent") ?? "";
  const selectedKnowledgeAreaId = watch("knowledgeAreaId");

  const { data: knowledgeAreasData } = useQuery(trpc.getKnowledgeAreas.queryOptions());

  const knowledgeAreas: KnowledgeArea[] =
    knowledgeAreasData?.knowledgeAreas ?? [];
  const selectedKnowledgeArea = knowledgeAreas.find(
    (area) => area.id === selectedKnowledgeAreaId,
  );

  const uploadMutation = useMutation(
    trpc.uploadTeachingMaterial.mutationOptions(),
  );
  const updateMutation = useMutation(
    trpc.updateTeachingMaterial.mutationOptions(),
  );
  const presignedUrlMutation = useMutation(
    trpc.generatePresignedUploadUrl.mutationOptions(),
  );

  const isUploading =
    uploadMutation.isPending ||
    updateMutation.isPending ||
    presignedUrlMutation.isPending;
  const isEditing = mode === "edit";
  const previewKind = useMemo(() => {
    if (uploadedFile) {
      return getPreviewKind(contentType, uploadedFile, textContent);
    }

    if (contentType === "text" && textContent.trim()) {
      return "text";
    }

    if (
      initialMaterial?.fileUrl &&
      contentType === "document" &&
      initialMaterial.fileUrl.toLowerCase().includes(".pdf")
    ) {
      return "pdf";
    }

    if (
      initialMaterial?.fileUrl &&
      (contentType === "image" ||
        contentType === "video" ||
        contentType === "audio")
    ) {
      return contentType;
    }

    if (initialMaterial?.textContent?.trim()) {
      return "text";
    }

    return getPreviewKind(contentType, null, textContent);
  }, [
    contentType,
    initialMaterial?.fileUrl,
    initialMaterial?.textContent,
    textContent,
    uploadedFile,
  ]);
  const currentMeta =
    contentType === "text" ? null : CONTENT_TYPE_META[contentType];
  const PreviewIcon = getContentTypeIcon(contentType);

  useEffect(() => {
    if (!initialMaterial) {
      reset({
        contentType: "text",
        title: "",
        description: "",
        textContent: "",
        knowledgeAreaId: undefined,
      });
      setUploadedFile(null);
      return;
    }

    reset({
      contentType: initialMaterial.contentType,
      title: initialMaterial.title,
      description: initialMaterial.description ?? "",
      textContent: initialMaterial.textContent ?? "",
      knowledgeAreaId: initialMaterial.knowledgeAreaId,
    });
    setUploadedFile(null);
  }, [
    initialMaterial?.contentType,
    initialMaterial?.description,
    initialMaterial?.fileUrl,
    initialMaterial?.id,
    initialMaterial?.knowledgeAreaId,
    initialMaterial?.textContent,
    initialMaterial?.title,
    reset,
  ]);

  useEffect(() => {
    if (!uploadedFile) {
      setFilePreviewUrl(null);
      setFileTextPreview("");
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    if (
      uploadedFile.type.startsWith("image/") ||
      uploadedFile.type.startsWith("video/") ||
      uploadedFile.type.startsWith("audio/") ||
      uploadedFile.type === "application/pdf"
    ) {
      objectUrl = URL.createObjectURL(uploadedFile);
      setFilePreviewUrl(objectUrl);
    } else {
      setFilePreviewUrl(null);
    }

    if (uploadedFile.type === "text/plain") {
      uploadedFile
        .text()
        .then((content) => {
          if (!revoked) {
            setFileTextPreview(content.slice(0, 2400));
          }
        })
        .catch(() => {
          if (!revoked) {
            setFileTextPreview("");
          }
        });
    } else {
      setFileTextPreview("");
    }

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [uploadedFile]);

  const existingPreviewUrl = useMemo(() => {
    if (!initialMaterial?.fileUrl || uploadedFile) return null;

    if (
      contentType === "image" ||
      contentType === "video" ||
      contentType === "audio"
    ) {
      return initialMaterial.fileUrl;
    }

    if (
      contentType === "document" &&
      initialMaterial.fileUrl.toLowerCase().includes(".pdf")
    ) {
      return initialMaterial.fileUrl;
    }

    return null;
  }, [contentType, initialMaterial?.fileUrl, uploadedFile]);

  const activePreviewUrl = filePreviewUrl ?? existingPreviewUrl;
  const hasPersistedFile =
    Boolean(initialMaterial?.fileUrl) &&
    !uploadedFile &&
    contentType !== "text";

  const detailItems = useMemo(
    () => [
      {
        label: "资料类型",
        value:
          CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)
            ?.label || "未设置",
      },
      {
        label: "文件状态",
        value:
          contentType === "text"
            ? textContent.trim()
              ? "文本内容已填写"
              : "等待输入文本"
            : uploadedFile
              ? "文件已选择"
              : hasPersistedFile
                ? "沿用现有文件"
                : "等待上传文件",
      },
      {
        label: "知识点归类",
        value: selectedKnowledgeArea?.name || "未关联知识点",
      },
    ],
    [
      contentType,
      hasPersistedFile,
      selectedKnowledgeArea?.name,
      textContent,
      uploadedFile,
    ],
  );

  const handleContentTypeChange = (nextType: MaterialContentType) => {
    setValue("contentType", nextType, { shouldDirty: true });
    if (nextType === "text") {
      setUploadedFile(null);
    }
  };

  const handleKnowledgeAreaChange = (value: string) => {
    setValue("knowledgeAreaId", value ? Number(value) : undefined, {
      shouldDirty: true,
    });
  };

  const handleFileSelect = (file: File) => {
    if (!isSupportedUploadFileType(file.type)) {
      toast.error(
        "当前仅支持图片、PDF、Word、Excel、TXT、MP4、MOV、MP3、WAV、M4A",
      );
      return;
    }

    setUploadedFile(file);
    setValue("contentType", detectContentTypeFromFile(file), {
      shouldDirty: true,
    });

    if (!title?.trim()) {
      setValue("title", stripFileExtension(file.name), { shouldDirty: true });
    }
  };

  const uploadFileToStorage = async (file: File) => {
    if (!isSupportedUploadFileType(file.type)) {
      throw new Error("不支持的文件类型");
    }

    const urlData: {
      presignedUrl: string;
      objectUrl: string;
      fileName: string;
    } = await presignedUrlMutation.mutateAsync({
      fileName: file.name,
      fileType: file.type,
      folderName: "teaching-materials",
    });

    const uploadResponse = await fetch(urlData.presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("文件上传失败");
    }

    return urlData.objectUrl;
  };

  const resetUploadState = () => {
    if (isEditing && initialMaterial) {
      reset({
        contentType: initialMaterial.contentType,
        title: initialMaterial.title,
        description: initialMaterial.description ?? "",
        textContent: initialMaterial.textContent ?? "",
        knowledgeAreaId: initialMaterial.knowledgeAreaId,
      });
      setUploadedFile(null);
      return;
    }

    reset({
      contentType: "text",
      title: "",
      description: "",
      textContent: "",
      knowledgeAreaId: undefined,
    });
    setUploadedFile(null);
  };

  const onSubmit = async (data: UploadFormData) => {
    if (data.contentType === "text" && !data.textContent?.trim()) {
      toast.error("请先填写文本内容");
      return;
    }

    if (
      data.contentType !== "text" &&
      !uploadedFile &&
      !(isEditing && initialMaterial?.fileUrl)
    ) {
      toast.error("请先选择文件");
      return;
    }

    try {
      const fileUrl =
        data.contentType !== "text"
          ? uploadedFile
            ? await uploadFileToStorage(uploadedFile)
            : initialMaterial?.fileUrl || undefined
          : undefined;

      const materialInput = {
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        contentType: data.contentType,
        fileUrl,
        textContent:
          data.contentType === "text" ? data.textContent?.trim() : undefined,
        knowledgeAreaId: data.knowledgeAreaId,
      };

      const result = isEditing
        ? await updateMutation.mutateAsync({
            ...materialInput,
            materialId: initialMaterial!.id!,
          })
        : await uploadMutation.mutateAsync(materialInput);

      toast.success(isEditing ? "教学资料已更新" : "教学资料已加入资料库");
      resetUploadState();
      onSuccess?.(result.material);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div
      className={
        variant === "page"
          ? "space-y-6"
          : "mx-auto max-w-6xl space-y-6 rounded-lg bg-white p-6 shadow-lg"
      }
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Plus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              {isEditing ? "编辑教学资料" : "添加教学资料"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {isEditing
                ? "调整资料标题、知识点归类和文件内容，保存后会立即同步到资料库。"
                : "上传讲义、讲评、题型素材或直接录入文本内容，保存后会进入资料库并可用于智能出题。"}
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            {variant === "page" ? "返回资料库" : "关闭"}
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900">资料类型</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  先确定资料形态，上传区和预览会随之调整。
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CONTENT_TYPE_OPTIONS.map((option) => {
                  const Icon = getContentTypeIcon(option.value);
                  const active = contentType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleContentTypeChange(option.value)}
                      className={`rounded-lg border p-4 text-left transition ${
                        active
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            active
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="text-sm font-bold text-slate-900">
                          {option.label}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {contentType === "text" ? "文本内容" : "文件上传"}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {contentType === "text"
                      ? "适合录入讲义摘要、板书整理或讲评提纲。"
                      : currentMeta?.helper}
                  </p>
                </div>
                {uploadedFile ? (
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    移除文件
                  </button>
                ) : null}
              </div>

              {hasPersistedFile ? (
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  当前将继续使用已上传文件。若要替换，只需重新选择一个新文件。
                </div>
              ) : null}

              {contentType === "text" ? (
                <div>
                  <textarea
                    {...register("textContent")}
                    rows={14}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="输入教学资料正文，例如知识点讲解、例题过程、常见错因和课堂提醒。"
                  />
                  {errors.textContent ? (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.textContent.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
                  <input
                    id={fileInputId}
                    type="file"
                    className="hidden"
                    accept={currentMeta?.accept}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                    }}
                  />
                  <label
                    htmlFor={fileInputId}
                    className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
                      uploadedFile
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/60"
                    }`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <Upload className="h-6 w-6" />
                    </span>
                    <div className="mt-4 text-base font-bold text-slate-900">
                      {uploadedFile ? uploadedFile.name : "拖拽或点击选择文件"}
                    </div>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                      {uploadedFile
                        ? `已选择 ${formatFileSize(uploadedFile.size)}，可以继续完善资料信息后保存。`
                        : currentMeta?.helper}
                    </p>
                    <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20">
                      {uploadedFile ? "重新选择文件" : "选择文件"}
                    </span>
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-900">
                    资料标题
                  </label>
                  <input
                    type="text"
                    {...register("title")}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="例如：三年级分数加减法讲评提纲"
                  />
                  {errors.title ? (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.title.message}
                    </p>
                  ) : null}
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-900">
                    资料说明
                  </label>
                  <textarea
                    {...register("description")}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="补充适用年级、课堂用途、典型错因或使用建议。"
                  />
                </div>

                {knowledgeAreas.length > 0 ? (
                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-900">
                      关联知识点
                    </label>
                    <select
                      value={selectedKnowledgeAreaId || ""}
                      onChange={(event) =>
                        handleKnowledgeAreaChange(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">暂不关联知识点</option>
                      {knowledgeAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">预览</h3>
              </div>

              {previewKind === "image" && activePreviewUrl ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img
                      src={activePreviewUrl}
                      alt={uploadedFile?.name || "教学资料预览"}
                      className="h-72 w-full object-cover"
                    />
                  </div>
                </div>
              ) : null}

              {previewKind === "video" && activePreviewUrl ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                  <video
                    src={activePreviewUrl}
                    controls
                    className="h-72 w-full object-contain"
                  />
                </div>
              ) : null}

              {previewKind === "audio" && activePreviewUrl ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Music className="h-4 w-4 text-blue-600" />
                    音频预览
                  </div>
                  <audio src={activePreviewUrl} controls className="w-full" />
                </div>
              ) : null}

              {previewKind === "pdf" && activePreviewUrl ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <iframe
                    src={activePreviewUrl}
                    title="PDF 预览"
                    className="h-80 w-full"
                  />
                </div>
              ) : null}

              {previewKind === "text" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileText className="h-4 w-4 text-blue-600" />
                    文本预览
                  </div>
                  <div className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {(contentType === "text"
                      ? textContent
                      : fileTextPreview ||
                        initialMaterial?.textContent ||
                        "") || "输入或上传内容后，这里会显示可读预览。"}
                  </div>
                </div>
              ) : null}

              {previewKind === "generic" ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                    <PreviewIcon className="h-5 w-5" />
                  </span>
                  <div className="mt-4 text-sm font-bold text-slate-900">
                    {uploadedFile ? uploadedFile.name : "等待预览内容"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {uploadedFile
                      ? "当前文件暂不支持内嵌预览，但会保留文件信息并上传到资料库。"
                      : contentType === "text"
                        ? "录入文本内容后，这里会实时展示讲义预览。"
                        : "选择文件后，这里会展示图片、PDF、音视频或文本预览。"}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
                {title?.trim() ? (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      标题
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {title}
                    </div>
                  </div>
                ) : null}
                {description?.trim() ? (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      资料说明
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      {description}
                    </div>
                  </div>
                ) : null}
                {uploadedFile ? (
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        文件大小
                      </div>
                      <div className="mt-1 font-medium text-slate-900">
                        {formatFileSize(uploadedFile.size)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        文件类型
                      </div>
                      <div className="mt-1 font-medium text-slate-900">
                        {uploadedFile.type || "未知"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-bold text-slate-900">保存前检查</h3>
              </div>
              <div className="space-y-3">
                {detailItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            保存后资料会出现在资料库，并可用于错题归因和智能出题参考。
          </div>
          <div className="flex flex-wrap gap-3">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
              >
                取消
              </button>
            ) : null}
            <button
              type="submit"
              disabled={
                isUploading ||
                !title?.trim() ||
                (contentType === "text"
                  ? !textContent.trim()
                  : !uploadedFile && !hasPersistedFile)
              }
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : isEditing ? (
                "保存修改"
              ) : (
                "保存到资料库"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
