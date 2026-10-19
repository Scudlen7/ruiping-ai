import { Camera, X } from "lucide-react";
import type { RefObject } from "react";

interface TeacherCameraCaptureProps {
  isOpen: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onCapture: () => void;
  onClose: () => void;
}

export function TeacherCameraCapture({
  isOpen,
  videoRef,
  canvasRef,
  onCapture,
  onClose,
}: TeacherCameraCaptureProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">拍照录入</h3>
              <p className="mt-1 text-sm text-slate-500">
                对准纸面后拍摄，照片会直接加入当前上传队列。
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-h-[60vh] w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onCapture}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              拍照并加入队列
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
