interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string; // e.g. "max-w-6xl"
}

export function ModalWrapper({ isOpen, onClose, children, maxWidth = "max-w-4xl" }: ModalWrapperProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl ${maxWidth} w-full max-h-[90vh] overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
