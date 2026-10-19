import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTRPC } from "~/trpc/react";
import { CheckCircle2, Files, Upload, Users, X } from "lucide-react";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import { FileUploadZone } from "~/components/assignment/FileUploadZone";
import {
  AssignmentPreview,
  type AssignmentFile,
} from "~/components/assignment/AssignmentPreview";
import { AssignmentConfig } from "~/components/assignment/AssignmentConfig";
import { TeacherCameraCapture } from "~/components/assignment/TeacherCameraCapture";
import { UploadSubmitSection } from "~/components/assignment/UploadSubmitSection";
import { compressImage } from "~/components/assignment/compressImage";

const uploadSchema = z.object({
  title: z.string().min(1, "请填写标题"),
  description: z.string().optional(),
  selectedModel: z.string().min(1, "请选择识别模型"),
  confidenceThreshold: z.number().min(0).max(1),
  autoAssignStudents: z.boolean(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

const DEFAULT_FORM_DATA: UploadFormData = {
  title: "",
  description: "",
  selectedModel: "siliconcloud/Qwen/Qwen3.6-35B-A3B",
  confidenceThreshold: 0.7,
  autoAssignStudents: true,
};

interface EnhancedTeacherAssignmentUploadProps {
  isOpen: boolean;
  classId: number;
  students?: Array<{ id: number; name: string }>;
  onSuccess?: (uploadedCount: number) => void;
  onClose?: () => void;
  maxFiles?: number;
  allowMultiple?: boolean;
  uploadType?: "assignment" | "exam";
}

type UploadQueueStatus = "idle" | "running" | "paused" | "completed";

/** Exact name match wins; a partial match is only accepted when it is unambiguous. */
function matchStudentByName(
  students: Array<{ id: number; name: string }>,
  recognizedName: string,
): number | undefined {
  const name = recognizedName.trim();
  if (!name) return undefined;

  const exact = students.find((s) => s.name === name);
  if (exact) return exact.id;

  const partial = students.filter(
    (s) => s.name.includes(name) || name.includes(s.name),
  );
  return partial.length === 1 ? partial[0]!.id : undefined;
}

export function EnhancedTeacherAssignmentUpload({
  isOpen,
  classId: _classId,
  students = [],
  onSuccess,
  onClose,
  maxFiles = 10,
  allowMultiple = true,
  uploadType = "assignment",
}: EnhancedTeacherAssignmentUploadProps) {
  const toast = useToast();
  const [files, setFiles] = useState<AssignmentFile[]>([]);
  const [queueStatus, setQueueStatus] = useState<UploadQueueStatus>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filesRef = useRef<AssignmentFile[]>(files);
  filesRef.current = files;
  const pausedRef = useRef(false);
  const lastFormDataRef = useRef<UploadFormData>(DEFAULT_FORM_DATA);

  const trpc = useTRPC();

  const modelsQuery = useQuery({
    ...trpc.getAvailableModels.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      selectedModel: DEFAULT_FORM_DATA.selectedModel,
      confidenceThreshold: DEFAULT_FORM_DATA.confidenceThreshold,
      autoAssignStudents: DEFAULT_FORM_DATA.autoAssignStudents,
    },
  });

  const confidenceThreshold = watch("confidenceThreshold");

  const presignedUrlMutation = useMutation(
    trpc.generatePresignedUploadUrl.mutationOptions(),
  );
  const recognizeStudentMutation = useMutation(
    trpc.recognizeStudentInfo.mutationOptions(),
  );
  const uploadTeacherAssignmentMutation = useMutation(
    trpc.uploadTeacherAssignment.mutationOptions(),
  );
  const uploadTeacherExamMutation = useMutation(
    trpc.uploadTeacherExam.mutationOptions(),
  );

  // Queue logic reads filesRef between awaits, so keep it in sync without waiting for a re-render.
  const updateFile = useCallback(
    (fileId: string, update: (file: AssignmentFile) => AssignmentFile) => {
      const apply = (list: AssignmentFile[]) =>
        list.map((f) => (f.id === fileId ? update(f) : f));
      filesRef.current = apply(filesRef.current);
      setFiles(apply);
    },
    [],
  );

  const patchFile = useCallback(
    (fileId: string, patch: Partial<AssignmentFile>) =>
      updateFile(fileId, (f) => ({ ...f, ...patch })),
    [updateFile],
  );

  // ─── File management ───────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return "请选择图片文件（JPG、PNG、GIF、WebP）";
    }
    if (file.size > 20 * 1024 * 1024) {
      return "文件大小不能超过 20MB";
    }
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return "暂不支持该格式，请使用 JPG、PNG、GIF 或 WebP";
    }
    return null;
  };

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const currentFileCount = files.length;

      if (currentFileCount + fileArray.length > maxFiles) {
        toast.error(`单次最多上传 ${maxFiles} 份图片`);
        return;
      }

      const validFiles: AssignmentFile[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }

        const isDuplicate = files.some(
          (f) =>
            f.file.name === file.name &&
            f.file.size === file.size &&
            f.file.lastModified === file.lastModified,
        );

        if (isDuplicate) {
          toast.error(`${file.name} 已在队列中`);
          continue;
        }

        const previewUrl = URL.createObjectURL(file);

        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          previewUrl,
          status: "pending",
          progress: 0,
          retryCount: 0,
        });
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
        toast.success(`已加入 ${validFiles.length} 份图片`);
      }
    },
    [files, maxFiles, toast],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        void addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  // ─── Camera ────────────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch {
      toast.error("无法访问摄像头，请检查浏览器权限");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context?.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            void addFiles([file]);
            stopCamera();
          }
        },
        "image/jpeg",
        0.8,
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  // ─── Upload pipeline ───────────────────────────────────────────────

  const uploadFileToOSS = async (file: File): Promise<string> => {
    const folderName =
      uploadType === "exam" ? "exam-uploads" : "assignment-uploads";

    const urlResponse = await presignedUrlMutation.mutateAsync({
      fileName: `teacher-${Date.now()}-${file.name}`,
      fileType: file.type as Parameters<
        typeof presignedUrlMutation.mutateAsync
      >[0]["fileType"],
      folderName,
    });

    const uploadResponse = await fetch(urlResponse.presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`上传到存储服务失败（HTTP ${uploadResponse.status}）`);
    }

    return urlResponse.objectUrl;
  };

  const buildTitle = (formData: UploadFormData, fileName: string) => {
    const date = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const base = formData.title?.trim()
      ? formData.title.trim()
      : `${uploadType === "exam" ? "考试" : "作业"} - ${date}`;
    return `${base} - ${fileName}`;
  };

  /** Creates the assignment/exam record; the server then queues AI grading. */
  const archiveFile = async (
    file: AssignmentFile,
    studentId: number,
    imageUrl: string,
    formData: UploadFormData,
  ) => {
    patchFile(file.id, {
      status: "processing",
      progress: 85,
      error: undefined,
      selectedStudentId: studentId,
    });

    const payload = {
      studentId,
      title: buildTitle(formData, file.file.name),
      description: formData.description,
      imageUrl,
      modelKey: formData.selectedModel,
    };

    const createdId =
      uploadType === "exam"
        ? (await uploadTeacherExamMutation.mutateAsync(payload)).exam.id
        : (await uploadTeacherAssignmentMutation.mutateAsync(payload))
            .assignment.id;

    patchFile(file.id, {
      status: "complete",
      progress: 100,
      assignmentId: createdId,
    });
    setCompletedCount((prev) => prev + 1);
  };

  /** Returns true when the file was archived, false when it needs manual review or failed. */
  const processFile = async (
    fileId: string,
    formData: UploadFormData,
  ): Promise<boolean> => {
    const file = filesRef.current.find((f) => f.id === fileId);
    if (!file) return false;

    try {
      let imageUrl = file.uploadedImageUrl;
      if (!imageUrl) {
        patchFile(fileId, { status: "compressing", progress: 10, error: undefined });
        const compressedFile = await compressImage(file.file);

        patchFile(fileId, { status: "uploading", progress: 30, compressedFile });
        imageUrl = await uploadFileToOSS(compressedFile);
        patchFile(fileId, { progress: 50, uploadedImageUrl: imageUrl });
      }

      let studentId = file.selectedStudentId;
      if (!studentId) {
        patchFile(fileId, { status: "recognizing", progress: 60 });
        let recognition = file.recognition;
        try {
          const result = await recognizeStudentMutation.mutateAsync({
            imageUrl,
            modelKey: formData.selectedModel,
          });
          recognition = result.recognition;
          patchFile(fileId, { recognition });
        } catch {
          // Recognition is a convenience; fall through to manual assignment.
        }

        if (
          recognition &&
          formData.autoAssignStudents &&
          recognition.confidence >= formData.confidenceThreshold
        ) {
          studentId = matchStudentByName(students, recognition.studentName);
        }
      }

      if (!studentId) {
        patchFile(fileId, { status: "needs_review", progress: 70 });
        return false;
      }

      await archiveFile(file, studentId, imageUrl, formData);
      return true;
    } catch (error: unknown) {
      updateFile(fileId, (f) => ({
        ...f,
        status: "error",
        progress: 0,
        error: getErrorMessage(error),
        retryCount: f.retryCount + 1,
      }));
      return false;
    }
  };

  const hasUnfinishedFiles = () =>
    filesRef.current.some((f) => f.status !== "complete");

  const startQueue = async (formData: UploadFormData) => {
    lastFormDataRef.current = formData;
    pausedRef.current = false;
    setQueueStatus("running");

    const pendingIds = filesRef.current
      .filter((f) => f.status === "pending" || f.status === "error")
      .map((f) => f.id);

    let archived = 0;
    for (const fileId of pendingIds) {
      if (pausedRef.current) break;
      if (await processFile(fileId, formData)) archived++;
    }

    if (pausedRef.current) return;
    setQueueStatus("completed");

    const contentLabel = uploadType === "exam" ? "试卷" : "作业";
    const reviewCount = filesRef.current.filter(
      (f) => f.status === "needs_review",
    ).length;

    if (reviewCount > 0) {
      toast.warning(`${reviewCount} 份${contentLabel}未能自动识别学生，请手动指定后归档`);
    } else if (archived > 0) {
      toast.success(`已归档 ${archived} 份${contentLabel}，AI 批改已在后台开始`);
    }

    if (archived > 0 && !hasUnfinishedFiles()) {
      onSuccess?.(archived);
    }
  };

  const confirmStudentForFile = async (fileId: string, studentId: number) => {
    const file = filesRef.current.find((f) => f.id === fileId);
    if (!file?.uploadedImageUrl) return;

    try {
      await archiveFile(file, studentId, file.uploadedImageUrl, lastFormDataRef.current);
      const student = students.find((s) => s.id === studentId);
      toast.success(`已归档到 ${student?.name ?? "所选学生"}，AI 批改已在后台开始`);
      if (!hasUnfinishedFiles()) {
        onSuccess?.(filesRef.current.filter((f) => f.status === "complete").length);
      }
    } catch (error) {
      patchFile(fileId, { status: "needs_review", error: getErrorMessage(error) });
    }
  };

  const pauseQueue = () => {
    pausedRef.current = true;
    setQueueStatus("paused");
  };

  const resumeQueue = () => {
    void startQueue(lastFormDataRef.current);
  };

  const retryFile = (fileId: string) => {
    patchFile(fileId, { status: "pending", error: undefined });
    void processFile(fileId, lastFormDataRef.current);
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const clearCompleted = () => {
    setFiles((prev) => {
      const completedFiles = prev.filter((f) => f.status === "complete");
      completedFiles.forEach((file) => URL.revokeObjectURL(file.previewUrl));
      return prev.filter((f) => f.status !== "complete");
    });
  };

  const onSubmit = (data: UploadFormData) => {
    if (files.length === 0) {
      toast.error("请先选择至少一张图片");
      return;
    }
    void startQueue(data);
  };

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, []);

  if (!isOpen) return null;

  const contentLabel = uploadType === "exam" ? "试卷" : "作业";
  const waitingCount = files.filter((file) => file.status === "pending").length;
  const handleStartCamera = () => {
    void startCamera();
  };
  const submitUpload = handleSubmit((data) => {
    onSubmit(data);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Upload className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {contentLabel}批量上传
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  上传后自动识别学生并归档，归档完成即进入 AI 批改，结果会写入学生档案与班级报告。
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    <Files className="mr-1 inline h-3.5 w-3.5" />
                    已选 {files.length} 份
                  </span>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">
                    <Users className="mr-1 inline h-3.5 w-3.5" />
                    学生 {students.length} 人
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                    已完成 {completedCount} 份
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    待处理 {waitingCount} 份
                  </span>
                </div>
              </div>
            </div>
            {onClose ? (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitUpload(event);
          }}
          className="grid gap-6 overflow-y-auto p-6 xl:grid-cols-[minmax(0,1.4fr)_360px]"
        >
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <FileUploadZone
                dragActive={dragActive}
                onDrag={handleDrag}
                onDrop={handleDrop}
                onFileSelect={handleFileSelect}
                onStartCamera={handleStartCamera}
                maxFiles={maxFiles}
                allowMultiple={allowMultiple}
                uploadType={uploadType}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <AssignmentPreview
                files={files}
                maxFiles={maxFiles}
                students={students}
                confidenceThreshold={confidenceThreshold}
                queueStatus={queueStatus}
                completedCount={completedCount}
                onRemoveFile={removeFile}
                onClearCompleted={clearCompleted}
                onRetryFile={retryFile}
                onConfirmStudent={(fileId, studentId) =>
                  void confirmStudentForFile(fileId, studentId)
                }
              />
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <AssignmentConfig
                uploadType={uploadType}
                register={register}
                watch={watch}
                errors={errors}
                showAdvancedSettings={showAdvancedSettings}
                onToggleAdvancedSettings={() =>
                  setShowAdvancedSettings(!showAdvancedSettings)
                }
                models={modelsQuery.data?.models}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <UploadSubmitSection
                uploadType={uploadType}
                files={files}
                queueStatus={queueStatus}
                completedCount={completedCount}
                onPause={pauseQueue}
                onResume={resumeQueue}
              />
            </section>
          </div>
        </form>

        <TeacherCameraCapture
          isOpen={showCamera}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onCapture={capturePhoto}
          onClose={stopCamera}
        />
      </div>
    </div>
  );
}
