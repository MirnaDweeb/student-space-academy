import api from './api';

export const studentService = {
  getMe: () => api.get('/students/me').then((r) => r.data),
  updateMe: (payload) => api.put('/students/me', payload).then((r) => r.data),
  setGoal: (goalId) => api.post('/students/me/goal', { goalId }).then((r) => r.data),
};

export const goalService = {
  list: () => api.get('/goals').then((r) => r.data),
};

export const learningPathService = {
  list: () => api.get('/learning-paths').then((r) => r.data),
  recommended: () => api.get('/learning-paths/recommended').then((r) => r.data),
};

export const dashboardService = {
  get: () => api.get('/dashboard').then((r) => r.data),
};
