import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "16:00", "18:00"];

const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};

const parseAppointmentDateTime = (appointmentDate, appointmentSlot) => {
  if (!appointmentDate || !appointmentSlot) return null;

  const parsed = new Date(`${appointmentDate}T${appointmentSlot}:00`);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isDateTimeInPast = (appointmentDate, appointmentSlot) => {
  const appointmentDateTime = parseAppointmentDateTime(
    appointmentDate,
    appointmentSlot
  );

  if (!appointmentDateTime) return false;
  return appointmentDateTime.getTime() < Date.now();
};

const normalizeSeverity = (severity = "MILD") => {
  const value = String(severity || "MILD").toUpperCase();
  return ["MILD", "MODERATE", "SEVERE"].includes(value) ? value : "MILD";
};

const normalizeProviderType = (providerType, provider = {}) => {
  const raw = String(providerType || provider.type || "").toLowerCase();

  if (raw.includes("hospital") || provider.emergencyReady) {
    return "hospital";
  }

  return "doctor";
};

const buildAppointmentPayload = ({
  userId,
  patientName = "Patient",
  symptoms = "Health consultation",
  severity = "MILD",
  language = "en",
  providerType,
  providerName,
  providerAddress = "",
  providerSpeciality = "",
  providerPhone = "",
  providerDistanceKm = 0,
  providerLat = null,
  providerLng = null,
  appointmentDate,
  appointmentSlot,
  notes = "",
  source = "MANUAL",
}) => {
  const appointmentDateTime = parseAppointmentDateTime(
    appointmentDate,
    appointmentSlot
  );

  return {
    userId,
    patientName: patientName || "Patient",
    symptoms,
    severity: normalizeSeverity(severity),
    language,
    providerType,
    providerName,
    providerAddress,
    providerSpeciality,
    providerPhone,
    providerDistanceKm: Number(providerDistanceKm || 0),
    providerLat: Number.isFinite(Number(providerLat)) ? Number(providerLat) : null,
    providerLng: Number.isFinite(Number(providerLng)) ? Number(providerLng) : null,
    appointmentDate,
    appointmentSlot,
    appointmentDateTime,
    notes,
    source,
    status: "BOOKED",
  };
};

const validateRequiredAppointmentFields = ({
  userId,
  symptoms,
  severity,
  providerType,
  providerName,
  appointmentDate,
  appointmentSlot,
}) => {
  if (
    !userId ||
    !symptoms ||
    !severity ||
    !providerType ||
    !providerName ||
    !appointmentDate ||
    !appointmentSlot
  ) {
    return "Missing required appointment fields.";
  }

  if (!["MILD", "MODERATE", "SEVERE"].includes(String(severity).toUpperCase())) {
    return "Invalid severity value.";
  }

  if (!["doctor", "hospital"].includes(String(providerType))) {
    return "Invalid provider type.";
  }

  if (!parseAppointmentDateTime(appointmentDate, appointmentSlot)) {
    return "Invalid appointment date or time.";
  }

  if (isDateTimeInPast(appointmentDate, appointmentSlot)) {
    return "Appointment must be scheduled for a future time.";
  }

  return "";
};

const findActiveDuplicate = async ({
  userId,
  providerName,
  appointmentDate,
  appointmentSlot,
  excludeAppointmentId = null,
}) => {
  const query = {
    userId,
    providerName,
    appointmentDate,
    appointmentSlot,
    status: { $ne: "CANCELLED" },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  return Appointment.findOne(query);
};

export const createAppointment = async (req, res) => {
  try {
    const {
      userId,
      patientName,
      symptoms,
      severity,
      language,
      providerType,
      providerName,
      providerAddress,
      providerSpeciality,
      providerPhone,
      providerDistanceKm,
      providerLat,
      providerLng,
      appointmentDate,
      appointmentSlot,
      notes,
      source = "MANUAL",
    } = req.body || {};

    const normalizedSeverity = normalizeSeverity(severity);

    const validationError = validateRequiredAppointmentFields({
      userId,
      symptoms,
      severity: normalizedSeverity,
      providerType,
      providerName,
      appointmentDate,
      appointmentSlot,
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const existing = await findActiveDuplicate({
      userId,
      providerName,
      appointmentDate,
      appointmentSlot,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This appointment slot is already booked.",
      });
    }

    const appointment = await Appointment.create(
      buildAppointmentPayload({
        userId,
        patientName,
        symptoms,
        severity: normalizedSeverity,
        language,
        providerType,
        providerName,
        providerAddress,
        providerSpeciality,
        providerPhone,
        providerDistanceKm,
        providerLat,
        providerLng,
        appointmentDate,
        appointmentSlot,
        notes,
        source,
      })
    );

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointment,
    });
  } catch (error) {
    console.error("createAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create appointment.",
      error: error.message,
    });
  }
};

export const autoBookAppointment = async (req, res) => {
  try {
    const {
      userId,
      patientName = "Patient",
      symptoms = "Health consultation",
      severity = "MODERATE",
      language = "en",
      provider,
      appointmentDate = getTomorrowDate(),
      appointmentSlot = TIME_SLOTS[0],
      notes = "Smart recommendation quick booking.",
    } = req.body || {};

    if (!userId || !provider?.name) {
      return res.status(400).json({
        success: false,
        message: "userId and provider are required for auto booking.",
      });
    }

    const providerType = normalizeProviderType(provider.type, provider);
    const providerSpeciality = provider.specialty || provider.type || "";
    const normalizedSeverity = normalizeSeverity(severity);

    const validationError = validateRequiredAppointmentFields({
      userId,
      symptoms,
      severity: normalizedSeverity,
      providerType,
      providerName: provider.name,
      appointmentDate,
      appointmentSlot,
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const existing = await findActiveDuplicate({
      userId,
      providerName: provider.name,
      appointmentDate,
      appointmentSlot,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This smart appointment is already booked.",
      });
    }

    const appointment = await Appointment.create(
      buildAppointmentPayload({
        userId,
        patientName,
        symptoms,
        severity: normalizedSeverity,
        language,
        providerType,
        providerName: provider.name,
        providerAddress: provider.address || "",
        providerSpeciality,
        providerPhone: provider.phone || "",
        providerDistanceKm: provider.distanceKm,
        providerLat: provider.latitude ?? provider.lat ?? null,
        providerLng: provider.longitude ?? provider.lng ?? null,
        appointmentDate,
        appointmentSlot,
        notes,
        source: "AUTO_BOOKING",
      })
    );

    return res.status(201).json({
      success: true,
      message: "Smart appointment booked successfully.",
      appointment,
    });
  } catch (error) {
    console.error("autoBookAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to auto book appointment.",
      error: error.message,
    });
  }
};

export const listAppointments = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    const appointments = await Appointment.find({ userId })
      .sort({ appointmentDateTime: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    console.error("listAppointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments.",
      error: error.message,
    });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const {
      userId,
      appointmentDate,
      appointmentSlot,
      notes,
      patientName,
      symptoms,
      severity,
      language,
      status,
    } = req.body || {};

    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid appointment id is required.",
      });
    }

    if (!appointmentDate || !appointmentSlot) {
      return res.status(400).json({
        success: false,
        message: "appointmentDate and appointmentSlot are required.",
      });
    }

    const nextAppointmentDateTime = parseAppointmentDateTime(
      appointmentDate,
      appointmentSlot
    );

    if (!nextAppointmentDateTime) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment date or time.",
      });
    }

    if (isDateTimeInPast(appointmentDate, appointmentSlot)) {
      return res.status(400).json({
        success: false,
        message: "Appointment must be scheduled for a future time.",
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (userId && appointment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this appointment.",
      });
    }

    if (appointment.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled appointments cannot be updated.",
      });
    }

    const duplicate = await findActiveDuplicate({
      userId: appointment.userId,
      providerName: appointment.providerName,
      appointmentDate,
      appointmentSlot,
      excludeAppointmentId: appointment._id,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This appointment slot is already booked.",
      });
    }

    appointment.appointmentDate = appointmentDate;
    appointment.appointmentSlot = appointmentSlot;
    appointment.appointmentDateTime = nextAppointmentDateTime;

    if (typeof notes === "string") appointment.notes = notes;

    if (typeof patientName === "string" && patientName.trim()) {
      appointment.patientName = patientName.trim();
    }

    if (typeof symptoms === "string" && symptoms.trim()) {
      appointment.symptoms = symptoms.trim();
    }

    if (
      typeof severity === "string" &&
      ["MILD", "MODERATE", "SEVERE"].includes(severity)
    ) {
      appointment.severity = severity;
    }

    if (typeof language === "string" && language.trim()) {
      appointment.language = language.trim();
    }

    if (
      typeof status === "string" &&
      ["BOOKED", "CONFIRMED", "CANCELLED"].includes(status)
    ) {
      appointment.status = status;
    }

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully.",
      appointment,
    });
  } catch (error) {
    console.error("updateAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update appointment.",
      error: error.message,
    });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.query.userId || req.body?.userId;

    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid appointment id is required.",
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (userId && appointment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this appointment.",
      });
    }

    if (appointment.status === "CANCELLED") {
      return res.status(200).json({
        success: true,
        message: "Appointment already cancelled.",
        appointment,
      });
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully.",
      appointment,
    });
  } catch (error) {
    console.error("deleteAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel appointment.",
      error: error.message,
    });
  }
};
