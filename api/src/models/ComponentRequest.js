import mongoose from 'mongoose';

export const REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  DRAFT_READY: 'draft_ready',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
});

const componentRequestSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      unique: true,
    },
    payloadHash: {
      type: String,
      required: true,
      select: false,
    },
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    draftReply: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: null,
    },
    draftEditedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    analysisAttempts: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    nextAnalysisAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    analysisLeaseToken: String,
    analysisLeaseUntil: Date,
    analysisCompletedAt: Date,
    lastAnalysisError: {
      type: String,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true },
);

componentRequestSchema.index({ status: 1, nextAnalysisAttemptAt: 1, analysisAttempts: 1 });
componentRequestSchema.index({ status: 1, analysisLeaseUntil: 1, analysisAttempts: 1 });

const ComponentRequest = mongoose.models.ComponentRequest
  || mongoose.model('ComponentRequest', componentRequestSchema);

export default ComponentRequest;