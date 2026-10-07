import { useEffect, useState } from 'react';
import DraftReply from './DraftReply.jsx';
import PartCard from './PartCard.jsx';
import StatusBadge from './StatusBadge.jsx';

function formatDate(value) {
  if (!value) return 'Recently submitted';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function RequestDetail({
  request,
  workflow,
  onAction,
  onSaveDraft,
  onPartCitation,
  busy,
  actionError,
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(request?.draftReply || '');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState('');
  const statusTransitions = workflow.transitions[request?.status] || [];
  const actions = workflow.reviewActions.filter((action) =>
    statusTransitions.includes(action.targetStatus)
    && workflow.userTransitionTargets.includes(action.targetStatus),
  );
  const canEditDraft = workflow.editableDraftStatuses.includes(request?.status);
  const matches = request?.analysis?.matches || [];

  useEffect(() => {
    setEditing(false);
    setDraftText(request?.draftReply || '');
    setDraftError('');
  }, [request?.id, request?.draftReply]);

  async function saveDraft(event) {
    event.preventDefault();
    setSavingDraft(true);
    setDraftError('');
    try {
      await onSaveDraft(draftText);
      setEditing(false);
    } catch (error) {
      setDraftError(error.message);
    } finally {
      setSavingDraft(false);
    }
  }

  if (!request) {
    return (
      <div className="detail-empty">
        <span className="detail-index" aria-hidden="true">01 / --</span>
        <h2>Select a request</h2>
        <p>Choose an item from the queue to review its analysis and draft.</p>
      </div>
    );
  }

  return (
    <article className="request-detail">
      <header className="detail-heading">
        <div className="detail-heading-copy">
          <p className="eyebrow">REQUEST / {request.id.slice(-6).toUpperCase()}</p>
          <h1>Component request</h1>
          <p className="detail-date">Received {formatDate(request.createdAt)}</p>
        </div>
        <StatusBadge status={request.status} statuses={workflow.statuses} />
      </header>

      <section className="detail-section request-message" aria-labelledby="request-message-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CUSTOMER MESSAGE</p>
            <h2 id="request-message-title">Request details</h2>
          </div>
          {request.analysis?.category ? (
            <span className="category-label">{request.analysis.category}</span>
          ) : null}
        </div>
        <blockquote>{request.text}</blockquote>
        {request.analysis?.quantity ? (
          <p className="quantity-note">Requested quantity <strong>{request.analysis.quantity}</strong></p>
        ) : null}
      </section>

      <section className="detail-section" aria-labelledby="matched-parts-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CATALOG RETRIEVAL</p>
            <h2 id="matched-parts-title">Matched parts</h2>
          </div>
          <span className="section-count">{matches.length.toString().padStart(2, '0')}</span>
        </div>
        {matches.length ? (
          <div className="part-grid">
            {matches.map((match) => (
              <PartCard key={match.part.partNumber} match={match} />
            ))}
          </div>
        ) : (
          <div className="parts-empty">
            <p>{request.analysis?.refusalMessage || 'No catalog matches are available for this request.'}</p>
          </div>
        )}
      </section>

      <section className="detail-section draft-section" aria-labelledby="draft-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CUSTOMER RESPONSE</p>
            <h2 id="draft-title">Draft reply</h2>
          </div>
          {canEditDraft && !editing ? (
            <button className="secondary-button" type="button" onClick={() => setEditing(true)}>
              Edit draft
            </button>
          ) : null}
        </div>
        {editing ? (
          <form className="draft-editor" onSubmit={saveDraft}>
            <label className="visually-hidden" htmlFor="draft-text">Edit draft reply</label>
            <textarea
              id="draft-text"
              autoFocus
              maxLength={5000}
              required
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={5}
            />
            <div className="draft-editor-footer">
              <span>{draftText.length.toLocaleString()} / 5,000</span>
              <div className="button-group">
                <button className="quiet-button" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={savingDraft}>
                  {savingDraft ? 'Saving…' : 'Save draft'}
                </button>
              </div>
            </div>
            {draftError ? <p className="inline-error" role="alert">{draftError}</p> : null}
          </form>
        ) : (
          <div className="draft-card">
            <DraftReply
              text={request.draftReply || request.analysis?.draftReply}
              matches={matches}
              onPartCitation={onPartCitation}
            />
          </div>
        )}
      </section>

      {actionError ? <p className="inline-error action-error" role="alert">{actionError}</p> : null}
      {actions.length ? (
        <footer className="review-actions">
          <p>Review decision</p>
          <div className="button-group">
            {actions.map((action) => {
              const actionStatus = workflow.statuses.find((item) => item.value === action.targetStatus);
              return (
                <button
                  className={actionStatus?.tone === 'negative' ? 'secondary-button danger-button' : 'primary-button'}
                  type="button"
                  key={action.targetStatus}
                  disabled={busy || editing}
                  onClick={() => onAction(action)}
                >
                  {busy ? 'Saving…' : action.label}
                </button>
              );
            })}
          </div>
        </footer>
      ) : null}
    </article>
  );
}