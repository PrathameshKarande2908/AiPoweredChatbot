import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
    },
    age: {
      type: Number,
      default: null,
      min: 0,
      max: 120,
    },
    gender: {
      type: String,
      default: "",
      trim: true,
    },
    allergies: {
      type: String,
      default: "",
      trim: true,
    },
    conditions: {
      type: String,
      default: "",
      trim: true,
    },
    medications: {
      type: String,
      default: "",
      trim: true,
    },
    emergencyContact: {
      type: String,
      default: "",
      trim: true,
    },
    preferredLanguage: {
      type: String,
      default: "en",
      enum: ["en", "hi", "mr"],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("UserProfile", userProfileSchema);