const API_URL = import.meta.env.VITE_API_URL;

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getErrorMessage = (data, fallbackMessage) => {
  return data?.message || data?.error || fallbackMessage;
};

const request = async (url, options = {}, fallbackMessage = "Request failed") => {
  const response = await fetch(url, options);
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  return data;
};

/* ================= CHAT ================= */

export const sendMessage = async (userId, message, sessionId, language) => {
  return request(
    `${API_URL}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        message,
        sessionId,
        language,
      }),
    },
    "Failed to send message"
  );
};

export const getHistory = async (userId, sessionId) => {
  return request(
    `${API_URL}/chat/history/${userId}?sessionId=${encodeURIComponent(sessionId)}`,
    {},
    "Failed to fetch chat history"
  );
};

/* ================= SESSIONS ================= */

export const getChatSessions = async (userId) => {
  return request(
    `${API_URL}/chat/sessions/${userId}`,
    {},
    "Failed to fetch chat sessions"
  );
};

export const createChatSession = async (userId) => {
  return request(
    `${API_URL}/chat/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
    "Failed to create chat session"
  );
};

export const renameChatSession = async (userId, sessionId, title) => {
  return request(
    `${API_URL}/chat/sessions/${sessionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, title }),
    },
    "Failed to rename chat session"
  );
};

export const deleteChatSession = async (userId, sessionId) => {
  return request(
    `${API_URL}/chat/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    },
    "Failed to delete chat session"
  );
};

/* ================= PROFILE ================= */

export const getUserProfile = async (userId) => {
  return request(
    `${API_URL}/chat/profile/${userId}`,
    {},
    "Failed to fetch profile"
  );
};

export const updateUserProfile = async (userId, profile) => {
  return request(
    `${API_URL}/chat/profile/${userId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profile),
    },
    "Failed to update profile"
  );
};

/* ================= LOCATION ================= */

export const getCurrentBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Unable to access your location.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission was denied.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Location information is unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out.";
        }

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });

/* ================= NEARBY CARE ================= */

export const getNearbyCare = async ({
  latitude,
  longitude,
  severity,
  symptomText,
  language,
}) => {
  return request(
    `${API_URL}/chat/nearby-care`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude,
        longitude,
        severity,
        symptomText,
        language,
      }),
    },
    "Failed to fetch nearby care"
  );
};

/* ================= APPOINTMENTS ================= */

export const bookAppointment = async (payload) => {
  return request(
    `${API_URL}/appointments/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to book appointment"
  );
};

export const getAppointments = async (userId) => {
  return request(
    `${API_URL}/appointments/list/${userId}`,
    {},
    "Failed to fetch appointments"
  );
};

export const updateAppointment = async (appointmentId, payload) => {
  return request(
    `${API_URL}/appointments/${appointmentId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update appointment"
  );
};

export const deleteAppointment = async (appointmentId, userId) => {
  return request(
    `${API_URL}/appointments/${appointmentId}?userId=${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    },
    "Failed to cancel appointment"
  );
};