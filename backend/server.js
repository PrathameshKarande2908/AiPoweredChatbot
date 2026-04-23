import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";

console.log(
  "SERVER ENV KEY:",
  process.env.OPENROUTER_API_KEY ? "FOUND" : "MISSING"
);
console.log("MONGO ENV:", process.env.MONGO_URI ? "FOUND" : "MISSING");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

connectDB();

app.use("/api/chat", chatRoutes);
app.use("/api/appointments", appointmentRoutes);

app.get("/", (req, res) => {
  res.status(200).send("API Running...");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});