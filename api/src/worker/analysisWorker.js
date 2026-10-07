import { REQUEST_STATUS } from '../models/ComponentRequest.js';
import { analysisWorkerConfig } from '../config/analysisWorkerConfig.js';
import {
  claimNextAnalysisRequest,
  completeAnalysisAttempt,
  recordAnalysisFailure,
} from '../services/statusTransitionService.js';

const analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8000';
let pollTimer;
let pollInProgress = false;

async function processClaim({ request, leaseToken }) {
  try {
    const response = await fetch(`${analysisServiceUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_text: request.text }),
      signal: AbortSignal.timeout(analysisWorkerConfig.requestTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Analysis service returned ${response.status}`);
    }

    const analysis = await response.json();
    if (typeof analysis.needsHumanReview !== 'boolean') {
      throw new Error('Analysis service returned an invalid review status');
    }
    const completed = await completeAnalysisAttempt(
      request.id,
      leaseToken,
      analysis,
    );
    if (!completed) {
      console.warn(`Analysis result ignored after lease expired for ${request.id}`);
    }
  } catch (error) {
    try {
      const failedAttempt = await recordAnalysisFailure(
        request.id,
        leaseToken,
        error.message,
        analysisWorkerConfig,
      );
      if (failedAttempt) {
        console.warn(
          `Analysis attempt ${failedAttempt.analysisAttempts} failed for ${request.id}; status is ${failedAttempt.status}`,
        );
      }
    } catch (statusError) {
      console.error(`Unable to record analysis failure for ${request.id}:`, statusError.message);
    }
  }
}

async function pollAnalysisQueue() {
  if (pollInProgress) {
    return;
  }

  pollInProgress = true;
  try {
    let claim;
    do {
      claim = await claimNextAnalysisRequest(analysisWorkerConfig);
      if (claim) {
        await processClaim(claim);
      }
    } while (claim);
  } catch (error) {
    console.error('Analysis queue polling failed:', error.message);
  } finally {
    pollInProgress = false;
  }
}

export function startAnalysisWorker() {
  if (pollTimer) {
    return;
  }

  void pollAnalysisQueue();
  pollTimer = setInterval(pollAnalysisQueue, analysisWorkerConfig.pollIntervalMs);
}

export function stopAnalysisWorker() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}