import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tournament } from "@/types/tournament";

type PointsRow = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  points: number;
};

function buildPointsTable(tournament: Tournament): PointsRow[] {
  const byTeam = new Map<string, PointsRow>();

  tournament.teams.forEach((team) => {
    byTeam.set(team._id, {
      teamId: team._id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      points: 0,
    });
  });

  tournament.matches.forEach((match) => {
    const isLeagueMatch =
      match.matchType === "league" ||
      (!match.matchType &&
        match.roundNumber === 1 &&
        (match.roundLabel === "League Stage" || match.roundLabel.startsWith("Group")));
    if (!isLeagueMatch) return;
    if (!match.isCompleted) return;
    if (!match.teamAId || !match.teamBId) return;
    if (match.scoreA === null || match.scoreB === null) return;

    const teamA = byTeam.get(match.teamAId);
    const teamB = byTeam.get(match.teamBId);
    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    teamA.pointsFor += match.scoreA;
    teamA.pointsAgainst += match.scoreB;

    teamB.pointsFor += match.scoreB;
    teamB.pointsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += 2;
    } else if (match.scoreB > match.scoreA) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += 2;
    } else {
      teamA.points += 1;
      teamB.points += 1;
    }
  });

  return [...byTeam.values()]
    .map((row) => ({ ...row, pointsDiff: row.pointsFor - row.pointsAgainst }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.teamName.localeCompare(b.teamName);
    });
}

export function TournamentPointsTable({ tournament }: { tournament: Tournament }) {
  const rows = useMemo(() => buildPointsTable(tournament), [tournament]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Points Table</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">P</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">PA</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.teamId}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{row.teamName}</TableCell>
                    <TableCell className="text-right">{row.played}</TableCell>
                    <TableCell className="text-right">{row.won}</TableCell>
                    <TableCell className="text-right">{row.lost}</TableCell>
                    <TableCell className="text-right">{row.pointsFor}</TableCell>
                    <TableCell className="text-right">{row.pointsAgainst}</TableCell>
                    <TableCell className="text-right">{row.pointsDiff}</TableCell>
                    <TableCell className="text-right font-semibold">{row.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
