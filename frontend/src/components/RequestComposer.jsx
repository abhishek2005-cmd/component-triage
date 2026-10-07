import { useEffect, useRef, useState } from 'react';

export default function RequestComposer({ onClose, onSubmit }) {
  const dialogRef = useRef(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(text);
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="request-dialog"
      ref={dialogRef}
      aria-labelledby="composer-title"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">INCOMING REQUEST</p>
            <h2 id="composer-title">Add a request</h2>
          </div>
          <button className="quiet-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="field-label" htmlFor="request-text">Customer request</label>
        <textarea
          id="request-text"
          autoFocus
          required
          maxLength={5000}
          rows={7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Describe the requested component, quantity, and any known specifications."
        />
        <div className="composer-footer">
          <span>{text.length.toLocaleString()} / 5,000</span>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
      </form>
    </dialog>
  );
}