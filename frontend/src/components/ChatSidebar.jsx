import { useMemo, useState } from "react";
import DeleteConfirmModal from "./DeleteConfirmModal";

function getAppointmentDateTime(appointment) {
  if (!appointment?.appointmentDate || !appointment?.appointmentSlot) return null;

  const isoString = `${appointment.appointmentDate}T${appointment.appointmentSlot}:00`;
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getUpcomingAppointment(appointments = []) {
  const now = Date.now();

  const futureAppointments = appointments
    .map((appointment) => ({
      ...appointment,
      _sortDate: getAppointmentDateTime(appointment),
    }))
    .filter(
      (appointment) =>
        appointment._sortDate &&
        appointment._sortDate.getTime() >= now &&
        appointment.status !== "CANCELLED"
    )
    .sort((a, b) => a._sortDate - b._sortDate);

  return futureAppointments[0] || null;
}

function getSortedAppointments(appointments = []) {
  return [...appointments]
    .map((appointment) => ({
      ...appointment,
      _sortDate: getAppointmentDateTime(appointment),
    }))
    .sort((a, b) => {
      const aTime = a._sortDate ? a._sortDate.getTime() : 0;
      const bTime = b._sortDate ? b._sortDate.getTime() : 0;
      return bTime - aTime;
    });
}

function getStatusStyles(status) {
  switch (status) {
    case "CONFIRMED":
      return {
        badge: "border-green-200 bg-green-50 text-green-700",
        card: "border-green-200 bg-green-50/40",
      };
    case "CANCELLED":
      return {
        badge: "border-red-200 bg-red-50 text-red-700",
        card: "border-red-200 bg-red-50/40 opacity-75",
      };
    case "BOOKED":
    default:
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        card: "border-gray-200 bg-white",
      };
  }
}

function isAppointmentPast(appointment) {
  const appointmentDate = getAppointmentDateTime(appointment);
  if (!appointmentDate) return false;
  return appointmentDate.getTime() < Date.now();
}

function CompactUpcomingAppointmentCard({ appointment, onEdit }) {
  const status = appointment?.status || "BOOKED";
  const statusStyles = getStatusStyles(status);
  const disableEdit = isAppointmentPast(appointment) || status === "CANCELLED";

  if (!appointment) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-400">
        No upcoming appointment
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-800">
            {appointment.providerName}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {appointment.appointmentDate} • {appointment.appointmentSlot}
          </div>
          <div className="mt-1 truncate text-xs text-gray-500">
            {appointment.providerSpeciality || appointment.providerType || "Doctor"}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyles.badge}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(appointment)}
          disabled={disableEdit}
          className={`text-xs px-3 py-1.5 rounded-lg transition ${
            disableEdit
              ? "bg-white/70 text-gray-400 cursor-not-allowed border border-gray-200"
              : "bg-white text-green-700 border border-green-200 hover:bg-green-100"
          }`}
          title={
            status === "CANCELLED"
              ? "Cancelled appointments cannot be edited"
              : isAppointmentPast(appointment)
              ? "Past appointments cannot be edited"
              : "Edit appointment"
          }
        >
          Quick Edit
        </button>
      </div>
    </div>
  );
}

function AppointmentItem({
  appointment,
  compact = false,
  onEdit,
  onDelete,
  deleting = false,
}) {
  const status = appointment.status || "BOOKED";
  const statusStyles = getStatusStyles(status);
  const isPast = isAppointmentPast(appointment);
  const isCancelled = status === "CANCELLED";
  const disableEdit = isPast || isCancelled;
  const disableDelete = deleting || isCancelled;

  return (
    <div
      className={`rounded-xl border ${statusStyles.card} ${
        compact ? "p-3" : "p-3.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-800">
            {appointment.providerName}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {appointment.providerSpeciality || appointment.providerType || "Doctor"}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyles.badge}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-2 text-xs text-gray-600">
        {appointment.appointmentDate} • {appointment.appointmentSlot}
      </div>

      {!compact && appointment.providerAddress && (
        <div className="mt-2 line-clamp-2 text-xs text-gray-500">
          {appointment.providerAddress}
        </div>
      )}

      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit?.(appointment)}
              disabled={disableEdit}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                disableEdit
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
              title={
                isCancelled
                  ? "Cancelled appointments cannot be edited"
                  : isPast
                  ? "Past appointments cannot be edited"
                  : "Edit appointment"
              }
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onDelete?.(appointment)}
              disabled={disableDelete}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                disableDelete
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
              title={
                isCancelled
                  ? "Appointment already cancelled"
                  : deleting
                  ? "Deleting appointment"
                  : "Delete appointment"
              }
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {(isPast || isCancelled) && (
            <div className="mt-2 text-[11px] text-gray-400">
              {isCancelled
                ? "This appointment is cancelled."
                : "Past appointments cannot be edited."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  isEditing,
  isLoading = false,
  editedTitle,
  setEditedTitle,
  onSelectSession,
  onStartEditing,
  onCancelEditing,
  onSubmitRename,
  onOpenDeleteModal,
}) {
  return (
    <div
      className={`rounded-xl px-3 py-3 mb-2 transition border ${
        isActive
          ? "bg-green-50 border-green-300"
          : "bg-white border-transparent hover:bg-gray-50"
      }`}
    >
      {isEditing ? (
        <div className="space-y-2">
          <input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={() => onSubmitRename(session.sessionId)}
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Save
            </button>

            <button
              onClick={onCancelEditing}
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => onSelectSession(session.sessionId)}
            type="button"
            className="w-full text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm text-gray-800 truncate">
                {session.title || "New Chat"}
              </div>
              {isLoading && (
                <span className="shrink-0 text-[10px] font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
                  Loading
                </span>
              )}
            </div>

            {session.preview ? (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {session.preview}
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">
                Empty conversation
              </div>
            )}

            <div className="text-[11px] text-gray-400 mt-2">
              {session.messageCount || 0} messages
            </div>
          </button>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onStartEditing(session.sessionId, session.title)}
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Rename
            </button>

            <button
              onClick={() => onOpenDeleteModal(session.sessionId, session.title)}
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatSidebar({
  sessions = [],
  currentSessionId,
  sessionsLoading = false,
  creatingSession = false,
  activeSessionLoading = false,
  onSelectSession,
  onNewChat,
  onOpenProfile,
  onRenameSession,
  onDeleteSession,
  isOpen = false,
  onClose,
  onToast,
  appointments = [],
  onEditAppointment,
  onDeleteAppointment,
  deletingAppointmentId = null,
}) {
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [appointmentDeleteTarget, setAppointmentDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const upcomingAppointment = useMemo(
    () => getUpcomingAppointment(appointments),
    [appointments]
  );

  const sortedAppointments = useMemo(
    () => getSortedAppointments(appointments),
    [appointments]
  );

  const showToast = (message, type = "info") => {
    if (typeof onToast === "function") {
      onToast(message, type);
    }
  };

  const startEditing = (sessionId, currentTitle) => {
    setEditingSessionId(sessionId);
    setEditedTitle(currentTitle || "");
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditedTitle("");
  };

  const submitRename = async (sessionId) => {
    const title = editedTitle.trim();
    if (!title) {
      showToast("Please enter a chat title.", "warning");
      return;
    }

    await onRenameSession(sessionId, title);
    cancelEditing();
  };

  const openDeleteModal = (sessionId, title) => {
    setDeleteTarget({
      sessionId,
      title: title || "New Chat",
    });
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.sessionId) return;

    try {
      setDeleting(true);
      await onDeleteSession(deleteTarget.sessionId);
      setDeleteTarget(null);
    } catch (error) {
      console.error("Delete modal error:", error);
      showToast(error.message || "Failed to delete chat.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const openAppointmentDeleteModal = (appointment) => {
    if (!appointment?._id || appointment.status === "CANCELLED") return;
    setAppointmentDeleteTarget(appointment);
  };

  const closeAppointmentDeleteModal = () => {
    if (deletingAppointmentId) return;
    setAppointmentDeleteTarget(null);
  };

  const confirmAppointmentDelete = async () => {
    if (!appointmentDeleteTarget?._id) return;

    try {
      await onDeleteAppointment?.(appointmentDeleteTarget);
      setAppointmentDeleteTarget(null);
    } catch (error) {
      console.error("Appointment delete error:", error);
      showToast(error.message || "Failed to cancel appointment.", "error");
    }
  };

  return (
    <>
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete chat"
        message={`Are you sure you want to delete "${
          deleteTarget?.title || "New Chat"
        }"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />

      <DeleteConfirmModal
        isOpen={Boolean(appointmentDeleteTarget)}
        title="Cancel appointment"
        message={`Are you sure you want to cancel the appointment with "${
          appointmentDeleteTarget?.providerName || "this provider"
        }" on ${
          appointmentDeleteTarget?.appointmentDate || ""
        } at ${
          appointmentDeleteTarget?.appointmentSlot || ""
        }?`}
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep Appointment"
        loading={Boolean(
          deletingAppointmentId &&
            deletingAppointmentId === appointmentDeleteTarget?._id
        )}
        onConfirm={confirmAppointmentDelete}
        onCancel={closeAppointmentDeleteModal}
      />

      <aside
        className={`fixed md:static top-0 left-0 z-40 h-full w-80 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:w-80 md:max-w-none md:flex`}
      >
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="md:hidden flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Menu</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Upcoming Appointment
            </div>

            <CompactUpcomingAppointmentCard
              appointment={upcomingAppointment}
              onEdit={onEditAppointment}
            />
          </div>

          <button
            onClick={onNewChat}
            type="button"
            disabled={creatingSession}
            className={`w-full py-3 rounded-xl transition font-medium ${
              creatingSession
                ? "bg-green-300 text-white cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {creatingSession ? "Creating..." : "+ New Chat"}
          </button>

          <button
            onClick={onOpenProfile}
            type="button"
            className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl hover:bg-blue-100 transition font-medium border border-blue-200"
          >
            👤 Patient Profile
          </button>
        </div>

        <div className="px-3 pt-4 text-xs uppercase tracking-wide text-gray-400 font-semibold">
          My Appointments
        </div>

        <div className="px-3 pt-2 pb-2 max-h-72 overflow-y-auto">
          {sortedAppointments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-400">
              No appointments yet
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAppointments.map((appointment) => (
                <AppointmentItem
                  key={
                    appointment._id ||
                    `${appointment.providerName}-${appointment.appointmentDate}-${appointment.appointmentSlot}`
                  }
                  appointment={appointment}
                  onEdit={onEditAppointment}
                  onDelete={openAppointmentDeleteModal}
                  deleting={deletingAppointmentId === appointment._id}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 font-semibold border-t border-gray-100">
          Chat History
        </div>

        {(sessionsLoading || activeSessionLoading) && (
          <div className="px-3 pb-1 text-[11px] text-gray-500">
            {activeSessionLoading ? "Switching chat..." : "Refreshing chats..."}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <div className="text-sm text-gray-400 px-3 py-4">No chats yet</div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.sessionId}
                session={session}
                isActive={session.sessionId === currentSessionId}
                isEditing={editingSessionId === session.sessionId}
                isLoading={activeSessionLoading && session.sessionId === currentSessionId}
                editedTitle={editedTitle}
                setEditedTitle={setEditedTitle}
                onSelectSession={(sessionId) => {
                  onSelectSession?.(sessionId);
                  if (window.innerWidth < 768) onClose?.();
                }}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onSubmitRename={submitRename}
                onOpenDeleteModal={openDeleteModal}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}