import { type CSSProperties, useEffect, useState } from 'react';
import { type ChannelEntry, fetchRegistry } from './channel';
import { ChannelSwitcher } from './ChannelSwitcher';

// Change this on a branch, deploy the branch to a channel, then switch to it.
const HEADLINE = 'Hello from the channel POC';

const BUILD = {
  channel: import.meta.env.VITE_CHANNEL ?? 'local',
  branch: import.meta.env.VITE_BRANCH ?? '(not built by a workflow)',
  commit: import.meta.env.VITE_COMMIT?.slice(0, 7) ?? '—',
  builtAt: import.meta.env.VITE_BUILD_TIME ?? '—',
};

// A stable colour per channel, so a switch is obvious at a glance.
const hue = [...BUILD.channel].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type Registry = { status: 'loading' } | { status: 'ok'; entries: ChannelEntry[] } | { status: 'error'; error: string };

export function App() {
  const [registry, setRegistry] = useState<Registry>({ status: 'loading' });
  const [config, setConfig] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetchRegistry().then(
      (entries) => setRegistry({ status: 'ok', entries }),
      (error: Error) => setRegistry({ status: 'error', error: error.message }),
    );
    // Runtime config lives next to the build, like platform-ui's config.json.
    fetch('./config.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setConfig(json ? JSON.stringify(json, null, 2) : null))
      .catch(() => setConfig(null));
  }, []);

  const entries = registry.status === 'ok' ? registry.entries : [];

  return (
    <div className="layout" style={{ '--accent': `hsl(${hue} 65% 45%)` } as CSSProperties}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          Channel POC
        </div>
        <nav className="nav">
          <span className="nav-item active">Overview</span>
        </nav>
        <ChannelSwitcher current={BUILD.channel} entries={entries} />
      </aside>

      <main className="main">
        <header className="hero">
          <span className="badge">{BUILD.channel}</span>
          <h1>{HEADLINE}</h1>
          <p className="muted">
            You are on the <strong>{BUILD.channel}</strong> channel. Use the switcher to move between channels.
          </p>
        </header>

        <section className="cards">
          <article className="card">
            <h2>This build</h2>
            <dl>
              <dt>Channel</dt>
              <dd>{BUILD.channel}</dd>
              <dt>Branch</dt>
              <dd>{BUILD.branch}</dd>
              <dt>Commit</dt>
              <dd>
                <code>{BUILD.commit}</code>
              </dd>
              <dt>Built at</dt>
              <dd>{BUILD.builtAt}</dd>
            </dl>
          </article>

          <article className="card">
            <h2>Runtime config</h2>
            <p className="muted small">
              <code>./config.json</code> in this channel's folder
            </p>
            {config === undefined && <p className="muted">Loading…</p>}
            {config === null && (
              <p className="muted">No config.json in this channel: it was deployed with copy_config off.</p>
            )}
            {config && <pre>{config}</pre>}
          </article>

          <article className="card wide">
            <h2>Channel registry</h2>
            <p className="muted small">
              <code>channel.json</code> at the site root, written by the Channel Management workflow
            </p>
            {registry.status === 'loading' && <p className="muted">Loading…</p>}
            {registry.status === 'error' && <p className="muted">Not available: {registry.error}</p>}
            {registry.status === 'ok' && entries.length === 0 && <p className="muted">No channels yet.</p>}
            {entries.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>channel_name</th>
                    <th>branch_name</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.channel_name} className={entry.channel_name === BUILD.channel ? 'current' : ''}>
                      <td>{entry.channel_name}</td>
                      <td>{entry.branch_name ?? <span className="muted">unknown (legacy entry)</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
