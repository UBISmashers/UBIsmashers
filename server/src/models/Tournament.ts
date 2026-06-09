import mongoose, { Document, Schema } from "mongoose";

export type TournamentType = "singles" | "doubles";
export type TournamentStatus = "upcoming" | "ongoing" | "completed";
export type TournamentFormat = "knockout" | "round_robin" | "group_knockout";
export type GroupDistributionMode = "random" | "balanced" | "manual";

export interface ITournamentTeam {
  _id: mongoose.Types.ObjectId;
  name: string;
  players: string[];
}

export interface ITournamentGroup {
  _id: mongoose.Types.ObjectId;
  groupName: string;
  groupOrder: number;
  teamIds: mongoose.Types.ObjectId[];
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITournamentAuditEntry {
  _id: mongoose.Types.ObjectId;
  action: string;
  userId: string | null;
  createdAt: Date;
}

export type TournamentRegistrationStatus = "pending" | "accepted" | "rejected";
export type RegistrationGender = "male" | "female" | "other";

export interface ITournamentRegistrationMember {
  name: string;
  mobileNumber: string;
  gender: RegistrationGender;
  isAvailable: boolean;
}

export interface ITournamentRegistration {
  _id: mongoose.Types.ObjectId;
  teamName: string;
  teamLeadName: string;
  contactMobileNumber: string | null;
  members: ITournamentRegistrationMember[];
  status: TournamentRegistrationStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface ITournamentRegistryMember {
  name: string;
  mobileNumber: string;
  gender: RegistrationGender;
}

export interface ITournamentTeamRegistry {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId | null;
  teamName: string;
  teamLeadName: string;
  members: ITournamentRegistryMember[];
  entryFeePaid: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TournamentIncomeType = "entry_registration" | "donation";

export interface ITournamentExpenseEntry {
  _id: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  note: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITournamentIncomeEntry {
  _id: mongoose.Types.ObjectId;
  type: TournamentIncomeType;
  title: string;
  amount: number;
  note: string | null;
  date: Date;
  teamRegistryId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITournamentMatch {
  matchId: string;
  roundNumber: number;
  roundLabel: string;
  matchNumber: number;
  matchType: "league" | "semifinal" | "final" | "friendly" | "practice";
  isManual: boolean;
  manualOverrideTeams: boolean;
  scheduledAt: Date | null;
  scheduledEndAt: Date | null;
  court: string | null;
  court_id?: string | null;
  court_name?: string | null;
  teamAId: mongoose.Types.ObjectId | null;
  teamBId: mongoose.Types.ObjectId | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: mongoose.Types.ObjectId | null;
  isCompleted: boolean;
}

export interface ITournament extends Document {
  name: string;
  date: Date;
  time: string;
  location: string;
  type: TournamentType;
  format: TournamentFormat;
  groupCount: number | null;
  groupDistributionMode: GroupDistributionMode;
  teamsQualifyingPerGroup: number;
  enableManualGroupEditing: boolean;
  entryFee?: number;
  status: TournamentStatus;
  isVisibleToMembers: boolean;
  allowTeamRegistration: boolean;
  registrationDeadline: Date | null;
  teams: ITournamentTeam[];
  registrations: ITournamentRegistration[];
  teamRegistry: ITournamentTeamRegistry[];
  tournamentGroups: ITournamentGroup[];
  auditHistory: ITournamentAuditEntry[];
  tournamentExpenses: ITournamentExpenseEntry[];
  tournamentIncomes: ITournamentIncomeEntry[];
  matches: ITournamentMatch[];
  totalRounds: number;
  championTeamId: mongoose.Types.ObjectId | null;
  finalScore: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITournamentTeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    players: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { _id: true }
);

const tournamentGroupSchema = new Schema<ITournamentGroup>(
  {
    groupName: { type: String, required: true, trim: true },
    groupOrder: { type: Number, required: true, min: 0 },
    teamIds: { type: [Schema.Types.ObjectId], default: [] },
    isLocked: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const tournamentAuditSchema = new Schema<ITournamentAuditEntry>(
  {
    action: { type: String, required: true, trim: true },
    userId: { type: String, trim: true, default: null },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const registrationMemberSchema = new Schema<ITournamentRegistrationMember>(
  {
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, trim: true, default: "" },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    isAvailable: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const registrationSchema = new Schema<ITournamentRegistration>(
  {
    teamName: { type: String, required: true, trim: true },
    teamLeadName: { type: String, required: true, trim: true },
    contactMobileNumber: { type: String, trim: true, default: null },
    members: { type: [registrationMemberSchema], required: true, default: [] },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    reviewNote: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const registryMemberSchema = new Schema<ITournamentRegistryMember>(
  {
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, trim: true, default: "" },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
  },
  { _id: false }
);

const teamRegistrySchema = new Schema<ITournamentTeamRegistry>(
  {
    teamId: { type: Schema.Types.ObjectId, default: null },
    teamName: { type: String, required: true, trim: true },
    teamLeadName: { type: String, required: true, trim: true },
    members: { type: [registryMemberSchema], required: true, default: [] },
    entryFeePaid: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true, timestamps: true }
);

const tournamentExpenseEntrySchema = new Schema<ITournamentExpenseEntry>(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, default: null },
    date: { type: Date, required: true },
  },
  { _id: true, timestamps: true }
);

const tournamentIncomeEntrySchema = new Schema<ITournamentIncomeEntry>(
  {
    type: { type: String, enum: ["entry_registration", "donation"], required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    note: { type: String, trim: true, default: null },
    date: { type: Date, required: true },
    teamRegistryId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: true, timestamps: true }
);

const matchSchema = new Schema<ITournamentMatch>(
  {
    matchId: { type: String, required: true },
    roundNumber: { type: Number, required: true },
    roundLabel: { type: String, required: true },
    matchNumber: { type: Number, required: true },
    matchType: {
      type: String,
      enum: ["league", "semifinal", "final", "friendly", "practice"],
      default: "league",
    },
    isManual: { type: Boolean, default: false },
    manualOverrideTeams: { type: Boolean, default: false },
    scheduledAt: { type: Date, default: null },
    scheduledEndAt: { type: Date, default: null },
    court: { type: String, trim: true, default: null },
    court_id: { type: String, trim: true, default: null },
    court_name: { type: String, trim: true, default: null },
    teamAId: { type: Schema.Types.ObjectId, default: null },
    teamBId: { type: Schema.Types.ObjectId, default: null },
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
    winnerTeamId: { type: Schema.Types.ObjectId, default: null },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const tournamentSchema = new Schema<ITournament>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["singles", "doubles"],
      required: true,
    },
    format: {
      type: String,
      enum: ["knockout", "round_robin", "group_knockout"],
      default: "knockout",
    },
    groupCount: {
      type: Number,
      min: 2,
      max: 16,
      default: null,
    },
    groupDistributionMode: {
      type: String,
      enum: ["random", "balanced", "manual"],
      default: "random",
    },
    teamsQualifyingPerGroup: {
      type: Number,
      min: 1,
      max: 8,
      default: 2,
    },
    enableManualGroupEditing: {
      type: Boolean,
      default: false,
    },
    entryFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    isVisibleToMembers: {
      type: Boolean,
      default: true,
    },
    allowTeamRegistration: {
      type: Boolean,
      default: false,
    },
    registrationDeadline: {
      type: Date,
      default: null,
    },
    teams: {
      type: [teamSchema],
      default: [],
    },
    registrations: {
      type: [registrationSchema],
      default: [],
    },
    teamRegistry: {
      type: [teamRegistrySchema],
      default: [],
    },
    tournamentGroups: {
      type: [tournamentGroupSchema],
      default: [],
    },
    auditHistory: {
      type: [tournamentAuditSchema],
      default: [],
    },
    tournamentExpenses: {
      type: [tournamentExpenseEntrySchema],
      default: [],
    },
    tournamentIncomes: {
      type: [tournamentIncomeEntrySchema],
      default: [],
    },
    matches: {
      type: [matchSchema],
      default: [],
    },
    totalRounds: {
      type: Number,
      default: 0,
    },
    championTeamId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    finalScore: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tournamentSchema.index({ date: -1 });
tournamentSchema.index({ status: 1 });

export const Tournament = mongoose.model<ITournament>("Tournament", tournamentSchema);
