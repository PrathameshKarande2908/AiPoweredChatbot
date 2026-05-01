import express from "express";
import {
  createAppointment,
  autoBookAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

const router = express.Router();

router.post("/create", createAppointment);
router.post("/auto-book", autoBookAppointment);
router.get("/list/:userId", listAppointments);
router.get("/list", listAppointments);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;
