import StatusBadge from './StatusBadge.jsx';

function formatDate(value) {
  if (!value) return 'Just now';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function RequestList({
  requests,
  statuses,
  selectedId,
  onSelect,
}) {
  if (!requests.length) {
    return (
      <div className="list-empty">
        <span className="empty-mark" aria-hidden="true">+</span>
        <h3>No requests found</h3>
        <p>New customer requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="request-list" role="list">
      {requests.map((request) => (
        <div className="request-list-item" role="listitem" key={request.id}>
          <button
            className={`request-row${request.id === selectedId ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={request.id === selectedId}
            onClick={() => onSelect(request.id)}
          >
            <span className="request-row-topline">
              <StatusBadge status={request.status} statuses={statuses} />
              <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
            </span>
            <span className="request-row-title">{request.text}</span>
            <span className="request-row-meta">
              {request.analysis?.category || 'Category pending'}
              {request.analysis?.quantity ? ` · Qty ${request.analysis.quantity}` : ''}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}