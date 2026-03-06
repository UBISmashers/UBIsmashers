import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  addTournamentTeam,
  createAdminTournament,
  declareTournamentChampion,
  deleteAdminTournament,
  generateTournamentBracket,
  getAdminTournament,
  getAdminTournaments,
  getTournamentConfig,
  removeTournamentTeam,
  updateAdminTournament,
  updateTournamentConfig,
  updateTournamentMatchScore,
} from "../controllers/tournamentController.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/config", getTournamentConfig);
router.patch("/config", updateTournamentConfig);

router.get("/", getAdminTournaments);
router.post("/", createAdminTournament);
router.get("/:id", getAdminTournament);
router.put("/:id", updateAdminTournament);
router.delete("/:id", deleteAdminTournament);
router.post("/:id/teams", addTournamentTeam);
router.delete("/:id/teams/:teamId", removeTournamentTeam);
router.post("/:id/generate-bracket", generateTournamentBracket);
router.patch("/:id/matches/:matchId", updateTournamentMatchScore);
router.post("/:id/declare-winner", declareTournamentChampion);

export default router;
