import mongoose, { Document, Schema } from "mongoose";

export type TournamentType = "singles" | "doubles";
export type TournamentStatus = "upcoming" | "ongoing" | "completed";

export interface ITournamentTeam {
  _id: mongoose.Types.ObjectId;
  name: string;
  players: string[];
}

export interface ITournamentMatch {
  matchId: string;
  roundNumber: number;
  roundLabel: string;
  matchNumber: number;
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
  location: string;
  type: TournamentType;
  entryFee?: number;
  status: TournamentStatus;
  isVisibleToMembers: boolean;
  teams: ITournamentTeam[];
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

const matchSchema = new Schema<ITournamentMatch>(
  {
    matchId: { type: String, required: true },
    roundNumber: { type: Number, required: true },
    roundLabel: { type: String, required: true },
    matchNumber: { type: Number, required: true },
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
    teams: {
      type: [teamSchema],
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
