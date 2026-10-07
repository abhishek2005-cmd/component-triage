import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import ComponentRequest from '../api/src/models/ComponentRequest.js';
import app from '../api/src/app.js';
import { createRequest } from '../api/src/services/requestService.js';
import {
  claimNextAnalysisRequest,
  recordAnalysisFailure,
  transitionRequestStatus,
} from '../api/src/services/statusTransitionService.js';

const requestId = '64f000000000000000000001';
let server;
let apiUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  apiUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function replaceModelMethod(method, replacement) {
  const original = ComponentRequest[method];
  ComponentRequest[method] = replacement;
  return () => {
    ComponentRequest[method] = original;
  };
}

async function submit(text, idempotencyKey = 'test-key') {
  return fetch(`${apiUrl}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ text }),
  });
}

test('API rejects an empty request before persistence', async () => {
  let createCalls = 0;
  const restore = replaceModelMethod('create', async () => {
    createCalls += 1;
    throw new Error('Invalid request reached persistence');
  });

  try {
    const response = await submit('   ');
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'text must not be empty' });
    assert.equal(createCalls, 0);
  } finally {
    restore();
  }
});

test('API rejects a request longer than 5000 characters before persistence', async () => {
  let createCalls = 0;
  const restore = replaceModelMethod('create', async () => {
    createCalls += 1;
    throw new Error('Invalid request reached persistence');
  });

  try {
    const response = await submit('x'.repeat(5001), 'too-long-key');
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'text must be 5000 characters or fewer',
    });
    assert.equal(createCalls, 0);
  } finally {
    restore();
  }
});

test('status service rejects an invalid transition', async () => {
  const restoreFind = replaceModelMethod('findById', async () => ({ status: 'pending' }));
  let updateCalls = 0;
  const restoreUpdate = replaceModelMethod('findOneAndUpdate', async () => {
    updateCalls += 1;
    return null;
  });

  try {
    await assert.rejects(
      transitionRequestStatus(requestId, 'approved', 'user'),
      (error) => error.status === 409 && /Cannot transition/.test(error.message),
    );
    assert.equal(updateCalls, 0);
  } finally {
    restoreFind();
    restoreUpdate();
  }
});

test('duplicate submission returns one stored request for the same key and text', async () => {
  const records = new Map();
  let nextId = 1;
  const restoreCreate = replaceModelMethod('create', async (values) => {
    if (records.has(values.idempotencyKey)) {
      const duplicateError = new Error('duplicate key');
      duplicateError.code = 11000;
      throw duplicateError;
    }

    const record = {
      ...values,
      _id: `request-${nextId}`,
      id: `request-${nextId}`,
      status: 'pending',
      createdAt: new Date(),
    };
    nextId += 1;
    records.set(values.idempotencyKey, record);
    return record;
  });
  const restoreFind = replaceModelMethod('findOne', (filter) => ({
    select: async () => records.get(filter.idempotencyKey),
  }));

  try {
    const first = await createRequest({ text: 'Need 10 kOhm resistors', idempotencyKey: 'same-key' });
    const retry = await createRequest({ text: 'Need 10 kOhm resistors', idempotencyKey: 'same-key' });

    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.equal(retry.request.id, first.request.id);
    await assert.rejects(
      createRequest({ text: 'Different payload', idempotencyKey: 'same-key' }),
      (error) => error.status === 409,
    );
    assert.equal(records.size, 1);
  } finally {
    restoreCreate();
    restoreFind();
  }
});

test('analysis failure persists a retry time and returns the request to the claimable queue', async () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const config = {
    maxAttempts: 4,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 8000,
    leaseDurationMs: 60000,
  };
  let failureUpdate;
  let failed;
  const restoreFind = replaceModelMethod('findOne', () => ({
    select: async () => ({ analysisAttempts: 1 }),
  }));
  const restoreUpdate = replaceModelMethod('findOneAndUpdate', async (_filter, update) => {
    failureUpdate = update;
    return {
      status: update.$set.status,
      nextAnalysisAttemptAt: update.$set.nextAnalysisAttemptAt,
      analysisAttempts: 1,
    };
  });

  try {
    failed = await recordAnalysisFailure(
      requestId,
      'lease-1',
      'analysis service unavailable',
      config,
      now,
    );

    assert.equal(failed.status, 'pending');
    assert.equal(failed.nextAnalysisAttemptAt.getTime(), now.getTime() + 1000);
    assert.equal(failureUpdate.$set.lastAnalysisError, 'analysis service unavailable');
  } finally {
    restoreFind();
    restoreUpdate();
  }

  let claimFilter;
  const restoreMany = replaceModelMethod('updateMany', async () => ({ acknowledged: true }));
  const restoreClaim = replaceModelMethod('findOneAndUpdate', async (filter) => {
    claimFilter = filter;
    return null;
  });

  try {
    await claimNextAnalysisRequest(config, failed.nextAnalysisAttemptAt);
    const pendingBranch = claimFilter.$and[1].$or.find((branch) => branch.status === 'pending');
    assert.ok(pendingBranch);
    assert.deepEqual(pendingBranch.$or[0].nextAnalysisAttemptAt, {
      $lte: failed.nextAnalysisAttemptAt,
    });
  } finally {
    restoreMany();
    restoreClaim();
  }
});
