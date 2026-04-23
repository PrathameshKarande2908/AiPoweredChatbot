import { useCallback, useEffect, useState } from "react";
import {
  sendMessage,
  getHistory,
  getChatSessions,
  createChatSession,
  renameChatSession,
  deleteChatSession,
} from "../services/api";

const createLocalSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export function useChat(userId, language = "en", onToast) {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const showToast = useCallback(
    (message, type = "info") => {
      if (typeof onToast === "function") {
        onToast(message, type);
      }
    },
    [onToast]
  );

  const loadSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setSessionId(null);
      setMessages([]);
      return;
    }

    try {
      const data = await getChatSessions(userId);
      const fetchedSessions = data?.sessions || [];

      setSessions(fetchedSessions);

      if (fetchedSessions.length === 0) {
        setSessionId(null);
        setMessages([]);
        return;
      }

      setSessionId((prev) => {
        const hasPrev = fetchedSessions.some((item) => item.sessionId === prev);
        return hasPrev ? prev : fetchedSessions[0].sessionId;
      });
    } catch (error) {
      console.error("Load sessions error:", error);
      showToast(error.message || "Failed to load chat sessions.", "error");
      setSessions([]);
    }
  }, [userId, showToast]);

  const loadHistory = useCallback(async () => {
    if (!userId || !sessionId) {
      setMessages([]);
      return;
    }

    setLoadingHistory(true);

    try {
      const data = await getHistory(userId, sessionId);
      setMessages(
        (data?.messages || []).map((msg) => ({
          ...msg,
          severity:
            msg?.severity ||
            (msg?.role === "assistant"
              ? msg?.emergency
                ? "SEVERE"
                : null
              : null),
        }))
      );
    } catch (error) {
      console.error("Load history error:", error);
      showToast(error.message || "Failed to load chat history.", "error");
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId, sessionId, showToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const send = useCallback(
    async (text) => {
      const cleanText = String(text || "").trim();
      if (!cleanText || !userId) return null;

      const activeSessionId = sessionId || createLocalSessionId();
      const userMessage = {
        role: "user",
        content: cleanText,
        timestamp: new Date().toISOString(),
      };

      if (!sessionId) {
        setSessionId(activeSessionId);
      }

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await sendMessage(
          userId,
          cleanText,
          activeSessionId,
          language
        );

        const assistantMessage = {
          role: "assistant",
          content: response?.reply || "",
          severity: response?.severity || null,
          emergency: response?.emergency || false,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        setSessionId(response?.sessionId || activeSessionId);

        await loadSessions();

        return response;
      } catch (error) {
        setMessages((prev) => prev.filter((msg) => msg !== userMessage));
        throw error;
      }
    },
    [userId, sessionId, language, loadSessions]
  );

  const selectSession = useCallback(async (targetSessionId) => {
    setSessionId(targetSessionId);
  }, []);

  const startNewChat = useCallback(async () => {
    if (!userId) return null;

    try {
      const data = await createChatSession(userId);

      const newSession = {
        sessionId: data.sessionId,
        title: data.title || "New Chat",
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        preview: "",
      };

      setSessions((prev) => [newSession, ...prev]);
      setSessionId(data.sessionId);
      setMessages([]);

      return data;
    } catch (error) {
      console.error("Create chat error:", error);
      showToast(error.message || "Failed to create chat session.", "error");
      return null;
    }
  }, [userId, showToast]);

  const renameSession = useCallback(
    async (targetSessionId, title) => {
      if (!userId || !targetSessionId || !title?.trim()) return null;

      try {
        const data = await renameChatSession(userId, targetSessionId, title);

        setSessions((prev) =>
          prev.map((session) =>
            session.sessionId === targetSessionId
              ? { ...session, title: data.title || title.trim() }
              : session
          )
        );

        showToast("Chat renamed successfully.", "success");
        return data;
      } catch (error) {
        console.error("Rename session error:", error);
        showToast(error.message || "Failed to rename chat session.", "error");
        return null;
      }
    },
    [userId, showToast]
  );

  const removeSession = useCallback(
    async (targetSessionId) => {
      if (!userId || !targetSessionId) return null;

      try {
        await deleteChatSession(userId, targetSessionId);

        setSessions((prev) =>
          prev.filter((session) => session.sessionId !== targetSessionId)
        );

        setSessionId((prev) => {
          if (prev !== targetSessionId) return prev;
          return null;
        });

        setMessages((prev) => {
          if (sessionId === targetSessionId) return [];
          return prev;
        });

        showToast("Chat deleted successfully.", "success");

        const refreshed = await getChatSessions(userId);
        const refreshedSessions = refreshed?.sessions || [];
        setSessions(refreshedSessions);

        if (sessionId === targetSessionId) {
          if (refreshedSessions.length > 0) {
            setSessionId(refreshedSessions[0].sessionId);
          } else {
            setSessionId(null);
            setMessages([]);
          }
        }

        return true;
      } catch (error) {
        console.error("Delete session error:", error);
        showToast(error.message || "Failed to delete chat session.", "error");
        return null;
      }
    },
    [userId, sessionId, showToast]
  );

  return {
    messages,
    sessions,
    sessionId,
    loadingHistory,
    send,
    selectSession,
    startNewChat,
    renameSession,
    removeSession,
  };
}