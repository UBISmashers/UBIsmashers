import type { Tournament } from "@/types/tournament";

export type TournamentGroupView = {
  label: string;
  teams: Tournament["teams"];
};

export const buildTournamentGroupView = (tournament: Tournament | null | undefined): TournamentGroupView[] => {
  if (!tournament || tournament.format !== "group_knockout") return [];

  const groupTeamIds = new Map<string, Set<string>>();
  tournament.matches.forEach((match) => {
    if (match.matchType !== "league") return;
    const label = (match.roundLabel || "").trim();
    if (!/^Group\s/i.test(label)) return;

    if (!groupTeamIds.has(label)) {
      groupTeamIds.set(label, new Set<string>());
    }

    if (match.teamAId) groupTeamIds.get(label)?.add(match.teamAId);
    if (match.teamBId) groupTeamIds.get(label)?.add(match.teamBId);
  });

  const teamsById = new Map(tournament.teams.map((team) => [team._id, team]));
  return [...groupTeamIds.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, teamIds]) => ({
      label,
      teams: [...teamIds]
        .map((teamId) => teamsById.get(teamId))
        .filter((team): team is Tournament["teams"][number] => Boolean(team))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
};
