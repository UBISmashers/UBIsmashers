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
  const rows = matches.map((match) => {
    const slotStart = match.scheduledAt ? new Date(match.scheduledAt) : null;
    const slotKey = slotStart ? slotStart.toISOString() : `unscheduled-${match.matchId}`;
    const slotLabel = formatScheduleTime(match.scheduledAt);

    return {
      slotKey,
      slotStart,
      slotLabel,
      court: match.court || "TBD",
      teamAName: match.teamA?.name || "TBD",
      teamBName: match.teamB?.name || "TBD",
      matchType: match.matchType,
      roundLabel: match.roundLabel,
      isManual: match.isManual,
      matchId: match.matchId,
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
