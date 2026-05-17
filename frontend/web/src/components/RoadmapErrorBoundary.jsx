import React from 'react';

class RoadmapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Roadmap render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card text-center text-ink-500 py-10">
          Roadmap could not be rendered.
        </div>
      );
    }

    return this.props.children;
  }
}

export default RoadmapErrorBoundary;
