import { createPortal } from "react-dom";

export default function DeleteConfirmModal({
  isOpen,
  title = "Delete chat",
  message = "Are you sure you want to delete this chat?",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close delete confirmation"
        className="absolute inset-0 bg-black/50"
        onClick={loading ? undefined : onCancel}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xl">
            🗑️
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition ${
              loading
                ? "bg-red-300 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}