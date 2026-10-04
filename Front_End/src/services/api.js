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

// Single-flight silent refresh variables
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

function clearAuthSessionAndNotify() {
  localStorage.removeItem('egsa_access_token');
  localStorage.removeItem('egsa_token');
  localStorage.removeItem('egsa_refresh_token');
  localStorage.removeItem('egsa_user');
  window.dispatchEvent(new CustomEvent('egsa_auth_expired'));
}

// Response Interceptor: Single-flight 401 token refresh queue with fallback logout
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';

      // Skip refresh for public auth endpoints
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/verify-email') ||
        requestUrl.includes('/auth/resend-verification') ||
        requestUrl.includes('/auth/forgot-password') ||
        requestUrl.includes('/auth/reset-password') ||
        requestUrl.includes('/auth/refresh');

      if (isAuthEndpoint) {
        return Promise.reject(err);
      }

      const refreshToken = localStorage.getItem('egsa_refresh_token');
      if (!refreshToken) {
        clearAuthSessionAndNotify();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // Queue concurrent requests while token refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((queueErr) => Promise.reject(queueErr));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const data = response.data?.data;
        const newAccessToken = data?.accessToken || data?.token;
        const newRefreshToken = data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('egsa_access_token', newAccessToken);
          localStorage.setItem('egsa_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('egsa_refresh_token', newRefreshToken);
          }
          window.dispatchEvent(new CustomEvent('egsa_token_refreshed', {
            detail: { accessToken: newAccessToken, refreshToken: newRefreshToken },
          }));
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh response missing access token');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthSessionAndNotify();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
