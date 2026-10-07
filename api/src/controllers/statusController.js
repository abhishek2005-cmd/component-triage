import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../models/ComponentRequest.js';
import {
  getStatusWorkflow,
  transitionRequestStatus,
  updateRequestDraft as saveRequestDraft,
} from '../services/statusTransitionService.js';

export function listStatuses(_request, response) {
  response.json(getStatusWorkflow());
}

export async function updateRequestStatus(request, response, next) {
  const targetStatus = request.body?.status;
  if (typeof targetStatus !== 'string' || !targetStatus.trim()) {
    return response.status(400).json({ error: 'status must be a non-empty string' });
  }
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const updatedRequest = await transitionRequestStatus(
      request.params.id,
      targetStatus.trim(),
      'user',
    );
    response.json({
      id: updatedRequest.id,
      status: updatedRequest.status,
      updatedAt: updatedRequest.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(request, response, next) {
  try {
    const approvedRequest = await transitionRequestStatus(
      request.params.id,
      REQUEST_STATUS.APPROVED,
      'user',
      { approvedAt: new Date() },
    );
    response.json({
      id: approvedRequest.id,
      status: approvedRequest.status,
      approvedAt: approvedRequest.approvedAt,
      updatedAt: approvedRequest.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function editRequestDraft(request, response, next) {
  try {
    const updatedRequest = await saveRequestDraft(
      request.params.id,
      request.body?.draftReply,
    );
    response.json({
      id: updatedRequest.id,
      status: updatedRequest.status,
      draftReply: updatedRequest.draftReply,
      draftEditedAt: updatedRequest.draftEditedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(request, response, next) {
  try {
    const rejectedRequest = await transitionRequestStatus(
      request.params.id,
      REQUEST_STATUS.REJECTED,
      'user',
      { rejectedAt: new Date() },
    );
    response.json({
      id: rejectedRequest.id,
      status: rejectedRequest.status,
      rejectedAt: rejectedRequest.rejectedAt,
      updatedAt: rejectedRequest.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}