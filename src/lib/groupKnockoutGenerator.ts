import type { TournamentMatch } from "@/types/tournament";

export type QualifiedTeam = {
  teamId: string;
  teamName: string;
  rank: number;
  groupName: string;
};

export type QualifiedGroup = {
  groupName: string;
  qualified: QualifiedTeam[];
};

const nextPowerOfTwo = (n: number) => {
  let power = 1;

  while (power < n) {
    power *= 2;
  }

  return power;
};

const getRoundLabel = (teamCount: number) => {
  switch (teamCount) {
    case 2:
      return "Final";

    case 4:
      return "Semi Final";

    case 8:
      return "Quarter Final";

    case 16:
      return "Round of 16";

    case 32:
      return "Round of 32";

    case 64:
      return "Round of 64";

    default:
      return `Round of ${teamCount}`;
  }
};

export function generateGroupKnockoutBracket(
  groups: QualifiedGroup[]
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];

  const qualifiedTeams = groups.flatMap((g) => g.qualified);

  if (qualifiedTeams.length < 2) {
    return matches;
  }

  const totalQualified = qualifiedTeams.length;

  const bracketSize = nextPowerOfTwo(totalQualified);

  if (bracketSize !== totalQualified) {
    throw new Error(
      `Qualified team count must be power of 2. Current: ${totalQualified}`
    );
  }

  const firstRoundTeams: QualifiedTeam[] = [];

  /*
   Group A:
   1,2,3,4

   Group B:
   1,2,3,4

   Creates:
   A1 vs B4
   A2 vs B3
   B1 vs A4
   B2 vs A3
  */

  if (groups.length === 2) {
    const groupA = groups[0].qualified;
    const groupB = groups[1].qualified;

    for (let i = 0; i < groupA.length; i++) {
      firstRoundTeams.push(groupA[i]);
      firstRoundTeams.push(
        groupB[groupB.length - 1 - i]
      );
    }
  } else {
    /*
      Generic seeding

      Group winners first
      Then runners-up
      Then 3rd places
      etc
    */

    const maxRank = Math.max(
      ...groups.map((g) => g.qualified.length)
    );

    for (let rank = 0; rank < maxRank; rank++) {
      groups.forEach((group) => {
        if (group.qualified[rank]) {
          firstRoundTeams.push(group.qualified[rank]);
        }
      });
    }
  }

  const firstRoundLabel = getRoundLabel(
    bracketSize
  );

  let matchNumber = 1;

  const currentRoundMatchIds: string[] = [];

  for (let i = 0; i < firstRoundTeams.length; i += 2) {
    const teamA = firstRoundTeams[i];
    const teamB = firstRoundTeams[i + 1];

    const matchId = `match-${matchNumber}`;

    currentRoundMatchIds.push(matchId);

    matches.push({
      matchId,
      matchNumber,
      roundNumber: 1,
      roundLabel: firstRoundLabel,

      teamAId: teamA.teamId,
      teamBId: teamB.teamId,

      scoreA: null,
      scoreB: null,

      winnerTeamId: null,
      isCompleted: false,
      scheduledAt: null,
    } as TournamentMatch);

    matchNumber++;
  }

  let roundSize = bracketSize / 2;
  let roundNumber = 2;

  while (roundSize >= 1) {
    const roundLabel = getRoundLabel(roundSize);

    for (let i = 0; i < roundSize; i++) {
      matches.push({
        matchId: `match-${matchNumber}`,
        matchNumber,

        roundNumber,
        roundLabel,

        teamAId: null,
        teamBId: null,

        scoreA: null,
        scoreB: null,

        winnerTeamId: null,
        isCompleted: false,
        scheduledAt: null,
      } as TournamentMatch);

      matchNumber++;
    }

    roundSize /= 2;
    roundNumber++;
  }

  return matches;
}