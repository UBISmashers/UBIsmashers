import type { TournamentMatch } from "@/types/tournament";

export type ScheduleRow = {
  slotKey: string;
  slotStart: Date | null;
  slotLabel: string;
  court: string;
  teamAName: string;
  teamBName: string;
  matchType: TournamentMatch["matchType"];
  roundLabel: string;
  isManual: boolean;
  matchId: string;
  status: "Pending" | "Live" | "Done";
  scoreLabel: string;
  backToBackTeams: string[];
};

export type CourtScheduleInputTeam = { _id: string; name: string };
export type CourtScheduleInputGroup = { groupName: string; teams: CourtScheduleInputTeam[] };
export type CourtScheduleInputCourt = { id: string; name: string };

export type CourtScheduleMatch = {
  courtId: string;
  courtName: string;
  groupName: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  backToBackTeams: string[];
};

const getBergerPairings = <T,>(teams: T[]) => {
  if (teams.length < 2) return [];
  const hasBye = teams.length % 2 === 1;
  const entries = hasBye ? [...teams, null] : [...teams];
  const rounds: Array<Array<[T, T]>> = [];
  const roundCount = entries.length - 1;
  const half = entries.length / 2;

  for (let round = 0; round < roundCount; round += 1) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < half; i += 1) {
      const left = entries[i];
      const right = entries[entries.length - 1 - i];
      if (left && right) pairs.push(round % 2 === 0 ? [left, right] : [right, left]);
    }
    rounds.push(pairs);
    const fixed = entries[0];
    const rotated = [fixed, entries[entries.length - 1], ...entries.slice(1, -1)];
    entries.splice(0, entries.length, ...rotated);
  }

  return rounds;
};

export const generateCourtSchedule = (
  groups: CourtScheduleInputGroup[],
  courts: CourtScheduleInputCourt[]
): CourtScheduleMatch[] => {
  const sortedGroups = [...groups].sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { numeric: true }));
  const sortedCourts = [...courts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (sortedCourts.length === 0) return [];

  const output: CourtScheduleMatch[] = [];
  sortedGroups.forEach((group, groupIndex) => {
    const court = sortedCourts[groupIndex % sortedCourts.length];
    const lastSeenTeams = new Set<string>();

    getBergerPairings(group.teams).forEach((round) => {
      round.forEach(([teamA, teamB]) => {
        const backToBackTeams = [teamA, teamB].filter((team) => lastSeenTeams.has(team._id)).map((team) => team.name);
        output.push({
          courtId: court.id,
          courtName: court.name,
          groupName: group.groupName,
          teamAId: teamA._id,
          teamBId: teamB._id,
          teamAName: teamA.name,
          teamBName: teamB.name,
          backToBackTeams,
        });
        lastSeenTeams.clear();
        lastSeenTeams.add(teamA._id);
        lastSeenTeams.add(teamB._id);
      });
    });
  });

  return output;
};

const byCourtThenMatch = (a: ScheduleRow, b: ScheduleRow) => {
  const courtCompare = a.court.localeCompare(b.court);
  if (courtCompare !== 0) return courtCompare;
  return a.matchId.localeCompare(b.matchId);
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatScheduleTime = (scheduledAt: string | null | undefined) => {
  if (!scheduledAt) return "Unscheduled";
  const value = new Date(scheduledAt);
  if (Number.isNaN(value.getTime())) return "Unscheduled";
  return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
};

export const formatScheduleDateTime = (scheduledAt: string | null | undefined) => {
  if (!scheduledAt) return "Schedule TBD";
  const value = new Date(scheduledAt);
  if (Number.isNaN(value.getTime())) return "Schedule TBD";
  const y = value.getUTCFullYear();
  const m = pad2(value.getUTCMonth() + 1);
  const d = pad2(value.getUTCDate());
  const t = `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  return `${y}-${m}-${d} ${t}`;
};

export const buildScheduleRows = (matches: TournamentMatch[]): ScheduleRow[] => {
  const sortedForWarnings = [...matches].sort((a, b) => {
    const courtCompare = (a.court_name || a.court || "TBD").localeCompare(b.court_name || b.court || "TBD");
    if (courtCompare !== 0) return courtCompare;
    const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    if ((a.roundLabel || "") !== (b.roundLabel || "")) return (a.roundLabel || "").localeCompare(b.roundLabel || "");
    return a.matchNumber - b.matchNumber;
  });
  const warningsByMatch = new Map<string, string[]>();
  let previousCourt = "";
  let previousTeams = new Map<string, string>();
  sortedForWarnings.forEach((match) => {
    const court = match.court_name || match.court || "TBD";
    if (court !== previousCourt) {
      previousTeams = new Map();
      previousCourt = court;
    }
    const currentTeams = [
      [match.teamAId, match.teamA?.name],
      [match.teamBId, match.teamB?.name],
    ].filter((item): item is [string, string] => Boolean(item[0] && item[1]));
    const warnings = currentTeams
      .filter(([teamId]) => previousTeams.has(teamId))
      .map(([, teamName]) => teamName);
    if (warnings.length > 0) warningsByMatch.set(match.matchId, warnings);
    previousTeams = new Map(currentTeams);
  });

  const rows = matches.map((match) => {
    const slotStart = match.scheduledAt ? new Date(match.scheduledAt) : null;
    const slotKey = slotStart ? slotStart.toISOString() : `unscheduled-${match.matchId}`;
    const slotLabel = formatScheduleTime(match.scheduledAt);

    return {
      slotKey,
      slotStart,
      slotLabel,
      court: match.court_name || match.court || "TBD",
      teamAName: match.teamA?.name || "TBD",
      teamBName: match.teamB?.name || "TBD",
      matchType: match.matchType,
      roundLabel: match.roundLabel,
      isManual: match.isManual,
      matchId: match.matchId,
      status: match.isCompleted ? "Done" : "Pending",
      scoreLabel:
        match.scoreA !== null && match.scoreB !== null ? `${match.scoreA} - ${match.scoreB}` : "TBD",
      backToBackTeams: warningsByMatch.get(match.matchId) || [],
    };
  });

  rows.sort((a, b) => {
    if (!a.slotStart && !b.slotStart) return byCourtThenMatch(a, b);
    if (!a.slotStart) return 1;
    if (!b.slotStart) return -1;
    const timeDelta = a.slotStart.getTime() - b.slotStart.getTime();
    if (timeDelta !== 0) return timeDelta;
    return byCourtThenMatch(a, b);
  });

  return rows;
};

export const buildCourtScheduleGroups = (matches: TournamentMatch[]) => {
  const rows = buildScheduleRows(matches);
  const courts = new Map<string, Map<string, ScheduleRow[]>>();

  rows.forEach((row) => {
    if (!courts.has(row.court)) courts.set(row.court, new Map());
    const groups = courts.get(row.court)!;
    const groupLabel = row.roundLabel || "Other Matches";
    if (!groups.has(groupLabel)) groups.set(groupLabel, []);
    groups.get(groupLabel)!.push(row);
  });

  return [...courts.entries()].map(([courtName, groups]) => ({
    courtName,
    groups: [...groups.entries()].map(([groupLabel, groupRows]) => ({
      groupLabel,
      rows: groupRows,
    })),
  }));
};
