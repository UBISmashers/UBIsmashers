import { useMemo } from "react";
import { CheckCircle2, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tournament, TournamentMatch, TournamentTeam } from "@/types/tournament";

type QualificationStatus = "qualified" | "eliminated" | "none";

type PointsRow = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  points: number;
  status: QualificationStatus;
};

type StandingsGroup = {
  key: string;
  label: string;
  rows: PointsRow[];
  pendingMatches: number;
  totalMatches: number;
};

const defaultPointRules = {
  win: 2,
  loss: 0,
  draw: 1,
};

const getPointRules = (tournament: Tournament) => {
  const settings = tournament as Tournament & {
    winPoints?: number;
    lossPoints?: number;
    drawPoints?: number;
  };

  return {
    win: Number.isFinite(settings.winPoints) ? Number(settings.winPoints) : defaultPointRules.win,
    loss: Number.isFinite(settings.lossPoints) ? Number(settings.lossPoints) : defaultPointRules.loss,
    draw: Number.isFinite(settings.drawPoints) ? Number(settings.drawPoints) : defaultPointRules.draw,
  };
};

const getSchedulingMode = (tournament: Tournament) => {
  const settings = tournament as Tournament & {
    schedulingFormat?: string;
    scoringMode?: string;
    scoringType?: string;
  };
  const value = `${settings.schedulingFormat || settings.scoringMode || settings.scoringType || ""}`.toLowerCase();
  return value.includes("league") || value.includes("goal") || value.includes("football") ? "league" : "points";
};

const isLeagueStageMatch = (match: TournamentMatch) => {
  if (match.matchType === "league") return true;
  if (match.matchType) return false;
  return (
    match.roundNumber === 1 &&
    (match.roundLabel === "League Stage" || /^Group\s/i.test(match.roundLabel || ""))
  );
};

const compareRows = (a: PointsRow, b: PointsRow) => {
  if (b.points !== a.points) return b.points - a.points;
  if (b.won !== a.won) return b.won - a.won;
  if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  return a.teamName.localeCompare(b.teamName);
};

const makeRows = (
  teams: TournamentTeam[],
  matches: TournamentMatch[],
  pointRules: ReturnType<typeof getPointRules>,
  qualifyingCount = 0,
  showFinalStatus = false
) => {
  const byTeam = new Map<string, PointsRow>();

  teams.forEach((team) => {
    byTeam.set(team._id, {
      teamId: team._id,
      teamName: team.name,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      points: 0,
      status: "none",
    });
  });

  matches.forEach((match) => {
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
      teamA.points += pointRules.win;
      teamB.points += pointRules.loss;
    } else if (match.scoreB > match.scoreA) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += pointRules.win;
      teamA.points += pointRules.loss;
    } else {
      teamA.draw += 1;
      teamB.draw += 1;
      teamA.points += pointRules.draw;
      teamB.points += pointRules.draw;
    }
  });

  return [...byTeam.values()]
    .map((row) => ({ ...row, pointsDiff: row.pointsFor - row.pointsAgainst }))
    .sort(compareRows)
    .map((row, index) => ({
      ...row,
      status:
        !showFinalStatus || qualifyingCount <= 0
          ? "none"
          : index < qualifyingCount
          ? "qualified"
          : "eliminated",
    }));
};

const buildFallbackGroupsFromMatches = (tournament: Tournament) => {
  const teamsById = new Map(tournament.teams.map((team) => [team._id, team]));
  const groupTeamIds = new Map<string, Set<string>>();

  tournament.matches.forEach((match) => {
    if (!isLeagueStageMatch(match) || !/^Group\s/i.test(match.roundLabel || "")) return;
    if (!groupTeamIds.has(match.roundLabel)) groupTeamIds.set(match.roundLabel, new Set<string>());
    if (match.teamAId) groupTeamIds.get(match.roundLabel)?.add(match.teamAId);
    if (match.teamBId) groupTeamIds.get(match.roundLabel)?.add(match.teamBId);
  });

  return [...groupTeamIds.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, teamIds]) => ({
      key: label,
      label,
      teams: [...teamIds]
        .map((teamId) => teamsById.get(teamId))
        .filter((team): team is TournamentTeam => Boolean(team)),
    }));
};

const buildStandingsGroups = (tournament: Tournament): StandingsGroup[] => {
  if (tournament.format === "knockout") return [];

  const pointRules = getPointRules(tournament);
  const leagueMatches = tournament.matches.filter(isLeagueStageMatch);

  if (tournament.format === "round_robin") {
    return [
      {
        key: "overall",
        label: "Overall Tournament Standings",
        rows: makeRows(tournament.teams, leagueMatches, pointRules),
        pendingMatches: leagueMatches.filter((match) => !match.isCompleted).length,
        totalMatches: leagueMatches.length,
      },
    ];
  }

  const teamsById = new Map(tournament.teams.map((team) => [team._id, team]));
  const configuredGroups = [...(tournament.tournamentGroups || [])]
    .sort((a, b) => a.groupOrder - b.groupOrder)
    .map((group) => ({
      key: group._id,
      label: group.groupName,
      teams: group.teamIds
        .map((teamId) => teamsById.get(teamId))
        .filter((team): team is TournamentTeam => Boolean(team)),
    }));
  const groups = configuredGroups.length > 0 ? configuredGroups : buildFallbackGroupsFromMatches(tournament);
  const qualifyingCount = Math.max(1, tournament.teamsQualifyingPerGroup || 2);

  return groups.map((group) => {
    const teamIds = new Set(group.teams.map((team) => team._id));
    const groupMatches = leagueMatches.filter(
      (match) =>
        (match.roundLabel === group.label || !/^Group\s/i.test(match.roundLabel || "")) &&
        Boolean(match.teamAId && match.teamBId && teamIds.has(match.teamAId) && teamIds.has(match.teamBId))
    );
    const pendingMatches = groupMatches.filter((match) => !match.isCompleted).length;
    const groupStageComplete = groupMatches.length > 0 && pendingMatches === 0;

    return {
      key: group.key,
      label: group.label,
      pendingMatches,
      totalMatches: groupMatches.length,
      rows: makeRows(group.teams, groupMatches, pointRules, qualifyingCount, groupStageComplete),
    };
  });
};

const statusContent: Record<QualificationStatus, { label: string; className: string; icon: JSX.Element | null }> = {
  qualified: {
    label: "Qualified",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  eliminated: {
    label: "Eliminated",
    className: "border-red-500/30 bg-red-500/10 text-red-700",
    icon: <CircleX className="h-3.5 w-3.5" />,
  },
  none: {
    label: "",
    className: "",
    icon: null,
  },
};

function QualificationBadge({ status }: { status: QualificationStatus }) {
  if (status === "none") return null;
  const content = statusContent[status];
  return (
    <Badge variant="outline" className={`gap-1 whitespace-nowrap ${content.className}`}>
      {content.icon}
      {content.label}
    </Badge>
  );
}

function StandingsTable({
  rows,
  showQualification,
  schedulingMode,
}: {
  rows: PointsRow[];
  showQualification: boolean;
  schedulingMode: "points" | "league";
}) {
  const scoreForLabel = schedulingMode === "league" ? "GF" : "PF";
  const scoreAgainstLabel = schedulingMode === "league" ? "GA" : "PA";
  const diffLabel = schedulingMode === "league" ? "Goal Difference" : "Difference";

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No teams added yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Rank</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Played</TableHead>
            <TableHead className="text-right">Won</TableHead>
            {schedulingMode === "league" && <TableHead className="text-right">Draw</TableHead>}
            <TableHead className="text-right">Lost</TableHead>
            <TableHead className="text-right">{scoreForLabel}</TableHead>
            <TableHead className="text-right">{scoreAgainstLabel}</TableHead>
            <TableHead className="text-right">{diffLabel}</TableHead>
            <TableHead className="text-right">Points</TableHead>
            {showQualification && <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.teamId}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell className="min-w-44 font-medium">{row.teamName}</TableCell>
              <TableCell className="text-right">{row.played}</TableCell>
              <TableCell className="text-right">{row.won}</TableCell>
              {schedulingMode === "league" && <TableCell className="text-right">{row.draw}</TableCell>}
              <TableCell className="text-right">{row.lost}</TableCell>
              <TableCell className="text-right">{row.pointsFor}</TableCell>
              <TableCell className="text-right">{row.pointsAgainst}</TableCell>
              <TableCell className="text-right">{row.pointsDiff}</TableCell>
              <TableCell className="text-right font-semibold">{row.points}</TableCell>
              {showQualification && (
                <TableCell>
                  <QualificationBadge status={row.status} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QualifiedTeamsPreview({ groups }: { groups: StandingsGroup[] }) {
  const qualifiedGroups = groups.map((group) => ({
    ...group,
    teams: group.rows.filter((row) => row.status === "qualified"),
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group Stage Results</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.key} className="rounded-md border p-3">
              <p className="text-sm font-semibold">{group.label}</p>
              <div className="mt-2 space-y-2 text-sm">
                {group.rows.map((team, index) => (
                  <div key={team.teamId} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {index + 1}. {team.teamName}
                    </span>
                    <QualificationBadge status={team.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qualified Teams</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {qualifiedGroups.map((group) => (
            <div key={group.key} className="rounded-md border p-3">
              <p className="text-sm font-semibold">{group.label}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {group.teams.length === 0 ? (
                  <p>Awaiting results</p>
                ) : (
                  group.teams.map((team, index) => (
                    <p key={team.teamId}>
                      {index + 1}. {team.teamName}
                    </p>
                  ))
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function TournamentPointsTable({ tournament }: { tournament: Tournament }) {
  const standingsGroups = useMemo(() => buildStandingsGroups(tournament), [tournament]);
  const schedulingMode = getSchedulingMode(tournament);

  if (tournament.format === "knockout") return null;

  if (tournament.format === "group_knockout") {
    const groupStageComplete =
      standingsGroups.length > 0 &&
      standingsGroups.every((group) => group.totalMatches > 0 && group.pendingMatches === 0);

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {groupStageComplete ? "Group Final Standings" : "Group Standings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {standingsGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Generate groups to show standings.</p>
            ) : (
              <Tabs defaultValue={standingsGroups[0]?.key} className="space-y-4">
                <div className="overflow-x-auto pb-1">
                  <TabsList className="w-max justify-start">
                    {standingsGroups.map((group) => (
                      <TabsTrigger key={group.key} value={group.key}>
                        {group.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {standingsGroups.map((group) => (
                  <TabsContent key={group.key} value={group.key} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">
                        {group.label} {groupStageComplete ? "Final Standings" : "Standings"}
                      </h3>
                      <Badge variant="secondary">
                        Top {Math.max(1, tournament.teamsQualifyingPerGroup || 2)} qualify
                      </Badge>
                    </div>
                    <StandingsTable
                      rows={group.rows}
                      showQualification={groupStageComplete}
                      schedulingMode={schedulingMode}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {groupStageComplete && (
          <>
            <QualifiedTeamsPreview groups={standingsGroups} />
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4">
                <p className="font-semibold text-emerald-800">Group Stage Complete</p>
                <p className="text-sm text-emerald-700">
                  All group matches are complete. Admin can verify standings and generate the knockout bracket.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  const overall = standingsGroups[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overall Tournament Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <StandingsTable rows={overall?.rows || []} showQualification={false} schedulingMode={schedulingMode} />
      </CardContent>
    </Card>
  );
}
