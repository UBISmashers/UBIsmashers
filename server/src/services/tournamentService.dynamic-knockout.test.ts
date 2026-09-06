import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Tournament } from "../models/Tournament";
import {
  buildGroupKnockoutMatches,
  buildRoundRobinKnockoutLeagueMatches,
  buildRoundRobinKnockoutMatches,
  generateBracket,
  getDynamicKnockoutConfig,
  reconcileRoundRobinKnockoutState,
} from "./tournamentService";

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

describe("round robin + knockout fixed top-four playoff", () => {
  it.each([6, 8, 10, 16])("creates league fixtures only for %i teams", (teamCount) => {
    const result = buildRoundRobinKnockoutLeagueMatches(makeTeams(teamCount) as any);

    expect(result.matches).toHaveLength((teamCount * (teamCount - 1)) / 2);
    expect(result.matches.every((match) => match.matchType === "league" && match.teamAId && match.teamBId)).toBe(true);
  });

  it("creates only the fixed top-four playoff after league completion", () => {
    const teams = makeTeams(6);
    const standings = teams.map((team, index) => ({
      teamId: team._id,
      points: 12 - index,
      wins: 6 - index,
      pointsFor: 20 - index,
      pointsAgainst: index,
    }));
    const result = buildRoundRobinKnockoutMatches(standings as any, 5);
    const final = result.matches.find((match) => match.matchId === "RRKO-FINAL");

    expect(result.matches).toHaveLength(3);
    expect(result.matches.map((match) => match.roundLabel)).toEqual(["Semi Final 1", "Semi Final 2", "Final"]);
    expect(result.matches[0].teamAId).toBe("team-1");
    expect(result.matches[0].teamBId).toBe("team-4");
    expect(result.matches[1].teamAId).toBe("team-2");
    expect(result.matches[1].teamBId).toBe("team-3");
    expect(final?.previousMatchAId).toBe("RRKO-SF1");
    expect(final?.previousMatchBId).toBe("RRKO-SF2");
  });

  it("does not crash or create a playoff while saving the final league score", () => {
    const teams = makeTeams(4);
    const league = buildRoundRobinKnockoutLeagueMatches(teams as any);
    league.matches.forEach((match, index) => {
      match.scoreA = 21;
      match.scoreB = 10 + index;
      match.winnerTeamId = match.teamAId;
      match.isCompleted = true;
    });
    const tournament = {
      format: "round_robin_knockout",
      teams,
      matches: league.matches,
      championTeamId: null,
      finalScore: null,
      status: "ongoing",
    } as any;

    expect(() => reconcileRoundRobinKnockoutState(tournament)).not.toThrow();
    expect(tournament.matches).toHaveLength(6);
    expect(tournament.matches.every((match: any) => match.matchType === "league")).toBe(true);
    expect(tournament.status).toBe("ongoing");
    expect(tournament.championTeamId).toBeNull();
  });

  it("does not fall through to the generic quarter-final bracket during RRKO league generation", async () => {
    const teams = Array.from({ length: 8 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(),
      name: `Team ${index + 1}`,
      players: [`P${index + 1}A`, `P${index + 1}B`],
    }));
    const tournament = new Tournament({
      name: "RRKO regression",
      date: new Date(),
      location: "Court A",
      type: "doubles",
      format: "round_robin_knockout",
      teams,
    });
    const findById = vi.spyOn(Tournament, "findById").mockResolvedValue(tournament as any);
    const save = vi.spyOn(tournament, "save").mockResolvedValue(tournament as any);

    try {
      const result = await generateBracket(tournament._id.toString());

      expect("error" in result).toBe(false);
      expect(tournament.matches).toHaveLength(28);
      expect(tournament.matches.every((match) => match.matchType === "league")).toBe(true);
      expect(tournament.matches.some((match) => /quarter|semi|final/i.test(match.roundLabel))).toBe(false);
      expect(save).toHaveBeenCalledOnce();
    } finally {
      findById.mockRestore();
      save.mockRestore();
    }
  });
});
