import mongoose from "mongoose";
import { AppSetting } from "../models/AppSetting.js";
import {
  GroupDistributionMode,
  ITournament,
  ITournamentMatch,
  Tournament,
  TournamentFormat,
  TournamentIncomeType,
} from "../models/Tournament.js";

const TOURNAMENT_VISIBILITY_KEY = "tournament_visibility_enabled";

const toId = (value: mongoose.Types.ObjectId | string | null | undefined) =>
  value ? value.toString() : null;

const toNumber = (value: unknown) => Number(value || 0);

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

const getDefaultGroupCount = (teamCount: number) => {
  if (teamCount <= 8) return 2;
  if (teamCount <= 24) return 4;
  return Math.min(16, Math.max(2, Math.ceil(teamCount / 4)));
};

const getGroupLabel = (index: number) => {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Group ${letter}`;
};

const clampGroupCount = (value: number | null | undefined, teamCount: number) =>
  Math.min(16, Math.max(2, Math.min(teamCount, value || getDefaultGroupCount(teamCount))));

const distributeTeamsToGroups = (
  teamIds: mongoose.Types.ObjectId[],
  groupCount: number,
  mode: GroupDistributionMode
) => {
  const source = mode === "random" ? shuffle(teamIds) : [...teamIds];
  const groups = Array.from({ length: groupCount }, () => [] as mongoose.Types.ObjectId[]);

  source.forEach((teamId, index) => {
    if (mode === "balanced") {
      const block = Math.floor(index / groupCount);
      const offset = index % groupCount;
      const groupIndex = block % 2 === 0 ? offset : groupCount - 1 - offset;
      groups[groupIndex].push(teamId);
      return;
    }

    groups[index % groupCount].push(teamId);
  });

  return groups;
};

const recordAudit = (tournament: ITournament, action: string, userId?: string | null) => {
  tournament.auditHistory.push({
    _id: new mongoose.Types.ObjectId(),
    action,
    userId: userId || null,
    createdAt: new Date(),
  } as any);
};

const resetTournamentProgress = (tournament: ITournament, action: string, userId?: string | null) => {
  const hadGeneratedMatches = tournament.matches.length > 0;
  tournament.matches = [] as any;
  tournament.totalRounds = 0;
  tournament.championTeamId = null;
  tournament.finalScore = null;
  tournament.status = "upcoming";
  if (hadGeneratedMatches) {
    recordAudit(tournament, action, userId);
  }
};

const makeTournamentGroups = (
  teamIds: mongoose.Types.ObjectId[],
  groupCount: number,
  mode: GroupDistributionMode
) => {
  const distributed = mode === "manual" ? Array.from({ length: groupCount }, () => [] as mongoose.Types.ObjectId[]) : distributeTeamsToGroups(teamIds, groupCount, mode);
  return distributed.map((groupTeamIds, index) => ({
    _id: new mongoose.Types.ObjectId(),
    groupName: getGroupLabel(index),
    groupOrder: index,
    teamIds: groupTeamIds,
    isLocked: false,
  }));
};

const getOrderedTournamentGroups = (tournament: ITournament) =>
  [...(tournament.tournamentGroups || [])].sort((a, b) => a.groupOrder - b.groupOrder);

type TeamStanding = {
  teamId: mongoose.Types.ObjectId;
  points: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
};

const sortStandings = (
  a: TeamStanding,
  b: TeamStanding,
  teamsById: Map<string, { name: string }>
) => {
  if (b.points !== a.points) return b.points - a.points;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const aDiff = a.pointsFor - a.pointsAgainst;
  const bDiff = b.pointsFor - b.pointsAgainst;
  if (bDiff !== aDiff) return bDiff - aDiff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  const nameA = teamsById.get(a.teamId.toString())?.name || "";
  const nameB = teamsById.get(b.teamId.toString())?.name || "";
  return nameA.localeCompare(nameB);
};

const buildStandings = (
  teams: Array<{ _id: mongoose.Types.ObjectId; name: string }>,
  matches: ITournamentMatch[]
) => {
  const byTeam = new Map<string, TeamStanding>();
  const teamsById = new Map<string, { name: string }>();

  teams.forEach((team) => {
    const id = team._id.toString();
    teamsById.set(id, { name: team.name });
    byTeam.set(id, {
      teamId: team._id,
      points: 0,
      wins: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  });

  matches.forEach((match) => {
    if (!match.isCompleted || !match.teamAId || !match.teamBId) return;
    if (match.scoreA === null || match.scoreB === null) return;

    const teamA = byTeam.get(match.teamAId.toString());
    const teamB = byTeam.get(match.teamBId.toString());
    if (!teamA || !teamB) return;

    teamA.pointsFor += match.scoreA;
    teamA.pointsAgainst += match.scoreB;
    teamB.pointsFor += match.scoreB;
    teamB.pointsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamA.points += 2;
      teamA.wins += 1;
    } else if (match.scoreB > match.scoreA) {
      teamB.points += 2;
      teamB.wins += 1;
    } else {
      teamA.points += 1;
      teamB.points += 1;
    }
  });

  return [...byTeam.values()].sort((a, b) => sortStandings(a, b, teamsById));
};

const findMatch = (matches: ITournamentMatch[], roundNumber: number, matchNumber: number) =>
  matches.find(
    (match) => !match.isManual && match.roundNumber === roundNumber && match.matchNumber === matchNumber
  );

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
    if (match.isManual) return;
    if (match.roundNumber > 1 && !match.manualOverrideTeams) {
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
      .filter((match) => !match.isManual && match.roundNumber === round)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    roundMatches.forEach((match) => {
      if (round > 1 && !match.manualOverrideTeams) {
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
        matchType: round === totalRounds ? "final" : round === totalRounds - 1 ? "semifinal" : "league",
        isManual: false,
        manualOverrideTeams: false,
        scheduledAt: null,
        scheduledEndAt: null,
        court: null,
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

const buildRoundRobinMatches = (teams: ITournament["teams"]) => {
  const shuffledTeams = shuffle(teams.map((team) => team._id));
  const matches: ITournamentMatch[] = [];
  let matchNumber = 1;

  for (let i = 0; i < shuffledTeams.length; i += 1) {
    for (let j = i + 1; j < shuffledTeams.length; j += 1) {
      matches.push({
        matchId: `RR-M${matchNumber}`,
        roundNumber: 1,
        roundLabel: "League Stage",
        matchNumber,
        matchType: "league",
        isManual: false,
        manualOverrideTeams: false,
        scheduledAt: null,
        scheduledEndAt: null,
        court: null,
        teamAId: shuffledTeams[i],
        teamBId: shuffledTeams[j],
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isCompleted: false,
      } as ITournamentMatch);
      matchNumber += 1;
    }
  }

  return { matches, totalRounds: 1 };
};

const getRoundRobinLeagueMatches = (tournament: ITournament) =>
  tournament.matches.filter(
    (match) =>
      match.matchType === "league" ||
      (!match.matchType &&
        match.roundNumber === 1 &&
        (match.roundLabel === "League Stage" || match.roundLabel === "Round 1"))
  );

const getRoundRobinPlayoffMatches = (tournament: ITournament) =>
  tournament.matches.filter(
    (match) =>
      ((!match.isManual && match.matchType === "semifinal") ||
        (!match.isManual && match.matchType === "final") ||
        (!match.matchType && !match.isManual && (match.roundNumber >= 2 || match.roundLabel.toLowerCase().includes("final"))))
  );

const buildRoundRobinPlayoffMatches = (standings: TeamStanding[]): ITournamentMatch[] => {
  const first = standings[0]?.teamId || null;
  const second = standings[1]?.teamId || null;
  const third = standings[2]?.teamId || null;
  const fourth = standings[3]?.teamId || null;

  return [
    {
      matchId: "RR-SF1",
      roundNumber: 2,
      roundLabel: "Semi Final 1",
      matchNumber: 1,
      matchType: "semifinal",
      isManual: false,
      manualOverrideTeams: false,
      scheduledAt: null,
      scheduledEndAt: null,
      court: null,
      teamAId: first,
      teamBId: fourth,
      scoreA: null,
      scoreB: null,
      winnerTeamId: null,
      isCompleted: false,
    } as ITournamentMatch,
    {
      matchId: "RR-SF2",
      roundNumber: 2,
      roundLabel: "Semi Final 2",
      matchNumber: 2,
      matchType: "semifinal",
      isManual: false,
      manualOverrideTeams: false,
      scheduledAt: null,
      scheduledEndAt: null,
      court: null,
      teamAId: second,
      teamBId: third,
      scoreA: null,
      scoreB: null,
      winnerTeamId: null,
      isCompleted: false,
    } as ITournamentMatch,
    {
      matchId: "RR-FINAL",
      roundNumber: 3,
      roundLabel: "Final",
      matchNumber: 1,
      matchType: "final",
      isManual: false,
      manualOverrideTeams: false,
      scheduledAt: null,
      scheduledEndAt: null,
      court: null,
      teamAId: null,
      teamBId: null,
      scoreA: null,
      scoreB: null,
      winnerTeamId: null,
      isCompleted: false,
    } as ITournamentMatch,
  ];
};

const reconcileRoundRobinPlayoffState = (tournament: ITournament) => {
  const semiFinals = tournament.matches
    .filter((match) => match.matchType === "semifinal" && !match.isManual)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const final = tournament.matches.find((match) => match.matchType === "final" && !match.isManual);

  semiFinals.forEach((match) => {
    if (!match.teamAId || !match.teamBId) {
      resetInvalidMatch(match);
      return;
    }
    if (!match.isCompleted) {
      match.winnerTeamId = null;
      return;
    }
    if (match.scoreA === null || match.scoreB === null || match.scoreA === match.scoreB) {
      resetInvalidMatch(match);
      return;
    }
    match.winnerTeamId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
  });

  if (!final) return;

  if (!final.manualOverrideTeams) {
    final.teamAId = semiFinals[0]?.isCompleted ? semiFinals[0].winnerTeamId : null;
    final.teamBId = semiFinals[1]?.isCompleted ? semiFinals[1].winnerTeamId : null;
  }

  if (!final.teamAId || !final.teamBId) {
    resetInvalidMatch(final);
    return;
  }
  if (!final.isCompleted) {
    final.winnerTeamId = null;
    return;
  }
  if (final.scoreA === null || final.scoreB === null || final.scoreA === final.scoreB) {
    resetInvalidMatch(final);
    return;
  }
  final.winnerTeamId = final.scoreA > final.scoreB ? final.teamAId : final.teamBId;
};

const buildGroupKnockoutMatches = (
  teams: ITournament["teams"],
  options: {
    groupCount?: number | null;
    distributionMode?: GroupDistributionMode;
    teamsQualifyingPerGroup?: number;
    tournamentGroups?: ITournament["tournamentGroups"];
  } = {}
) => {
  const teamIds = teams.map((team) => team._id);
  const groupCount = clampGroupCount(options.groupCount, teamIds.length);
  const groupsFromModel = [...(options.tournamentGroups || [])]
    .sort((a, b) => a.groupOrder - b.groupOrder)
    .map((group) => group.teamIds.filter((teamId) => teamIds.some((id) => id.toString() === teamId.toString())));
  const groups =
    groupsFromModel.length > 0
      ? groupsFromModel
      : distributeTeamsToGroups(teamIds, groupCount, options.distributionMode || "random");
  const activeTeamIds = groups.flat();
  const teamsQualifyingPerGroup = Math.max(1, Math.min(8, options.teamsQualifyingPerGroup || 2));
  const groupMatches: ITournamentMatch[] = [];
  let matchNumber = 1;

  const pushGroupMatches = (groupName: string, groupIndex: number, groupTeams: mongoose.Types.ObjectId[]) => {
    for (let i = 0; i < groupTeams.length; i += 1) {
      for (let j = i + 1; j < groupTeams.length; j += 1) {
        groupMatches.push({
          matchId: `GR-${String.fromCharCode(65 + groupIndex)}-M${matchNumber}`,
          roundNumber: 1,
          roundLabel: groupName,
          matchNumber,
          matchType: "league",
          isManual: false,
          manualOverrideTeams: false,
          scheduledAt: null,
          scheduledEndAt: null,
          court: null,
          teamAId: groupTeams[i],
          teamBId: groupTeams[j],
          scoreA: null,
          scoreB: null,
          winnerTeamId: null,
          isCompleted: false,
        } as ITournamentMatch);
        matchNumber += 1;
      }
    }
  };

  groups.forEach((groupTeams, index) => pushGroupMatches(getGroupLabel(index), index, groupTeams));

  const qualifierCount = Math.min(activeTeamIds.length, groups.length * teamsQualifyingPerGroup);
  const knockoutSize = nextPowerOfTwo(Math.max(2, qualifierCount));
  const knockoutRounds = Math.log2(knockoutSize);
  const knockoutMatches: ITournamentMatch[] = [];

  for (let knockoutRound = 1; knockoutRound <= knockoutRounds; knockoutRound += 1) {
    const roundNumber = knockoutRound + 1;
    const matchCount = knockoutSize / 2 ** knockoutRound;
    for (let knockoutMatchNumber = 1; knockoutMatchNumber <= matchCount; knockoutMatchNumber += 1) {
      knockoutMatches.push({
        matchId:
          knockoutRound === knockoutRounds
            ? "KO-FINAL"
            : `KO-R${knockoutRound}-M${knockoutMatchNumber}`,
        roundNumber,
        roundLabel: getRoundLabel(knockoutRound, knockoutRounds),
        matchNumber: knockoutMatchNumber,
        matchType:
          knockoutRound === knockoutRounds
            ? "final"
            : knockoutRound === knockoutRounds - 1
            ? "semifinal"
            : "league",
        isManual: false,
        manualOverrideTeams: false,
        scheduledAt: null,
        scheduledEndAt: null,
        court: null,
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isCompleted: false,
      } as ITournamentMatch);
    }
  }

  return { matches: [...groupMatches, ...knockoutMatches], totalRounds: knockoutRounds + 1 };
};

const resetInvalidMatch = (match: ITournamentMatch) => {
  match.scoreA = null;
  match.scoreB = null;
  match.winnerTeamId = null;
  match.isCompleted = false;
};

const reconcileRoundRobinState = (tournament: ITournament) => {
  const leagueMatches = getRoundRobinLeagueMatches(tournament);
  leagueMatches.forEach((match) => {
    if (!match.teamAId || !match.teamBId) {
      resetInvalidMatch(match);
      return;
    }
    if (!match.isCompleted) {
      match.winnerTeamId = null;
      return;
    }
    if (match.scoreA === null || match.scoreB === null || match.scoreA === match.scoreB) {
      resetInvalidMatch(match);
      return;
    }
    match.winnerTeamId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
  });

  const allLeagueCompleted = leagueMatches.length > 0 && leagueMatches.every((match) => match.isCompleted);
  const standings = buildStandings(tournament.teams, leagueMatches);
  const playoffMatches = getRoundRobinPlayoffMatches(tournament);

  if (allLeagueCompleted && standings.length >= 4 && playoffMatches.length === 0) {
    tournament.matches = [...tournament.matches, ...buildRoundRobinPlayoffMatches(standings)] as any;
    tournament.totalRounds = 3;
  }

  reconcileRoundRobinPlayoffState(tournament);

  const finalMatch = tournament.matches.find((match) => match.matchType === "final" && !match.isManual);
  if (finalMatch?.isCompleted && finalMatch.winnerTeamId) {
    tournament.championTeamId = finalMatch.winnerTeamId;
    tournament.finalScore =
      finalMatch.scoreA !== null && finalMatch.scoreB !== null
        ? `${finalMatch.scoreA}-${finalMatch.scoreB}`
        : null;
    tournament.status = "completed";
    return;
  }

  if (allLeagueCompleted && standings.length < 4) {
    tournament.championTeamId = standings[0]?.teamId || null;
    tournament.finalScore = null;
    tournament.status = tournament.championTeamId ? "completed" : "ongoing";
    return;
  }

  tournament.championTeamId = null;
  tournament.finalScore = null;
  if (tournament.matches.some((match) => match.isCompleted)) {
    tournament.status = "ongoing";
  } else {
    tournament.status = "upcoming";
  }
};

const seedGroupKnockoutSlots = (tournament: ITournament) => {
  const groupMatches = tournament.matches.filter(
    (match) => !match.isManual && match.roundNumber === 1 && isGroupLeagueMatch(match)
  );
  const firstKnockoutMatches = tournament.matches
    .filter((match) => !match.isManual && match.roundNumber === 2)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  if (firstKnockoutMatches.length === 0) return;

  const allGroupCompleted = groupMatches.length > 0 && groupMatches.every((match) => match.isCompleted);

  if (!allGroupCompleted) {
    tournament.matches
      .filter((match) => !match.isManual && match.roundNumber >= 2)
      .forEach((match) => {
        if (!match.manualOverrideTeams) {
          match.teamAId = null;
          match.teamBId = null;
        }
        resetInvalidMatch(match);
      });
    return;
  }

  const groupLabels = [...new Set(groupMatches.map((match) => match.roundLabel))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const standingsByGroup = groupLabels.map((label) => {
    const matches = groupMatches.filter((match) => match.roundLabel === label);
    const teamIds = new Set<string>();
    matches.forEach((match) => {
      if (match.teamAId) teamIds.add(match.teamAId.toString());
      if (match.teamBId) teamIds.add(match.teamBId.toString());
    });
    const groupTeams = tournament.teams.filter((team) => teamIds.has(team._id.toString()));
    return buildStandings(groupTeams, matches);
  });

  const qualifiersPerGroup = Math.max(1, tournament.teamsQualifyingPerGroup || 2);
  const matchupPairs: Array<[mongoose.Types.ObjectId | null, mongoose.Types.ObjectId | null]> = [];

  for (let i = 0; i < standingsByGroup.length; i += 2) {
    const current = standingsByGroup[i] || [];
    const next = standingsByGroup[i + 1] || [];

    if (next.length > 0) {
      if (qualifiersPerGroup >= 2) {
        matchupPairs.push([current[0]?.teamId || null, next[1]?.teamId || null]);
        matchupPairs.push([next[0]?.teamId || null, current[1]?.teamId || null]);
        for (let rank = 2; rank < qualifiersPerGroup; rank += 1) {
          matchupPairs.push([current[rank]?.teamId || null, next[rank]?.teamId || null]);
        }
      } else {
        matchupPairs.push([current[0]?.teamId || null, next[0]?.teamId || null]);
      }
    } else {
      for (let rank = 0; rank < qualifiersPerGroup; rank += 1) {
        matchupPairs.push([current[rank]?.teamId || null, null]);
      }
    }
  }

  firstKnockoutMatches.forEach((match, index) => {
    if (match.manualOverrideTeams) return;
    const [teamAId, teamBId] = matchupPairs[index] || [null, null];
    match.teamAId = teamAId;
    match.teamBId = teamBId;
  });
};

const reconcileGroupKnockoutState = (tournament: ITournament) => {
  const preserved = captureMatches(tournament.matches);

  tournament.matches
    .filter((match) => !match.isManual && match.roundNumber === 1)
    .forEach((match) => {
      if (!match.teamAId || !match.teamBId) {
        resetInvalidMatch(match);
        return;
      }
      if (!match.isCompleted) {
        match.winnerTeamId = null;
        return;
      }
      if (match.scoreA === null || match.scoreB === null || match.scoreA === match.scoreB) {
        resetInvalidMatch(match);
        return;
      }
      match.winnerTeamId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
    });

  seedGroupKnockoutSlots(tournament);

  for (let round = 2; round <= tournament.totalRounds; round += 1) {
    const roundMatches = tournament.matches
      .filter((match) => !match.isManual && match.roundNumber === round)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    roundMatches.forEach((match) => {
      if (round > 2 && !match.manualOverrideTeams) {
        const sourceA = getSourceMatch(tournament.matches, round, match.matchNumber, "A");
        const sourceB = getSourceMatch(tournament.matches, round, match.matchNumber, "B");
        match.teamAId = sourceA?.isCompleted ? sourceA.winnerTeamId : null;
        match.teamBId = sourceB?.isCompleted ? sourceB.winnerTeamId : null;
      }

      const teamAId = toId(match.teamAId);
      const teamBId = toId(match.teamBId);
      const old = preserved.get(match.matchId);

      if (!teamAId && !teamBId) {
        resetInvalidMatch(match);
      } else if (teamAId && !teamBId) {
        match.isCompleted = true;
        match.winnerTeamId = match.teamAId;
      } else if (!teamAId && teamBId) {
        match.isCompleted = true;
        match.winnerTeamId = match.teamBId;
      } else if (old && old.teamAId === teamAId && old.teamBId === teamBId && old.isCompleted) {
        match.scoreA = old.scoreA;
        match.scoreB = old.scoreB;
        match.winnerTeamId = old.winnerTeamId ? new mongoose.Types.ObjectId(old.winnerTeamId) : null;
        match.isCompleted = true;
        if (!isValidCompletedMatch(match)) resetInvalidMatch(match);
      } else if (!match.isCompleted) {
        match.winnerTeamId = null;
      } else if (match.scoreA === null || match.scoreB === null || match.scoreA === match.scoreB) {
        resetInvalidMatch(match);
      } else {
        match.winnerTeamId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
      }

      if (match.isCompleted) {
        setNextRoundSlot(tournament.matches, round, match.matchNumber, match.winnerTeamId);
      }
    });
  }

  const hasKnockoutStage = tournament.matches.some(
    (match) => !match.isManual && !isGroupLeagueMatch(match) && match.roundNumber >= 2
  );
  if (!hasKnockoutStage) {
    tournament.championTeamId = null;
    tournament.finalScore = null;
    tournament.status = tournament.matches.some((match) => match.isCompleted) ? "ongoing" : "upcoming";
    return;
  }

  const finalMatch = findMatch(tournament.matches, tournament.totalRounds, 1);
  if (finalMatch?.isCompleted && finalMatch.winnerTeamId) {
    tournament.championTeamId = finalMatch.winnerTeamId;
    tournament.finalScore =
      finalMatch.scoreA !== null && finalMatch.scoreB !== null
        ? `${finalMatch.scoreA}-${finalMatch.scoreB}`
        : null;
    tournament.status = "completed";
    return;
  }

  tournament.championTeamId = null;
  tournament.finalScore = null;
  tournament.status = tournament.matches.some((match) => match.isCompleted) ? "ongoing" : "upcoming";
};

const reconcileTournamentState = (tournament: ITournament) => {
  const format = tournament.format || "knockout";
  if (format === "round_robin") {
    reconcileRoundRobinState(tournament);
    return;
  }
  if (format === "group_knockout") {
    reconcileGroupKnockoutState(tournament);
    return;
  }
  reconcileBracketState(tournament);
};

const normalizeTeamSignature = (players: string[]) =>
  [...players].map((player) => player.trim().toLowerCase()).sort().join("|");

const pushTournamentIncome = (
  tournament: ITournament,
  input: {
    type: TournamentIncomeType;
    title: string;
    amount: number;
    note?: string | null;
    date?: string | Date;
    teamRegistryId?: mongoose.Types.ObjectId | null;
  }
) => {
  tournament.tournamentIncomes.push({
    _id: new mongoose.Types.ObjectId(),
    type: input.type,
    title: input.title.trim(),
    amount: Number(input.amount || 0),
    note: input.note?.trim() || null,
    date: input.date ? new Date(input.date) : new Date(),
    teamRegistryId: input.teamRegistryId || null,
  } as any);
};

const captureEntryFeeAdjustment = (
  tournament: ITournament,
  input: {
    teamName: string;
    previousAmount: number;
    nextAmount: number;
    teamRegistryId?: mongoose.Types.ObjectId | null;
  }
) => {
  const delta = Number((input.nextAmount - input.previousAmount).toFixed(2));
  if (delta === 0) return;

  pushTournamentIncome(tournament, {
    type: "entry_registration",
    title: `${input.teamName.trim()} entry registration`,
    amount: delta,
    note: delta > 0 ? "Entry fee collected" : "Entry fee adjustment",
    teamRegistryId: input.teamRegistryId || null,
  });
};

const serializeTournament = (tournament: ITournament) => {
  const plain = tournament.toObject();
  const teamsById = new Map(plain.teams.map((team: any) => [team._id.toString(), team]));
  const champion =
    plain.championTeamId && teamsById.has(plain.championTeamId.toString())
      ? teamsById.get(plain.championTeamId.toString())
      : null;
  const entryRegistrationTotal = (plain.teamRegistry || []).reduce(
    (sum: number, entry: any) => sum + toNumber(entry.entryFeePaid),
    0
  );
  const donationTotal = (plain.tournamentIncomes || [])
    .filter((income: any) => income.type === "donation")
    .reduce((sum: number, income: any) => sum + toNumber(income.amount), 0);
  const expensesTotal = (plain.tournamentExpenses || []).reduce(
    (sum: number, expense: any) => sum + toNumber(expense.amount),
    0
  );
  const incomingTotal = entryRegistrationTotal + donationTotal;
  const feedbackSubmissions = (plain.feedbackSubmissions || [])
    .slice()
    .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const averageFeedbackRating = (key: string) =>
    feedbackSubmissions.length
      ? Number(
          (
            feedbackSubmissions.reduce((sum: number, submission: any) => sum + toNumber(submission[key]), 0) /
            feedbackSubmissions.length
          ).toFixed(1)
        )
      : null;

  return {
    ...plain,
    format: plain.format || "knockout",
    groupCount: plain.groupCount ?? null,
    groupDistributionMode: plain.groupDistributionMode || "random",
    teamsQualifyingPerGroup: plain.teamsQualifyingPerGroup || 2,
    enableManualGroupEditing: Boolean(plain.enableManualGroupEditing),
    feedbackEnabled: Boolean(plain.feedbackEnabled),
    time: plain.time || "",
    championTeam: champion,
    teamRegistry: (plain.teamRegistry || []).map((entry: any) => ({
      ...entry,
      teamId: entry.teamId ? entry.teamId.toString() : null,
      members: (entry.members || []).map((member: any) => ({
        name: member.name,
        mobileNumber: member.mobileNumber,
        gender: member.gender,
      })),
    })),
    tournamentGroups: (plain.tournamentGroups || []).map((group: any) => ({
      ...group,
      teamIds: (group.teamIds || []).map((teamId: any) => teamId.toString()),
    })),
    auditHistory: (plain.auditHistory || [])
      .slice()
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    tournamentExpenses: (plain.tournamentExpenses || []).map((expense: any) => ({
      ...expense,
      amount: toNumber(expense.amount),
      note: expense.note || null,
      date: expense.date || null,
    })),
    tournamentIncomes: (plain.tournamentIncomes || []).map((income: any) => ({
      ...income,
      amount: toNumber(income.amount),
      note: income.note || null,
      date: income.date || null,
      teamRegistryId: income.teamRegistryId ? income.teamRegistryId.toString() : null,
    })),
    financeSummary: {
      totalExpenses: expensesTotal,
      totalEntryRegistration: entryRegistrationTotal,
      totalDonations: donationTotal,
      totalIncoming: incomingTotal,
      netBalance: incomingTotal - expensesTotal,
    },
    feedbackSubmissions: feedbackSubmissions.map((submission: any) => ({
      ...submission,
      userId: submission.userId || "",
      comments: submission.comments || null,
      submittedAt: submission.submittedAt || null,
    })),
    feedbackSummary: {
      totalResponses: feedbackSubmissions.length,
      organizationRating: averageFeedbackRating("organizationRating"),
      courtFacilitiesRating: averageFeedbackRating("courtFacilitiesRating"),
      refreshmentsRating: averageFeedbackRating("refreshmentsRating"),
      schedulingRating: averageFeedbackRating("schedulingRating"),
      returnLikelihoodRating: averageFeedbackRating("returnLikelihoodRating"),
    },
    matches: plain.matches.map((match: any) => ({
      ...match,
      matchType:
        match.matchType ||
        (match.roundLabel === "Final"
          ? "final"
          : match.roundLabel?.toLowerCase().includes("semi")
          ? "semifinal"
          : "league"),
      isManual: Boolean(match.isManual),
      manualOverrideTeams: Boolean(match.manualOverrideTeams),
      scheduledAt: match.scheduledAt || null,
      scheduledEndAt: match.scheduledEndAt || null,
      court: match.court || null,
      teamA: match.teamAId ? teamsById.get(match.teamAId.toString()) || null : null,
      teamB: match.teamBId ? teamsById.get(match.teamBId.toString()) || null : null,
      winnerTeam: match.winnerTeamId ? teamsById.get(match.winnerTeamId.toString()) || null : null,
    })),
  };
};

const serializePublicTournament = (tournament: ITournament) => {
  const serialized = serializeTournament(tournament);

  const publicSerialized = {
    ...serialized,
    feedbackSubmissions: [],
    feedbackSummary: {
      totalResponses: 0,
      organizationRating: null,
      courtFacilitiesRating: null,
      refreshmentsRating: null,
      schedulingRating: null,
      returnLikelihoodRating: null,
    },
  };

  if (serialized.isVisibleToMembers) return publicSerialized;

  return {
    ...publicSerialized,
    registrations: [],
    tournamentGroups: [],
    auditHistory: [],
    tournamentExpenses: [],
    tournamentIncomes: [],
    feedbackSubmissions: [],
    feedbackSummary: {
      totalResponses: 0,
      organizationRating: null,
      courtFacilitiesRating: null,
      refreshmentsRating: null,
      schedulingRating: null,
      returnLikelihoodRating: null,
    },
    financeSummary: {
      totalExpenses: 0,
      totalEntryRegistration: 0,
      totalDonations: 0,
      totalIncoming: 0,
      netBalance: 0,
    },
    matches: [],
    totalRounds: 0,
    championTeamId: null,
    finalScore: null,
    championTeam: null,
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
  time?: string;
  location: string;
  type: "singles" | "doubles";
  format?: TournamentFormat;
  groupCount?: number | null;
  groupDistributionMode?: GroupDistributionMode;
  teamsQualifyingPerGroup?: number;
  enableManualGroupEditing?: boolean;
  entryFee?: number;
  status?: "upcoming" | "ongoing" | "completed";
  isVisibleToMembers?: boolean;
  allowTeamRegistration?: boolean;
  feedbackEnabled?: boolean;
  registrationDeadline?: string | Date | null;
};

export const createTournament = async (input: CreateTournamentInput) => {
  const tournament = await Tournament.create({
    name: input.name.trim(),
    date: new Date(input.date),
    time: (input.time || "").trim(),
    location: input.location.trim(),
    type: input.type,
    format: input.format || "knockout",
    groupCount: input.groupCount ?? null,
    groupDistributionMode: input.groupDistributionMode || "random",
    teamsQualifyingPerGroup: input.teamsQualifyingPerGroup || 2,
    enableManualGroupEditing: input.enableManualGroupEditing ?? false,
    entryFee: input.entryFee || 0,
    status: input.status || "upcoming",
    isVisibleToMembers: input.isVisibleToMembers ?? true,
    allowTeamRegistration: input.allowTeamRegistration ?? false,
    feedbackEnabled: input.feedbackEnabled ?? false,
    registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : null,
    teams: [],
    registrations: [],
    teamRegistry: [],
    tournamentGroups: [],
    auditHistory: [],
    tournamentExpenses: [],
    tournamentIncomes: [],
    feedbackSubmissions: [],
    matches: [],
    totalRounds: 0,
    championTeamId: null,
    finalScore: null,
  });

  return serializeTournament(tournament);
};

type UpdateTournamentInput = Partial<CreateTournamentInput>;

type TeamRegistryMemberInput = {
  name: string;
  mobileNumber?: string;
  gender: "male" | "female" | "other";
};

export const updateTournament = async (id: string, input: UpdateTournamentInput) => {
  const tournament = await Tournament.findById(id);
  if (!tournament) return null;

  if (input.name !== undefined) tournament.name = input.name.trim();
  if (input.date !== undefined) tournament.date = new Date(input.date);
  if (input.time !== undefined) tournament.time = input.time.trim();
  if (input.location !== undefined) tournament.location = input.location.trim();
  if (input.type !== undefined) tournament.type = input.type;
  if (input.format !== undefined) tournament.format = input.format;
  if (input.groupCount !== undefined) tournament.groupCount = input.groupCount;
  if (input.groupDistributionMode !== undefined) tournament.groupDistributionMode = input.groupDistributionMode;
  if (input.teamsQualifyingPerGroup !== undefined) tournament.teamsQualifyingPerGroup = input.teamsQualifyingPerGroup;
  if (input.enableManualGroupEditing !== undefined) tournament.enableManualGroupEditing = input.enableManualGroupEditing;
  if (input.entryFee !== undefined) tournament.entryFee = input.entryFee;
  if (input.status !== undefined) tournament.status = input.status;
  if (input.isVisibleToMembers !== undefined) tournament.isVisibleToMembers = input.isVisibleToMembers;
  if (input.allowTeamRegistration !== undefined) tournament.allowTeamRegistration = input.allowTeamRegistration;
  if (input.feedbackEnabled !== undefined) tournament.feedbackEnabled = input.feedbackEnabled;
  if (input.registrationDeadline !== undefined) {
    tournament.registrationDeadline = input.registrationDeadline ? new Date(input.registrationDeadline) : null;
  }

  await tournament.save();
  return serializeTournament(tournament);
};

type AddTeamInput = {
  name?: string;
  player1?: string;
  player2?: string;
  contactMobileNumber?: string;
  players?: string[];
  teamLeadName?: string;
  members?: TeamRegistryMemberInput[];
  entryFeePaid?: number;
};

type UpdateTeamInput = {
  name?: string;
  player1?: string;
  player2?: string;
  players?: string[];
  contactMobileNumber?: string;
  teamLeadName?: string;
  members?: TeamRegistryMemberInput[];
  entryFeePaid?: number;
};

type RegisterTeamInput = {
  teamName: string;
  contactMobileNumber?: string;
};

type TournamentFeedbackInput = {
  userId: string;
  organizationRating: number;
  courtFacilitiesRating: number;
  refreshmentsRating: number;
  schedulingRating: number;
  returnLikelihoodRating: number;
  comments?: string | null;
};

type ReviewRegistrationInput = {
  status: "accepted" | "rejected";
  reviewNote?: string;
};

type TeamInsertResult = { ok: true } | { error: string; status: 400 };

const normalizeRegistryMembers = (
  players: string[],
  members?: TeamRegistryMemberInput[]
): TeamRegistryMemberInput[] => {
  if (members && members.length > 0) {
    return members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: (member.mobileNumber || "").trim(),
      gender: member.gender,
    }));
  }
  return players.map((player) => ({
    name: player.trim(),
    mobileNumber: "",
    gender: "other",
  }));
};

const parsePlayersFromTeamName = (teamName: string, expectedPlayerCount: number) => {
  const parsed = teamName
    .split(/[+/]/g)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parsed.length !== expectedPlayerCount) return null;
  return parsed;
};

const upsertTeamRegistry = (
  tournament: ITournament,
  teamId: mongoose.Types.ObjectId | null,
  payload: {
    teamName: string;
    teamLeadName: string;
    members: TeamRegistryMemberInput[];
    entryFeePaid: number;
  }
) => {
  const existing = (tournament.teamRegistry || []).find(
    (item) =>
      (teamId && item.teamId && item.teamId.toString() === teamId.toString()) ||
      item.teamName.trim().toLowerCase() === payload.teamName.trim().toLowerCase()
  );

  if (existing) {
    const previousEntryFeePaid = toNumber(existing.entryFeePaid);
    const nextEntryFeePaid = Math.max(0, payload.entryFeePaid || 0);
    existing.teamId = teamId;
    existing.teamName = payload.teamName.trim();
    existing.teamLeadName = payload.teamLeadName.trim();
    existing.members = payload.members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: (member.mobileNumber || "").trim(),
      gender: member.gender,
    })) as any;
    existing.entryFeePaid = nextEntryFeePaid;
    return { entry: existing, previousEntryFeePaid, nextEntryFeePaid };
  }

  const nextEntryFeePaid = Math.max(0, payload.entryFeePaid || 0);
  tournament.teamRegistry.push({
    _id: new mongoose.Types.ObjectId(),
    teamId,
    teamName: payload.teamName.trim(),
    teamLeadName: payload.teamLeadName.trim(),
    members: payload.members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: (member.mobileNumber || "").trim(),
      gender: member.gender,
    })) as any,
    entryFeePaid: nextEntryFeePaid,
  } as any);
  const created = tournament.teamRegistry[tournament.teamRegistry.length - 1];
  return { entry: created, previousEntryFeePaid: 0, nextEntryFeePaid };
};

const tryAddTeamToTournament = (tournament: ITournament, input: AddTeamInput): TeamInsertResult => {
  const expectedPlayerCount = tournament.type === "doubles" ? 2 : 1;
  const playersFromInput = (input.players || []).map((player) => player.trim()).filter(Boolean);
  const normalizedPlayers =
    playersFromInput.length > 0 ? playersFromInput : parsePlayersFromTeamName(input.name?.trim() || "", expectedPlayerCount) || [];

  const teamName = input.name?.trim() ||
    (normalizedPlayers.length > 0
      ? tournament.type === "doubles"
        ? `${normalizedPlayers[0]}+${normalizedPlayers[1]}`
        : normalizedPlayers[0]
      : "");
  const contactMobileNumber = (input.contactMobileNumber || "").trim();
  if (!teamName) return { error: "Team name is required", status: 400 as const };
  if (contactMobileNumber && !/^\+?[0-9]{8,15}$/.test(contactMobileNumber)) {
    return { error: "Enter a valid contact mobile number", status: 400 as const };
  }

  if (normalizedPlayers.length !== expectedPlayerCount) {
    return {
      error:
        tournament.type === "doubles"
          ? "For doubles, use 'Player1+Player2' or 'Player1/Player2'"
          : "For singles, team name must be the player name",
      status: 400 as const,
    };
  }

  const playersLower = normalizedPlayers.map((player) => player.toLowerCase());
  if (new Set(playersLower).size !== normalizedPlayers.length) {
    return { error: "Duplicate player names are not allowed in the same team", status: 400 as const };
  }

  const registryMembers = normalizeRegistryMembers(normalizedPlayers, input.members);
  if (contactMobileNumber && registryMembers.length > 0) {
    registryMembers[0].mobileNumber = contactMobileNumber;
  }
  if (registryMembers.length !== expectedPlayerCount) {
    return {
      error: `Team registry requires exactly ${expectedPlayerCount} member(s)`,
      status: 400 as const,
    };
  }

  const invalidRegistryMember = registryMembers.some(
    (member) =>
      !member.name.trim() ||
      !member.gender ||
      ((member.mobileNumber || "").trim().length > 0 && !/^\+?[0-9]{8,15}$/.test((member.mobileNumber || "").trim()))
  );
  if (invalidRegistryMember) {
    return {
      error: "Each team registry member needs name and gender. Mobile number is optional but must be valid when provided",
      status: 400 as const,
    };
  }

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

  const team = tournament.teams[tournament.teams.length - 1];
  const registryResult = upsertTeamRegistry(tournament, team._id, {
    teamName,
    teamLeadName: (input.teamLeadName || normalizedPlayers[0] || teamName).trim(),
    members: registryMembers,
    entryFeePaid: Math.max(0, input.entryFeePaid || 0),
  });
  captureEntryFeeAdjustment(tournament, {
    teamName,
    previousAmount: registryResult.previousEntryFeePaid,
    nextAmount: registryResult.nextEntryFeePaid,
    teamRegistryId: registryResult.entry?._id || null,
  });

  return { ok: true };
};

export const addTeam = async (tournamentId: string, input: AddTeamInput, userId?: string | null) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const hadGeneratedMatches = tournament.matches.length > 0;
  const teamAddResult = tryAddTeamToTournament(tournament, input);
  if ("error" in teamAddResult) return teamAddResult;
  if (hadGeneratedMatches) {
    resetTournamentProgress(tournament, "Added team after bracket generation; generated bracket was cleared", userId);
  }
  recordAudit(tournament, `Added team ${tournament.teams[tournament.teams.length - 1]?.name || ""}`.trim(), userId);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

export const updateTeam = async (
  tournamentId: string,
  teamId: string,
  input: UpdateTeamInput,
  userId?: string | null
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const hadGeneratedMatches = tournament.matches.length > 0;

  const team = tournament.teams.find((item) => item._id.toString() === teamId);
  if (!team) return { error: "Team not found", status: 404 as const };

  const existingName = team.name;
  const currentPlayers = [...team.players];

  const playerInputs = input.players?.map((player) => player.trim()).filter(Boolean) ?? [];
  if (input.player1) playerInputs[0] = input.player1.trim();
  if (input.player2) playerInputs[1] = input.player2.trim();
  const normalizedPlayers = playerInputs.length > 0 ? playerInputs : team.players;

  const expectedPlayerCount = tournament.type === "doubles" ? 2 : 1;
  if (normalizedPlayers.length !== expectedPlayerCount) {
    return {
      error:
        tournament.type === "doubles"
          ? "For doubles, provide both player1 and player2"
          : "For singles, provide the player name",
      status: 400 as const,
    };
  }

  const playersLower = normalizedPlayers.map((player) => player.toLowerCase());
  if (new Set(playersLower).size !== normalizedPlayers.length) {
    return { error: "Duplicate player names are not allowed in the same team", status: 400 as const };
  }

  const incomingSignature = normalizeTeamSignature(normalizedPlayers);
  const duplicateSignature = tournament.teams.some(
    (item) => item._id.toString() !== teamId && normalizeTeamSignature(item.players) === incomingSignature
  );
  if (duplicateSignature) return { error: "Duplicate team entry is not allowed", status: 400 as const };

  const nextName = input.name?.trim() ||
    (tournament.type === "doubles" ? `${normalizedPlayers[0]}+${normalizedPlayers[1]}` : normalizedPlayers[0]);
  if (!nextName) {
    return { error: "Team name is required", status: 400 as const };
  }

  const contactMobileNumber = (input.contactMobileNumber || "").trim();
  if (contactMobileNumber && !/^\+?[0-9]{8,15}$/.test(contactMobileNumber)) {
    return { error: "Enter a valid contact mobile number", status: 400 as const };
  }

  const registryMembers = normalizeRegistryMembers(normalizedPlayers, input.members);
  if (contactMobileNumber && registryMembers.length > 0) {
    registryMembers[0].mobileNumber = contactMobileNumber;
  }
  if (registryMembers.length !== expectedPlayerCount) {
    return {
      error: `Team registry requires exactly ${expectedPlayerCount} member(s)`,
      status: 400 as const,
    };
  }

  const invalidRegistryMember = registryMembers.some(
    (member) =>
      !member.name.trim() ||
      !member.gender ||
      ((member.mobileNumber || "").trim().length > 0 && !/^\+?[0-9]{8,15}$/.test((member.mobileNumber || "").trim()))
  );
  if (invalidRegistryMember) {
    return {
      error: "Each team registry member needs name and gender. Mobile number is optional but must be valid when provided",
      status: 400 as const,
    };
  }

  team.name = nextName;
  team.players = normalizedPlayers;

  const registryResult = upsertTeamRegistry(tournament, team._id, {
    teamName: team.name,
    teamLeadName: (input.teamLeadName || normalizedPlayers[0] || team.name).trim(),
    members: registryMembers,
    entryFeePaid: Math.max(0, input.entryFeePaid || 0),
  });

  captureEntryFeeAdjustment(tournament, {
    teamName: team.name,
    previousAmount: registryResult.previousEntryFeePaid,
    nextAmount: registryResult.nextEntryFeePaid,
    teamRegistryId: registryResult.entry?._id || null,
  });

  if (hadGeneratedMatches) {
    resetTournamentProgress(tournament, `Updated team ${team.name}; generated bracket was cleared`, userId);
  }
  recordAudit(tournament, `Updated team ${existingName} to ${team.name}`, userId);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const generateGroups = async (tournamentId: string, userId?: string | null) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if ((tournament.format || "knockout") !== "group_knockout") {
    return { error: "Groups are only available for Group + Knockout tournaments", status: 400 as const };
  }
  if (tournament.teams.length < 2) {
    return { error: "At least 2 teams are required to generate groups", status: 400 as const };
  }

  const groupCount = clampGroupCount(tournament.groupCount, tournament.teams.length);
  tournament.tournamentGroups = makeTournamentGroups(
    tournament.teams.map((team) => team._id),
    groupCount,
    tournament.groupDistributionMode || "random"
  ) as any;
  resetTournamentProgress(tournament, "Regenerated groups; generated bracket was cleared", userId);
  recordAudit(tournament, `Generated ${groupCount} groups using ${tournament.groupDistributionMode || "random"} distribution`, userId);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const renameTournamentGroup = async (
  tournamentId: string,
  groupId: string,
  groupName: string,
  userId?: string | null
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const group = tournament.tournamentGroups.find((item) => item._id.toString() === groupId);
  if (!group) return { error: "Group not found", status: 404 as const };
  if (group.isLocked) return { error: "Group is locked", status: 400 as const };
  const previousName = group.groupName;
  group.groupName = groupName.trim();
  resetTournamentProgress(tournament, `Renamed group ${previousName} to ${group.groupName}; generated bracket was cleared`, userId);
  recordAudit(tournament, `Renamed group ${previousName} to ${group.groupName}`, userId);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const setTournamentGroupLock = async (
  tournamentId: string,
  groupId: string,
  isLocked: boolean,
  userId?: string | null
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const group = tournament.tournamentGroups.find((item) => item._id.toString() === groupId);
  if (!group) return { error: "Group not found", status: 404 as const };
  group.isLocked = isLocked;
  recordAudit(tournament, `${isLocked ? "Locked" : "Unlocked"} ${group.groupName}`, userId);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const updateTournamentGroupTeams = async (
  tournamentId: string,
  groupId: string,
  teamIds: string[],
  userId?: string | null
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const group = tournament.tournamentGroups.find((item) => item._id.toString() === groupId);
  if (!group) return { error: "Group not found", status: 404 as const };
  if (group.isLocked) return { error: "Group is locked", status: 400 as const };

  const validTeamIds = new Set(tournament.teams.map((team) => team._id.toString()));
  const uniqueTeamIds = [...new Set(teamIds)].filter((teamId) => validTeamIds.has(teamId));
  tournament.tournamentGroups.forEach((item) => {
    if (item._id.toString() === groupId) return;
    item.teamIds = item.teamIds.filter((teamId) => !uniqueTeamIds.includes(teamId.toString())) as any;
  });
  group.teamIds = uniqueTeamIds.map((teamId) => new mongoose.Types.ObjectId(teamId)) as any;
  resetTournamentProgress(tournament, `Updated teams in ${group.groupName}; generated bracket was cleared`, userId);
  recordAudit(tournament, `Updated teams in ${group.groupName}`, userId);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const removeTeam = async (tournamentId: string, teamId: string, userId?: string | null) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const hadGeneratedMatches = tournament.matches.length > 0;
  const removedTeam = tournament.teams.find((team) => team._id.toString() === teamId);

  const beforeCount = tournament.teams.length;
  tournament.teams = tournament.teams.filter((team) => team._id.toString() !== teamId) as any;
  if (tournament.teams.length === beforeCount) {
    return { error: "Team not found", status: 404 as const };
  }
  tournament.teamRegistry = (tournament.teamRegistry || []).filter(
    (entry) => !entry.teamId || entry.teamId.toString() !== teamId
  ) as any;
  tournament.tournamentGroups.forEach((group) => {
    group.teamIds = group.teamIds.filter((id) => id.toString() !== teamId) as any;
  });
  if (hadGeneratedMatches) {
    resetTournamentProgress(tournament, `Removed team ${removedTeam?.name || teamId}; generated bracket was cleared`, userId);
  }
  recordAudit(tournament, `Removed team ${removedTeam?.name || teamId}`, userId);

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const registerTeam = async (tournamentId: string, input: RegisterTeamInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const isTournamentFeatureEnabled = await getTournamentVisibility();
  if (!isTournamentFeatureEnabled) return { error: "Tournament registration is closed", status: 400 as const };
  if (!tournament.allowTeamRegistration) {
    return { error: "Admin has not opened team registration for this tournament", status: 400 as const };
  }
  if (!tournament.registrationDeadline) {
    return { error: "Registration deadline is not set", status: 400 as const };
  }
  if (new Date() > new Date(tournament.registrationDeadline)) {
    return { error: "Team registration deadline has passed", status: 400 as const };
  }
  if (tournament.status === "completed") return { error: "Tournament already completed", status: 400 as const };

  const teamName = input.teamName.trim();
  const contactMobileNumber = (input.contactMobileNumber || "").trim();
  if (!teamName) return { error: "Team name is required", status: 400 as const };
  if (contactMobileNumber && !/^\+?[0-9]{8,15}$/.test(contactMobileNumber)) {
    return { error: "Enter a valid contact mobile number", status: 400 as const };
  }

  const expectedPlayerCount = tournament.type === "doubles" ? 2 : 1;
  const parsedPlayers = parsePlayersFromTeamName(teamName, expectedPlayerCount);
  if (!parsedPlayers) {
    return {
      error:
        tournament.type === "doubles"
          ? "Use team name format 'Player1+Player2' or 'Player1/Player2' for doubles registration"
          : "Use player name as team name for singles registration",
      status: 400 as const,
    };
  }
  const normalizedMembers = parsedPlayers.map((name, index) => ({
    name,
    mobileNumber: index === 0 ? contactMobileNumber : "",
    gender: "other" as const,
    isAvailable: true,
  }));
  const teamLeadName = parsedPlayers[0];

  const existingTeamName = tournament.teams.some(
    (team) => team.name.trim().toLowerCase() === teamName.toLowerCase()
  );
  if (existingTeamName) return { error: "Team name already exists", status: 400 as const };

  const registrationTeamNameTaken = (tournament.registrations || []).some(
    (registration) =>
      registration.teamName.trim().toLowerCase() === teamName.toLowerCase() &&
      registration.status !== "rejected"
  );
  if (registrationTeamNameTaken) return { error: "Team registration already submitted", status: 400 as const };

  tournament.registrations.push({
    _id: new mongoose.Types.ObjectId(),
    teamName,
    teamLeadName,
    contactMobileNumber: contactMobileNumber || null,
    members: normalizedMembers,
    status: "pending",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
  } as any);

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const submitTournamentFeedback = async (tournamentId: string, input: TournamentFeedbackInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };

  const isTournamentFeatureEnabled = await getTournamentVisibility();
  if (!isTournamentFeatureEnabled) return { error: "Tournament feature is disabled", status: 400 as const };
  if (!tournament.feedbackEnabled) return { error: "Feedback form is not enabled for this tournament", status: 400 as const };

  const userId = input.userId.trim();
  if (!userId) return { error: "Feedback user identifier is required", status: 400 as const };
  const alreadySubmitted = (tournament.feedbackSubmissions || []).some((submission) => submission.userId === userId);
  if (alreadySubmitted) return { error: "Feedback already submitted for this tournament", status: 409 as const };

  const ratings = [
    input.organizationRating,
    input.courtFacilitiesRating,
    input.refreshmentsRating,
    input.schedulingRating,
    input.returnLikelihoodRating,
  ];
  if (ratings.some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: "All feedback ratings must be between 1 and 5", status: 400 as const };
  }

  tournament.feedbackSubmissions.push({
    _id: new mongoose.Types.ObjectId(),
    userId,
    organizationRating: input.organizationRating,
    courtFacilitiesRating: input.courtFacilitiesRating,
    refreshmentsRating: input.refreshmentsRating,
    schedulingRating: input.schedulingRating,
    returnLikelihoodRating: input.returnLikelihoodRating,
    comments: input.comments?.trim() || null,
    submittedAt: new Date(),
  } as any);

  await tournament.save();
  return { tournament: serializePublicTournament(tournament) };
};

export const reviewTeamRegistration = async (
  tournamentId: string,
  registrationId: string,
  input: ReviewRegistrationInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };

  const registration = (tournament.registrations || []).find(
    (item) => item._id.toString() === registrationId
  );
  if (!registration) return { error: "Registration not found", status: 404 as const };
  if (registration.status !== "pending") return { error: "Registration already reviewed", status: 400 as const };

  registration.status = input.status;
  registration.reviewNote = input.reviewNote?.trim() || null;
  registration.reviewedAt = new Date();

  if (input.status === "accepted") {
    const players = registration.members.map((member) => member.name);
    const addResult = tryAddTeamToTournament(tournament, {
      name: registration.teamName,
      players,
      teamLeadName: registration.teamLeadName,
      members: registration.members.map((member) => ({
        name: member.name,
        mobileNumber: member.mobileNumber,
        gender: member.gender,
      })),
      entryFeePaid: 0,
    });
    if ("error" in addResult) return addResult;
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

  const format = tournament.format || "knockout";
  if (format === "group_knockout" && tournament.teams.length < 4) {
    return { error: "At least 4 teams are required for Group + Knockout format", status: 400 as const };
  }

  if (format === "group_knockout" && tournament.tournamentGroups.length === 0) {
    const groupCount = clampGroupCount(tournament.groupCount, tournament.teams.length);
    tournament.tournamentGroups = makeTournamentGroups(
      tournament.teams.map((team) => team._id),
      groupCount,
      tournament.groupDistributionMode || "random"
    ) as any;
    recordAudit(tournament, `Generated ${groupCount} groups before bracket generation`, undefined);
  }

  if (format === "group_knockout") {
    const assignedTeamCount = new Set(
      tournament.tournamentGroups.flatMap((group) => group.teamIds.map((teamId) => teamId.toString()))
    ).size;
    if (assignedTeamCount < 4) {
      return { error: "Assign at least 4 teams to groups before generating the bracket", status: 400 as const };
    }
  }

  if (format === "group_knockout") {
    const groupMatches = tournament.matches.filter((match) => !match.isManual && isGroupLeagueMatch(match));
    const knockoutMatches = tournament.matches.filter(
      (match) => !match.isManual && !isGroupLeagueMatch(match) && match.roundNumber >= 2
    );
    const generated = buildGroupKnockoutMatches(tournament.teams, {
      groupCount: tournament.groupCount,
      distributionMode: tournament.groupDistributionMode,
      teamsQualifyingPerGroup: tournament.teamsQualifyingPerGroup,
      tournamentGroups: tournament.tournamentGroups,
    });

    if (groupMatches.length === 0) {
      tournament.matches = generated.matches.filter((match) => isGroupLeagueMatch(match)) as any;
      tournament.totalRounds = 1;
      recordAudit(tournament, "Generated group stage fixtures", undefined);
    } else {
      const allGroupMatchesCompleted = groupMatches.every((match) => match.isCompleted);
      if (!allGroupMatchesCompleted) {
        return { error: "Complete all group matches before generating the knockout bracket", status: 400 as const };
      }
      if (knockoutMatches.length > 0) {
        return { error: "Knockout bracket has already been generated", status: 400 as const };
      }

      tournament.matches = [
        ...tournament.matches,
        ...generated.matches.filter((match) => !isGroupLeagueMatch(match) && match.roundNumber >= 2),
      ] as any;
      tournament.totalRounds = generated.totalRounds;
      recordAudit(tournament, "Generated knockout bracket from final group standings", undefined);
    }
  } else {
    const { matches, totalRounds } =
      format === "round_robin" ? buildRoundRobinMatches(tournament.teams) : buildBracketMatches(tournament.teams);
    tournament.matches = matches as any;
    tournament.totalRounds = totalRounds;
  }
  tournament.championTeamId = null;
  tournament.finalScore = null;
  tournament.status = "ongoing";

  reconcileTournamentState(tournament);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

type GenerateScheduleInput = {
  courtCount: number;
  courtNames?: string[];
  startTime: string;
  matchDurationMinutes: number;
};

const getMatchSchedulingRank = (match: ITournamentMatch) => {
  if (match.matchType === "league") return 1;
  if (match.matchType === "semifinal") return 2;
  if (match.matchType === "final") return 3;
  if (match.matchType === "friendly") return 4;
  return 5;
};

const getMatchTeamIds = (match: ITournamentMatch) => {
  const ids: string[] = [];
  if (match.teamAId) ids.push(match.teamAId.toString());
  if (match.teamBId) ids.push(match.teamBId.toString());
  return ids;
};

const hasBothTeams = (match: ITournamentMatch) => Boolean(match.teamAId) && Boolean(match.teamBId);

const areAllMatchesCompleted = (matches: ITournamentMatch[]) =>
  matches.length > 0 && matches.every((match) => match.isCompleted);

const isGroupLeagueMatch = (match: ITournamentMatch) =>
  match.matchType === "league" && /^Group\s/i.test(match.roundLabel || "");

const isMatchReadyForScheduling = (tournament: ITournament, match: ITournamentMatch) => {
  if (match.isCompleted) return false;
  if (!hasBothTeams(match)) return false;

  const matchType = match.matchType || "league";
  if (matchType === "friendly" || matchType === "practice") return true;

  const format = tournament.format || "knockout";

  if (format === "group_knockout") {
    if (matchType === "league") return true;

    const groupLeagueMatches = tournament.matches.filter((item) => isGroupLeagueMatch(item) && !item.isManual);
    if (matchType === "semifinal") {
      return areAllMatchesCompleted(groupLeagueMatches);
    }
    if (matchType === "final") {
      const semiFinals = tournament.matches.filter(
        (item) => item.matchType === "semifinal" && !item.isManual
      );
      return areAllMatchesCompleted(semiFinals);
    }
    return true;
  }

  if (format === "round_robin") {
    if (matchType === "league") return true;

    const leagueMatches = tournament.matches.filter(
      (item) => item.matchType === "league" && !item.isManual
    );
    if (matchType === "semifinal") {
      return areAllMatchesCompleted(leagueMatches);
    }
    if (matchType === "final") {
      const semiFinals = tournament.matches.filter(
        (item) => item.matchType === "semifinal" && !item.isManual
      );
      return areAllMatchesCompleted(semiFinals);
    }
    return true;
  }

  if (match.roundNumber <= 1) return true;
  const sourceA = getSourceMatch(tournament.matches, match.roundNumber, match.matchNumber, "A");
  const sourceB = getSourceMatch(tournament.matches, match.roundNumber, match.matchNumber, "B");
  const sourceACompleted = sourceA ? sourceA.isCompleted : true;
  const sourceBCompleted = sourceB ? sourceB.isCompleted : true;
  return sourceACompleted && sourceBCompleted;
};

const buildCourtName = (index: number) => {
  if (index < 26) return `Court ${String.fromCharCode(65 + index)}`;
  return `Court ${index + 1}`;
};

const getGroupSortValue = (label: string) => label.replace(/^Group\s+/i, "").trim() || label;

const buildBergerTeamPairs = (teamIds: string[]) => {
  if (teamIds.length < 2) return [] as Array<[string, string]>;
  const entries: Array<string | null> = teamIds.length % 2 === 1 ? [...teamIds, null] : [...teamIds];
  const pairs: Array<[string, string]> = [];
  const roundCount = entries.length - 1;
  const half = entries.length / 2;

  for (let round = 0; round < roundCount; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const left = entries[i];
      const right = entries[entries.length - 1 - i];
      if (left && right) pairs.push(round % 2 === 0 ? [left, right] : [right, left]);
    }
    const fixed = entries[0];
    const rotated = [fixed, entries[entries.length - 1], ...entries.slice(1, -1)];
    entries.splice(0, entries.length, ...rotated);
  }

  return pairs;
};

const orderGroupMatchesByBerger = (matches: ITournamentMatch[]) => {
  const teams = Array.from(
    new Set(
      matches.flatMap((match) =>
        getMatchTeamIds(match)
      )
    )
  ).sort();
  const pairRank = new Map<string, number>();
  buildBergerTeamPairs(teams).forEach(([teamA, teamB], index) => {
    pairRank.set([teamA, teamB].sort().join(":"), index);
  });

  return [...matches].sort((a, b) => {
    const aRank = pairRank.get(getMatchTeamIds(a).sort().join(":")) ?? Number.MAX_SAFE_INTEGER;
    const bRank = pairRank.get(getMatchTeamIds(b).sort().join(":")) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.matchNumber - b.matchNumber;
  });
};

const buildTournamentSlotStart = (baseDate: Date, startTime: string) => {
  const [hourPart, minutePart] = startTime.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
};

export const generateMatchSchedule = async (tournamentId: string, input: GenerateScheduleInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if (tournament.matches.length === 0) {
    return { error: "Generate matches before creating a schedule", status: 400 as const };
  }

  const baseDate = new Date(tournament.date);
  const scheduleStart = buildTournamentSlotStart(baseDate, input.startTime);

  if (!scheduleStart || Number.isNaN(scheduleStart.getTime())) {
    return { error: "Invalid schedule start time", status: 400 as const };
  }

  const courtNames = Array.from({ length: input.courtCount }, (_, index) => {
    const customName = input.courtNames?.[index]?.trim();
    return customName || buildCourtName(index);
  });
  const sorted = [...tournament.matches].sort((a, b) => {
    const rankDelta = getMatchSchedulingRank(a) - getMatchSchedulingRank(b);
    if (rankDelta !== 0) return rankDelta;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return a.matchNumber - b.matchNumber;
  });
  const pendingMatches = sorted.filter((match) => !match.isCompleted);
  pendingMatches.forEach((match) => {
    match.scheduledAt = null;
    match.scheduledEndAt = null;
    match.court = null;
    match.court_id = null;
    match.court_name = null;
  });
  const durationMs = input.matchDurationMinutes * 60 * 1000;
  const readyMatches = sorted.filter((match) => isMatchReadyForScheduling(tournament, match));
  const groupMatches = readyMatches.filter((match) => isGroupLeagueMatch(match));
  const otherMatches = readyMatches.filter((match) => !isGroupLeagueMatch(match));
  const groups = Array.from(new Set(groupMatches.map((match) => match.roundLabel))).sort((a, b) =>
    getGroupSortValue(a).localeCompare(getGroupSortValue(b), undefined, { numeric: true })
  );
  const courtSlotIndexes = new Map(courtNames.map((courtName) => [courtName, 0]));

  groups.forEach((groupLabel, groupIndex) => {
    const courtIndex = groupIndex % courtNames.length;
    const courtName = courtNames[courtIndex] || buildCourtName(courtIndex);
    const courtId = `court-${courtIndex + 1}`;
    const orderedMatches = orderGroupMatchesByBerger(groupMatches.filter((match) => match.roundLabel === groupLabel));

    orderedMatches.forEach((match) => {
      const slotIndex = courtSlotIndexes.get(courtName) || 0;
      const slotStart = new Date(scheduleStart.getTime() + slotIndex * durationMs);
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      match.scheduledAt = slotStart;
      match.scheduledEndAt = slotEnd;
      match.court = courtName;
      match.court_id = courtId;
      match.court_name = courtName;
      courtSlotIndexes.set(courtName, slotIndex + 1);
    });
  });

  otherMatches.forEach((match, index) => {
    const courtIndex = index % courtNames.length;
    const courtName = courtNames[courtIndex] || buildCourtName(courtIndex);
    const slotIndex = courtSlotIndexes.get(courtName) || 0;
    const slotStart = new Date(scheduleStart.getTime() + slotIndex * durationMs);
    const slotEnd = new Date(slotStart.getTime() + durationMs);
    match.scheduledAt = slotStart;
    match.scheduledEndAt = slotEnd;
    match.court = courtName;
    match.court_id = `court-${courtIndex + 1}`;
    match.court_name = courtName;
    courtSlotIndexes.set(courtName, slotIndex + 1);
  });

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const updateMatchScore = async (
  tournamentId: string,
  matchId: string,
  scoreA: number | null,
  scoreB: number | null
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const match = tournament.matches.find((item) => item.matchId === matchId);
  if (!match) return { error: "Match not found", status: 404 as const };

  if (scoreA === null || scoreB === null) {
    if (scoreA !== null || scoreB !== null) {
      return { error: "Both scores must be cleared together", status: 400 as const };
    }

    match.scoreA = null;
    match.scoreB = null;
    match.winnerTeamId = null;
    match.isCompleted = false;

    reconcileTournamentState(tournament);
    await tournament.save();

    return { tournament: serializeTournament(tournament) };
  }

  if (!match.teamAId || !match.teamBId) {
    return { error: "Cannot score a match until both teams are available", status: 400 as const };
  }
  if (scoreA === scoreB) return { error: "Scores cannot be tied", status: 400 as const };

  const winnerTeamId = scoreA > scoreB ? match.teamAId : match.teamBId;
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerTeamId = winnerTeamId;
  match.isCompleted = true;

  reconcileTournamentState(tournament);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

type UpdatePlayoffTeamsInput = {
  teamAId: string | null;
  teamBId: string | null;
};

export const updatePlayoffTeams = async (
  tournamentId: string,
  matchId: string,
  input: UpdatePlayoffTeamsInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const match = tournament.matches.find((item) => item.matchId === matchId);
  if (!match) return { error: "Match not found", status: 404 as const };

  const matchType = match.matchType || (match.roundLabel?.toLowerCase().includes("semi") ? "semifinal" : match.roundLabel === "Final" ? "final" : "league");
  if (matchType !== "semifinal" && matchType !== "final") {
    return { error: "Only semifinal and final teams can be edited", status: 400 as const };
  }
  if (match.isCompleted) {
    return { error: "Cannot edit teams for a completed playoff match", status: 400 as const };
  }

  const teamAId = input.teamAId ? input.teamAId.toString() : null;
  const teamBId = input.teamBId ? input.teamBId.toString() : null;
  if (teamAId && !tournament.teams.some((team) => team._id.toString() === teamAId)) {
    return { error: "Invalid Team A", status: 400 as const };
  }
  if (teamBId && !tournament.teams.some((team) => team._id.toString() === teamBId)) {
    return { error: "Invalid Team B", status: 400 as const };
  }
  if (teamAId && teamBId && teamAId === teamBId) {
    return { error: "Team A and Team B cannot be the same", status: 400 as const };
  }

  match.teamAId = teamAId ? new mongoose.Types.ObjectId(teamAId) : null;
  match.teamBId = teamBId ? new mongoose.Types.ObjectId(teamBId) : null;
  match.scoreA = null;
  match.scoreB = null;
  match.winnerTeamId = null;
  match.isCompleted = false;
  match.manualOverrideTeams = true;

  reconcileTournamentState(tournament);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

type UpdateMatchDetailsInput = {
  teamAId?: string | null;
  teamBId?: string | null;
  scheduledAt?: string | Date | null;
  court?: string | null;
};

export const updateMatchDetails = async (
  tournamentId: string,
  matchId: string,
  input: UpdateMatchDetailsInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const match = tournament.matches.find((item) => item.matchId === matchId);
  if (!match) return { error: "Match not found", status: 404 as const };
  if (match.isCompleted) return { error: "Completed matches cannot be edited", status: 400 as const };

  const hasTeamUpdates = input.teamAId !== undefined || input.teamBId !== undefined;
  if (hasTeamUpdates) {
    const teamAId = input.teamAId !== undefined ? (input.teamAId ? input.teamAId.toString() : null) : toId(match.teamAId);
    const teamBId = input.teamBId !== undefined ? (input.teamBId ? input.teamBId.toString() : null) : toId(match.teamBId);

    if (teamAId && !tournament.teams.some((team) => team._id.toString() === teamAId)) {
      return { error: "Invalid Team A", status: 400 as const };
    }
    if (teamBId && !tournament.teams.some((team) => team._id.toString() === teamBId)) {
      return { error: "Invalid Team B", status: 400 as const };
    }
    if (teamAId && teamBId && teamAId === teamBId) {
      return { error: "Team A and Team B cannot be the same", status: 400 as const };
    }

    match.teamAId = teamAId ? new mongoose.Types.ObjectId(teamAId) : null;
    match.teamBId = teamBId ? new mongoose.Types.ObjectId(teamBId) : null;
    match.scoreA = null;
    match.scoreB = null;
    match.winnerTeamId = null;
    match.isCompleted = false;
    match.manualOverrideTeams = true;
  }

  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt) {
      const nextStart = new Date(input.scheduledAt);
      const existingDurationMs =
        match.scheduledAt && match.scheduledEndAt
          ? new Date(match.scheduledEndAt).getTime() - new Date(match.scheduledAt).getTime()
          : null;
      match.scheduledAt = nextStart;
      match.scheduledEndAt =
        existingDurationMs && existingDurationMs > 0
          ? new Date(nextStart.getTime() + existingDurationMs)
          : null;
    } else {
      match.scheduledAt = null;
      match.scheduledEndAt = null;
    }
  }
  if (input.court !== undefined) {
    match.court = input.court?.trim() || null;
  }

  reconcileTournamentState(tournament);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

type CreateCustomMatchInput = {
  matchType: "league" | "semifinal" | "final" | "friendly" | "practice";
  teamAId: string | null;
  teamBId: string | null;
  scheduledAt?: string | Date | null;
  court?: string | null;
};

const getCustomMatchRound = (matchType: CreateCustomMatchInput["matchType"]) => {
  if (matchType === "league") return 1;
  if (matchType === "semifinal") return 2;
  if (matchType === "final") return 3;
  return 4;
};

const getCustomMatchLabel = (matchType: CreateCustomMatchInput["matchType"]) => {
  if (matchType === "league") return "League Match";
  if (matchType === "semifinal") return "Semi Final";
  if (matchType === "final") return "Final";
  if (matchType === "friendly") return "Friendly Match";
  return "Practice Match";
};

export const createCustomMatch = async (tournamentId: string, input: CreateCustomMatchInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };

  const teamAId = input.teamAId ? input.teamAId.toString() : null;
  const teamBId = input.teamBId ? input.teamBId.toString() : null;
  if (teamAId && !tournament.teams.some((team) => team._id.toString() === teamAId)) {
    return { error: "Invalid Team A", status: 400 as const };
  }
  if (teamBId && !tournament.teams.some((team) => team._id.toString() === teamBId)) {
    return { error: "Invalid Team B", status: 400 as const };
  }
  if (teamAId && teamBId && teamAId === teamBId) {
    return { error: "Team A and Team B cannot be the same", status: 400 as const };
  }

  const roundNumber = getCustomMatchRound(input.matchType);
  const roundMatchCount = tournament.matches.filter((match) => match.roundNumber === roundNumber).length;
  const matchId = `MAN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  tournament.matches.push({
    matchId,
    roundNumber,
    roundLabel: getCustomMatchLabel(input.matchType),
    matchNumber: roundMatchCount + 1,
    matchType: input.matchType,
    isManual: true,
    manualOverrideTeams: true,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    scheduledEndAt: null,
    court: input.court?.trim() || null,
    teamAId: teamAId ? new mongoose.Types.ObjectId(teamAId) : null,
    teamBId: teamBId ? new mongoose.Types.ObjectId(teamBId) : null,
    scoreA: null,
    scoreB: null,
    winnerTeamId: null,
    isCompleted: false,
  } as any);

  if (roundNumber > tournament.totalRounds) {
    tournament.totalRounds = roundNumber;
  }

  reconcileTournamentState(tournament);
  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

type UpdateTeamRegistryInput = {
  teamName?: string;
  teamLeadName?: string;
  members?: TeamRegistryMemberInput[];
  entryFeePaid?: number;
};

export const updateTeamRegistryEntry = async (
  tournamentId: string,
  registryId: string,
  input: UpdateTeamRegistryInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const entry = (tournament.teamRegistry || []).find((item) => item._id.toString() === registryId);
  if (!entry) return { error: "Team registry entry not found", status: 404 as const };
  const previousEntryFeePaid = toNumber(entry.entryFeePaid);

  if (input.teamName !== undefined) {
    const teamName = input.teamName.trim();
    if (!teamName) return { error: "Team name is required", status: 400 as const };
    entry.teamName = teamName;
  }
  if (input.teamLeadName !== undefined) {
    const lead = input.teamLeadName.trim();
    if (!lead) return { error: "Team lead name is required", status: 400 as const };
    entry.teamLeadName = lead;
  }
  if (input.members !== undefined) {
    const members = input.members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: (member.mobileNumber || "").trim(),
      gender: member.gender,
    }));
    const invalid = members.some(
      (member) =>
        !member.name ||
        !member.gender ||
        (member.mobileNumber.length > 0 && !/^\+?[0-9]{8,15}$/.test(member.mobileNumber))
    );
    if (invalid) {
      return {
        error: "Each member requires name and gender. Mobile number is optional but must be valid when provided",
        status: 400 as const,
      };
    }
    entry.members = members as any;
  }
  if (input.entryFeePaid !== undefined) {
    if (input.entryFeePaid < 0) return { error: "Entry fee paid cannot be negative", status: 400 as const };
    entry.entryFeePaid = input.entryFeePaid;
  }
  captureEntryFeeAdjustment(tournament, {
    teamName: entry.teamName,
    previousAmount: previousEntryFeePaid,
    nextAmount: toNumber(entry.entryFeePaid),
    teamRegistryId: entry._id,
  });

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

type AddTournamentExpenseInput = {
  title: string;
  amount: number;
  note?: string;
  date?: string | Date | null;
};

export const addTournamentExpense = async (tournamentId: string, input: AddTournamentExpenseInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };

  const title = input.title.trim();
  if (!title) return { error: "Expense title is required", status: 400 as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Expense amount must be greater than 0", status: 400 as const };
  }

  tournament.tournamentExpenses.push({
    _id: new mongoose.Types.ObjectId(),
    title,
    amount: Number(input.amount),
    note: input.note?.trim() || null,
    date: input.date ? new Date(input.date) : new Date(),
  } as any);

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const updateTournamentExpense = async (
  tournamentId: string,
  expenseId: string,
  input: AddTournamentExpenseInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const expense = (tournament.tournamentExpenses || []).find((item) => item._id.toString() === expenseId);
  if (!expense) return { error: "Tournament expense not found", status: 404 as const };

  const title = input.title.trim();
  if (!title) return { error: "Expense title is required", status: 400 as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Expense amount must be greater than 0", status: 400 as const };
  }

  expense.title = title;
  expense.amount = Number(input.amount);
  expense.note = input.note?.trim() || null;
  expense.date = input.date ? new Date(input.date) : expense.date;

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

type AddTournamentIncomeInput = {
  type: TournamentIncomeType;
  title: string;
  amount: number;
  note?: string;
  date?: string | Date | null;
};

export const addTournamentIncome = async (tournamentId: string, input: AddTournamentIncomeInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };

  const title = input.title.trim();
  if (!title) return { error: "Incoming title is required", status: 400 as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Incoming amount must be greater than 0", status: 400 as const };
  }

  pushTournamentIncome(tournament, {
    type: input.type,
    title,
    amount: Number(input.amount),
    note: input.note?.trim() || null,
    date: input.date || undefined,
  });

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const updateTournamentIncome = async (
  tournamentId: string,
  incomeId: string,
  input: AddTournamentIncomeInput
) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const income = (tournament.tournamentIncomes || []).find((item) => item._id.toString() === incomeId);
  if (!income) return { error: "Tournament incoming entry not found", status: 404 as const };

  const title = input.title.trim();
  if (!title) return { error: "Incoming title is required", status: 400 as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Incoming amount must be greater than 0", status: 400 as const };
  }

  income.type = input.type;
  income.title = title;
  income.amount = Number(input.amount);
  income.note = input.note?.trim() || null;
  income.date = input.date ? new Date(input.date) : income.date;

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
      tournaments: [],
      history: [],
    };
  }

  const tournaments = await Tournament.find().sort({ date: -1, createdAt: -1 });
  const serialized = tournaments.map(serializePublicTournament);
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
    tournaments: serialized,
    history,
  };
};

export const getPublicTournamentById = async (id: string) => {
  const isEnabled = await getTournamentVisibility();
  if (!isEnabled) return { isEnabled, tournament: null };

  const tournament = await Tournament.findById(id);
  if (!tournament) return { isEnabled, tournament: null };

  return {
    isEnabled,
    tournament: serializePublicTournament(tournament),
  };
};
