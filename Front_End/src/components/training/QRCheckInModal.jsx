import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { attendanceService } from '../../services/studentPortalServices';

/**
 * QRCheckInModal
 * Production-ready QR code attendance scanner, image uploader, and manual token validator.
 * Validates against backend attendance policy and session window constraints.
 */
export default function QRCheckInModal({ isOpen, onClose, onSuccess, initialSession = null }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'upload' | 'manual'
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanResult, setScanResult] = useState(null); // { success: true, message, data }
  const [errorMessage, setErrorMessage] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Submit token to backend for server-side verification
  const submitToken = async (token, method = 'QR_Scan') => {
    if (!token || !token.trim()) {
      setErrorMessage('Please provide a valid session QR token.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await attendanceService.markAttendanceQR(token.trim(), method);
      setScanResult(response);
      stopCamera();
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message;
      // Institutional friendly error mappings matching Section 30
      if (serverMsg?.toLowerCase().includes('already recorded')) {
        setErrorMessage('Your attendance has already been recorded for this session.');
      } else if (serverMsg?.toLowerCase().includes('expired')) {
        setErrorMessage('This attendance QR code has expired.');
      } else if (serverMsg?.toLowerCase().includes('window is not open') || serverMsg?.toLowerCase().includes('closed')) {
        setErrorMessage('The attendance window for this session is closed.');
      } else if (serverMsg?.toLowerCase().includes('not enrolled')) {
        setErrorMessage('You are not enrolled in this training session or cohort.');
      } else if (serverMsg?.toLowerCase().includes('not found') || serverMsg?.toLowerCase().includes('invalid')) {
        setErrorMessage('Invalid attendance QR code. Please verify you scanned an active EGSA session code.');
      } else {
        setErrorMessage(serverMsg || 'Unable to record attendance. Please try again or notify your instructor.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Video scanning loop using jsQR
  const scanVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      stopCamera();
      submitToken(code.data, 'QR_Scan');
      return;
    }

    animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
  }, [stopCamera]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported by your browser. Please use the Upload QR or Manual Code option.');
      setActiveTab('upload');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().then(() => {
          animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
        }).catch((e) => {
          console.warn('Video play error:', e);
          setCameraError('Could not start video stream. Please grant permission or upload image.');
        });
      }
    } catch (err) {
      console.warn('Camera permission denied or unavailable:', err);
      setCameraError('Camera access was denied or is unavailable. Please upload a QR image or enter code manually.');
      setActiveTab('upload');
    }
  }, [stopCamera, scanVideoFrame]);

  // Handle image upload decode
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          submitToken(code.data, 'QR_Upload');
        } else {
          setErrorMessage('Could not detect a valid QR code in the uploaded image. Please try a clearer picture or enter the code manually.');
        }
      };
      img.onerror = () => {
        setErrorMessage('Failed to load image file. Please choose a valid PNG or JPEG.');
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setErrorMessage('');
      setTokenInput('');
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(5, 15, 30, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
          {/* Header */}
          <div className="modal-header bg-dark text-white border-bottom border-secondary pb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary-egsa p-2">
                <i className="fa-solid fa-qrcode fs-6"></i>
              </span>
              <div>
                <h5 className="modal-title fw-bold mb-0">Session Attendance Check-in</h5>
                <small className="text-muted">EGSA Space Academy · Institutional Security</small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {initialSession && (
              <div className="p-3 bg-light rounded border mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="badge bg-light text-primary-egsa border border-primary-subtle fw-semibold">
                    Session #{initialSession.sessionNumber}
                  </span>
                  <small className="text-muted">{initialSession.time || 'Scheduled'}</small>
                </div>
                <h6 className="fw-bold text-dark mt-2 mb-1">{initialSession.title}</h6>
                <small className="text-muted d-block">
                  <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                  {initialSession.location || 'EGSA Space Academy'}
                </small>
              </div>
            )}

            {/* Success View */}
            {scanResult ? (
              <div className="text-center py-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white mb-3 shadow"
                  style={{ width: '70px', height: '70px' }}
                >
                  <i className="fa-solid fa-check fa-2x"></i>
                </div>
                <h5 className="fw-bold text-dark mb-1">Attendance Confirmed!</h5>
                <p className="text-muted small mb-3">{scanResult.message}</p>

                <div className="card bg-light border p-3 text-start mb-3">
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted small">Status Recorded:</span>
                    <span className={`badge ${scanResult.data?.record?.status === 'Present' ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {scanResult.data?.record?.status}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted small">Check-in Time:</span>
                    <strong className="small text-dark">
                      {new Date(scanResult.data?.record?.checkInTime || Date.now()).toLocaleTimeString()}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted small">Updated Course Attendance:</span>
                    <strong className="small text-primary-egsa">
                      {scanResult.data?.summary?.attendanceRate}%
                    </strong>
                  </div>
                </div>

                <button className="btn btn-primary px-4 fw-semibold" onClick={onClose}>
                  <i className="fa-solid fa-check me-2"></i> Done
                </button>
              </div>
            ) : (
              <>
                {/* Mode Selector Tabs */}
                <ul className="nav nav-pills nav-fill mb-3 gap-2">
                  <li className="nav-item">
                    <button
                      className={`nav-link btn-sm py-2 ${activeTab === 'camera' ? 'active bg-primary-egsa' : 'bg-light text-dark'}`}
                      onClick={() => {
                        setActiveTab('camera');
                        setErrorMessage('');
                      }}
                      disabled={loading}
                    >
                      <i className="fa-solid fa-camera me-1"></i> Scan Camera
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn-sm py-2 ${activeTab === 'upload' ? 'active bg-primary-egsa' : 'bg-light text-dark'}`}
                      onClick={() => {
                        stopCamera();
                        setActiveTab('upload');
                        setErrorMessage('');
                      }}
                      disabled={loading}
                    >
                      <i className="fa-solid fa-cloud-arrow-up me-1"></i> Upload QR
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn-sm py-2 ${activeTab === 'manual' ? 'active bg-primary-egsa' : 'bg-light text-dark'}`}
                      onClick={() => {
                        stopCamera();
                        setActiveTab('manual');
                        setErrorMessage('');
                      }}
                      disabled={loading}
                    >
                      <i className="fa-solid fa-keyboard me-1"></i> Enter Code
                    </button>
                  </li>
                </ul>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                    <i className="fa-solid fa-triangle-exclamation flex-shrink-0"></i>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Camera View */}
                {activeTab === 'camera' && (
                  <div className="text-center">
                    {cameraError ? (
                      <div className="alert alert-warning small p-3 text-start">
                        <i className="fa-solid fa-camera-rotate me-2"></i>
                        {cameraError}
                      </div>
                    ) : (
                      <div
                        className="position-relative overflow-hidden rounded bg-black mx-auto mb-3 shadow-inner"
                        style={{ width: '100%', height: '260px', maxWidth: '340px' }}
                      >
                        <video
                          ref={videoRef}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          muted
                          playsInline
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Scanner targeting overlay reticle */}
                        <div
                          className="position-absolute top-50 start-50 translate-middle border border-2 border-primary-egsa rounded"
                          style={{
                            width: '180px',
                            height: '180px',
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                          }}
                        >
                          <div className="w-100 h-100 position-relative">
                            <span
                              className="position-absolute top-0 start-0 border-top border-start border-4 border-info"
                              style={{ width: '20px', height: '20px' }}
                            />
                            <span
                              className="position-absolute top-0 end-0 border-top border-end border-4 border-info"
                              style={{ width: '20px', height: '20px' }}
                            />
                            <span
                              className="position-absolute bottom-0 start-0 border-bottom border-start border-4 border-info"
                              style={{ width: '20px', height: '20px' }}
                            />
                            <span
                              className="position-absolute bottom-0 end-0 border-bottom border-end border-4 border-info"
                              style={{ width: '20px', height: '20px' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <small className="text-muted d-block">
                      Position the official session QR code displayed by your instructor within the frame.
                    </small>
                  </div>
                )}

                {/* Upload View */}
                {activeTab === 'upload' && (
                  <div className="text-center py-3">
                    <div
                      className="border border-2 border-dashed rounded p-4 mb-3 bg-light cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-qrcode fa-3x text-primary-egsa mb-2 d-block"></i>
                      <h6 className="fw-bold text-dark mb-1">Select QR Code Image</h6>
                      <small className="text-muted d-block mb-3">Supports PNG, JPG, or Screenshots</small>
                      <button type="button" className="btn btn-outline-primary btn-sm px-3">
                        <i className="fa-solid fa-folder-open me-1"></i> Browse Files
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {/* Manual Code View */}
                {activeTab === 'manual' && (
                  <div className="py-2">
                    <label className="form-label small fw-semibold text-dark">
                      Session Check-in Code / Token:
                    </label>
                    <div className="input-group mb-3">
                      <span className="input-group-text bg-light text-muted">
                        <i className="fa-solid fa-key"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. EGSA-CIRCUIT-SESSION-04-LIVE-TOKEN"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <small className="text-muted d-block mb-3">
                      Provided on the lecture presentation display or by the laboratory proctor.
                    </small>
                    <div className="d-grid">
                      <button
                        className="btn btn-primary fw-semibold"
                        onClick={() => submitToken(tokenInput, 'Manual_Code')}
                        disabled={loading || !tokenInput.trim()}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Verifying Session Code…
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-check me-2"></i> Submit Check-in
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!scanResult && (
            <div className="modal-footer bg-light border-top py-2 px-3 justify-content-between">
              <small className="text-muted">
                <i className="fa-solid fa-shield-halved text-success me-1"></i> Time-limited cryptographic verification
              </small>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
