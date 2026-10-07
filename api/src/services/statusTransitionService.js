import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import ComponentRequest, { REQUEST_STATUS } from '../models/ComponentRequest.js';

const STATUS_TRANSITIONS = Object.freeze({
  [REQUEST_STATUS.PENDING]: Object.freeze([REQUEST_STATUS.ANALYZING]),
  [REQUEST_STATUS.ANALYZING]: Object.freeze([
    REQUEST_STATUS.PENDING,
    REQUEST_STATUS.DRAFT_READY,
    REQUEST_STATUS.NEEDS_REVIEW,
  ]),
  [REQUEST_STATUS.DRAFT_READY]: Object.freeze([
    REQUEST_STATUS.APPROVED,
    REQUEST_STATUS.REJECTED,
    REQUEST_STATUS.NEEDS_REVIEW,
  ]),
  [REQUEST_STATUS.APPROVED]: Object.freeze([]),
  [REQUEST_STATUS.REJECTED]: Object.freeze([]),
  [REQUEST_STATUS.NEEDS_REVIEW]: Object.freeze([
    REQUEST_STATUS.APPROVED,
    REQUEST_STATUS.REJECTED,
  ]),
});

const STATUS_LABELS = Object.freeze({
  [REQUEST_STATUS.PENDING]: { label: 'Pending', tone: 'neutral' },
  [REQUEST_STATUS.ANALYZING]: { label: 'Analyzing', tone: 'progress' },
  [REQUEST_STATUS.DRAFT_READY]: { label: 'Draft ready', tone: 'attention' },
  [REQUEST_STATUS.APPROVED]: { label: 'Approved', tone: 'positive' },
  [REQUEST_STATUS.REJECTED]: { label: 'Rejected', tone: 'negative' },
  [REQUEST_STATUS.NEEDS_REVIEW]: { label: 'Needs review', tone: 'attention' },
});

const USER_TRANSITION_TARGETS = new Set([
  REQUEST_STATUS.APPROVED,
  REQUEST_STATUS.REJECTED,
]);
const EDITABLE_DRAFT_STATUSES = Object.freeze([
  REQUEST_STATUS.DRAFT_READY,
  REQUEST_STATUS.NEEDS_REVIEW,
]);

export function getStatusWorkflow() {
  return {
    statuses: Object.entries(STATUS_LABELS).map(([value, metadata]) => ({
      value,
      ...metadata,
    })),
    transitions: Object.fromEntries(
      Object.entries(STATUS_TRANSITIONS).map(([status, nextStatuses]) => [
        status,
        [...nextStatuses],
      ]),
    ),
    userTransitionTargets: [...USER_TRANSITION_TARGETS],
    editableDraftStatuses: [...EDITABLE_DRAFT_STATUSES],
    reviewActions: [
      {
        targetStatus: REQUEST_STATUS.APPROVED,
        label: 'Approve',
        endpoint: 'approve',
        method: 'POST',
      },
      {
        targetStatus: REQUEST_STATUS.REJECTED,
        label: 'Reject',
        endpoint: 'reject',
        method: 'POST',
      },
    ],
  };
}

export function isTransitionAllowed(fromStatus, toStatus) {
  return STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export async function transitionRequestStatus(
  requestId,
  targetStatus,
  actor = 'user',
  updates = {},
) {
  if (!Object.hasOwn(STATUS_TRANSITIONS, targetStatus)) {
    throw createStatusError(400, 'Unknown request status');
  }

  if (actor === 'user' && !USER_TRANSITION_TARGETS.has(targetStatus)) {
    throw createStatusError(403, 'This status can only be set by the system');
  }
  if (actor !== 'user' && actor !== 'system') {
    throw createStatusError(403, 'Invalid status transition actor');
  }
  if (!mongoose.isValidObjectId(requestId)) {
    throw createStatusError(400, 'Invalid request id');
  }

  const currentRequest = await ComponentRequest.findById(requestId);
  if (!currentRequest) {
    throw createStatusError(404, 'Request not found');
  }
  if (!isTransitionAllowed(currentRequest.status, targetStatus)) {
    throw createStatusError(
      409,
      `Cannot transition request from ${currentRequest.status} to ${targetStatus}`,
    );
  }

  const updatedRequest = await ComponentRequest.findOneAndUpdate(
    { _id: requestId, status: currentRequest.status },
    { $set: { ...updates, status: targetStatus } },
    { new: true, runValidators: true },
  );

  if (!updatedRequest) {
    throw createStatusError(409, 'Request status changed; reload and try again');
  }

  return updatedRequest;
}

export async function updateRequestDraft(requestId, draftReply) {
  if (!mongoose.isValidObjectId(requestId)) {
    throw createStatusError(400, 'Invalid request id');
  }

  if (typeof draftReply !== 'string' || !draftReply.trim()) {
    throw createStatusError(400, 'draftReply must be a non-empty string');
  }
  if (draftReply.length > 5000) {
    throw createStatusError(400, 'draftReply must be 5000 characters or fewer');
  }

  const now = new Date();
  const updatedRequest = await ComponentRequest.findOneAndUpdate(
    { _id: requestId, status: { $in: EDITABLE_DRAFT_STATUSES } },
    {
      $set: {
        draftReply: draftReply.trim(),
        draftEditedAt: now,
        'analysis.draftReply': draftReply.trim(),
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedRequest) {
    const existingRequest = await ComponentRequest.findById(requestId).select('status');
    if (!existingRequest) {
      throw createStatusError(404, 'Request not found');
    }
    throw createStatusError(409, `Draft cannot be edited while request is ${existingRequest.status}`);
  }

  return updatedRequest;
}

function createStatusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function claimNextAnalysisRequest(config, now = new Date()) {
  await ComponentRequest.updateMany(
    {
      status: REQUEST_STATUS.ANALYZING,
      analysisAttempts: { $gte: config.maxAttempts },
      analysisCompletedAt: { $exists: false },
      $or: [
        { analysisLeaseUntil: { $lte: now } },
        { analysisLeaseUntil: { $exists: false } },
      ],
    },
    {
      $set: {
        status: REQUEST_STATUS.NEEDS_REVIEW,
        nextAnalysisAttemptAt: null,
        lastAnalysisError: 'Analysis worker lease expired after maximum attempts',
      },
      $unset: { analysisLeaseToken: 1, analysisLeaseUntil: 1 },
    },
  );

  const leaseToken = randomUUID();
  return ComponentRequest.findOneAndUpdate(
    {
      analysisCompletedAt: { $exists: false },
      $and: [
        {
          $or: [
            { analysisAttempts: { $lt: config.maxAttempts } },
            { analysisAttempts: { $exists: false } },
          ],
        },
        {
          $or: [
            {
              status: REQUEST_STATUS.PENDING,
              $or: [
                { nextAnalysisAttemptAt: { $lte: now } },
                { nextAnalysisAttemptAt: { $exists: false } },
              ],
            },
            {
              status: REQUEST_STATUS.ANALYZING,
              $or: [
                { analysisLeaseUntil: { $lte: now } },
                { analysisLeaseUntil: { $exists: false } },
              ],
            },
          ],
        },
      ],
    },
    {
      $set: {
        status: REQUEST_STATUS.ANALYZING,
        analysisLeaseToken: leaseToken,
        analysisLeaseUntil: new Date(now.getTime() + config.leaseDurationMs),
        nextAnalysisAttemptAt: null,
        lastAnalysisError: null,
      },
      $inc: { analysisAttempts: 1 },
    },
    { new: true, sort: { createdAt: 1 } },
  ).then((request) => request && { request, leaseToken });
}

export async function completeAnalysisAttempt(
  requestId,
  leaseToken,
  analysis,
  now = new Date(),
) {
  if (typeof analysis?.needsHumanReview !== 'boolean') {
    throw new TypeError('Analysis result must include needsHumanReview');
  }

  const targetStatus = analysis.needsHumanReview
    ? REQUEST_STATUS.NEEDS_REVIEW
    : REQUEST_STATUS.DRAFT_READY;
  if (!isTransitionAllowed(REQUEST_STATUS.ANALYZING, targetStatus)) {
    throw createStatusError(409, 'Invalid analysis status transition');
  }

  return ComponentRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: REQUEST_STATUS.ANALYZING,
      analysisLeaseToken: leaseToken,
      analysisCompletedAt: { $exists: false },
    },
    {
      $set: {
        status: targetStatus,
        analysis,
        draftReply: analysis.draftReply,
        analysisCompletedAt: now,
        nextAnalysisAttemptAt: null,
        lastAnalysisError: null,
      },
      $unset: { analysisLeaseToken: 1, analysisLeaseUntil: 1 },
    },
    { new: true, runValidators: true },
  );
}

export async function recordAnalysisFailure(
  requestId,
  leaseToken,
  failureMessage,
  config,
  now = new Date(),
) {
  const request = await ComponentRequest.findOne({
    _id: requestId,
    status: REQUEST_STATUS.ANALYZING,
    analysisLeaseToken: leaseToken,
    analysisCompletedAt: { $exists: false },
  }).select('analysisAttempts');

  if (!request) {
    return null;
  }

  const exhausted = request.analysisAttempts >= config.maxAttempts;
  const targetStatus = exhausted
    ? REQUEST_STATUS.NEEDS_REVIEW
    : REQUEST_STATUS.PENDING;
  if (!isTransitionAllowed(REQUEST_STATUS.ANALYZING, targetStatus)) {
    throw createStatusError(409, 'Invalid analysis retry transition');
  }

  const exponent = Math.min(request.analysisAttempts - 1, 20);
  const retryDelayMs = Math.min(
    config.retryBaseDelayMs * (2 ** exponent),
    config.retryMaxDelayMs,
  );
  const updates = {
    $set: {
      status: targetStatus,
      lastAnalysisError: String(failureMessage).slice(0, 500),
      nextAnalysisAttemptAt: exhausted
        ? null
        : new Date(now.getTime() + retryDelayMs),
    },
    $unset: { analysisLeaseToken: 1, analysisLeaseUntil: 1 },
  };

  return ComponentRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: REQUEST_STATUS.ANALYZING,
      analysisLeaseToken: leaseToken,
      analysisCompletedAt: { $exists: false },
    },
    updates,
    { new: true, runValidators: true },
  );
}