import mongoose, { Document, Schema } from "mongoose";

export interface IAppSetting extends Document {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const appSettingSchema = new Schema<IAppSetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AppSetting = mongoose.model<IAppSetting>("AppSetting", appSettingSchema);
