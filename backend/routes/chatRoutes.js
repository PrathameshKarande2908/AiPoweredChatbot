import express from "express";
import {
  handleChat,
  getHistory,
  listChats,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  getUserProfile,
  updateUserProfile,
  getNearbyCare,
} from "../controllers/chatController.js";

const router = express.Router();

/**
 * CHAT SYSTEM
 * Final endpoint: /api/chat
 */
router.post("/", handleChat);

/**
 * CHAT HISTORY
 * /api/chat/history/:userId?sessionId=...
 */
router.get("/history/:userId", getHistory);

/**
 * SESSION MANAGEMENT
 */
router.get("/sessions/:userId", listChats);
router.post("/sessions", createChatSession);
router.patch("/sessions/:sessionId", renameChatSession);
router.delete("/sessions/:sessionId", deleteChatSession);

/**
 * USER PROFILE
 */
router.get("/profile/:userId", getUserProfile);
router.put("/profile/:userId", updateUserProfile);

/**
 * 🔥 CRITICAL FEATURE
 * Nearby doctors/hospitals
 * Final endpoint: /api/chat/nearby-care
 */
router.post("/nearby-care", getNearbyCare);

export default router;