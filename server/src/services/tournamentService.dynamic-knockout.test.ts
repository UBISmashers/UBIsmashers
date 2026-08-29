import { describe, expect, it } from "vitest";
import { buildGroupKnockoutMatches, getDynamicKnockoutConfig } from "./tournamentService";

const makeTeams = (count: number): Array<{ _id: string; name: string; players: string[] }> =>
  Array.from({ length: count }, (_, index) => ({
    _id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    players: [],
  }));

const makeGroups = (teamCount: number, groupCount: number): any =>
  Array.from({ length: groupCount }, (_, groupIndex) => ({
    _id: `group-${groupIndex + 1}`,
    groupName: `Group ${String.fromCharCode(65 + groupIndex)}`,
    groupOrder: groupIndex,
    teamIds: makeTeams(teamCount)
      .filter((_, teamIndex) => teamIndex % groupCount === groupIndex)
      .map((team) => team._id),
    isLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

describe("dynamic group knockout configuration", () => {
  it("creates a semifinal+final bracket for two groups with top-2 qualifiers", () => {
    const config = getDynamicKnockoutConfig(2, 2);

    expect(config.bracketSize).toBe(4);
    expect(config.rounds.map((round) => round.matchType)).toEqual(["semifinal", "final"]);
    expect(config.rounds.map((round) => round.roundLabel)).toEqual(["Semi Final", "Final"]);
  });

  it("creates quarterfinal+semifinal+final for two groups with top-4 qualifiers", () => {
    const config = getDynamicKnockoutConfig(2, 4);

    expect(config.bracketSize).toBe(8);
    expect(config.rounds.map((round) => round.matchType)).toEqual(["quarterfinal", "semifinal", "final"]);
  });

  it("creates round-of-16 for eight groups with top-2 qualifiers", () => {
    const config = getDynamicKnockoutConfig(8, 2);

    expect(config.bracketSize).toBe(16);
    expect(config.rounds[0].matchType).toBe("round_of_16");
    expect(config.rounds[0].roundLabel).toBe("Round of 16");
  });

  it("supports a larger bracket without hardcoded assumptions", () => {
    const config = getDynamicKnockoutConfig(4, 4);

    expect(config.bracketSize).toBe(16);
    expect(config.rounds.map((round) => round.matchType)).toEqual(["round_of_16", "quarterfinal", "semifinal", "final"]);
  });

  it("creates bracket dependencies for later knockout rounds", () => {
    const teams = [
      { _id: "team-a1", name: "A1", players: [] },
      { _id: "team-a2", name: "A2", players: [] },
      { _id: "team-b1", name: "B1", players: [] },
      { _id: "team-b2", name: "B2", players: [] },
    ] as any;

    const result = buildGroupKnockoutMatches(teams, {
      groupCount: 2,
      teamsQualifyingPerGroup: 2,
      tournamentGroups: ([
        { _id: "g1", groupName: "Group A", groupOrder: 0, teamIds: ["team-a1", "team-a2"], isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { _id: "g2", groupName: "Group B", groupOrder: 1, teamIds: ["team-b1", "team-b2"], isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ] as any),
    });

    const knockoutMatches = result.matches.filter((match) => match.matchType !== "league");

    expect(knockoutMatches.length).toBeGreaterThan(0);
    expect(knockoutMatches.some((match) => match.previousMatchAId || match.previousMatchBId)).toBe(true);
    expect(knockoutMatches[0].roundLabel).toBe("Semi Final");
  });

  it("creates every odd-sized group round-robin fixture with real teams", () => {
    const result = buildGroupKnockoutMatches(makeTeams(10) as any, {
      groupCount: 2,
      teamsQualifyingPerGroup: 4,
      tournamentGroups: makeGroups(10, 2) as any,
    });
    const leagueMatches = result.matches.filter((match) => match.matchType === "league");

    expect(leagueMatches).toHaveLength(20);
    expect(leagueMatches.every((match) => match.teamAId && match.teamBId)).toBe(true);
    expect(new Set(leagueMatches.map((match) => match.matchId)).size).toBe(20);
    expect(result.matches.filter((match) => match.matchType === "quarterfinal")).toHaveLength(4);
    expect(result.matches.filter((match) => match.matchType === "semifinal")).toHaveLength(2);
    expect(result.matches.filter((match) => match.matchType === "final")).toHaveLength(1);
  });

  it.each([
    [8, 2, 2, 12, "semifinal", 2],
    [16, 4, 2, 24, "quarterfinal", 4],
    [32, 8, 2, 48, "round_of_16", 8],
  ])("matches the expected fixture count for %i teams", (teamCount, groupCount, qualifiers, leagueCount, firstRoundType, firstRoundCount) => {
    const result = buildGroupKnockoutMatches(makeTeams(teamCount) as any, {
      groupCount,
      teamsQualifyingPerGroup: qualifiers,
      tournamentGroups: makeGroups(teamCount, groupCount) as any,
    });
    const leagueMatches = result.matches.filter((match) => match.matchType === "league");
    const knockoutMatches = result.matches.filter((match) => match.matchType !== "league");

    expect(leagueMatches).toHaveLength(leagueCount);
    expect(leagueMatches.every((match) => match.teamAId && match.teamBId)).toBe(true);
    expect(knockoutMatches.filter((match) => match.matchType === firstRoundType)).toHaveLength(firstRoundCount);
    expect(knockoutMatches.filter((match) => match.matchType === "final")).toHaveLength(1);
  });
});
