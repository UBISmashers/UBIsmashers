import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tournament, TournamentMatch } from "@/types/tournament";

type Props = {
  tournament: Tournament;
  editable?: boolean;
  onSubmitScore?: (matchId: string, scoreA: number, scoreB: number) => Promise<void> | void;
};

const teamRowClass = (isWinner: boolean) =>
  `flex items-center justify-between rounded-md border px-2 py-2 text-sm ${
    isWinner ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-900" : "bg-background"
  }`;

const getScheduledTime = (scheduledAt: TournamentMatch["scheduledAt"]) => {
  if (!scheduledAt) return null;
  const value = new Date(scheduledAt).getTime();
  return Number.isNaN(value) ? null : value;
};

const compareMatchesBySchedule = (a: TournamentMatch, b: TournamentMatch) => {
  const scheduledA = getScheduledTime(a.scheduledAt);
  const scheduledB = getScheduledTime(b.scheduledAt);

  if (scheduledA !== null && scheduledB !== null && scheduledA !== scheduledB) {
    return scheduledA - scheduledB;
  }
  if (scheduledA !== null && scheduledB === null) return -1;
  if (scheduledA === null && scheduledB !== null) return 1;
  if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;
  return a.matchId.localeCompare(b.matchId);
};

const getRoundSortKey = (match: TournamentMatch) => {
  const normalized = (match.roundLabel || "").trim();
  if (!normalized) return 9999;
  if (/league stage/i.test(normalized)) return -200_000;
  if (/group stage/i.test(normalized) || /^group\s/i.test(normalized)) return -100_000;
  if (match.matchType === "final" || /final/i.test(normalized)) return 1_000_000;
  if (match.matchType === "semifinal" || /semi/i.test(normalized)) return 500_000;
  if (match.matchType === "quarterfinal" || /quarter/i.test(normalized)) return 250_000;
  if (match.matchType === "round_of_16" || /round of 16/i.test(normalized)) return 125_000;
  if (match.matchType === "round_of_32" || /round of 32/i.test(normalized)) return 62_500;
  if (match.matchType === "round_of_64" || /round of 64/i.test(normalized)) return 31_250;
  const roundOfMatch = normalized.match(/round of (\d+)/i);
  if (roundOfMatch) return Number(roundOfMatch[1]) * 100;
  const directMatch = normalized.match(/(\d+)/);
  if (directMatch) return Number(directMatch[1]) * 100;
  return 9999;
};

export function TournamentBracket({ tournament, editable = false, onSubmitScore }: Props) {
  const [scoresByMatch, setScoresByMatch] = useState<Record<string, { scoreA: string; scoreB: string }>>({});
  const rounds = useMemo(() => {
    const map = new Map<string, { roundNumber: number; label: string; matches: TournamentMatch[] }>();
    const bracketMatches = tournament.format === "round_robin_knockout"
      ? tournament.matches.filter((match) => match.matchType === "semifinal" || match.matchType === "final")
      : tournament.matches;
    bracketMatches.forEach((match) => {
      // Group schedules reuse round numbers across groups.  Keep each group
      // distinct so Group B matches never appear under a Group A header.
      const isGroupRound = match.matchType === "league" && /^group\s/i.test(match.roundLabel || "");
      const key = isGroupRound
        ? `group:${match.roundLabel}:${match.roundNumber}`
        : `round:${match.roundNumber}`;
      if (!map.has(key)) {
        map.set(key, {
          roundNumber: match.roundNumber,
          label: isGroupRound ? `${match.roundLabel} — Round ${match.roundNumber}` : match.roundLabel || `Round ${match.roundNumber}`,
          matches: [],
        });
      }
      map.get(key)!.matches.push(match);
    });
    return [...map.values()]
      .sort((a, b) => {
        const aMatch = a.matches[0];
        const bMatch = b.matches[0];
        const aSort = aMatch ? getRoundSortKey(aMatch) : 9999;
        const bSort = bMatch ? getRoundSortKey(bMatch) : 9999;
        if (aSort !== bSort) return aSort - bSort;
        if (a.label !== b.label) return a.label.localeCompare(b.label, undefined, { numeric: true });
        return a.roundNumber - b.roundNumber;
      })
      .map((round) => ({
        ...round,
        matches: [...round.matches].sort(compareMatchesBySchedule),
      }));
  }, [tournament.format, tournament.matches]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tournament Bracket</h2>
        {tournament.championTeam && (
          <Badge className="bg-emerald-600 text-white">
            <Trophy className="mr-1 h-3.5 w-3.5" />
            Champion: {tournament.championTeam.name}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {rounds.map((round) => (
            <div key={`${round.label}-${round.roundNumber}`} className="w-[290px] shrink-0">
              <div className="mb-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                {round.label}
              </div>
              <div className="space-y-3">
                {round.matches.map((match) => {
                  const teamAName = match.teamA?.name || "TBD";
                  const teamBName = match.teamB?.name || "TBD";
                  const winnerId = match.winnerTeamId;
                  const teamAIsWinner = Boolean(match.teamAId && winnerId && match.teamAId === winnerId);
                  const teamBIsWinner = Boolean(match.teamBId && winnerId && match.teamBId === winnerId);
                  const editableMatch = editable && match.teamAId && match.teamBId;
                  const localScore = scoresByMatch[match.matchId] || {
                    scoreA: match.scoreA?.toString() || "",
                    scoreB: match.scoreB?.toString() || "",
                  };

                  return (
                    <div key={match.matchId} className="rounded-lg border bg-card p-3 shadow-sm">
                      <p className="mb-2 text-xs text-muted-foreground">Match {match.matchNumber}</p>
                      <div className="space-y-2">
                        <div className={teamRowClass(teamAIsWinner)}>
                          <span className="truncate pr-3">{teamAName}</span>
                          {editableMatch && onSubmitScore ? (
                            <Input
                              type="number"
                              min={0}
                              className="h-7 w-20 text-right"
                              value={localScore.scoreA}
                              onChange={(event) =>
                                setScoresByMatch((prev) => ({
                                  ...prev,
                                  [match.matchId]: {
                                    ...localScore,
                                    scoreA: event.target.value,
                                  },
                                }))
                              }
                              placeholder="A"
                            />
                          ) : (
                            <span>{match.scoreA ?? "-"}</span>
                          )}
                        </div>
                        <div className={teamRowClass(teamBIsWinner)}>
                          <span className="truncate pr-3">{teamBName}</span>
                          {editableMatch && onSubmitScore ? (
                            <Input
                              type="number"
                              min={0}
                              className="h-7 w-20 text-right"
                              value={localScore.scoreB}
                              onChange={(event) =>
                                setScoresByMatch((prev) => ({
                                  ...prev,
                                  [match.matchId]: {
                                    ...localScore,
                                    scoreB: event.target.value,
                                  },
                                }))
                              }
                              placeholder="B"
                            />
                          ) : (
                            <span>{match.scoreB ?? "-"}</span>
                          )}
                        </div>
                      </div>

                      {editableMatch && onSubmitScore && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            className="h-8 px-3"
                            onClick={() =>
                              onSubmitScore(
                                match.matchId,
                                Number(localScore.scoreA),
                                Number(localScore.scoreB)
                              )
                            }
                            disabled={localScore.scoreA === "" || localScore.scoreB === ""}
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {tournament.championTeam && (
            <div className="w-[220px] shrink-0">
              <div className="mb-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                Champion
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">{tournament.championTeam.name}</p>
                {tournament.finalScore && (
                  <p className="mt-1 text-sm text-emerald-700">Final: {tournament.finalScore}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
