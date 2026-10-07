import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import PartCard, { partElementId } from '../components/PartCard.jsx';
import RequestComposer from '../components/RequestComposer.jsx';
import RequestDetail from '../components/RequestDetail.jsx';
import RequestList from '../components/RequestList.jsx';
import useTriageData from '../hooks/useTriageData.js';
import { runReviewAction, submitRequest, updateDraft } from '../services/api.js';

export default function HomePage() {
	const { requests, workflow, categories, loading, error, refresh } = useTriageData();
	const [selectedId, setSelectedId] = useState(null);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [categoryFilter, setCategoryFilter] = useState('');
	const [showComposer, setShowComposer] = useState(false);
	const [busyAction, setBusyAction] = useState(false);
	const [actionError, setActionError] = useState('');
	const [theme, setTheme] = useState(() => {
		const savedTheme = window.localStorage.getItem('triage-theme');
		return savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	});

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		window.localStorage.setItem('triage-theme', theme);
	}, [theme]);

	useEffect(() => {
		if (!selectedId && requests.length) setSelectedId(requests[0].id);
	}, [requests, selectedId]);

	const selectedRequest = requests.find((request) => request.id === selectedId);
	const filteredRequests = requests.filter((request) => {
		const searchable = [
			request.text,
			request.analysis?.category,
			...(request.analysis?.matches || []).map((match) => match.part.partNumber),
			...(request.analysis?.matches || []).map((match) => match.part.name),
		].filter(Boolean).join(' ').toLocaleLowerCase();
		const matchesSearch = searchable.includes(search.trim().toLocaleLowerCase());
		const matchesStatus = !statusFilter || request.status === statusFilter;
		const matchesCategory = !categoryFilter || request.analysis?.category === categoryFilter;
		return matchesSearch && matchesStatus && matchesCategory;
	});

	async function handleCreate(text) {
		const createdRequest = await submitRequest(text);
		setSelectedId(createdRequest.id);
		refresh();
	}

	async function handleReviewAction(action) {
		if (!selectedRequest) return;
		setBusyAction(true);
		setActionError('');
		try {
			await runReviewAction(selectedRequest.id, action);
			refresh();
		} catch (requestError) {
			setActionError(requestError.message);
		} finally {
			setBusyAction(false);
		}
	}

	async function handleSaveDraft(draftReply) {
		if (!selectedRequest) return;
		await updateDraft(selectedRequest.id, draftReply);
		refresh();
	}

	function focusPart(elementId) {
		const element = document.getElementById(elementId);
		element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		element?.focus({ preventScroll: true });
	}

	function toggleTheme() {
		setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
	}

	return (
		<div className="app-frame">
			<AppHeader
				theme={theme}
				onToggleTheme={toggleTheme}
				onNewRequest={() => setShowComposer(true)}
				requestCount={requests.length}
			/>
			<main className="workspace">
				<aside className="request-rail" aria-label="Request queue">
					<div className="rail-heading">
						<div>
							<p className="eyebrow">WORK QUEUE</p>
							<h1>Requests <span>{requests.length.toString().padStart(2, '0')}</span></h1>
						</div>
						<button className="refresh-button" type="button" onClick={refresh} aria-label="Refresh requests" title="Refresh requests">
							Refresh
						</button>
					</div>
					<label className="visually-hidden" htmlFor="request-search">Search requests</label>
					<input
						className="search-input"
						id="request-search"
						type="search"
						placeholder="Search request or part"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div className="filter-row">
						<label>
							<span className="visually-hidden">Filter by status</span>
							<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
								<option value="">All statuses</option>
								{workflow.statuses.map((status) => (
									<option key={status.value} value={status.value}>{status.label}</option>
								))}
							</select>
						</label>
						<label>
							<span className="visually-hidden">Filter by category</span>
							<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
								<option value="">All categories</option>
								{categories.map((category) => (
									<option key={category} value={category}>{category}</option>
								))}
							</select>
						</label>
					</div>
					{loading ? (
						<div className="loading-list" role="status" aria-live="polite">
							<span className="skeleton-line" />
							<span className="skeleton-line" />
							<span className="skeleton-line" />
							<span className="visually-hidden">Loading requests</span>
						</div>
					) : error ? (
						<div className="error-state" role="alert">
							<span className="state-mark">!</span>
							<h2>Queue unavailable</h2>
							<p>{error}</p>
							<button className="secondary-button" type="button" onClick={refresh}>Try again</button>
						</div>
					) : (
						<RequestList
							requests={filteredRequests}
							statuses={workflow.statuses}
							selectedId={selectedId}
							onSelect={setSelectedId}
						/>
					)}
					<div className="rail-footer">
						<span className="connection-dot" aria-hidden="true" />
						<span>Live queue</span>
						<span className="rail-footer-count">{filteredRequests.length} shown</span>
					</div>
				</aside>
				<section className="detail-pane" aria-label="Request detail">
					{loading && !requests.length ? (
						<div className="detail-loading" role="status" aria-live="polite">
							<span className="skeleton-line skeleton-short" />
							<span className="skeleton-title" />
							<span className="skeleton-block" />
							<span className="visually-hidden">Loading request detail</span>
						</div>
					) : error && !requests.length ? (
						<div className="detail-empty">
							<p className="eyebrow">CONNECTION ERROR</p>
							<h2>Request details are unavailable</h2>
							<p>Reconnect to the API to load the request workspace.</p>
						</div>
					) : (
						<RequestDetail
							request={selectedRequest}
							workflow={workflow}
							onAction={handleReviewAction}
							onSaveDraft={handleSaveDraft}
							onPartCitation={focusPart}
							busy={busyAction}
							actionError={actionError}
						/>
					)}
				</section>
			</main>
			{showComposer ? (
				<RequestComposer onClose={() => setShowComposer(false)} onSubmit={handleCreate} />
			) : null}
		</div>
	);
}