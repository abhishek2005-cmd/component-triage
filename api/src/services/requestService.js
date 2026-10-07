import { createHash } from 'node:crypto';
import ComponentRequest from '../models/ComponentRequest.js';

export async function createRequest({ text, idempotencyKey }) {
  const payloadHash = createHash('sha256').update(text).digest('hex');

  try {
    const request = await ComponentRequest.create({
      text,
      idempotencyKey,
      payloadHash,
    });
    return { request, created: true };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  const existingRequest = await ComponentRequest.findOne({ idempotencyKey })
    .select('+payloadHash');

  if (!existingRequest) {
    throw new Error('Unable to resolve duplicate idempotency key');
  }

  if (existingRequest.payloadHash !== payloadHash) {
    const error = new Error('Idempotency key was already used with different text');
    error.status = 409;
    throw error;
  }

  return { request: existingRequest, created: false };
}