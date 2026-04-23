import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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
    } = req.body;

    if (
      !userId ||
      !symptoms ||
      !severity ||
      !providerType ||
      !providerName ||
      !appointmentDate ||
      !appointmentSlot
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required appointment fields.",
      });
    }

    const appointment = await Appointment.create({
      userId,
      patientName: patientName || "Patient",
      symptoms,
      severity,
      language: language || "en",
      providerType,
      providerName,
      providerAddress: providerAddress || "",
      providerSpeciality: providerSpeciality || "",
      providerPhone: providerPhone || "",
      providerDistanceKm: Number(providerDistanceKm || 0),
      providerLat: providerLat ?? null,
      providerLng: providerLng ?? null,
      appointmentDate,
      appointmentSlot,
      notes: notes || "",
      status: "BOOKED",
    });

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
      .sort({ createdAt: -1 })
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
    } = req.body;

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

    appointment.appointmentDate = appointmentDate;
    appointment.appointmentSlot = appointmentSlot;

    if (typeof notes === "string") {
      appointment.notes = notes;
    }

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