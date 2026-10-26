import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-lg px-6 py-24"><p className="eyebrow mb-3">Harani demo</p><h1 className="text-3xl">This page could not be displayed.</h1><p className="my-5 text-black/65">Your saved demo data has not been cleared. Reload the page to try again.</p><a className="btn btn-primary" href="/">Return to Home</a></main>;
    return this.props.children;
  }
}
