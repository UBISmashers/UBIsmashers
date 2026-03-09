import mongoose from "mongoose";
import { AppSetting } from "../models/AppSetting.js";
import { ITournament, ITournamentMatch, Tournament, TournamentFormat } from "../models/Tournament.js";

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

const buildGroupKnockoutMatches = (teams: ITournament["teams"]) => {
  const shuffledTeams = shuffle(teams.map((team) => team._id));
  const groupA: mongoose.Types.ObjectId[] = [];
  const groupB: mongoose.Types.ObjectId[] = [];

  shuffledTeams.forEach((teamId, index) => {
    if (index % 2 === 0) groupA.push(teamId);
    else groupB.push(teamId);
  });

  const groupMatches: ITournamentMatch[] = [];
  let matchNumber = 1;
  const pushGroupMatches = (groupName: "Group A" | "Group B", groupTeams: mongoose.Types.ObjectId[]) => {
    for (let i = 0; i < groupTeams.length; i += 1) {
      for (let j = i + 1; j < groupTeams.length; j += 1) {
        groupMatches.push({
          matchId: `GR-${groupName === "Group A" ? "A" : "B"}-M${matchNumber}`,
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

  pushGroupMatches("Group A", groupA);
  pushGroupMatches("Group B", groupB);

  const knockoutMatches: ITournamentMatch[] = [
    {
      matchId: "KO-SF1",
      roundNumber: 2,
      roundLabel: "Semi Finals",
      matchNumber: 1,
      matchType: "semifinal",
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
    {
      matchId: "KO-SF2",
      roundNumber: 2,
      roundLabel: "Semi Finals",
      matchNumber: 2,
      matchType: "semifinal",
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
    {
      matchId: "KO-FINAL",
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

  return { matches: [...groupMatches, ...knockoutMatches], totalRounds: 3 };
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
  const groupAMatches = tournament.matches.filter(
    (match) => !match.isManual && match.roundNumber === 1 && match.roundLabel === "Group A"
  );
  const groupBMatches = tournament.matches.filter(
    (match) => !match.isManual && match.roundNumber === 1 && match.roundLabel === "Group B"
  );
  const allGroupCompleted =
    groupAMatches.length > 0 &&
    groupBMatches.length > 0 &&
    [...groupAMatches, ...groupBMatches].every((match) => match.isCompleted);

  const semi1 = tournament.matches.find((match) => match.matchId === "KO-SF1");
  const semi2 = tournament.matches.find((match) => match.matchId === "KO-SF2");
  const final = tournament.matches.find((match) => match.matchId === "KO-FINAL");
  if (!semi1 || !semi2 || !final) return;

  if (!allGroupCompleted) {
    if (!semi1.manualOverrideTeams) {
      semi1.teamAId = null;
      semi1.teamBId = null;
    }
    if (!semi2.manualOverrideTeams) {
      semi2.teamAId = null;
      semi2.teamBId = null;
    }
    resetInvalidMatch(semi1);
    resetInvalidMatch(semi2);
    if (!final.manualOverrideTeams) {
      final.teamAId = null;
      final.teamBId = null;
    }
    resetInvalidMatch(final);
    return;
  }

  const groupATeamIds = new Set<string>();
  const groupBTeamIds = new Set<string>();
  groupAMatches.forEach((match) => {
    if (match.teamAId) groupATeamIds.add(match.teamAId.toString());
    if (match.teamBId) groupATeamIds.add(match.teamBId.toString());
  });
  groupBMatches.forEach((match) => {
    if (match.teamAId) groupBTeamIds.add(match.teamAId.toString());
    if (match.teamBId) groupBTeamIds.add(match.teamBId.toString());
  });

  const groupATeams = tournament.teams.filter((team) => groupATeamIds.has(team._id.toString()));
  const groupBTeams = tournament.teams.filter((team) => groupBTeamIds.has(team._id.toString()));

  const groupAStanding = buildStandings(groupATeams, groupAMatches);
  const groupBStanding = buildStandings(groupBTeams, groupBMatches);
  const a1 = groupAStanding[0]?.teamId || null;
  const a2 = groupAStanding[1]?.teamId || null;
  const b1 = groupBStanding[0]?.teamId || null;
  const b2 = groupBStanding[1]?.teamId || null;

  if (!semi1.manualOverrideTeams) {
    semi1.teamAId = a1;
    semi1.teamBId = b2;
  }
  if (!semi2.manualOverrideTeams) {
    semi2.teamAId = b1;
    semi2.teamBId = a2;
  }

  if (!isValidCompletedMatch(semi1)) resetInvalidMatch(semi1);
  if (!isValidCompletedMatch(semi2)) resetInvalidMatch(semi2);

  if (!final.manualOverrideTeams) {
    final.teamAId = semi1.isCompleted ? semi1.winnerTeamId : null;
    final.teamBId = semi2.isCompleted ? semi2.winnerTeamId : null;
  }

  if (!isValidCompletedMatch(final)) resetInvalidMatch(final);
};

const reconcileGroupKnockoutState = (tournament: ITournament) => {
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

  const semiMatches = tournament.matches.filter((match) => !match.isManual && match.roundNumber === 2);
  semiMatches.forEach((match) => {
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

  const finalMatch = tournament.matches.find((match) => match.matchId === "KO-FINAL");
  if (finalMatch) {
    if (!finalMatch.manualOverrideTeams) {
      finalMatch.teamAId = semiMatches[0]?.isCompleted ? semiMatches[0].winnerTeamId : null;
      finalMatch.teamBId = semiMatches[1]?.isCompleted ? semiMatches[1].winnerTeamId : null;
    }

    if (!finalMatch.teamAId || !finalMatch.teamBId) {
      resetInvalidMatch(finalMatch);
    } else if (!finalMatch.isCompleted) {
      finalMatch.winnerTeamId = null;
    } else if (
      finalMatch.scoreA === null ||
      finalMatch.scoreB === null ||
      finalMatch.scoreA === finalMatch.scoreB
    ) {
      resetInvalidMatch(finalMatch);
    } else {
      finalMatch.winnerTeamId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamAId : finalMatch.teamBId;
    }
  }

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

const serializeTournament = (tournament: ITournament) => {
  const plain = tournament.toObject();
  const teamsById = new Map(plain.teams.map((team: any) => [team._id.toString(), team]));
  const champion =
    plain.championTeamId && teamsById.has(plain.championTeamId.toString())
      ? teamsById.get(plain.championTeamId.toString())
      : null;

  return {
    ...plain,
    format: plain.format || "knockout",
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
  entryFee?: number;
  status?: "upcoming" | "ongoing" | "completed";
  isVisibleToMembers?: boolean;
  allowTeamRegistration?: boolean;
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
    entryFee: input.entryFee || 0,
    status: input.status || "upcoming",
    isVisibleToMembers: input.isVisibleToMembers ?? true,
    allowTeamRegistration: input.allowTeamRegistration ?? false,
    registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : null,
    teams: [],
    registrations: [],
    teamRegistry: [],
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
  mobileNumber: string;
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
  if (input.entryFee !== undefined) tournament.entryFee = input.entryFee;
  if (input.status !== undefined) tournament.status = input.status;
  if (input.isVisibleToMembers !== undefined) tournament.isVisibleToMembers = input.isVisibleToMembers;
  if (input.allowTeamRegistration !== undefined) tournament.allowTeamRegistration = input.allowTeamRegistration;
  if (input.registrationDeadline !== undefined) {
    tournament.registrationDeadline = input.registrationDeadline ? new Date(input.registrationDeadline) : null;
  }

  await tournament.save();
  return serializeTournament(tournament);
};

type AddTeamInput = {
  name: string;
  contactMobileNumber?: string;
  players?: string[];
  teamLeadName?: string;
  members?: TeamRegistryMemberInput[];
  entryFeePaid?: number;
};

type RegisterTeamInput = {
  teamName: string;
  contactMobileNumber?: string;
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
      mobileNumber: member.mobileNumber.trim(),
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
    existing.teamId = teamId;
    existing.teamName = payload.teamName.trim();
    existing.teamLeadName = payload.teamLeadName.trim();
    existing.members = payload.members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: member.mobileNumber.trim(),
      gender: member.gender,
    })) as any;
    existing.entryFeePaid = Math.max(0, payload.entryFeePaid || 0);
    return;
  }

  tournament.teamRegistry.push({
    _id: new mongoose.Types.ObjectId(),
    teamId,
    teamName: payload.teamName.trim(),
    teamLeadName: payload.teamLeadName.trim(),
    members: payload.members.map((member) => ({
      name: member.name.trim(),
      mobileNumber: member.mobileNumber.trim(),
      gender: member.gender,
    })) as any,
    entryFeePaid: Math.max(0, payload.entryFeePaid || 0),
  } as any);
};

const tryAddTeamToTournament = (tournament: ITournament, input: AddTeamInput): TeamInsertResult => {
  if (tournament.matches.length > 0) {
    return { error: "Cannot add teams after bracket generation", status: 400 as const };
  }

  const teamName = input.name.trim();
  const contactMobileNumber = (input.contactMobileNumber || "").trim();
  if (!teamName) return { error: "Team name is required", status: 400 as const };
  if (contactMobileNumber && !/^\+?[0-9]{8,15}$/.test(contactMobileNumber)) {
    return { error: "Enter a valid contact mobile number", status: 400 as const };
  }

  const expectedPlayerCount = tournament.type === "doubles" ? 2 : 1;
  const playersFromInput = (input.players || []).map((player) => player.trim()).filter(Boolean);
  const normalizedPlayers =
    playersFromInput.length > 0 ? playersFromInput : parsePlayersFromTeamName(teamName, expectedPlayerCount) || [];

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
      (member.mobileNumber.trim().length > 0 && !/^\+?[0-9]{8,15}$/.test(member.mobileNumber.trim()))
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
  upsertTeamRegistry(tournament, team._id, {
    teamName,
    teamLeadName: (input.teamLeadName || normalizedPlayers[0] || teamName).trim(),
    members: registryMembers,
    entryFeePaid: Math.max(0, input.entryFeePaid || 0),
  });

  return { ok: true };
};

export const addTeam = async (tournamentId: string, input: AddTeamInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const teamAddResult = tryAddTeamToTournament(tournament, input);
  if ("error" in teamAddResult) return teamAddResult;
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
  tournament.teamRegistry = (tournament.teamRegistry || []).filter(
    (entry) => !entry.teamId || entry.teamId.toString() !== teamId
  ) as any;

  await tournament.save();
  return { tournament: serializeTournament(tournament) };
};

export const registerTeam = async (tournamentId: string, input: RegisterTeamInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  const isTournamentFeatureEnabled = await getTournamentVisibility();
  if (!isTournamentFeatureEnabled) return { error: "Tournament registration is closed", status: 400 as const };
  if (!tournament.isVisibleToMembers) return { error: "Tournament registration is closed", status: 400 as const };
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

  const { matches, totalRounds } =
    format === "round_robin"
      ? buildRoundRobinMatches(tournament.teams)
      : format === "group_knockout"
      ? buildGroupKnockoutMatches(tournament.teams)
      : buildBracketMatches(tournament.teams);
  tournament.matches = matches as any;
  tournament.totalRounds = totalRounds;
  tournament.championTeamId = null;
  tournament.finalScore = null;
  tournament.status = "ongoing";

  reconcileTournamentState(tournament);
  await tournament.save();

  return { tournament: serializeTournament(tournament) };
};

type GenerateScheduleInput = {
  courtCount: number;
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

const buildCourtName = (index: number) => {
  if (index < 26) return `Court ${String.fromCharCode(65 + index)}`;
  return `Court ${index + 1}`;
};

export const generateMatchSchedule = async (tournamentId: string, input: GenerateScheduleInput) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: "Tournament not found", status: 404 as const };
  if (tournament.matches.length === 0) {
    return { error: "Generate matches before creating a schedule", status: 400 as const };
  }

  const baseDate = new Date(tournament.date);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  const day = String(baseDate.getDate()).padStart(2, "0");
  const scheduleStart = new Date(`${year}-${month}-${day}T${input.startTime}:00`);

  if (Number.isNaN(scheduleStart.getTime())) {
    return { error: "Invalid schedule start time", status: 400 as const };
  }

  const courtNames = Array.from({ length: input.courtCount }, (_, index) => buildCourtName(index));
  const sorted = [...tournament.matches].sort((a, b) => {
    const rankDelta = getMatchSchedulingRank(a) - getMatchSchedulingRank(b);
    if (rankDelta !== 0) return rankDelta;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return a.matchNumber - b.matchNumber;
  });
  const queue = sorted.filter((match) => !match.isCompleted && Boolean(match.teamAId) && Boolean(match.teamBId));
  const unschedulableMatches = sorted.filter(
    (match) => !match.isCompleted && (!match.teamAId || !match.teamBId)
  );
  unschedulableMatches.forEach((match) => {
    match.scheduledAt = null;
    match.scheduledEndAt = null;
    match.court = null;
  });

  let slotIndex = 0;
  let previousSlotTeams = new Set<string>();
  const durationMs = input.matchDurationMinutes * 60 * 1000;

  while (queue.length > 0) {
    const slotMatches: ITournamentMatch[] = [];
    const currentSlotTeams = new Set<string>();

    for (let courtIndex = 0; courtIndex < courtNames.length && queue.length > 0; courtIndex += 1) {
      const preferredIndex = queue.findIndex((match) => {
        const teams = getMatchTeamIds(match);
        if (teams.some((teamId) => currentSlotTeams.has(teamId))) return false;
        if (teams.some((teamId) => previousSlotTeams.has(teamId))) return false;
        return true;
      });
      const relaxedIndex =
        preferredIndex !== -1
          ? preferredIndex
          : queue.findIndex((match) => {
              const teams = getMatchTeamIds(match);
              return !teams.some((teamId) => currentSlotTeams.has(teamId));
            });
      const matchIndex = relaxedIndex !== -1 ? relaxedIndex : 0;
      const [pickedMatch] = queue.splice(matchIndex, 1);
      if (!pickedMatch) break;

      slotMatches.push(pickedMatch);
      getMatchTeamIds(pickedMatch).forEach((teamId) => currentSlotTeams.add(teamId));
    }

    const slotStart = new Date(scheduleStart.getTime() + slotIndex * durationMs);
    const slotEnd = new Date(slotStart.getTime() + durationMs);

    slotMatches.forEach((match, courtIndex) => {
      match.scheduledAt = new Date(slotStart);
      match.scheduledEndAt = new Date(slotEnd);
      match.court = courtNames[courtIndex] || buildCourtName(courtIndex);
    });

    previousSlotTeams = currentSlotTeams;
    slotIndex += 1;
  }

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
      mobileNumber: member.mobileNumber.trim(),
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
    tournaments: serialized,
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
