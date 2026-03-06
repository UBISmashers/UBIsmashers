import mongoose from "mongoose";
import { AppSetting } from "../models/AppSetting.js";
import { ITournament, ITournamentMatch, Tournament } from "../models/Tournament.js";

const TOURNAMENT_VISIBILITY_KEY = "tournament_visibility_enabled";

const toId = (value: mongoose.Types.ObjectId | string | null | undefined) =>
  value ? value.toString() : null;

const getRoundLabel = (roundNumber: number, totalRounds: number) => {
  if (totalRounds <= 0) return `Round ${roundNumber}`;
  if (roundNumber === totalRounds) return "Final";
  if (roundNumber === totalRounds - 1) return "Semi Finals";
  if (roundNumber === totalRounds - 2) return "Quarter Finals";
  const players = 2 ** (totalRounds - roundNumber + 1);
  if (players > 2) return `Round of ${players}`;
  return `Round ${roundNumber}`;
};

const nextPowerOfTwo = (value: number) => {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
};

const shuffle = <T>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const findMatch = (matches: ITournamentMatch[], roundNumber: number, matchNumber: number) =>
  matches.find((match) => match.roundNumber === roundNumber && match.matchNumber === matchNumber);

const getSourceMatch = (
  matches: ITournamentMatch[],
  roundNumber: number,
  matchNumber: number,
  side: "A" | "B"
) => {
  if (roundNumber <= 1) return null;
  const sourceRound = roundNumber - 1;
  const sourceMatchNumber = (matchNumber - 1) * 2 + (side === "A" ? 1 : 2);
  return findMatch(matches, sourceRound, sourceMatchNumber) || null;
};

const setNextRoundSlot = (
  matches: ITournamentMatch[],
  roundNumber: number,
  matchNumber: number,
  winnerTeamId: mongoose.Types.ObjectId | null
) => {
  const nextMatch = findMatch(matches, roundNumber + 1, Math.ceil(matchNumber / 2));
  if (!nextMatch) return;
  if (matchNumber % 2 === 1) {
    nextMatch.teamAId = winnerTeamId;
  } else {
    nextMatch.teamBId = winnerTeamId;
  }
};

const isValidCompletedMatch = (match: ITournamentMatch) => {
  if (!match.isCompleted) return false;
  const teamAId = toId(match.teamAId);
  const teamBId = toId(match.teamBId);
  const winnerId = toId(match.winnerTeamId);
  if (!teamAId || !teamBId || !winnerId) return false;
  if (match.scoreA === null || match.scoreB === null) return false;
  if (match.scoreA === match.scoreB) return false;
  const expectedWinner = match.scoreA > match.scoreB ? teamAId : teamBId;
  return winnerId === expectedWinner;
};

type PreservedMatch = {
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  isCompleted: boolean;
};

const captureMatches = (matches: ITournamentMatch[]) => {
  const map = new Map<string, PreservedMatch>();
  matches.forEach((match) => {
    map.set(match.matchId, {
      teamAId: toId(match.teamAId),
      teamBId: toId(match.teamBId),
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      winnerTeamId: toId(match.winnerTeamId),
      isCompleted: match.isCompleted,
    });
  });
  return map;
};

const resetDerivedMatches = (matches: ITournamentMatch[]) => {
  matches.forEach((match) => {
    if (match.roundNumber > 1) {
      match.teamAId = null;
      match.teamBId = null;
    }
    match.scoreA = null;
    match.scoreB = null;
    match.winnerTeamId = null;
    match.isCompleted = false;
  });
};

const reconcileBracketState = (tournament: ITournament) => {
  const preserved = captureMatches(tournament.matches);
  resetDerivedMatches(tournament.matches);

  for (let round = 1; round <= tournament.totalRounds; round += 1) {
    const roundMatches = tournament.matches
      .filter((match) => match.roundNumber === round)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    roundMatches.forEach((match) => {
      if (round > 1) {
        const sourceA = getSourceMatch(tournament.matches, round, match.matchNumber, "A");
        const sourceB = getSourceMatch(tournament.matches, round, match.matchNumber, "B");
        match.teamAId = sourceA?.isCompleted ? sourceA.winnerTeamId : null;
        match.teamBId = sourceB?.isCompleted ? sourceB.winnerTeamId : null;
      }

      const teamAId = toId(match.teamAId);
      const teamBId = toId(match.teamBId);
      const old = preserved.get(match.matchId);

      if (!teamAId && !teamBId) {
        const sourceA = getSourceMatch(tournament.matches, round, match.matchNumber, "A");
        const sourceB = getSourceMatch(tournament.matches, round, match.matchNumber, "B");
        const canSetVoid = round === 1 || ((sourceA?.isCompleted ?? false) && (sourceB?.isCompleted ?? false));
        if (canSetVoid) {
          match.isCompleted = true;
          match.winnerTeamId = null;
        }
      } else if (teamAId && !teamBId) {
        const sourceB = getSourceMatch(tournament.matches, round, match.matchNumber, "B");
        const canAutoAdvance = round === 1 || Boolean(sourceB?.isCompleted);
        if (canAutoAdvance) {
          match.isCompleted = true;
          match.winnerTeamId = match.teamAId;
        }
      } else if (!teamAId && teamBId) {
        const sourceA = getSourceMatch(tournament.matches, round, match.matchNumber, "A");
        const canAutoAdvance = round === 1 || Boolean(sourceA?.isCompleted);
        if (canAutoAdvance) {
          match.isCompleted = true;
          match.winnerTeamId = match.teamBId;
        }
      } else if (old) {
        const sameTeams = old.teamAId === teamAId && old.teamBId === teamBId;
        if (sameTeams && old.isCompleted) {
          match.scoreA = old.scoreA;
          match.scoreB = old.scoreB;
          match.winnerTeamId = old.winnerTeamId ? new mongoose.Types.ObjectId(old.winnerTeamId) : null;
          match.isCompleted = true;
          if (!isValidCompletedMatch(match)) {
            match.scoreA = null;
            match.scoreB = null;
            match.winnerTeamId = null;
            match.isCompleted = false;
          }
        }
      }

      if (match.isCompleted) {
        setNextRoundSlot(tournament.matches, round, match.matchNumber, match.winnerTeamId);
      }
    });
  }

  const finalMatch = findMatch(tournament.matches, tournament.totalRounds, 1);
  if (finalMatch?.isCompleted && finalMatch.winnerTeamId) {
    tournament.championTeamId = finalMatch.winnerTeamId;
    tournament.status = "completed";
    tournament.finalScore =
      finalMatch.scoreA !== null && finalMatch.scoreB !== null
        ? `${finalMatch.scoreA}-${finalMatch.scoreB}`
        : null;
  } else if (tournament.matches.some((match) => match.isCompleted)) {
    tournament.championTeamId = null;
    tournament.finalScore = null;
    tournament.status = "ongoing";
  } else {
    tournament.championTeamId = null;
    tournament.finalScore = null;
    tournament.status = "upcoming";
  }
};

const buildBracketMatches = (teams: ITournament["teams"]) => {
  const shuffledTeams = shuffle(teams.map((team) => team._id));
  const bracketSize = nextPowerOfTwo(shuffledTeams.length);
  const totalRounds = Math.log2(bracketSize);
  const slots: Array<mongoose.Types.ObjectId | null> = [...shuffledTeams];

  while (slots.length < bracketSize) slots.push(null);

  const matches: ITournamentMatch[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = bracketSize / 2 ** round;
    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
      const matchId = `R${round}-M${matchNumber}`;
      let teamAId: mongoose.Types.ObjectId | null = null;
      let teamBId: mongoose.Types.ObjectId | null = null;

      if (round === 1) {
        teamAId = slots[(matchNumber - 1) * 2];
        teamBId = slots[(matchNumber - 1) * 2 + 1];
      }

      matches.push({
        matchId,
        roundNumber: round,
        roundLabel: getRoundLabel(round, totalRounds),
        matchNumber,
        teamAId,
        teamBId,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isCompleted: false,
      } as ITournamentMatch);
    }
  }

  return { matches, totalRounds };
};

const normalizeTeamSignature = (players: string[]) =>
  [...players].map((player) => player.trim().toLowerCase()).sort().join("|");

const serializeTournament = (tournament: ITournament) => {
  const plain = tournament.toObject();
  const teamsById = new Map(plain.teams.map((team: any) => [team._id.toString(), team]));
  const champion =
    plain.championTeamId && teamsById.has(plain.championTeamId.toString())
      ? teamsById.get(plain.championTeamId.toString())
      : null;

  return {
    ...plain,
    championTeam: champion,
    matches: plain.matches.map((match: any) => ({
      ...match,
      teamA: match.teamAId ? teamsById.get(match.teamAId.toString()) || null : null,
      teamB: match.teamBId ? teamsById.get(match.teamBId.toString()) || null : null,
      winnerTeam: match.winnerTeamId ? teamsById.get(match.winnerTeamId.toString()) || null : null,
    })),
  };
};

export const getTournamentVisibility = async () => {
  const setting = await AppSetting.findOne({ key: TOURNAMENT_VISIBILITY_KEY });
  return Boolean(setting?.value);
};

export const setTournamentVisibility = async (enabled: boolean) => {
  await AppSetting.findOneAndUpdate(
    { key: TOURNAMENT_VISIBILITY_KEY },
    { key: TOURNAMENT_VISIBILITY_KEY, value: enabled },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return enabled;
};

export const listAdminTournaments = async () => {
  const tournaments = await Tournament.find().sort({ date: -1, createdAt: -1 });
  return tournaments.map(serializeTournament);
};

export const getAdminTournamentById = async (id: string) => {
  const tournament = await Tournament.findById(id);
  if (!tournament) return null;
  return serializeTournament(tournament);
};

type CreateTournamentInput = {
  name: string;
  date: string | Date;
  location: string;
  type: "singles" | "doubles";
  entryFee?: number;
  status?: "upcoming" | "ongoing" | "completed";
  isVisibleToMembers?: boolean;
};

export const createTournament = async (input: CreateTournamentInput) => {
  const tournament = await Tournament.create({
    name: input.name.trim(),
    date: new Date(input.date),
    location: input.location.trim(),
    type: input.type,
    entryFee: input.entryFee || 0,
    status: input.status || "upcoming",
    isVisibleToMembers: input.isVisibleToMembers ?? true,
    teams: [],
    matches: [],
    totalRounds: 0,
    championTeamId: null,
    finalScore: null,
  });

  return serializeTournament(tournament);
};

type UpdateTournamentInput = Partial<CreateTournamentInput>;

export const updateTournament = async (id: string, input: UpdateTournamentInput) => {
  const tournament = await Tournament.findById(id);
  if (!tournament) return null;

  if (input.name !== undefined) tournament.name = input.name.trim();
  if (input.date !== undefined) tournament.date = new Date(input.date);
  if (input.location !== undefined) tournament.location = input.location.trim();
  if (input.type !== undefined) tournament.type = input.type;
  if (input.entryFee !== undefined) tournament.entryFee = input.entryFee;
  if (input.status !== undefined) tournament.status = input.status;
  if (input.isVisibleToMembers !== undefined) tournament.isVisibleToMembers = input.isVisibleToMembers;

  await tournament.save();
  return serializeTournament(tournament);
};

type AddTeamInput = {
  name?: string;
  players: string[];
};

export const addTeam = async (tournamentId: string, input: AddTeamInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if (tournament.matches.length > 0) {
    return { error: "Cannot add teams after bracket generation", status: 400 as const };
  }

  const normalizedPlayers = input.players.map((player) => player.trim()).filter(Boolean);
  const expectedPlayerCount = tournament.type === "doubles" ? 2 : 1;
  if (normalizedPlayers.length !== expectedPlayerCount) {
    return {
      error: `${tournament.type === "doubles" ? "Doubles" : "Singles"} teams require exactly ${expectedPlayerCount} player(s)`,
      status: 400 as const,
    };
  }

  const playersLower = normalizedPlayers.map((player) => player.toLowerCase());
  if (new Set(playersLower).size !== normalizedPlayers.length) {
    return { error: "Duplicate player names are not allowed in the same team", status: 400 as const };
  }

  const teamName = (input.name || normalizedPlayers.join(" / ")).trim();
  if (!teamName) return { error: "Team name is required", status: 400 as const };

  const existingName = tournament.teams.some(
    (team) => team.name.trim().toLowerCase() === teamName.toLowerCase()
  );
  if (existingName) return { error: "Team already exists", status: 400 as const };

  const incomingSignature = normalizeTeamSignature(normalizedPlayers);
  const existingSignature = tournament.teams.some(
    (team) => normalizeTeamSignature(team.players) === incomingSignature
  );
  if (existingSignature) return { error: "Duplicate team entry is not allowed", status: 400 as const };

  tournament.teams.push({
    _id: new mongoose.Types.ObjectId(),
    name: teamName,
    players: normalizedPlayers,
  } as any);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

export const removeTeam = async (tournamentId: string, teamId: string) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if (tournament.matches.length > 0) {
    return { error: "Cannot remove teams after bracket generation", status: 400 as const };
  }

  const beforeCount = tournament.teams.length;
  tournament.teams = tournament.teams.filter((team) => team._id.toString() !== teamId) as any;
  if (tournament.teams.length === beforeCount) {
    return { error: "Team not found", status: 404 as const };
  }

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const generateBracket = async (tournamentId: string) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if (tournament.teams.length < 2) {
    return { error: "At least 2 teams are required to generate a bracket", status: 400 as const };
  }

  const { matches, totalRounds } = buildBracketMatches(tournament.teams);
  tournament.matches = matches as any;
  tournament.totalRounds = totalRounds;
  tournament.championTeamId = null;
  tournament.finalScore = null;
  tournament.status = "ongoing";

  reconcileBracketState(tournament);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

export const updateMatchScore = async (
  tournamentId: string,
  matchId: string,
  scoreA: number,
  scoreB: number
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const match = tournament.matches.find((item) => item.matchId === matchId);
  if (!match) return { error: "Match not found", status: 404 as const };
  if (!match.teamAId || !match.teamBId) {
    return { error: "Cannot score a match until both teams are available", status: 400 as const };
  }
  if (scoreA === scoreB) return { error: "Scores cannot be tied", status: 400 as const };

  const winnerTeamId = scoreA > scoreB ? match.teamAId : match.teamBId;
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerTeamId = winnerTeamId;
  match.isCompleted = true;

  reconcileBracketState(tournament);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

export const declareTournamentWinner = async (tournamentId: string, teamId: string) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const team = tournament.teams.find((item) => item._id.toString() === teamId);
  if (!team) return { error: "Team not found in this tournament", status: 404 as const };

  tournament.championTeamId = team._id;
  tournament.status = "completed";
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

export const deleteTournament = async (id: string) => {
  const tournament = await Tournament.findById(id);
  if (!tournament) return false;
  await tournament.deleteOne();
  return true;
};

export const getPublicTournamentPayload = async () => {
  const isEnabled = await getTournamentVisibility();
  if (!isEnabled) {
    return {
      isEnabled,
      currentTournament: null,
      history: [],
    };
  }

  const tournaments = await Tournament.find({ isVisibleToMembers: true }).sort({ date: -1, createdAt: -1 });
  const serialized = tournaments.map(serializeTournament);
  const currentTournament =
    serialized.find((tournament) => tournament.status !== "completed") || serialized[0] || null;
  const history = serialized
    .filter((tournament) => tournament.status === "completed")
    .map((tournament) => ({
      _id: tournament._id,
      name: tournament.name,
      date: tournament.date,
      championTeam: tournament.championTeam,
      finalScore: tournament.finalScore,
    }));

  return {
    isEnabled,
    currentTournament,
    history,
  };
};

export const getPublicTournamentById = async (id: string) => {
  const isEnabled = await getTournamentVisibility();
  if (!isEnabled) return { isEnabled, tournament: null };

  const tournament = await Tournament.findById(id);
  if (!tournament || !tournament.isVisibleToMembers) return { isEnabled, tournament: null };

  return {
    isEnabled,
    tournament: serializeTournament(tournament),
  };
};
