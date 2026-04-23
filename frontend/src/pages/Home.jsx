import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import ChatComponent from "../components/ChatComponent.jsx";
import ChatSidebar from "../components/ChatSidebar.jsx";
import ProfilePanel from "../components/ProfilePanel.jsx";
import ToastContainer from "../components/ToastContainer.jsx";
import {
  auth,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  logOutUser,
} from "../services/firebase";
import {
  createChatSession,
  deleteAppointment as deleteAppointmentApi,
  deleteChatSession,
  getAppointments,
  getChatSessions,
  renameChatSession,
} from "../services/api";

function getAppointmentDateTime(appointment) {
  if (!appointment?.appointmentDate || !appointment?.appointmentSlot) return null;

  const parsed = new Date(
    `${appointment.appointmentDate}T${appointment.appointmentSlot}:00`
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getUpcomingAppointment(appointments = []) {
  const now = Date.now();

  return (
    appointments
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
      .sort((a, b) => a._sortDate - b._sortDate)[0] || null
  );
}

function getReadableError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed.";
    case "auth/popup-blocked":
      return "Popup blocked by browser. Allow popups and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    default:
      return "Authentication failed. Please try again.";
  }
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const [appointments, setAppointments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [activeSessionLoading, setActiveSessionLoading] = useState(false);

  const [deletingAppointmentId, setDeletingAppointmentId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [appointmentAction, setAppointmentAction] = useState(null);

  const pushToast = useCallback((message, type = "info") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setToasts((prev) => [...prev, { id, message, type }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const loadAppointments = useCallback(
    async (uid) => {
      if (!uid) return;

      try {
        const data = await getAppointments(uid);
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      } catch (err) {
        pushToast(err.message || "Failed to load appointments.", "error");
      }
    },
    [pushToast]
  );

  const loadSessions = useCallback(
    async (uid, preferredSessionId = null) => {
      if (!uid) return;

      try {
        setSessionsLoading(true);
        const data = await getChatSessions(uid);
        const nextSessions = Array.isArray(data?.sessions) ? data.sessions : [];
        setSessions(nextSessions);

        if (preferredSessionId) {
          setCurrentSessionId(preferredSessionId);
          return;
        }

        setCurrentSessionId((prev) => {
          if (prev && nextSessions.some((session) => session.sessionId === prev)) {
            return prev;
          }
          return nextSessions[0]?.sessionId || null;
        });
      } catch (err) {
        pushToast(err.message || "Failed to load chat sessions.", "error");
      } finally {
        setSessionsLoading(false);
      }
    },
    [pushToast]
  );

  const handleAppointmentsChange = useCallback((nextAppointments) => {
    setAppointments(Array.isArray(nextAppointments) ? nextAppointments : []);
  }, []);

  const handleSessionResolved = useCallback((resolvedSessionId) => {
    if (!resolvedSessionId) return;

    setCurrentSessionId(resolvedSessionId);

    setSessions((prev) => {
      if (prev.some((session) => session.sessionId === resolvedSessionId)) {
        return prev;
      }

      return [
        {
          sessionId: resolvedSessionId,
          title: "New Chat",
          preview: "",
          messageCount: 0,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });

    if (user?.uid) {
      loadSessions(user.uid, resolvedSessionId);
    }
  }, [loadSessions, user?.uid]);

  const handleSessionActivity = useCallback((activity) => {
    if (!activity?.sessionId) return;

    setSessions((prev) => {
      const existingIndex = prev.findIndex(
        (session) => session.sessionId === activity.sessionId
      );

      const nextSession = {
        sessionId: activity.sessionId,
        title: activity.title || "New Chat",
        preview: activity.preview || "",
        messageCount: activity.messageCount || 0,
        updatedAt: activity.updatedAt || new Date().toISOString(),
      };

      if (existingIndex === -1) {
        return [nextSession, ...prev];
      }

      const updated = [...prev];
      const current = updated[existingIndex];
      updated[existingIndex] = {
        ...current,
        ...nextSession,
      };

      const [moved] = updated.splice(existingIndex, 1);
      return [moved, ...updated];
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setAuthLoading(false);

      if (firebaseUser?.uid) {
        loadAppointments(firebaseUser.uid);
        loadSessions(firebaseUser.uid);
      } else {
        setAppointments([]);
        setSessions([]);
        setCurrentSessionId(null);
      }
    });

    return () => unsubscribe();
  }, [loadAppointments, loadSessions]);

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const upcomingAppointment = useMemo(
    () => getUpcomingAppointment(appointments),
    [appointments]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      const message = "Email and password are required.";
      setError(message);
      pushToast(message, "warning");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      const message = "Password must be at least 6 characters.";
      setError(message);
      pushToast(message, "warning");
      return;
    }

    setFormLoading(true);

    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password, name);
        pushToast("Account created successfully.", "success");
      } else {
        await signInWithEmail(email, password);
        pushToast("Logged in successfully.", "success");
      }

      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      const readable = getReadableError(err);
      setError(readable);
      pushToast(readable, "error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      pushToast("Google sign-in successful.", "success");
    } catch (err) {
      const readable = getReadableError(err);
      setError(readable);
      pushToast(readable, "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOutUser();
      pushToast("Logged out successfully.", "success");
      setSidebarOpen(false);
      setProfileOpen(false);
      setAppointmentAction(null);
      setAppointments([]);
      setSessions([]);
      setCurrentSessionId(null);
    } catch {
      setError("Logout failed. Try again.");
      pushToast("Logout failed. Try again.", "error");
    }
  };

  const handleProfileSaved = useCallback(() => {
    setProfileRefreshKey((prev) => prev + 1);
  }, []);

  const handleDeleteAppointment = useCallback(
    async (appointment) => {
      if (!user?.uid || !appointment?._id) return;

      setDeletingAppointmentId(appointment._id);

      try {
        const res = await deleteAppointmentApi(appointment._id, user.uid);

        if (!res?.success) {
          throw new Error(res?.message || "Failed to cancel appointment.");
        }

        setAppointments((prev) =>
          prev.map((item) =>
            item._id === appointment._id
              ? {
                  ...item,
                  status: "CANCELLED",
                }
              : item
          )
        );

        pushToast(
          res?.message || "Appointment cancelled successfully.",
          "success"
        );
      } catch (err) {
        pushToast(err.message || "Failed to cancel appointment.", "error");
      } finally {
        setDeletingAppointmentId(null);
      }
    },
    [pushToast, user?.uid]
  );

  const handleEditAppointment = useCallback(
    (appointment) => {
      if (!appointment?._id) return;

      setAppointmentAction({
        type: "edit",
        appointment,
        nonce: `${Date.now()}_${appointment._id}`,
      });

      setSidebarOpen(false);
      pushToast("Edit appointment opened.", "info");
    },
    [pushToast]
  );

  const handleNewChat = useCallback(async () => {
    if (!user?.uid || creatingSession) return;

    try {
      setCreatingSession(true);
      const data = await createChatSession(user.uid);
      const nextSessionId = data?.sessionId;

      if (!nextSessionId) {
        throw new Error("Session id was not returned.");
      }

      await loadSessions(user.uid, nextSessionId);
      setActiveSessionLoading(true);
      setSidebarOpen(false);
      pushToast("New chat created.", "success");
    } catch (err) {
      pushToast(err.message || "Failed to create chat session.", "error");
    } finally {
      setCreatingSession(false);
    }
  }, [creatingSession, loadSessions, pushToast, user?.uid]);

  const handleSelectSession = useCallback((sessionId) => {
    if (!sessionId || sessionId === currentSessionId) {
      setSidebarOpen(false);
      return;
    }

    setActiveSessionLoading(true);
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
  }, [currentSessionId]);

  const handleRenameSession = useCallback(
    async (sessionId, title) => {
      if (!user?.uid) return;

      try {
        const res = await renameChatSession(user.uid, sessionId, title);

        setSessions((prev) =>
          prev.map((session) =>
            session.sessionId === sessionId
              ? {
                  ...session,
                  title: res?.title || title,
                }
              : session
          )
        );

        pushToast("Chat renamed successfully.", "success");
      } catch (err) {
        pushToast(err.message || "Failed to rename chat.", "error");
        throw err;
      }
    },
    [pushToast, user?.uid]
  );

  const handleDeleteSession = useCallback(
    async (sessionId) => {
      if (!user?.uid) return;

      try {
        await deleteChatSession(user.uid, sessionId);

        setSessions((prev) => {
          const remaining = prev.filter((session) => session.sessionId !== sessionId);

          setCurrentSessionId((current) => {
            if (current !== sessionId) return current;
            return remaining[0]?.sessionId || null;
          });

          return remaining;
        });

        pushToast("Chat deleted successfully.", "success");
      } catch (err) {
        pushToast(err.message || "Failed to delete chat.", "error");
        throw err;
      }
    },
    [pushToast, user?.uid]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white px-6 py-4 rounded-2xl shadow text-gray-700">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <div className="min-h-screen bg-gradient-to-br from-green-100 via-white to-blue-100 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-4xl mb-2">🏥</div>
              <h1 className="text-2xl font-bold text-gray-800">
                AI Health Assistant
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Sign in to continue to your personal health chat.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || formLoading}
              className={`w-full border border-gray-300 rounded-xl py-3 px-4 flex items-center justify-center gap-3 font-medium transition mb-5 ${
                googleLoading || formLoading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span className="text-lg">🔵</span>
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </button>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400">or</span>
              </div>
            </div>

            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === "login"
                    ? "bg-white shadow text-green-700"
                    : "text-gray-500"
                }`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === "signup"
                    ? "bg-white shadow text-green-700"
                    : "text-gray-500"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              )}

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
              />

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={formLoading || googleLoading}
                className={`w-full py-3 rounded-xl text-white font-semibold transition ${
                  formLoading || googleLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {formLoading
                  ? "Please wait..."
                  : mode === "signup"
                  ? "Create Account"
                  : "Login"}
              </button>
            </form>

            <p className="text-xs text-center text-gray-400 mt-6">
              Secure sign-in powered by Firebase Authentication
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50"
            >
              ☰
            </button>

            <div>
              <div className="text-lg font-semibold text-green-700">
                AI Health Assistant
              </div>
              <div className="text-sm text-gray-500">
                Signed in as {user.email}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {upcomingAppointment && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <div className="font-medium">Next appointment</div>
                <div className="truncate text-xs text-green-700">
                  {upcomingAppointment.providerName} • {upcomingAppointment.appointmentDate} •{" "}
                  {upcomingAppointment.appointmentSlot}
                </div>
              </div>
            )}

            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              type="button"
            >
              {profileOpen ? "Hide Profile" : "Profile"}
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
              type="button"
            >
              Logout
            </button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              type="button"
            >
              Profile
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
              type="button"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close sidebar overlay"
              className="md:hidden fixed inset-0 bg-black/40 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            sessionsLoading={sessionsLoading}
            creatingSession={creatingSession}
            activeSessionLoading={activeSessionLoading}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onOpenProfile={() => {
              setProfileOpen(true);
              setSidebarOpen(false);
            }}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onToast={pushToast}
            appointments={appointments}
            onEditAppointment={handleEditAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            deletingAppointmentId={deletingAppointmentId}
          />

          <div className="flex-1 min-w-0">
            <ChatComponent
              userId={user.uid}
              currentSessionId={currentSessionId}
              profileRefreshTrigger={profileRefreshKey}
              appointments={appointments}
              appointmentAction={appointmentAction}
              onAppointmentsChange={handleAppointmentsChange}
              onToast={pushToast}
              onSessionResolved={handleSessionResolved}
              onSessionsRefresh={() => loadSessions(user.uid)}
              onSessionActivity={handleSessionActivity}
              onSessionLoadStateChange={setActiveSessionLoading}
            />
          </div>

          <ProfilePanel
            userId={user.uid}
            isOpen={profileOpen}
            onClose={() => setProfileOpen(false)}
            onToast={pushToast}
            onProfileSaved={handleProfileSaved}
          />
        </div>
      </div>
    </>
  );
}