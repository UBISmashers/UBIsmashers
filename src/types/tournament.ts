export type TournamentType = "singles" | "doubles";
export type TournamentStatus = "upcoming" | "ongoing" | "completed";

export interface TournamentTeam {
  _id: string;
  name: string;
  players: string[];
}

export interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  roundLabel: string;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  isCompleted: boolean;
  teamA: TournamentTeam | null;
  teamB: TournamentTeam | null;
  winnerTeam: TournamentTeam | null;
}

export interface Tournament {
  _id: string;
  name: string;
  date: string;
  location: string;
  type: TournamentType;
  entryFee: number;
  status: TournamentStatus;
  isVisibleToMembers: boolean;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  totalRounds: number;
  championTeamId: string | null;
  finalScore: string | null;
  championTeam: TournamentTeam | null;
}

export interface TournamentHistoryItem {
  _id: string;
  name: string;
  date: string;
  championTeam: TournamentTeam | null;
  finalScore: string | null;
}

export interface PublicTournamentPayload {
  isEnabled: boolean;
  currentTournament: Tournament | null;
  history: TournamentHistoryItem[];
}
