import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    patientName: {
      type: String,
      default: "Patient",
      trim: true,
    },
    symptoms: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ["MILD", "MODERATE", "SEVERE"],
      required: true,
    },
    language: {
      type: String,
      default: "en",
      trim: true,
    },
    providerType: {
      type: String,
      enum: ["doctor", "hospital"],
      required: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    providerAddress: {
      type: String,
      default: "",
      trim: true,
    },
    providerSpeciality: {
      type: String,
      default: "",
      trim: true,
    },
    providerPhone: {
      type: String,
      default: "",
      trim: true,
    },
    providerDistanceKm: {
      type: Number,
      default: 0,
    },
    providerLat: {
      type: Number,
      default: null,
    },
    providerLng: {
      type: Number,
      default: null,
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentSlot: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["BOOKED", "CONFIRMED", "CANCELLED"],
      default: "BOOKED",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Appointment", AppointmentSchema);