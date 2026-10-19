import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import {
  Camera,
  X,
  Upload,
  Loader2,
  CheckCircle,
  Pause,
  Play,
} from "lucide-react";
import { uploadSchema } from "./parent/types";
import type { UploadFormData, AssignmentFile, UploadQueueStatus } from "./parent/types";
import { compressImage } from "./parent/compressImage";
import { ParentFileUploadZone } from "./parent/ParentFileUploadZone";
import { ParentFileList } from "./parent/ParentFileList";
import { ParentCameraCapture } from "./parent/ParentCameraCapture";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const isAllowedImageType = (type: string): type is AllowedImageType =>
  (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);

interface EnhancedAssignmentUploadProps {
  childId: number;
  onSuccess?: (uploadedCount: number) => void;
  onClose?: () => void;
  maxFiles?: number;
  allowMultiple?: boolean;
}

export function EnhancedAssignmentUpload({
  childId,
  onSuccess,
  onClose,
  maxFiles = 5,
  allowMultiple = true,
}: EnhancedAssignmentUploadProps) {
  const [files, setFiles] = useState<AssignmentFile[]>([]);
  const [queueStatus, setQueueStatus] = useState<UploadQueueStatus>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  // The queue runs across many renders; refs give it the current files and pause flag.
  const filesRef = useRef<AssignmentFile[]>([]);
  const pausedRef = useRef(false);
  const lastFormDataRef = useRef<UploadFormData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const trpc = useTRPC();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const uploadMutation = useMutation(trpc.uploadParentAssignment.mutationOptions());
  const presignedUrlMutation = useMutation(trpc.generatePresignedUploadUrl.mutationOptions());

  const commitFiles = (next: AssignmentFile[]) => {
    filesRef.current = next;
    setFiles(next);
  };

  const patchFile = (fileId: string, patch: Partial<AssignmentFile>) => {
    commitFiles(filesRef.current.map((f) => (f.id === fileId ? { ...f, ...patch } : f)));
  };

  const validateFile = (file: File): string | null => {
    if (!isAllowedImageType(file.type)) {
      return "不支持的文件格式。请选择 JPG、PNG、GIF 或 WebP 文件";
    }
    if (file.size > 20 * 1024 * 1024) {
      return "文件大小必须小于20MB";
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const current = filesRef.current;

    if (current.length + fileArray.length > maxFiles) {
      toast.error(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    const validFiles: AssignmentFile[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }
      const isDuplicate = current.some(
        (f) => f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified,
      );
      if (isDuplicate) {
        toast.error(`${file.name} 已存在`);
        continue;
      }
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
        progress: 0,
        retryCount: 0,
      });
    }

    if (validFiles.length > 0) {
      commitFiles([...current, ...validFiles]);
      toast.success(`已添加 ${validFiles.length} 个文件`);
    }
  }, [maxFiles, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }, [addFiles]);

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
      toast.error("无法访问摄像头");
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

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          addFiles([file]);
          stopCamera();
        }
      }, "image/jpeg", 0.8);
    }
  };

  const uploadFileToOSS = async (file: File): Promise<string> => {
    const fileType = isAllowedImageType(file.type) ? file.type : "image/jpeg";
    const urlResponse = await presignedUrlMutation.mutateAsync({
      fileName: `parent-${Date.now()}-${file.name.replace(/[/\\]/g, "_")}`,
      fileType,
      folderName: "assignment-uploads",
    });

    const uploadResponse = await fetch(urlResponse.presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": fileType },
    });
    if (!uploadResponse.ok) {
      throw new Error("上传文件到存储失败");
    }
    return urlResponse.objectUrl;
  };

  const titleFor = (formData: UploadFormData, fileId: string) => {
    const all = filesRef.current;
    if (all.length <= 1) return formData.title;
    return `${formData.title}（${all.findIndex((f) => f.id === fileId) + 1}/${all.length}）`;
  };

  /** Uploads one file and archives it; AI grading is queued by the server. Returns true on success. */
  const processFile = async (fileId: string, formData: UploadFormData): Promise<boolean> => {
    const file = filesRef.current.find((f) => f.id === fileId);
    if (!file) return false;

    try {
      let fileUrl = file.uploadedUrl;
      if (!fileUrl) {
        patchFile(fileId, { status: "compressing", progress: 15, error: undefined });
        const compressedFile = await compressImage(file.file);
        patchFile(fileId, { compressedFile, status: "uploading", progress: 40 });
        fileUrl = await uploadFileToOSS(compressedFile);
        patchFile(fileId, { uploadedUrl: fileUrl });
      }

      patchFile(fileId, { status: "processing", progress: 75 });
      const result = await uploadMutation.mutateAsync({
        childId,
        title: titleFor(formData, fileId),
        description: formData.description,
        imageUrl: fileUrl,
      });

      patchFile(fileId, { status: "complete", progress: 100, assignmentId: result.assignment.id });
      setCompletedCount((count) => count + 1);
      return true;
    } catch (error: unknown) {
      patchFile(fileId, {
        status: "error",
        progress: 0,
        error: getErrorMessage(error),
        retryCount: file.retryCount + 1,
      });
      return false;
    }
  };

  const runQueue = async (formData: UploadFormData) => {
    lastFormDataRef.current = formData;
    pausedRef.current = false;
    setQueueStatus("running");

    const queue = filesRef.current.filter((f) => f.status === "pending" || f.status === "error" || f.status === "paused");
    let succeeded = 0;
    for (const file of queue) {
      if (pausedRef.current) {
        patchFile(file.id, { status: "paused" });
        continue;
      }
      if (await processFile(file.id, formData)) succeeded++;
    }

    if (pausedRef.current) {
      setQueueStatus("paused");
      return;
    }

    setQueueStatus("completed");
    if (succeeded > 0) {
      toast.success(`已上传 ${succeeded} 份作业，AI 正在后台批改`);
      onSuccess?.(succeeded);
    }
  };

  const pauseQueue = () => {
    pausedRef.current = true;
  };

  const resumeQueue = () => {
    if (lastFormDataRef.current) void runQueue(lastFormDataRef.current);
  };

  const retryFile = async (fileId: string) => {
    const formData = lastFormDataRef.current;
    if (!formData) return;
    if (await processFile(fileId, formData)) {
      toast.success("已上传，AI 正在后台批改");
      onSuccess?.(1);
    }
  };

  const removeFile = (fileId: string) => {
    const file = filesRef.current.find((f) => f.id === fileId);
    if (file) URL.revokeObjectURL(file.previewUrl);
    commitFiles(filesRef.current.filter((f) => f.id !== fileId));
  };

  const clearCompleted = () => {
    filesRef.current.filter((f) => f.status === "complete").forEach((f) => URL.revokeObjectURL(f.previewUrl));
    commitFiles(filesRef.current.filter((f) => f.status !== "complete"));
  };

  const onSubmit = (data: UploadFormData) => {
    if (filesRef.current.length === 0) {
      toast.error("请至少选择一个文件");
      return;
    }
    void runQueue(data);
  };

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, []);

  const hasWork = files.some((f) => f.status === "pending" || f.status === "error" || f.status === "paused");

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Camera className="w-6 h-6 text-pink-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">上传作业</h3>
              <p className="text-sm text-gray-600">
                拍照或选择图片，上传后 AI 会在后台自动批改，结果会出现在学习报告中
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              作业标题
            </label>
            <input
              {...register("title")}
              type="text"
              id="title"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
              placeholder="例如：数学作业第5章"
            />
            {errors.title && (
              <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              描述（可选）
            </label>
            <input
              {...register("description")}
              type="text"
              id="description"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
              placeholder="添加关于此作业的其他说明..."
            />
          </div>
        </div>

        <ParentFileUploadZone
          dragActive={dragActive}
          onDrag={handleDrag}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
          onStartCamera={() => void startCamera()}
          maxFiles={maxFiles}
          allowMultiple={allowMultiple}
        />

        <ParentFileList
          files={files}
          maxFiles={maxFiles}
          queueStatus={queueStatus}
          completedCount={completedCount}
          onRemoveFile={removeFile}
          onClearCompleted={clearCompleted}
          onRetryFile={(fileId) => void retryFile(fileId)}
        />

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={!hasWork || queueStatus === "running"}
            className="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3 px-4 rounded-lg font-medium hover:from-pink-600 hover:to-rose-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {queueStatus === "running" ? (
              <>
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                上传中... ({completedCount}/{files.length})
              </>
            ) : queueStatus === "completed" && !hasWork ? (
              <>
                <CheckCircle className="w-4 h-4 inline mr-2" />
                全部完成，AI 正在批改
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 inline mr-2" />
                开始上传 ({files.length} 个文件)
              </>
            )}
          </button>

          {queueStatus === "running" && (
            <button
              type="button"
              onClick={pauseQueue}
              className="px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {queueStatus === "paused" && (
            <button
              type="button"
              onClick={resumeQueue}
              className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      <ParentCameraCapture
        isOpen={showCamera}
        videoRef={videoRef}
        canvasRef={canvasRef}
        onCapture={capturePhoto}
        onClose={stopCamera}
      />
    </div>
  );
}
