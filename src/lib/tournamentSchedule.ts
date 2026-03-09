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

export const buildScheduleRows = (matches: TournamentMatch[]): ScheduleRow[] => {
  const rows = matches.map((match) => {
    const slotStart = match.scheduledAt ? new Date(match.scheduledAt) : null;
    const slotKey = slotStart ? slotStart.toISOString() : `unscheduled-${match.matchId}`;
    const slotLabel = slotStart ? slotStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unscheduled";

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
