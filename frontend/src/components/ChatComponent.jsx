import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentBrowserLocation,
  getHistory,
  getNearbyCare,
  getUserProfile,
  bookAppointment,
  sendMessage,
  updateAppointment as updateAppointmentApi,
} from "../services/api";

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "16:00", "18:00"];

const getTodayDate = () => new Date().toISOString().split("T")[0];

const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};

const getAppointmentDateTime = (appointment) => {
  if (!appointment?.appointmentDate || !appointment?.appointmentSlot) return null;

  const parsed = new Date(
    `${appointment.appointmentDate}T${appointment.appointmentSlot}:00`
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getUpcomingAppointment = (appointments = []) => {
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
};

const severityStyles = {
  MILD: {
    box: "#ecfdf5",
    border: "#a7f3d0",
    text: "#065f46",
    label: "Mild",
  },
  MODERATE: {
    box: "#fffbeb",
    border: "#fde68a",
    text: "#92400e",
    label: "Moderate",
  },
  SEVERE: {
    box: "#fef2f2",
    border: "#fca5a5",
    text: "#991b1b",
    label: "Severe",
  },
};

function parseAppointmentNotes(noteText = "") {
  if (!noteText || typeof noteText !== "string") {
    return {
      clinicNotes: "",
      age: "",
      gender: "",
      allergies: "",
      conditions: "",
      medications: "",
      emergencyContact: "",
    };
  }

  const lines = noteText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const meta = {
    age: "",
    gender: "",
    allergies: "",
    conditions: "",
    medications: "",
    emergencyContact: "",
  };

  const clinicLines = [];

  for (const line of lines) {
    const tokens = line.split("|").map((token) => token.trim()).filter(Boolean);
    let foundMeta = false;

    for (const token of tokens) {
      if (token.startsWith("Age:")) {
        meta.age = token.replace("Age:", "").trim();
        foundMeta = true;
      } else if (token.startsWith("Gender:")) {
        meta.gender = token.replace("Gender:", "").trim();
        foundMeta = true;
      } else if (token.startsWith("Allergies:")) {
        meta.allergies = token.replace("Allergies:", "").trim();
        foundMeta = true;
      } else if (token.startsWith("Conditions:")) {
        meta.conditions = token.replace("Conditions:", "").trim();
        foundMeta = true;
      } else if (token.startsWith("Medications:")) {
        meta.medications = token.replace("Medications:", "").trim();
        foundMeta = true;
      } else if (token.startsWith("Emergency Contact:")) {
        meta.emergencyContact = token.replace("Emergency Contact:", "").trim();
        foundMeta = true;
      }
    }

    if (!foundMeta) {
      clinicLines.push(line);
    }
  }

  return {
    clinicNotes: clinicLines.join("\n").trim(),
    ...meta,
  };
}

function isDateTimeInPast(date, time) {
  if (!date || !time) return false;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

function getAvailableTimeSlots(selectedDate) {
  const today = getTodayDate();

  if (!selectedDate || selectedDate !== today) {
    return TIME_SLOTS;
  }

  const now = Date.now();

  return TIME_SLOTS.filter((slot) => {
    const slotTime = new Date(`${selectedDate}T${slot}:00`);
    return !Number.isNaN(slotTime.getTime()) && slotTime.getTime() > now;
  });
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderCard({ item, onSelect }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontWeight: 700, color: "#111827" }}>{item.name}</div>

      {!!item.specialty && (
        <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
          {item.specialty}
        </div>
      )}

      {!!item.type && !item.specialty && (
        <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
          {item.type}
        </div>
      )}

      {!!item.address && (
        <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
          {item.address}
        </div>
      )}

      <div style={{ marginTop: 8, color: "#374151", fontSize: 13 }}>
        {typeof item.distanceKm === "number" ? `${item.distanceKm} km away` : ""}
        {item.phone ? ` • ${item.phone}` : ""}
      </div>

      <button
        type="button"
        onClick={() => onSelect(item)}
        style={{
          marginTop: 12,
          border: "none",
          borderRadius: 10,
          background: "#2563eb",
          color: "#ffffff",
          padding: "10px 14px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Book Appointment
      </button>
    </div>
  );
}

function BookingOverlay({
  provider,
  profile,
  severity,
  bookingDate,
  setBookingDate,
  bookingTime,
  setBookingTime,
  bookingNotes,
  setBookingNotes,
  bookingName,
  setBookingName,
  bookingAge,
  setBookingAge,
  bookingGender,
  setBookingGender,
  bookingAllergies,
  setBookingAllergies,
  bookingConditions,
  setBookingConditions,
  bookingMedications,
  setBookingMedications,
  bookingEmergencyContact,
  setBookingEmergencyContact,
  bookingLoading,
  bookingMode,
  bookingError,
  availableTimeSlots,
  onClose,
  onConfirm,
}) {
  if (!provider) return null;

  const clinicPhone = String(provider.phone || "").replace(/[^\d+]/g, "");
  const emergencyPhone = "112";
  const ambulancePhone = "108";
  const isSevere = severity === "SEVERE";
  const isEditMode = bookingMode === "edit";
  const minDate = isEditMode ? getTodayDate() : getTomorrowDate();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.55)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          background: "#ffffff",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          minHeight: "82vh",
        }}
      >
        <div
          style={{
            padding: 24,
            borderRight: "1px solid #e5e7eb",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {isEditMode ? "Reschedule Appointment" : "Appointment Request"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#6b7280",
                  fontSize: 14,
                }}
              >
                {isEditMode
                  ? "Update your appointment date and time."
                  : "Review your details and confirm the appointment."}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              marginTop: 20,
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e3a8a" }}>
              {provider.name}
            </div>
            <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
              {provider.specialty || provider.type || "Doctor"}
            </div>
            {!!provider.address && (
              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
                {provider.address}
              </div>
            )}
            <div style={{ marginTop: 8, color: "#374151", fontSize: 13 }}>
              {typeof provider.distanceKm === "number"
                ? `${provider.distanceKm} km away`
                : ""}
              {provider.phone ? ` • ${provider.phone}` : ""}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
                marginBottom: 12,
              }}
            >
              Patient Details
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ffffff",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 13,
                      color: "#374151",
                      fontWeight: 600,
                    }}
                  >
                    Age
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={bookingAge}
                    onChange={(e) => setBookingAge(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 13,
                      color: "#374151",
                      fontWeight: 600,
                    }}
                  >
                    Gender
                  </label>
                  <input
                    type="text"
                    value={bookingGender}
                    onChange={(e) => setBookingGender(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  Allergies
                </label>
                <textarea
                  rows={2}
                  value={bookingAllergies}
                  onChange={(e) => setBookingAllergies(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ffffff",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  Existing Conditions
                </label>
                <textarea
                  rows={2}
                  value={bookingConditions}
                  onChange={(e) => setBookingConditions(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ffffff",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  Current Medications
                </label>
                <textarea
                  rows={2}
                  value={bookingMedications}
                  onChange={(e) => setBookingMedications(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ffffff",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={bookingEmergencyContact}
                  onChange={(e) => setBookingEmergencyContact(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 24,
            overflowY: "auto",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Schedule
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 600,
                }}
              >
                Appointment Date
              </label>
              <input
                type="date"
                min={minDate}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 600,
                }}
              >
                Appointment Time
              </label>
              <select
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              >
                {availableTimeSlots.length > 0 ? (
                  availableTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                ) : (
                  <option value="">No available slots</option>
                )}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 600,
                }}
              >
                Notes for Clinic
              </label>
              <textarea
                rows={5}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Optional notes for the clinic"
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#ffffff",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {!!bookingError && (
            <div
              style={{
                marginTop: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
              }}
            >
              {bookingError}
            </div>
          )}

          <div
            style={{
              marginTop: 18,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                marginBottom: 10,
              }}
            >
              Quick Actions
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {clinicPhone ? (
                <a
                  href={`tel:${clinicPhone}`}
                  style={{
                    display: "inline-block",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRadius: 10,
                    background: "#16a34a",
                    color: "#ffffff",
                    padding: "12px 14px",
                    fontWeight: 700,
                  }}
                >
                  Call Clinic Now
                </a>
              ) : (
                <div
                  style={{
                    borderRadius: 10,
                    background: "#f3f4f6",
                    color: "#6b7280",
                    padding: "12px 14px",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  Clinic phone not available
                </div>
              )}

              {isSevere && (
                <>
                  <a
                    href={`tel:${emergencyPhone}`}
                    style={{
                      display: "inline-block",
                      textAlign: "center",
                      textDecoration: "none",
                      borderRadius: 10,
                      background: "#dc2626",
                      color: "#ffffff",
                      padding: "12px 14px",
                      fontWeight: 700,
                    }}
                  >
                    Call Emergency 112
                  </a>

                  <a
                    href={`tel:${ambulancePhone}`}
                    style={{
                      display: "inline-block",
                      textAlign: "center",
                      textDecoration: "none",
                      borderRadius: 10,
                      background: "#f59e0b",
                      color: "#111827",
                      padding: "12px 14px",
                      fontWeight: 700,
                    }}
                  >
                    Call Ambulance 108
                  </a>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1e3a8a",
                marginBottom: 8,
              }}
            >
              Summary
            </div>
            <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.6 }}>
              <div>
                <b>Patient:</b> {bookingName || profile?.fullName || "Patient"}
              </div>
              <div>
                <b>Date:</b> {bookingDate}
              </div>
              <div>
                <b>Time:</b> {bookingTime || "Select time"}
              </div>
              <div>
                <b>Provider:</b> {provider.name}
              </div>
              <div>
                <b>Speciality:</b> {provider.specialty || provider.type || "Doctor"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onConfirm}
              disabled={bookingLoading || availableTimeSlots.length === 0}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 12,
                background:
                  bookingLoading || availableTimeSlots.length === 0
                    ? "#9ca3af"
                    : "#2563eb",
                color: "#ffffff",
                padding: "14px 16px",
                cursor:
                  bookingLoading || availableTimeSlots.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {bookingLoading
                ? isEditMode
                  ? "Updating..."
                  : "Booking..."
                : isEditMode
                ? "Save Changes"
                : "Confirm Appointment"}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                background: "#ffffff",
                color: "#374151",
                padding: "14px 16px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function renderBulletList(items = []) {
  return (
    <ul style={{ margin: "8px 0 0 18px", padding: 0, lineHeight: 1.7 }}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} style={{ marginBottom: 4 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function extractBullets(sectionText = "") {
  return sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

function parseAssistantMessage(content = "") {
  if (!content || typeof content !== "string") {
    return {
      header: "",
      summary: [],
      nextStepsTitle: "",
      nextSteps: [],
      guidanceTitle: "",
      guidanceBody: "",
      preventiveTitle: "",
      dietTitle: "",
      dietTips: [],
      lifestyleTitle: "",
      lifestyleTips: [],
      preventionTitle: "",
      preventionTips: [],
      warningTitle: "",
      warningSigns: [],
      disclaimer: "",
      raw: "",
    };
  }

  const normalized = content.replace(/\r\n/g, "\n").trim();

  const disclaimerMatch = normalized.match(/⚠️[^\n]+/);
  const disclaimer = disclaimerMatch ? disclaimerMatch[0].trim() : "";

  const headerMatch = normalized.match(/^(🩺[^\n]+|🚨[^\n]+)$/m);
  const header = headerMatch ? headerMatch[1].trim() : "";

  const warningSignsMatch = normalized.match(
    /### (Possible warning signs noticed|संभावित गंभीर संकेत|आढळलेले गंभीर संकेत)\n([\s\S]*?)(?=\n### |\n#### |\n---|\n⚠️|$)/
  );
  const warningTitle = warningSignsMatch ? warningSignsMatch[1].trim() : "";
  const warningSigns = warningSignsMatch
    ? extractBullets(warningSignsMatch[2])
    : [];

  const nextStepsMatch = normalized.match(
    /### (What you can do now|Suggested next steps|Do this now|अभी आप क्या कर सकते हैं|अगले उचित कदम|अभी यह करें|आत्ता तुम्ही काय करू शकता|पुढील योग्य पावले|आत्ता हे करा)\n([\s\S]*?)(?=\n### |\n#### |\n---|\n⚠️|$)/
  );
  const nextStepsTitle = nextStepsMatch ? nextStepsMatch[1].trim() : "";
  const nextSteps = nextStepsMatch ? extractBullets(nextStepsMatch[2]) : [];

  const preventiveMatch = normalized.match(
    /### (Preventive Tips|बचाव और देखभाल सुझाव|प्रतिबंधक आणि काळजीच्या सूचना)\n([\s\S]*?)(?=\n⚠️|$)/
  );
  const preventiveTitle = preventiveMatch ? preventiveMatch[1].trim() : "";
  const preventiveBody = preventiveMatch ? preventiveMatch[2] : "";

  const dietMatch = preventiveBody.match(
    /#### (Diet support|आहार सहायता|आहार मदत)\n([\s\S]*?)(?=\n#### |\n### |$)/
  );
  const lifestyleMatch = preventiveBody.match(
    /#### (Lifestyle support|जीवनशैली सहायता|जीवनशैली मदत)\n([\s\S]*?)(?=\n#### |\n### |$)/
  );
  const preventionMatch = preventiveBody.match(
    /#### (Disease prevention|रोग-रोकथाम|रोग प्रतिबंध)\n([\s\S]*?)(?=\n#### |\n### |$)/
  );

  let guidanceBody = normalized;
  const removableSections = [
    header,
    warningSignsMatch?.[0],
    nextStepsMatch?.[0],
    preventiveMatch?.[0],
    disclaimer,
  ].filter(Boolean);

  removableSections.forEach((section) => {
    guidanceBody = guidanceBody.replace(section, "");
  });

  guidanceBody = guidanceBody
    .replace(/\n---\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  const guidanceTitle = guidanceBody ? "Guidance" : "";
  const summaryLines = !nextSteps.length && !guidanceBody
    ? normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return {
    header,
    summary: summaryLines,
    nextStepsTitle,
    nextSteps,
    guidanceTitle,
    guidanceBody,
    preventiveTitle,
    dietTitle: dietMatch ? dietMatch[1].trim() : "",
    dietTips: dietMatch ? extractBullets(dietMatch[2]) : [],
    lifestyleTitle: lifestyleMatch ? lifestyleMatch[1].trim() : "",
    lifestyleTips: lifestyleMatch ? extractBullets(lifestyleMatch[2]) : [],
    preventionTitle: preventionMatch ? preventionMatch[1].trim() : "",
    preventionTips: preventionMatch ? extractBullets(preventionMatch[2]) : [],
    warningTitle,
    warningSigns,
    disclaimer,
    raw: normalized,
  };
}

function AssistantMessageCard({ content }) {
  const parsed = parseAssistantMessage(content);
  const hasStructuredContent =
    parsed.header ||
    parsed.nextSteps.length ||
    parsed.guidanceBody ||
    parsed.dietTips.length ||
    parsed.lifestyleTips.length ||
    parsed.preventionTips.length ||
    parsed.warningSigns.length;

  if (!hasStructuredContent) {
    return (
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 14,
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
          color: "#111827",
        }}
      >
        {content}
      </div>
    );
  }

  const tipGroups = [
    {
      title: parsed.dietTitle,
      items: parsed.dietTips,
      background: "#eff6ff",
      border: "#bfdbfe",
    },
    {
      title: parsed.lifestyleTitle,
      items: parsed.lifestyleTips,
      background: "#ecfeff",
      border: "#a5f3fc",
    },
    {
      title: parsed.preventionTitle,
      items: parsed.preventionTips,
      background: "#ecfdf5",
      border: "#a7f3d0",
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        color: "#111827",
      }}
    >
      {!!parsed.header && (
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{parsed.header}</div>
      )}

      {parsed.summary.length > 0 && (
        <div style={{ lineHeight: 1.7 }}>
          {parsed.summary.map((line, index) => (
            <div key={`${line}-${index}`} style={{ marginBottom: 6 }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {parsed.nextSteps.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {parsed.nextStepsTitle}
          </div>
          {renderBulletList(parsed.nextSteps)}
        </div>
      )}

      {!!parsed.warningTitle && parsed.warningSigns.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fdba74",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{parsed.warningTitle}</div>
          {renderBulletList(parsed.warningSigns)}
        </div>
      )}

      {!!parsed.guidanceBody && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{parsed.guidanceTitle}</div>
          {parsed.guidanceBody}
        </div>
      )}

      {!!parsed.preventiveTitle && tipGroups.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, color: "#065f46", marginBottom: 8 }}>
            {parsed.preventiveTitle}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: tipGroups.length > 1 ? "1fr 1fr" : "1fr",
              gap: 10,
            }}
          >
            {tipGroups.map((group) => (
              <div
                key={group.title}
                style={{
                  background: group.background,
                  border: `1px solid ${group.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{group.title}</div>
                {renderBulletList(group.items)}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!parsed.disclaimer && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#7f1d1d",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: 10,
          }}
        >
          {parsed.disclaimer}
        </div>
      )}
    </div>
  );
}

export default function ChatComponent({
  userId,
  currentSessionId = null,
  profileRefreshTrigger = 0,
  appointments = [],
  appointmentAction = null,
  onAppointmentsChange,
  onToast,
  onSessionResolved,
  onSessionsRefresh,
  onSessionActivity,
  onSessionLoadStateChange,
}) {
  const [profile, setProfile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatTitle, setChatTitle] = useState("New Chat");
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [severity, setSeverity] = useState("MILD");
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyCareLoading, setNearbyCareLoading] = useState(false);
  const [nearbyCare, setNearbyCare] = useState({ doctors: [], hospitals: [] });

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [bookingMode, setBookingMode] = useState("create");
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [bookingDate, setBookingDate] = useState(getTomorrowDate());
  const [bookingTime, setBookingTime] = useState(TIME_SLOTS[0]);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const [bookingName, setBookingName] = useState("");
  const [bookingAge, setBookingAge] = useState("");
  const [bookingGender, setBookingGender] = useState("");
  const [bookingAllergies, setBookingAllergies] = useState("");
  const [bookingConditions, setBookingConditions] = useState("");
  const [bookingMedications, setBookingMedications] = useState("");
  const [bookingEmergencyContact, setBookingEmergencyContact] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const chatEndRef = useRef(null);
  const loadedSessionRef = useRef(null);
  const activeSessionRef = useRef(currentSessionId);
  const historyRequestIdRef = useRef(0);
  const sendRequestIdRef = useRef(0);

  const latestUserSymptomText = useMemo(() => {
    const latestUser = [...messages].reverse().find((m) => m.role === "user");
    return latestUser?.content || "";
  }, [messages]);

  const upcomingAppointment = useMemo(
    () => getUpcomingAppointment(appointments),
    [appointments]
  );

  const availableTimeSlots = useMemo(
    () => getAvailableTimeSlots(bookingDate),
    [bookingDate]
  );

  const severityUI = severityStyles[severity] || severityStyles.MILD;
  const showCareTools = severity === "MODERATE" || severity === "SEVERE";

  const showToast = (message, type = "info") => {
    if (typeof onToast === "function") {
      onToast(message, type);
    }
  };

  const updateSessionLoadState = (nextState) => {
    if (typeof onSessionLoadStateChange === "function") {
      onSessionLoadStateChange(Boolean(nextState));
    }
  };

  const emitSessionActivity = (sessionId, data = {}) => {
    if (!sessionId || typeof onSessionActivity !== "function") return;

    const nextMessages = Array.isArray(data.messages) ? data.messages : [];
    const previewSource = [...nextMessages]
      .reverse()
      .find((message) => message?.content?.trim());

    onSessionActivity({
      sessionId,
      title: data.title || "New Chat",
      preview: previewSource?.content?.trim() || "",
      messageCount: nextMessages.length,
      updatedAt: new Date().toISOString(),
    });
  };

  const hydrateBookingFromProfile = (profileData) => {
    setBookingName(profileData?.fullName || "");
    setBookingAge(
      profileData?.age !== null && profileData?.age !== undefined
        ? String(profileData.age)
        : ""
    );
    setBookingGender(profileData?.gender || "");
    setBookingAllergies(profileData?.allergies || "");
    setBookingConditions(profileData?.conditions || "");
    setBookingMedications(profileData?.medications || "");
    setBookingEmergencyContact(profileData?.emergencyContact || "");
  };

  const loadProfile = async () => {
    if (!userId) return;
    try {
      const data = await getUserProfile(userId);
      setProfile(data);
      hydrateBookingFromProfile(data);
    } catch {
      setProfile(null);
    }
  };

  const resetBookingState = (useTomorrow = true) => {
    setBookingMode("create");
    setEditingAppointmentId(null);
    setSelectedProvider(null);
    setBookingDate(useTomorrow ? getTomorrowDate() : getTodayDate());
    setBookingTime(TIME_SLOTS[0]);
    setBookingNotes("");
    setBookingError("");
    hydrateBookingFromProfile(profile);
  };

  const clearSessionView = () => {
    setMessages([]);
    setChatTitle("New Chat");
    setSeverity("MILD");
    setStatusMessage("");
    setErrorMessage("");
    setNearbyCare({ doctors: [], hospitals: [] });
    setLocation(null);
    resetBookingState();
  };

  const openEditAppointment = (appointment) => {
    if (!appointment) return;

    const parsedNotes = parseAppointmentNotes(appointment.notes || "");
    const isCancelled = appointment.status === "CANCELLED";
    const isPast = isDateTimeInPast(
      appointment.appointmentDate,
      appointment.appointmentSlot
    );

    if (isCancelled) {
      setErrorMessage("Cancelled appointments cannot be edited.");
      showToast("Cancelled appointments cannot be edited.", "warning");
      return;
    }

    if (isPast) {
      setErrorMessage("Past appointments cannot be edited.");
      showToast("Past appointments cannot be edited.", "warning");
      return;
    }

    setBookingMode("edit");
    setEditingAppointmentId(appointment._id || null);
    setSelectedProvider({
      name: appointment.providerName,
      specialty: appointment.providerSpeciality,
      type: appointment.providerType,
      address: appointment.providerAddress,
      phone: appointment.providerPhone,
      distanceKm: appointment.providerDistanceKm,
      latitude: appointment.providerLat,
      longitude: appointment.providerLng,
    });
    setBookingDate(appointment.appointmentDate || getTodayDate());
    setBookingTime(appointment.appointmentSlot || TIME_SLOTS[0]);
    setBookingNotes(parsedNotes.clinicNotes || "");
    setBookingName(appointment.patientName || profile?.fullName || "Patient");
    setBookingAge(parsedNotes.age || "");
    setBookingGender(parsedNotes.gender || "");
    setBookingAllergies(parsedNotes.allergies || "");
    setBookingConditions(parsedNotes.conditions || "");
    setBookingMedications(parsedNotes.medications || "");
    setBookingEmergencyContact(parsedNotes.emergencyContact || "");
    setBookingError("");
    setSeverity(appointment.severity || "MILD");
    setStatusMessage(`Editing appointment for ${appointment.providerName}.`);
    setErrorMessage("");
  };

  const loadSessionHistory = async (sessionId) => {
    if (!userId || !sessionId) {
      clearSessionView();
      loadedSessionRef.current = null;
      return;
    }

    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    activeSessionRef.current = sessionId;

    try {
      setHistoryLoading(true);
      updateSessionLoadState(true);
      setErrorMessage("");
      setStatusMessage("");
      setBookingError("");
      setNearbyCare({ doctors: [], hospitals: [] });
      setLocation(null);

      const data = await getHistory(userId, sessionId);

      if (
        historyRequestIdRef.current !== requestId ||
        activeSessionRef.current !== sessionId
      ) {
        return;
      }

      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(nextMessages);
      setChatTitle(data?.title || "New Chat");
      setSeverity("MILD");
      resetBookingState();
      loadedSessionRef.current = sessionId;
      emitSessionActivity(sessionId, {
        title: data?.title || "New Chat",
        messages: nextMessages,
      });
    } catch (error) {
      if (
        historyRequestIdRef.current !== requestId ||
        activeSessionRef.current !== sessionId
      ) {
        return;
      }

      clearSessionView();
      setErrorMessage(error.message || "Failed to load chat history.");
      loadedSessionRef.current = null;
    } finally {
      if (historyRequestIdRef.current === requestId) {
        setHistoryLoading(false);
        updateSessionLoadState(false);
      }
    }
  };

  useEffect(() => {
    activeSessionRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    loadProfile();
  }, [userId, profileRefreshTrigger]);

  useEffect(() => {
    if (
      appointmentAction?.type === "edit" &&
      appointmentAction?.appointment?._id
    ) {
      openEditAppointment(appointmentAction.appointment);
    }
  }, [appointmentAction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (availableTimeSlots.length === 0) {
      setBookingTime("");
      return;
    }

    if (!availableTimeSlots.includes(bookingTime)) {
      setBookingTime(availableTimeSlots[0]);
    }
  }, [availableTimeSlots, bookingTime]);

  useEffect(() => {
    if (!userId) return;

    activeSessionRef.current = currentSessionId;

    if (!currentSessionId) {
      historyRequestIdRef.current += 1;
      clearSessionView();
      loadedSessionRef.current = null;
      setHistoryLoading(false);
      updateSessionLoadState(false);
      return;
    }

    if (loadedSessionRef.current === currentSessionId && messages.length > 0) {
      return;
    }

    loadSessionHistory(currentSessionId);
  }, [userId, currentSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, nearbyCare, historyLoading]);

  const sendChatMessage = async () => {
    if (!userId || !input.trim() || chatLoading || historyLoading) return;

    const targetSessionId = currentSessionId;
    const requestId = sendRequestIdRef.current + 1;
    sendRequestIdRef.current = requestId;

    const userText = input.trim();
    const optimisticUserMessage = {
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setErrorMessage("");
    setStatusMessage("");
    resetBookingState();
    setNearbyCare({ doctors: [], hospitals: [] });

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInput("");
    setChatLoading(true);

    try {
      const data = await sendMessage(
        userId,
        userText,
        targetSessionId,
        profile?.preferredLanguage || "en"
      );

      if (sendRequestIdRef.current !== requestId) {
        return;
      }

      const resolvedSessionId = data?.sessionId || targetSessionId;
      const nextMessages = Array.isArray(data?.messages)
        ? data.messages
        : [
            ...messages,
            optimisticUserMessage,
            {
              role: "assistant",
              content: data?.reply || "I'm here to help.",
              timestamp: new Date().toISOString(),
            },
          ];

      if (resolvedSessionId && resolvedSessionId !== currentSessionId) {
        onSessionResolved?.(resolvedSessionId);
      }

      setMessages(nextMessages);
      setChatTitle(data?.title || "New Chat");
      setSeverity(data?.severity || "MILD");

      if (data?.severity === "MODERATE" || data?.severity === "SEVERE") {
        setStatusMessage(
          "Severity detected. Use your location to see nearby doctors and hospitals."
        );
      } else {
        setStatusMessage("No urgent care recommendation needed right now.");
      }

      if (resolvedSessionId) {
        loadedSessionRef.current = resolvedSessionId;
        activeSessionRef.current = resolvedSessionId;
        emitSessionActivity(resolvedSessionId, {
          title: data?.title || "New Chat",
          messages: nextMessages,
        });
      }

      onSessionsRefresh?.();
    } catch (error) {
      if (sendRequestIdRef.current !== requestId) {
        return;
      }

      setMessages((prev) => {
        const withoutOptimistic = [...prev];
        const index = withoutOptimistic.findIndex(
          (msg) =>
            msg.role === "user" &&
            msg.content === optimisticUserMessage.content &&
            msg.timestamp === optimisticUserMessage.timestamp
        );

        if (index !== -1) {
          withoutOptimistic.splice(index, 1);
        }

        return [
          ...withoutOptimistic,
          {
            role: "assistant",
            content: "⚠️ Server error. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ];
      });
      setErrorMessage(error.message || "Failed to send message.");
    } finally {
      if (sendRequestIdRef.current === requestId) {
        setChatLoading(false);
      }
    }
  };

  const handleUseMyLocation = async () => {
    if (locationLoading || nearbyCareLoading) return;

    setErrorMessage("");
    setStatusMessage("");

    try {
      setLocationLoading(true);
      const coords = await getCurrentBrowserLocation();
      setLocation(coords);
      setStatusMessage("Location captured. Fetching nearby care...");

      setNearbyCareLoading(true);
      const data = await getNearbyCare({
        latitude: coords.latitude,
        longitude: coords.longitude,
        severity,
        symptomText: latestUserSymptomText,
        language: profile?.preferredLanguage || "en",
      });

      setNearbyCare({
        doctors: data.doctors || [],
        hospitals: data.hospitals || [],
      });

      if ((data.doctors || []).length || (data.hospitals || []).length) {
        setStatusMessage("Nearby care loaded successfully.");
      } else {
        setStatusMessage("No nearby care results were found.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch nearby care.");
      setNearbyCare({ doctors: [], hospitals: [] });
    } finally {
      setLocationLoading(false);
      setNearbyCareLoading(false);
    }
  };

  const handleSelectProvider = (provider) => {
    setBookingMode("create");
    setEditingAppointmentId(null);
    setSelectedProvider(provider);
    setBookingDate(getTomorrowDate());
    setBookingTime(TIME_SLOTS[0]);
    setBookingNotes("");
    setBookingError("");
    hydrateBookingFromProfile(profile);
    setStatusMessage(`Selected ${provider.name} for booking.`);
    setErrorMessage("");
  };

  const handleCloseBooking = () => {
    resetBookingState();
  };

  const buildProfileSnapshot = () => {
    return [
      bookingAge ? `Age: ${bookingAge}` : "",
      bookingGender ? `Gender: ${bookingGender}` : "",
      bookingAllergies ? `Allergies: ${bookingAllergies}` : "",
      bookingConditions ? `Conditions: ${bookingConditions}` : "",
      bookingMedications ? `Medications: ${bookingMedications}` : "",
      bookingEmergencyContact
        ? `Emergency Contact: ${bookingEmergencyContact}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");
  };

  const validateBooking = () => {
    if (!selectedProvider) {
      return "Please select a doctor first.";
    }

    if (!bookingName.trim()) {
      return "Please enter patient name.";
    }

    if (!bookingDate) {
      return "Please select appointment date.";
    }

    if (!bookingTime) {
      return "Please select appointment time.";
    }

    if (availableTimeSlots.length === 0) {
      return "No valid time slots are available for the selected date.";
    }

    if (isDateTimeInPast(bookingDate, bookingTime)) {
      return "Past date/time cannot be selected.";
    }

    return "";
  };

  const handleBookAppointment = async () => {
    const validationError = validateBooking();

    if (validationError) {
      setBookingError(validationError);
      showToast(validationError, "warning");
      return;
    }

    try {
      setBookingLoading(true);
      setBookingError("");
      setErrorMessage("");
      setStatusMessage("");

      const profileSnapshot = buildProfileSnapshot();
      const mergedNotes = [bookingNotes, profileSnapshot].filter(Boolean).join("\n");

      if (bookingMode === "edit" && editingAppointmentId) {
        const existingAppointment = appointments.find(
          (appointment) => appointment._id === editingAppointmentId
        );

        if (!existingAppointment) {
          throw new Error("Appointment not found.");
        }

        if (existingAppointment.status === "CANCELLED") {
          throw new Error("Cancelled appointments cannot be edited.");
        }

        const result = await updateAppointmentApi(editingAppointmentId, {
          userId,
          appointmentDate: bookingDate,
          appointmentSlot: bookingTime,
          notes: mergedNotes,
          patientName:
            bookingName?.trim() || existingAppointment?.patientName || "Patient",
          symptoms:
            existingAppointment?.symptoms ||
            latestUserSymptomText ||
            "Health consultation",
          severity: existingAppointment?.severity || severity,
          language:
            existingAppointment?.language || profile?.preferredLanguage || "en",
          status: existingAppointment?.status || "BOOKED",
        });

        if (!result?.success || !result?.appointment) {
          throw new Error(result?.message || "Failed to update appointment.");
        }

        const nextAppointments = appointments.map((appointment) =>
          appointment._id === editingAppointmentId ? result.appointment : appointment
        );

        onAppointmentsChange?.(nextAppointments);
        setStatusMessage("Appointment updated successfully.");
        showToast("Appointment updated successfully.", "success");
        handleCloseBooking();
        return;
      }

      const payload = {
        userId,
        patientName: bookingName?.trim() || profile?.fullName?.trim() || "Patient",
        symptoms: latestUserSymptomText || "Health consultation",
        severity,
        language: profile?.preferredLanguage || "en",
        providerType: selectedProvider.type || "doctor",
        providerName: selectedProvider.name,
        providerAddress: selectedProvider.address || "",
        providerSpeciality:
          selectedProvider.specialty || selectedProvider.type || "",
        providerPhone: selectedProvider.phone || "",
        providerDistanceKm: Number(selectedProvider.distanceKm || 0),
        providerLat: selectedProvider.latitude ?? selectedProvider.lat ?? null,
        providerLng: selectedProvider.longitude ?? selectedProvider.lng ?? null,
        appointmentDate: bookingDate,
        appointmentSlot: bookingTime,
        notes: mergedNotes,
      };

      const result = await bookAppointment(payload);

      if (!result?.success || !result?.appointment) {
        throw new Error(result?.message || "Booking failed.");
      }

      onAppointmentsChange?.([result.appointment, ...appointments]);
      setStatusMessage("Appointment booked successfully.");
      showToast("Appointment booked successfully.", "success");
      handleCloseBooking();
    } catch (error) {
      const message = error.message || "Failed to save appointment.";
      setBookingError(message);
      setErrorMessage(message);
      showToast(message, "error");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 24,
      }}
    >
      <BookingOverlay
        provider={selectedProvider}
        profile={profile}
        severity={severity}
        bookingDate={bookingDate}
        setBookingDate={setBookingDate}
        bookingTime={bookingTime}
        setBookingTime={setBookingTime}
        bookingNotes={bookingNotes}
        setBookingNotes={setBookingNotes}
        bookingName={bookingName}
        setBookingName={setBookingName}
        bookingAge={bookingAge}
        setBookingAge={setBookingAge}
        bookingGender={bookingGender}
        setBookingGender={setBookingGender}
        bookingAllergies={bookingAllergies}
        setBookingAllergies={setBookingAllergies}
        bookingConditions={bookingConditions}
        setBookingConditions={setBookingConditions}
        bookingMedications={bookingMedications}
        setBookingMedications={setBookingMedications}
        bookingEmergencyContact={bookingEmergencyContact}
        setBookingEmergencyContact={setBookingEmergencyContact}
        bookingLoading={bookingLoading}
        bookingMode={bookingMode}
        bookingError={bookingError}
        availableTimeSlots={availableTimeSlots}
        onClose={handleCloseBooking}
        onConfirm={handleBookAppointment}
      />

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.3fr 0.9fr",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title={chatTitle || "AI Health Chat"}>
            <div
              style={{
                height: 360,
                overflowY: "auto",
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: 14,
                background: "#ffffff",
              }}
            >
              {!currentSessionId ? (
                <div style={{ color: "#6b7280", lineHeight: 1.7 }}>
                  Select a chat from the sidebar or create a new one to begin.
                </div>
              ) : messages.length === 0 && !historyLoading ? (
                <div style={{ color: "#6b7280" }}>
                  Type something like: <b>I have chest pain and breathing issue</b>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      marginBottom: 12,
                      display: "flex",
                      justifyContent:
                        message.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "88%",
                        minWidth: message.role === "assistant" ? "70%" : "auto",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#6b7280",
                          marginBottom: 4,
                          textTransform: "capitalize",
                        }}
                      >
                        {message.role}
                      </div>

                      {message.role === "assistant" ? (
                        <AssistantMessageCard content={message.content} />
                      ) : (
                        <div
                          style={{
                            background: "#dbeafe",
                            border: "1px solid #93c5fd",
                            borderRadius: 14,
                            padding: 12,
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            color: "#111827",
                          }}
                        >
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {historyLoading && (
                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 14,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  Switching session and loading history...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChatMessage();
                }}
                placeholder={
                  currentSessionId
                    ? "Type symptoms..."
                    : "Create or select a chat to start"
                }
                disabled={historyLoading || !currentSessionId}
                style={{
                  flex: 1,
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 15,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={chatLoading || historyLoading || !currentSessionId}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background:
                    chatLoading || historyLoading ? "#9ca3af" : "#2563eb",
                  color: "#ffffff",
                  padding: "12px 18px",
                  cursor:
                    chatLoading || historyLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {!currentSessionId ? "Select Chat" : chatLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming Appointment">
            {!upcomingAppointment ? (
              <div style={{ color: "#6b7280" }}>No upcoming appointment.</div>
            ) : (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  background: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 700, color: "#111827", fontSize: 18 }}>
                  {upcomingAppointment.providerName}
                </div>

                <div style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
                  {upcomingAppointment.providerSpeciality ||
                    upcomingAppointment.providerType}
                </div>

                <div style={{ marginTop: 10, color: "#374151", fontSize: 14 }}>
                  {upcomingAppointment.appointmentDate} •{" "}
                  {upcomingAppointment.appointmentSlot}
                </div>

                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                  Status: {upcomingAppointment.status}
                </div>

                {!!upcomingAppointment.providerAddress && (
                  <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                    {upcomingAppointment.providerAddress}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Care & Booking">
            <div
              style={{
                border: `1px solid ${severityUI.border}`,
                background: severityUI.box,
                color: severityUI.text,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                Current Severity: {severityUI.label}
              </div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                {showCareTools
                  ? "You can now fetch nearby doctors and hospitals."
                  : "Nearby care recommendations will appear for moderate or severe symptoms."}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={!showCareTools || locationLoading || nearbyCareLoading}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background:
                    !showCareTools || locationLoading || nearbyCareLoading
                      ? "#9ca3af"
                      : "#16a34a",
                  color: "#ffffff",
                  padding: "12px 16px",
                  cursor:
                    !showCareTools || locationLoading || nearbyCareLoading
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 700,
                  width: "100%",
                }}
              >
                {locationLoading || nearbyCareLoading
                  ? "Loading nearby care..."
                  : "Use my location"}
              </button>

              {location && (
                <div style={{ marginTop: 8, color: "#4b5563", fontSize: 13 }}>
                  Location: {location.latitude.toFixed(4)},{" "}
                  {location.longitude.toFixed(4)}
                </div>
              )}
            </div>

            {!!statusMessage && (
              <div
                style={{
                  marginTop: 14,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                }}
              >
                {statusMessage}
              </div>
            )}

            {!!errorMessage && (
              <div
                style={{
                  marginTop: 14,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Nearby Doctors
              </div>

              {nearbyCare.doctors.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  No doctors shown yet. Click <b>Use my location</b>.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {nearbyCare.doctors.map((doctor, index) => (
                    <ProviderCard
                      key={`${doctor.name}-${index}`}
                      item={doctor}
                      onSelect={handleSelectProvider}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Nearby Hospitals
              </div>

              {nearbyCare.hospitals.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  No hospitals shown yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {nearbyCare.hospitals.map((hospital, index) => (
                    <div
                      key={`${hospital.name}-${index}`}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        background: "#f9fafb",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#111827" }}>
                        {hospital.name}
                      </div>
                      <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
                        {hospital.type || "Hospital"}
                      </div>
                      <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>
                        {typeof hospital.distanceKm === "number"
                          ? `${hospital.distanceKm} km away`
                          : ""}
                        {hospital.phone ? ` • ${hospital.phone}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}