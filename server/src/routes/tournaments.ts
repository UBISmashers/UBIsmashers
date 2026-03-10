import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  addAdminTournamentExpense,
  addAdminTournamentIncome,
  addTournamentTeam,
  createTournamentCustomMatch,
  createAdminTournament,
  declareTournamentChampion,
  deleteAdminTournament,
  generateTournamentBracket,
  generateTournamentSchedule,
  getAdminTournament,
  getAdminTournaments,
  getTournamentConfig,
  removeTournamentTeam,
  reviewAdminTournamentRegistration,
  updateAdminTournament,
  updateTournamentConfig,
  updateAdminTournamentTeamRegistry,
  updateAdminTournamentExpense,
  updateAdminTournamentIncome,
  updateTournamentMatchDetails,
  updateTournamentPlayoffTeams,
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
router.patch("/:id/team-registry/:registryId", updateAdminTournamentTeamRegistry);
router.post("/:id/finance/expenses", addAdminTournamentExpense);
router.post("/:id/finance/incomes", addAdminTournamentIncome);
router.patch("/:id/finance/expenses/:expenseId", updateAdminTournamentExpense);
router.patch("/:id/finance/incomes/:incomeId", updateAdminTournamentIncome);
router.patch("/:id/registrations/:registrationId/review", reviewAdminTournamentRegistration);
router.post("/:id/generate-bracket", generateTournamentBracket);
router.post("/:id/generate-schedule", generateTournamentSchedule);
router.patch("/:id/matches/:matchId", updateTournamentMatchScore);
router.patch("/:id/matches/:matchId/details", updateTournamentMatchDetails);
router.patch("/:id/matches/:matchId/playoff-teams", updateTournamentPlayoffTeams);
router.post("/:id/matches/custom", createTournamentCustomMatch);
router.post("/:id/declare-winner", declareTournamentChampion);

export default router;
