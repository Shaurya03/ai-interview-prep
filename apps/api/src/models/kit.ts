import mongoose, { Schema } from "mongoose";

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
      enum: ["draft", "generating", "ready", "failed"],
      default: "draft",
    },

    data: {
      type: Schema.Types.Mixed,
      default: null,
    },

    builderState: {
      type: Schema.Types.Mixed,
      default: {
        editedQuestions: {},
        editedFlashcards: {},
        editedCompanyBrief: {},
        questionOrder: [],
        deletedQuestionIds: [],
        deletedFlashcardIds: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Kit = mongoose.model("Kit", kitSchema);