import express from "express";
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

const router = express.Router();

router.post("/create", createAppointment);
router.get("/list/:userId", listAppointments);
router.get("/list", listAppointments);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;