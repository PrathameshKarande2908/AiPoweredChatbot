import mongoose from "mongoose";
import Chat from "../models/Chat.js";

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected");

    // Sync indexes with current schema
    await Chat.syncIndexes();
    console.log("✅ Chat indexes synced");
  } catch (error) {
    console.error("❌ DB Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;