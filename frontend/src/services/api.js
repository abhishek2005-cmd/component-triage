export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiRoot = `${API_URL.replace(/\/$/, '')}/api`;

async function apiRequest(path, options = {}) {
	const response = await fetch(`${apiRoot}${path}`, {
		...options,
		headers: {
			Accept: 'application/json',
			...options.headers,
		},
	});
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload.error || `Request failed (${response.status})`);
	}

	return payload;
}

export async function fetchRequests() {
	const result = await apiRequest('/requests');
	return result.requests;
}

export async function fetchRequest(id) {
	return apiRequest(`/requests/${encodeURIComponent(id)}`);
}

export async function fetchStatusWorkflow() {
	return apiRequest('/statuses');
}

export async function fetchCategories() {
	const result = await apiRequest('/categories');
	return result.categories;
}

export async function submitRequest(text) {
	const idempotencyKey = globalThis.crypto?.randomUUID?.()
		|| `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return apiRequest('/requests', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': idempotencyKey,
		},
		body: JSON.stringify({ text }),
	});
}

export async function updateDraft(id, draftReply) {
	return apiRequest(`/requests/${encodeURIComponent(id)}/draft`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ draftReply }),
	});
}

export async function runReviewAction(id, action) {
	return apiRequest(`/requests/${encodeURIComponent(id)}/${action.endpoint}`, {
		method: action.method,
	});
}