import { Request, Response } from "express";
import { z } from "zod";
import {
  addTeam,
  createTournament,
  declareTournamentWinner,
  deleteTournament,
  generateBracket,
  getAdminTournamentById,
  getPublicTournamentById,
  getPublicTournamentPayload,
  getTournamentVisibility,
  listAdminTournaments,
  removeTeam,
  setTournamentVisibility,
  updateMatchScore,
  updateTournament,
} from "../services/tournamentService.js";

const tournamentSchema = z.object({
  name: z.string().min(1, "Tournament name is required"),
  date: z.string().or(z.date()),
  location: z.string().min(1, "Location is required"),
  type: z.enum(["singles", "doubles"]),
  entryFee: z.number().min(0).optional(),
  status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
  isVisibleToMembers: z.boolean().optional(),
});

const teamSchema = z.object({
  name: z.string().optional(),
  players: z.array(z.string().min(1)).min(1),
});

const visibilitySchema = z.object({
  enabled: z.boolean(),
});

const scoreSchema = z.object({
  scoreA: z.number().min(0),
  scoreB: z.number().min(0),
});

const winnerSchema = z.object({
  teamId: z.string().min(1),
});

const isServiceError = (value: any): value is { error: string; status: number } =>
  Boolean(value && typeof value.error === "string" && typeof value.status === "number");

export const getTournamentConfig = async (_req: Request, res: Response) => {
  const enabled = await getTournamentVisibility();
  return res.json({ enabled });
};

export const updateTournamentConfig = async (req: Request, res: Response) => {
  try {
    const { enabled } = visibilitySchema.parse(req.body);
    const updated = await setTournamentVisibility(enabled);
    return res.json({ enabled: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update tournament config error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAdminTournaments = async (_req: Request, res: Response) => {
  try {
    const tournaments = await listAdminTournaments();
    return res.json(tournaments);
  } catch (error) {
    console.error("Get tournaments error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAdminTournament = async (req: Request, res: Response) => {
  try {
    const tournament = await getAdminTournamentById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });
    return res.json(tournament);
  } catch (error) {
    console.error("Get tournament error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createAdminTournament = async (req: Request, res: Response) => {
  try {
    const payload = tournamentSchema.parse(req.body);
    const tournament = await createTournament(payload);
    return res.status(201).json(tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create tournament error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAdminTournament = async (req: Request, res: Response) => {
  try {
    const payload = tournamentSchema.partial().parse(req.body);
    const tournament = await updateTournament(req.params.id, payload);
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });
    return res.json(tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update tournament error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteAdminTournament = async (req: Request, res: Response) => {
  try {
    const deleted = await deleteTournament(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Tournament not found" });
    return res.json({ message: "Tournament deleted successfully" });
  } catch (error) {
    console.error("Delete tournament error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addTournamentTeam = async (req: Request, res: Response) => {
  try {
    const payload = teamSchema.parse(req.body);
    const result = await addTeam(req.params.id, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Add team error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeTournamentTeam = async (req: Request, res: Response) => {
  try {
    const result = await removeTeam(req.params.id, req.params.teamId);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    console.error("Remove team error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const generateTournamentBracket = async (req: Request, res: Response) => {
  try {
    const result = await generateBracket(req.params.id);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    console.error("Generate bracket error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateTournamentMatchScore = async (req: Request, res: Response) => {
  try {
    const { scoreA, scoreB } = scoreSchema.parse(req.body);
    const result = await updateMatchScore(req.params.id, req.params.matchId, scoreA, scoreB);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update match score error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const declareTournamentChampion = async (req: Request, res: Response) => {
  try {
    const { teamId } = winnerSchema.parse(req.body);
    const result = await declareTournamentWinner(req.params.id, teamId);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Declare winner error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getPublicTournaments = async (_req: Request, res: Response) => {
  try {
    const payload = await getPublicTournamentPayload();
    return res.json(payload);
  } catch (error) {
    console.error("Get public tournaments error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getPublicTournament = async (req: Request, res: Response) => {
  try {
    const payload = await getPublicTournamentById(req.params.id);
    if (!payload.isEnabled) return res.status(403).json({ error: "Tournament feature is disabled" });
    if (!payload.tournament) return res.status(404).json({ error: "Tournament not found" });
    return res.json(payload.tournament);
  } catch (error) {
    console.error("Get public tournament error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
