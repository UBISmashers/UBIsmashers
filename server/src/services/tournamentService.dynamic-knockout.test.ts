import { describe, expect, it } from "vitest";
import { buildGroupKnockoutMatches, getDynamicKnockoutConfig } from "./tournamentService";

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
      { _id: "team-a1", name: "A1" },
      { _id: "team-a2", name: "A2" },
      { _id: "team-b1", name: "B1" },
      { _id: "team-b2", name: "B2" },
    ];

    const result = buildGroupKnockoutMatches(teams, {
      groupCount: 2,
      teamsQualifyingPerGroup: 2,
      tournamentGroups: [
        { _id: "g1", groupName: "Group A", groupOrder: 0, teamIds: ["team-a1", "team-a2"], isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { _id: "g2", groupName: "Group B", groupOrder: 1, teamIds: ["team-b1", "team-b2"], isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    });

    const knockoutMatches = result.matches.filter((match) => match.roundNumber >= 2);

    expect(knockoutMatches.length).toBeGreaterThan(0);
    expect(knockoutMatches.some((match) => match.previousMatchAId || match.previousMatchBId)).toBe(true);
    expect(knockoutMatches[0].roundLabel).toBe("Semi Final");
  });
});
