import mongoose, { type InferSchemaType, Schema, type Types } from "mongoose";

const kitSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    jobDescription: {
      type: String,
      required: true,
      trim: true,
    },

    companyUrl: {
      type: String,
      required: true,
      trim: true,
    },

    daysAvailable: {
      type: Number,
      required: true,
      min: 1,
      max: 60,
    },

    status: {
      type: String,
      required: true,
      enum: ["draft", "generating", "ready", "failed"],
      default: "draft",
    },

    data: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

export type KitDocument =
  InferSchemaType<typeof kitSchema> & {
    ownerId: Types.ObjectId;
  };

export const Kit =
  mongoose.models.Kit ?? mongoose.model("Kit", kitSchema);