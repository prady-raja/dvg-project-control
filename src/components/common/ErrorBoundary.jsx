import React from 'react';
import { reportClientError } from '@/lib/clientErrors';
import { Button } from '@/components/ui/button';

/** Keeps one broken screen from blanking the app, and records what broke. */
export default class ErrorBoundary extends React.Component {
  state = { error: null, reported: false, note: '', sent: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportClientError(Object.assign(error, { stack: `${error?.stack || ''}\n${info?.componentStack || ''}` }), { source: 'boundary' });
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, note: '', sent: false });
  }

  send = async () => {
    await reportClientError(this.state.error, { source: 'boundary', note: this.state.note || 'Reported by user' });
    this.setState({ sent: true });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-sm">
        <p className="font-display text-lg font-semibold text-red-900">This screen hit a problem</p>
        <p className="mt-1 text-red-800">
          Nothing you saved has been lost. Reload to try again; if it keeps happening, tell us what you were doing.
        </p>
        <textarea
          value={this.state.note}
          onChange={(e) => this.setState({ note: e.target.value })}
          placeholder="What were you doing? (optional)"
          className="mt-3 w-full rounded-md border border-red-200 bg-white p-2 text-sm"
          rows={2}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>Reload</Button>
          <Button size="sm" variant="outline" onClick={this.send} disabled={this.state.sent}>
            {this.state.sent ? 'Thank you — reported' : 'Report a problem'}
          </Button>
        </div>
      </div>
    );
  }
}
