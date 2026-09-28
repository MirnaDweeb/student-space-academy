import api from './api';

export const courseService = {
  list: (params) => api.get('/courses', { params }).then((r) => r.data),
  get: (id) => api.get(`/courses/${id}`).then((r) => r.data),
  checkFit: (id) => api.get(`/courses/${id}/fit`).then((r) => r.data),
};
