import { useState, useCallback, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onCancel}
        />
        <span className="inline-block h-screen align-middle" aria-hidden="true">
          &#8203;
        </span>

        {/* Dialog */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center mb-4">
            <div
              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                destructive ? "bg-red-100" : "bg-yellow-100"
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  destructive ? "text-red-600" : "text-yellow-600"
                }`}
              />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-600">{message}</p>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`flex-1 font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center ${
                destructive
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing confirm dialog state.
 * Usage:
 *   const { dialog, confirm } = useConfirmDialog();
 *   // ...
 *   <ConfirmDialog {...dialog} />
 *   // ...
 *   const ok = await confirm({ title: "Delete?", message: "Are you sure?" });
 *   if (ok) { doDelete(); }
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const resolveRef = useState<((value: boolean) => void) | null>(null);
  const resolve = resolveRef[0];

  const confirm = useCallback(
    (options: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
    }): Promise<boolean> => {
      return new Promise<boolean>((res) => {
        resolveRef[1](res);
        setState({ isOpen: true, ...options });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolve?.(true);
  }, [resolve]);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolve?.(false);
  }, [resolve]);

  return {
    dialog: {
      ...state,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    confirm,
  };
}
