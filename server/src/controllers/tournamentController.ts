import { Request, Response } from "express";
import { z } from "zod";
import {
  addTeam,
  createTournament,
  createCustomMatch,
  declareTournamentWinner,
  deleteTournament,
  generateBracket,
  getAdminTournamentById,
  getPublicTournamentById,
  getPublicTournamentPayload,
  getTournamentVisibility,
  listAdminTournaments,
  registerTeam,
  removeTeam,
  reviewTeamRegistration,
  setTournamentVisibility,
  updateMatchDetails,
  updateTeamRegistryEntry,
  updatePlayoffTeams,
  updateMatchScore,
  updateTournament,
} from "../services/tournamentService.js";

const tournamentSchema = z.object({
  name: z.string().min(1, "Tournament name is required"),
  date: z.string().or(z.date()),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format").optional(),
  location: z.string().min(1, "Location is required"),
  type: z.enum(["singles", "doubles"]),
  format: z.enum(["knockout", "round_robin", "group_knockout"]).optional(),
  entryFee: z.number().min(0).optional(),
  status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
  isVisibleToMembers: z.boolean().optional(),
  allowTeamRegistration: z.boolean().optional(),
  registrationDeadline: z.string().or(z.date()).nullable().optional(),
});

const teamSchema = z.object({
  name: z.string().optional(),
  players: z.array(z.string().min(1)).min(1),
  teamLeadName: z.string().optional(),
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        mobileNumber: z.string().regex(/^\+?[0-9]{8,15}$/),
        gender: z.enum(["male", "female", "other"]),
      })
    )
    .optional(),
  entryFeePaid: z.number().min(0).optional(),
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

const playoffTeamsSchema = z.object({
  teamAId: z.string().nullable(),
  teamBId: z.string().nullable(),
});

const customMatchSchema = z.object({
  matchType: z.enum(["league", "semifinal", "final", "friendly", "practice"]),
  teamAId: z.string().nullable(),
  teamBId: z.string().nullable(),
  scheduledAt: z.string().or(z.date()).nullable().optional(),
  court: z.string().optional().nullable(),
});

const matchDetailsSchema = z.object({
  teamAId: z.string().nullable().optional(),
  teamBId: z.string().nullable().optional(),
  scheduledAt: z.string().or(z.date()).nullable().optional(),
  court: z.string().optional().nullable(),
});

const registrationMemberSchema = z.object({
  name: z.string().min(1, "Member name is required"),
  mobileNumber: z.string().regex(/^\+?[0-9]{8,15}$/, "Enter a valid mobile number"),
  gender: z.enum(["male", "female", "other"]),
  isAvailable: z.literal(true),
});

const registerTeamSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  teamLeadName: z.string().min(1, "Team lead name is required"),
  members: z.array(registrationMemberSchema).min(1),
});

const reviewRegistrationSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  reviewNote: z.string().optional(),
});

const updateTeamRegistrySchema = z.object({
  teamName: z.string().min(1).optional(),
  teamLeadName: z.string().min(1).optional(),
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        mobileNumber: z.string().regex(/^\+?[0-9]{8,15}$/),
        gender: z.enum(["male", "female", "other"]),
      })
    )
    .optional(),
  entryFeePaid: z.number().min(0).optional(),
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

export const updateTournamentPlayoffTeams = async (req: Request, res: Response) => {
  try {
    const payload = playoffTeamsSchema.parse(req.body);
    const result = await updatePlayoffTeams(req.params.id, req.params.matchId, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update playoff teams error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createTournamentCustomMatch = async (req: Request, res: Response) => {
  try {
    const payload = customMatchSchema.parse(req.body);
    const result = await createCustomMatch(req.params.id, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create custom match error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateTournamentMatchDetails = async (req: Request, res: Response) => {
  try {
    const payload = matchDetailsSchema.parse(req.body);
    const result = await updateMatchDetails(req.params.id, req.params.matchId, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update match details error:", error);
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

export const registerPublicTournamentTeam = async (req: Request, res: Response) => {
  try {
    const payload = registerTeamSchema.parse(req.body);
    const result = await registerTeam(req.params.id, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Register tournament team error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const reviewAdminTournamentRegistration = async (req: Request, res: Response) => {
  try {
    const payload = reviewRegistrationSchema.parse(req.body);
    const result = await reviewTeamRegistration(req.params.id, req.params.registrationId, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Review tournament registration error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAdminTournamentTeamRegistry = async (req: Request, res: Response) => {
  try {
    const payload = updateTeamRegistrySchema.parse(req.body);
    const result = await updateTeamRegistryEntry(req.params.id, req.params.registryId, payload);
    if (isServiceError(result)) return res.status(result.status).json({ error: result.error });
    return res.json(result.tournament);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update team registry error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
