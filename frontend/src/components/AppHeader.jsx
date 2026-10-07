export default function AppHeader({ theme, onToggleTheme, onNewRequest, requestCount }) {
  return (
    <header className="app-header">
      <div className="header-brand-group">
        <a className="app-brand" href="/" aria-label="Component Triage home">
          <span className="brand-mark" aria-hidden="true">CT</span>
          <span>Component Triage</span>
        </a>
        <span className="header-divider" aria-hidden="true" />
        <span className="header-workspace-label">Triage desk</span>
      </div>
      <div className="header-actions">
        <span className="header-count">{requestCount} requests</span>
        <button className="theme-button" type="button" onClick={onToggleTheme}>
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
        <button className="primary-button header-new-button" type="button" onClick={onNewRequest}>
          <span aria-hidden="true">+</span> New request
        </button>
      </div>
    </header>
  );
}