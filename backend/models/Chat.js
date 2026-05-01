import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant"],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conditionMemorySchema = new mongoose.Schema(
  {
    knownSymptoms: {
      type: [String],
      default: [],
    },
    primaryConcern: {
      type: String,
      default: "general",
      trim: true,
    },
    highestSeverity: {
      type: String,
      enum: ["MILD", "MODERATE", "SEVERE"],
      default: "MILD",
    },
    progressionFlags: {
      type: [String],
      default: [],
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    conditionMemory: {
      type: conditionMemorySchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export default mongoose.model("Chat", chatSchema);
