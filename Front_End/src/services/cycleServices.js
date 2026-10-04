import api from './api';

export const readinessService = {
  start: (courseId) => api.post('/readiness/start', { courseId }).then((r) => r.data),
  submit: (attemptId, answers) => api.post(`/readiness/${attemptId}/submit`, { answers }).then((r) => r.data),
  result: (attemptId) => api.get(`/readiness/${attemptId}/result`).then((r) => r.data),
  // Admin Question Authoring
  createQuestion: (payload) => api.post('/readiness/admin/questions', payload).then((r) => r.data),
  bulkCreateQuestions: (courseId, questions) => api.post('/readiness/admin/questions/bulk', { courseId, questions }).then((r) => r.data),
  listQuestions: (courseId) => api.get('/readiness/admin/questions', { params: { courseId } }).then((r) => r.data),
  deleteQuestion: (questionId) => api.delete(`/readiness/admin/questions/${questionId}`).then((r) => r.data),
};

export const applicationService = {
  create: (payload) => api.post('/applications', payload).then((r) => r.data),
  my: () => api.get('/applications/my').then((r) => r.data),
  get: (id) => api.get(`/applications/${id}`).then((r) => r.data),
  cancel: (id) => api.patch(`/applications/${id}/cancel`).then((r) => r.data),
};

export const paymentService = {
  my: () => api.get('/payments/my').then((r) => r.data),
  getInvoice: (id) => api.get(`/payments/invoices/${id}`).then((r) => r.data),
  calculatePrice: (courseId, packageType) =>
    api.post('/payments/calculate', { courseId, packageType }).then((r) => r.data),
  prepareInvoice: (payload) => api.post('/payments/prepare', payload).then((r) => r.data),
  initiate: (payload) => api.post('/payments/initiate', payload).then((r) => r.data),
  verify: (payload) => api.post('/payments/verify', payload).then((r) => r.data),
  getSessionStatus: (sessionId) => api.get(`/payments/session-status/${sessionId}`).then((r) => r.data),
  pay: (invoiceId, payload = {}) => {
    const body = typeof payload === 'string' ? { method: payload } : payload;
    return api.post(`/payments/${invoiceId}/pay`, body).then((r) => r.data);
  },
};

export const adminService = {
  overview: () => api.get('/admin/overview').then((r) => r.data),
  applications: (params) => api.get('/admin/applications', { params }).then((r) => r.data),
  acceptApplication: (id, note) => api.patch(`/admin/applications/${id}/accept`, { note }).then((r) => r.data),
  reviewApplication: (id, note) => api.patch(`/admin/applications/${id}/review`, { note }).then((r) => r.data),
  waitlistApplication: (id, note) => api.patch(`/admin/applications/${id}/waitlist`, { note }).then((r) => r.data),
  rejectApplication: (id, reason) => api.patch(`/admin/applications/${id}/reject`, { reason }).then((r) => r.data),
  promoteWaitlist: (id) => api.patch(`/admin/applications/${id}/promote`).then((r) => r.data),
  // Payment management
  payments: (params) => api.get('/admin/payments', { params }).then((r) => r.data),
  paymentDetails: (id) => api.get(`/admin/payments/${id}`).then((r) => r.data),
  // Certificate management
  certificates: (params) => api.get('/admin/certificates', { params }).then((r) => r.data),
  certificateDetails: (id) => api.get(`/admin/certificates/${id}`).then((r) => r.data),
  createCertificate: (id) => api.post(`/admin/certificates/${id}/create`).then((r) => r.data),
  uploadCertificate: (id, formData) =>
    api
      .post(`/admin/certificates/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  issueCertificate: (id) => api.post(`/admin/certificates/${id}/issue`).then((r) => r.data),
  updateCertificateStatus: (id, status) =>
    api.patch(`/admin/certificates/${id}/status`, { status }).then((r) => r.data),
  correctCertificateName: (id, payload) =>
    api.patch(`/admin/certificates/${id}/correct-name`, payload).then((r) => r.data),
  // Cohorts & Capacity Management
  cohorts: (params) => api.get('/admin/cohorts', { params }).then((r) => r.data),
  createCohort: (payload) => api.post('/admin/cohorts', payload).then((r) => r.data),
  updateCohort: (id, payload) => api.patch(`/admin/cohorts/${id}`, payload).then((r) => r.data),
  // Sessions & Attendance
  sessions: (params) => api.get('/admin/sessions', { params }).then((r) => r.data),
  createSession: (payload) => api.post('/admin/sessions', payload).then((r) => r.data),
  generateQR: (sessionId) => api.post(`/attendance/sessions/${sessionId}/qr`).then((r) => r.data),
  disputes: () => api.get('/attendance/disputes').then((r) => r.data),
  reviewDispute: (id, payload) => api.put(`/attendance/disputes/${id}`, payload).then((r) => r.data),
};

export const enrollmentService = {
  my: () => api.get('/enrollments/my').then((r) => r.data),
};

export const notificationService = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
};

export const certificateService = {
  my: () => api.get('/certificates/my').then((r) => r.data),
  getById: (id) => api.get(`/certificates/${id}`).then((r) => r.data),
  submitName: (payload) => api.post('/certificates/submit-name', payload).then((r) => r.data),
  confirmName: (payload) => api.post('/certificates/confirm-name', payload).then((r) => r.data),
  correctName: (id, payload) => api.patch(`/certificates/${id}/correct-name`, payload).then((r) => r.data),
  verify: (tokenOrId) => api.get(`/certificates/verify/${tokenOrId}`).then((r) => r.data),
};

export const assessmentService = {
  my: (params) => api.get('/assessments/my', { params }).then((r) => r.data),
  getById: (id) => api.get(`/assessments/${id}`).then((r) => r.data),
  submit: (id, formData) =>
    api
      .post(`/assessments/${id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
};

