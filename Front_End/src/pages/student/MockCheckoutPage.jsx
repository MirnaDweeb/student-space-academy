import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { paymentService } from '../../services/cycleServices';

/**
 * Egyptian Space Agency — Development Mock Card Payment Gateway
 * Isolated sandbox payment simulation for local development and testing.
 * Replaces recursive embedding of the main PaymentsPage.
 */
export default function MockCheckoutPage() {
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('sessionToken') || '';
  const invoiceId = searchParams.get('invoiceId') || '';
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'EGP';
  const transactionId = searchParams.get('transactionId') || '';

  const [cardHolder, setCardHolder] = useState('Ahmed Student');
  const [cardNumber, setCardNumber] = useState('5123 •••• •••• 2345');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('•••');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const navigateParent = (url) => {
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // Cross-origin fallback
    }
    window.location.href = url;
  };

  const handleSimulateSuccess = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');

    try {
      if (transactionId) {
        await paymentService.verify({ transactionId });
      }
      // Redirect back to return URL with session_id to trigger status confirmation
      const returnUrl = `/student/payments?session_id=${encodeURIComponent(
        sessionToken || transactionId
      )}&success=true&invoiceId=${encodeURIComponent(invoiceId)}`;
      navigateParent(returnUrl);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Simulated payment processing encountered an error. Please try again.'
      );
      setIsProcessing(false);
    }
  };

  const handleSimulateCancel = () => {
    const returnUrl = `/student/payments?session_id=${encodeURIComponent(
      sessionToken || transactionId
    )}&cancelled=true&invoiceId=${encodeURIComponent(invoiceId)}`;
    navigateParent(returnUrl);
  };

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm border-0" style={{ maxWidth: '480px', width: '100%', borderRadius: '12px' }}>
        {/* Gateway Simulation Header */}
        <div className="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-flask text-warning fs-5"></i>
            <div>
              <strong className="d-block small">DEVELOPMENT MOCK GATEWAY</strong>
              <small className="text-secondary" style={{ fontSize: '0.72rem' }}>
                Simulated Sandbox Payment Frame
              </small>
            </div>
          </div>
          <span className="badge bg-warning text-dark font-monospace small">SANDBOX MODE</span>
        </div>

        <div className="card-body p-4">
          <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <i className="fa-solid fa-circle-info fs-6 flex-shrink-0"></i>
            <div>
              <strong>Local Development Simulation:</strong> No real card will be charged. Real payments require active Paymob merchant credentials.
            </div>
          </div>

          {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

          {/* Amount Summary */}
          <div className="p-3 bg-light rounded border mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small">Tuition Settlement:</span>
              <span className="font-monospace small text-dark">{transactionId ? `TXN: ${transactionId.slice(-8)}` : 'Tuition Invoice'}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-bold text-dark">Payable Amount:</span>
              <span className="fs-4 fw-bold text-primary">
                {Number(amount).toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Card Simulation Form */}
          <form onSubmit={handleSimulateSuccess}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted mb-1">Cardholder Full Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                required
                disabled={isProcessing}
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold text-muted mb-1">Card Number (Simulated Test Card)</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <i className="fa-solid fa-credit-card text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label small fw-bold text-muted mb-1">Expiration</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  required
                  disabled={isProcessing}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold text-muted mb-1">CVV / CVC</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  required
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex flex-column gap-2">
              <button
                type="submit"
                className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Processing Sandbox Settlement…</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i>
                    <span className="fw-bold">Simulate Successful Payment</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm w-100 py-2"
                onClick={handleSimulateCancel}
                disabled={isProcessing}
              >
                Cancel & Return
              </button>
            </div>
          </form>
        </div>

        <div className="card-footer bg-light text-center py-2 text-muted small" style={{ fontSize: '0.72rem' }}>
          <i className="fa-solid fa-shield-halved text-success me-1"></i>
          EGSA Space Academy Sandbox Checkout Environment
        </div>
      </div>
    </div>
  );
}
