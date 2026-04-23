export default function ToastContainer({ toasts = [], onRemove }) {
  if (!toasts.length) return null;

  const typeStyles = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-gray-800 text-white",
    warning: "bg-yellow-500 text-black",
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3 ${
            typeStyles[toast.type] || typeStyles.info
          }`}
        >
          <div className="flex-1 text-sm leading-relaxed">{toast.message}</div>

          <button
            type="button"
            onClick={() => onRemove(toast.id)}
            className="text-inherit/80 hover:text-inherit text-lg leading-none"
            aria-label="Close notification"
            title="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}