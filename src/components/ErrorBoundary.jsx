import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("DetailPanel crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong loading details.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error)}
            {this.state.info ? "\n" + (this.state.info.componentStack || "") : ""}
          </pre>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}



















