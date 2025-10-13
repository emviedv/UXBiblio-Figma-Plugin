import { formatEndpoint } from "../utils/url";

interface SettingsPageProps {
  analysisEndpoint?: string;
  onTestConnection: () => void;
}

export function SettingsPage({ analysisEndpoint, onTestConnection }: SettingsPageProps): JSX.Element {
  const endpointLabel = analysisEndpoint ? formatEndpoint(analysisEndpoint) : "Not configured";

  return (
    <div className="settings-page">
      <section className="card" data-card-surface="true">
        <header className="card-header">
          <h2 className="card-heading">
            <span className="card-heading-title">Settings</span>
          </h2>
        </header>
        <div className="card-body">
          <div className="card-section">
            <div className="card-section-header">
              <h3 className="card-section-title">Analysis Endpoint</h3>
              <div className="card-section-actions">
                <button type="button" className="secondary-button" onClick={onTestConnection}>
                  Test Connection
                </button>
              </div>
            </div>
            <div className="settings-endpoint-row">
              <span className="connection-indicator" title={analysisEndpoint ? `Analysis endpoint: ${analysisEndpoint}` : undefined}>
                {endpointLabel}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

