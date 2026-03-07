export type TournamentType = "singles" | "doubles";
export type TournamentStatus = "upcoming" | "ongoing" | "completed";
export type TournamentFormat = "knockout" | "round_robin" | "group_knockout";
export type TournamentMatchType = "league" | "semifinal" | "final" | "friendly" | "practice";
export type TournamentRegistrationStatus = "pending" | "accepted" | "rejected";
export type RegistrationGender = "male" | "female" | "other";

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
  matchType: TournamentMatchType;
  isManual: boolean;
  manualOverrideTeams: boolean;
  scheduledAt: string | null;
  court: string | null;
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

export interface TournamentRegistrationMember {
  name: string;
  mobileNumber: string;
  gender: RegistrationGender;
  isAvailable: boolean;
}

export interface TournamentRegistration {
  _id: string;
  teamName: string;
  teamLeadName: string;
  members: TournamentRegistrationMember[];
  status: TournamentRegistrationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TournamentRegistryMember {
  name: string;
  mobileNumber: string;
  gender: RegistrationGender;
}

export interface TournamentTeamRegistryEntry {
  _id: string;
  teamId: string | null;
  teamName: string;
  teamLeadName: string;
  members: TournamentRegistryMember[];
  entryFeePaid: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tournament {
  _id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  type: TournamentType;
  format: TournamentFormat;
  entryFee: number;
  status: TournamentStatus;
  isVisibleToMembers: boolean;
  allowTeamRegistration: boolean;
  registrationDeadline: string | null;
  teams: TournamentTeam[];
  registrations: TournamentRegistration[];
  teamRegistry: TournamentTeamRegistryEntry[];
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
  tournaments: Tournament[];
  history: TournamentHistoryItem[];
}
