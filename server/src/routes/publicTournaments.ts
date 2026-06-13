import express from "express";
import {
  getPublicTournament,
  getPublicTournaments,
  getTournamentConfig,
  registerPublicTournamentTeam,
  submitPublicTournamentFeedback,
} from "../controllers/tournamentController.js";

const router = express.Router();

router.get("/config", getTournamentConfig);
router.get("/", getPublicTournaments);
router.post("/:id/register-team", registerPublicTournamentTeam);
router.post("/:id/feedback", submitPublicTournamentFeedback);
router.get("/:id", getPublicTournament);

export default router;
