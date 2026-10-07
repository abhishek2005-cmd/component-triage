import { createRequest as saveRequest } from '../services/requestService.js';
import ComponentRequest from '../models/ComponentRequest.js';

const PUBLIC_REQUEST_FIELDS = [
  'text',
  'status',
  'analysis',
  'draftReply',
  'analysisAttempts',
  'analysisCompletedAt',
  'draftEditedAt',
  'approvedAt',
  'rejectedAt',
  'createdAt',
  'updatedAt',
].join(' ');

function serializeRequest(request) {
  const { _id, ...fields } = request;
  return { id: String(_id), ...fields };
}

export async function listRequests(_request, response, next) {
  try {
    const requests = await ComponentRequest.find()
      .select(PUBLIC_REQUEST_FIELDS)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    response.json({ requests: requests.map(serializeRequest) });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(request, response, next) {
  try {
    const savedRequest = await ComponentRequest.findById(request.params.id)
      .select(PUBLIC_REQUEST_FIELDS)
      .lean();
    if (!savedRequest) {
      return response.status(404).json({ error: 'Request not found' });
    }
    response.json(serializeRequest(savedRequest));
  } catch (error) {
    next(error);
  }
}

export async function createRequest(request, response, next) {
  const text = request.body?.text;

  if (typeof text !== 'string') {
    return response.status(400).json({ error: 'text must be a string' });
  }
  if (!text.trim()) {
    return response.status(400).json({ error: 'text must not be empty' });
  }
  if (text.length > 5000) {
    return response.status(400).json({ error: 'text must be 5000 characters or fewer' });
  }

  const idempotencyKey = request.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return response.status(400).json({ error: 'Idempotency-Key header is required' });
  }
  if (idempotencyKey.length > 200) {
    return response.status(400).json({ error: 'Idempotency-Key is too long' });
  }

  try {
    const { request: savedRequest, created } = await saveRequest({
      text: text.trim(),
      idempotencyKey,
    });
    const result = {
      id: savedRequest.id,
      text: savedRequest.text,
      status: savedRequest.status,
      createdAt: savedRequest.createdAt,
    };

    response.status(created ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
}