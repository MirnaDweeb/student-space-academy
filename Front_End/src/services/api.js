import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Request Interceptor: Attach current access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('egsa_access_token') || localStorage.getItem('egsa_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Safe 401 handling without reload loops
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const requestUrl = err.config?.url || '';
      // Don't clear tokens on public auth check/login/register attempts
      if (
        !requestUrl.includes('/auth/login') &&
        !requestUrl.includes('/auth/register') &&
        !requestUrl.includes('/auth/verify-email') &&
        !requestUrl.includes('/auth/resend-verification') &&
        !requestUrl.includes('/auth/forgot-password') &&
        !requestUrl.includes('/auth/reset-password')
      ) {
        localStorage.removeItem('egsa_access_token');
        localStorage.removeItem('egsa_token');
        localStorage.removeItem('egsa_refresh_token');
        localStorage.removeItem('egsa_user');
        window.dispatchEvent(new CustomEvent('egsa_auth_expired'));
      }
    }
    return Promise.reject(err);
  }
);

export default api;

