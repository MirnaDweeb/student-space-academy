import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[EGSA ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light p-4">
          <div className="card shadow-sm border-0 text-center p-4 p-md-5" style={{ maxWidth: 520, borderRadius: 16 }}>
            <div
              className="d-inline-flex align-items-center justify-content-center mx-auto mb-3"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'rgba(235, 87, 87, 0.1)',
                color: '#EB5757',
              }}
            >
              <i className="fa-solid fa-triangle-exclamation fa-2x"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">Egyptian Space Agency</h4>
            <h6 className="text-secondary mb-3">Portal Interface Recovery</h6>
            <p className="text-muted small mb-4">
              An unexpected interface error occurred. You can reload the application or return to the Academy Home.
            </p>
            <div className="d-flex gap-2 justify-content-center mb-3">
              <button className="btn btn-primary px-4" onClick={this.handleReload}>
                <i className="fa-solid fa-rotate-right me-2"></i>Reload
              </button>
              <button className="btn btn-outline-secondary px-4" onClick={this.handleGoHome}>
                <i className="fa-solid fa-house me-2"></i>Academy Home
              </button>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="text-start mt-3 p-2 bg-light rounded small border">
                <summary className="text-danger fw-semibold cursor-pointer">Error Details</summary>
                <pre className="text-danger mt-2 mb-0 overflow-auto" style={{ maxHeight: 150 }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
