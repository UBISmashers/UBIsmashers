import express from "express";
import {
  getPublicTournament,
  getPublicTournaments,
  getTournamentConfig,
  registerPublicTournamentTeam,
} from "../controllers/tournamentController.js";

const router = express.Router();

router.get("/config", getTournamentConfig);
router.get("/", getPublicTournaments);
router.post("/:id/register-team", registerPublicTournamentTeam);
router.get("/:id", getPublicTournament);

export default router;
