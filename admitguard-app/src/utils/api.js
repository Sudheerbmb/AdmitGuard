import axios from 'axios';
import { API_URL } from '../constants';
import { getToken } from './storage';

// Create axios instance
const api = axios.create({ baseURL: API_URL });

// Auto-attach JWT to every request
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── AUTH ───────────────────────────────────────────────────────
export const loginCounselor = (username, password) =>
  api.post('/api/auth/login', { username, password });

// ── RULES ──────────────────────────────────────────────────────
export const getRules = () => api.get('/api/rules');

// ── SUBMISSIONS ────────────────────────────────────────────────
export const submitCandidate = (data) => api.post('/api/submissions', data);

export const getSubmissions = () => api.get('/api/submissions');

export const patchDecision = (candidateId, decision) =>
  api.patch(`/api/submissions/${candidateId}/decision`, { decision });

// ── HEALTH ─────────────────────────────────────────────────────
export const checkHealth = () => api.get('/health');

export default api;
