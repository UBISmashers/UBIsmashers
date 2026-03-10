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

export function TournamentBracket({ tournament, editable = false, onSubmitScore }: Props) {
  const [scoresByMatch, setScoresByMatch] = useState<Record<string, { scoreA: string; scoreB: string }>>({});
  const rounds = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    tournament.matches.forEach((match) => {
      if (!map.has(match.roundNumber)) map.set(match.roundNumber, []);
      map.get(match.roundNumber)!.push(match);
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([roundNumber, matches]) => ({
        roundNumber,
        label: matches[0]?.roundLabel || `Round ${roundNumber}`,
        matches: matches.sort(compareMatchesBySchedule),
      }));
  }, [tournament.matches]);

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
            <div key={round.roundNumber} className="w-[290px] shrink-0">
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
