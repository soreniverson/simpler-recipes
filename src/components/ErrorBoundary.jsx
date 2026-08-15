import { Component } from 'react';

/**
 * Keeps one broken island child (bad local data, an unexpected shape) from unmounting its
 * siblings — e.g. a malformed "Recent" entry must never take the paste box with it.
 * Renders `fallback` (default: nothing) and logs once.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    if (typeof console !== 'undefined') console.error('[ui] section failed to render:', err);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
