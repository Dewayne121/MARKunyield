import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ============================================
// API URL CONFIGURATION
// ============================================
// Option 1: Use environment variable (recommended)
// Set EXPO_PUBLIC_API_URL in your .env file or app.json
//
// Option 2: Uncomment one of the lines below:
//

// Production (Railway)
// const API_BASE_URL = 'https://unyielding-api-production.up.railway.app';

// Local development
// const API_BASE_URL = 'http://localhost:3000';

const LOCAL_API_BASE_URL = 'http://localhost:3000';
const PRODUCTION_API_BASE_URL = 'https://unyielding-api-production.up.railway.app';
const EMERGENCY_API_BASE_URL = process.env.EXPO_PUBLIC_API_EMERGENCY_URL || 'https://unyield-main.onrender.com';
const DEFAULT_API_BASE_URL = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? LOCAL_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

// Use environment variable when provided; otherwise default to local API in dev.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
const API_FALLBACK_URLS = String(process.env.EXPO_PUBLIC_API_FALLBACK_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const isWebRuntime = () => typeof window !== 'undefined' && !!window.location;
const isLocalWebRuntime = () => {
  if (!isWebRuntime()) {
    return false;
  }
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '');
};
const isRemoteWebRuntime = () => isWebRuntime() && !isLocalWebRuntime();
const isNativeRuntime = () => !isWebRuntime();

const isTunnelBaseUrl = (url) => ['.loca.lt', '.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'].some((domain) => url.includes(domain));
const isLocaltunnelUrl = (url) => url.includes('.loca.lt');
const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');
const isLocalhostHost = (host) => /^(localhost|127\.0\.0\.1|::1|\[::1\])$/i.test(String(host || ''));
const isPrivateIpv4Host = (host) => {
  const parts = String(host || '').split('.');
  if (parts.length !== 4) {
    return false;
  }
  const nums = parts.map((part) => Number(part));
  if (nums.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }
  const [a, b] = nums;
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254);
};
const isLikelyLanHost = (host) => isPrivateIpv4Host(host) || String(host || '').endsWith('.local');
const isLocalhostBaseUrl = (url) => {
  const normalized = normalizeBaseUrl(url);
  const match = normalized.match(/^https?:\/\/([^/:]+|\[[^\]]+\])(?::\d+)?$/i);
  if (!match) {
    return false;
  }
  return isLocalhostHost(match[1]);
};
const parseHostFromUri = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return parsed.hostname || '';
  } catch {
    return '';
  }
};
const formatHostForUrl = (host) => (host.includes(':') && !host.startsWith('[') ? `[${host}]` : host);
const getExpoHostUri = () => {
  const candidates = [
    Constants?.expoGoConfig?.debuggerHost,
    Constants?.manifest2?.extra?.expoClient?.hostUri,
    Constants?.manifest?.debuggerHost,
    Constants?.manifest?.hostUri,
    Constants?.expoConfig?.hostUri,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
};
const localApiPort = Number(process.env.EXPO_PUBLIC_LOCAL_API_PORT || 3000);
const inferredDevHost = parseHostFromUri(getExpoHostUri());
const LAN_API_BASE_URL = (isNativeRuntime() && inferredDevHost && isLikelyLanHost(inferredDevHost))
  ? `http://${formatHostForUrl(inferredDevHost)}:${localApiPort}`
  : '';
const lower = (value) => String(value || '').toLowerCase();
const isNetworkLikeError = (error) => {
  const message = lower(error?.message);
  return (
    error?.name === 'AbortError' ||
    message === 'network request failed' ||
    message === 'failed to fetch' ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('cors')
  );
};
const parseJsonSafely = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const looksLikeHtml = (text) => /<(!doctype|html|head|body)\b/i.test(String(text || ''));
const isLikelyTunnelInterference = ({ baseUrl, status, contentType, responseText }) => {
  if (!isTunnelBaseUrl(baseUrl)) {
    return false;
  }

  const tunnelFailureStatus = new Set([401, 403, 408, 429, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526]);
  if (tunnelFailureStatus.has(status)) {
    return true;
  }

  const type = lower(contentType);
  const text = lower(responseText).slice(0, 500);

  if (type.includes('text/html') || looksLikeHtml(responseText)) {
    return (
      text.includes('localtunnel') ||
      text.includes('trycloudflare') ||
      text.includes('cloudflare') ||
      text.includes('tunnel') ||
      text.includes('captcha') ||
      text.includes('just a moment')
    );
  }

  return false;
};

// When opening Expo web locally, tunnel URLs are brittle and can trigger CORS-like failures
// when they expire. Prefer the local API if we are on localhost.
const RESOLVED_API_BASE_URL = (() => {
  const normalizedApiBase = normalizeBaseUrl(API_BASE_URL);
  if (isLocalWebRuntime() && isTunnelBaseUrl(normalizedApiBase)) {
    return LOCAL_API_BASE_URL;
  }
  if (isNativeRuntime() && isLocalhostBaseUrl(normalizedApiBase) && LAN_API_BASE_URL) {
    return LAN_API_BASE_URL;
  }
  return normalizedApiBase;
})();

const buildApiBaseCandidates = () => {
  const candidates = [];
  const pushUnique = (url) => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized || candidates.includes(normalized)) {
      return;
    }

    // localtunnel commonly blocks browser preflight in Expo web; skip it there.
    if (isRemoteWebRuntime() && isLocaltunnelUrl(normalized)) {
      return;
    }
    candidates.push(normalized);
  };

  const shouldPrioritizeLan = (typeof __DEV__ !== 'undefined' && __DEV__)
    && isNativeRuntime()
    && !!LAN_API_BASE_URL
    && (isLocalhostBaseUrl(API_BASE_URL) || isTunnelBaseUrl(API_BASE_URL));
  if (shouldPrioritizeLan) {
    pushUnique(LAN_API_BASE_URL);
  }

  pushUnique(RESOLVED_API_BASE_URL);

  // Local web should always have localhost fallback if a tunnel goes stale.
  if (isLocalWebRuntime()) {
    pushUnique(LOCAL_API_BASE_URL);
  }

  // Expo Go on a phone cannot reach localhost; always keep inferred LAN host as backup.
  if (isNativeRuntime() && LAN_API_BASE_URL) {
    pushUnique(LAN_API_BASE_URL);
  }

  // Last-resort fallback for dead tunnels (can be overridden via EXPO_PUBLIC_API_FALLBACK_URL).
  API_FALLBACK_URLS.forEach((url) => pushUnique(url));

  // Mobile remote sessions are tunnel-based and can rotate frequently.
  // Keep at least one non-tunnel emergency endpoint so requests can still route.
  const hasOnlyTunnels = candidates.length > 0 && candidates.every((url) => isTunnelBaseUrl(url));
  if (hasOnlyTunnels) {
    pushUnique(EMERGENCY_API_BASE_URL);
    pushUnique(PRODUCTION_API_BASE_URL);
  }

  // Final guard for empty/invalid candidate sets.
  if (candidates.length === 0) {
    pushUnique(PRODUCTION_API_BASE_URL);
    pushUnique(EMERGENCY_API_BASE_URL);
  }
  return candidates;
};

const API_BASE_CANDIDATES = buildApiBaseCandidates();
console.log('[API] Base URL candidates:', API_BASE_CANDIDATES.join(', '));

const TOKEN_KEY = 'unyield_auth_token';

// Upload timeout in milliseconds (tunnel/mobile uploads can exceed 2 minutes).
const UPLOAD_TIMEOUT = Number(process.env.EXPO_PUBLIC_UPLOAD_TIMEOUT_MS || 600000); // 10 minutes
const UPLOAD_RETRIES = Number(process.env.EXPO_PUBLIC_UPLOAD_RETRIES || 2);
const BLUR_TIMEOUT = 300000; // 5 minutes

class ApiService {
  constructor() {
    this.token = null;
    this.rateLimitUntil = 0;
    this.activeApiBaseUrl = API_BASE_CANDIDATES[0];
  }

  async init() {
    this.token = await AsyncStorage.getItem(TOKEN_KEY);
  }

  async setToken(token) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }

  async getToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number(value);
    if (!Number.isNaN(seconds)) {
      return Math.max(0, seconds * 1000);
    }
    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
    return null;
  }

  async waitForRateLimit() {
    while (this.rateLimitUntil > Date.now()) {
      const delayMs = this.rateLimitUntil - Date.now();
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Clear all auth-related data from storage (for recovery from corrupted state)
  async clearAllAuthData() {
    this.token = null;
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      'unyield_user_data',
      'unyield_seen_onboarding',
    ]);
  }

  getBaseUrlCandidates() {
    const prioritized = [];
    const pushUnique = (url) => {
      const normalized = normalizeBaseUrl(url);
      if (!normalized || prioritized.includes(normalized)) {
        return;
      }
      prioritized.push(normalized);
    };

    pushUnique(this.activeApiBaseUrl);
    API_BASE_CANDIDATES.forEach((url) => pushUnique(url));
    return prioritized;
  }

  markWorkingBaseUrl(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized || this.activeApiBaseUrl === normalized) {
      return;
    }
    this.activeApiBaseUrl = normalized;
    console.log('[API] Switched active base URL to:', normalized);
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const timeout = options.timeout || 30000; // 30 second default timeout (increased for cold starts)
    const maxRetries = options.retries ?? 2; // Retry up to 2 times on timeout

    let lastError;
    const baseCandidates = this.getBaseUrlCandidates();

    for (const baseUrl of baseCandidates) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
          };

          // localtunnel can show a password/reminder interstitial unless this header is present
          if (isLocaltunnelUrl(baseUrl)) {
            headers['bypass-tunnel-reminder'] = 'true';
          }

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          await this.waitForRateLimit();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(`${baseUrl}${endpoint}`, {
            ...options,
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const contentType = response.headers.get('content-type') || '';
          let data;
          if (response.status === 204) {
            data = { success: true };
          } else if (lower(contentType).includes('application/json')) {
            data = await response.json();
          } else {
            const responseText = await response.text();
            const parsed = parseJsonSafely(responseText);
            if (parsed) {
              data = parsed;
            } else {
              if (isLikelyTunnelInterference({
                baseUrl,
                status: response.status,
                contentType,
                responseText,
              })) {
                const tunnelError = new Error('Tunnel gateway response received');
                tunnelError.retryableTransport = true;
                throw tunnelError;
              }
              data = {
                success: response.ok,
                error: response.ok ? 'Unexpected non-JSON response from server' : `Request failed (${response.status})`,
              };
            }
          }

          if (response.status === 429) {
            const retryAfterMs = this.parseRetryAfter(response.headers.get('retry-after')) ?? 2000;
            const waitMs = Math.max(0, retryAfterMs);
            this.rateLimitUntil = Math.max(this.rateLimitUntil, Date.now() + waitMs);
            if (waitMs <= 5000 && attempt < maxRetries) {
              await this.waitForRateLimit();
              continue;
            }
            const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
            throw new Error(data.error || data.message || `Too many requests. Please wait ${waitSeconds}s and try again.`);
          }

          if (!response.ok) {
            const requestError = new Error(data.error || data.message || `Request failed (${response.status})`);
            requestError.status = response.status;
            throw requestError;
          }

          this.markWorkingBaseUrl(baseUrl);
          return data;
        } catch (error) {
          lastError = error;
          const retryable = (
            isNetworkLikeError(error) ||
            error?.retryableTransport === true ||
            (typeof error?.status === 'number' && (error.status === 408 || error.status >= 500))
          );

          if (retryable && attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
            continue;
          }

          // Network-like failures move to the next candidate base URL.
          if (retryable) {
            break;
          }

          throw error;
        }
      }
    }

    if (lastError?.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    const triedTunnelOnly = baseCandidates.length > 0 && baseCandidates.every((candidate) => isTunnelBaseUrl(candidate));
    if (triedTunnelOnly) {
      throw new Error(
        `Cannot connect to server. Tried: ${baseCandidates.join(', ')}. ` +
        'Tunnel may be stale. Restart remote session and re-scan the latest Expo QR code.'
      );
    }
    throw new Error(`Cannot connect to server. Tried: ${baseCandidates.join(', ')}`);
  }

  // HTTP method helpers (axios-like interface)
  // Note: These methods pass the endpoint directly, so use full path like '/api/users'
  // For query parameters, include them in the endpoint string
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Auth endpoints
  async register(email, password, username, inviteCode) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, inviteCode }),
    });
    if (response.data?.token) {
      await this.setToken(response.data.token);
    }
    return response;
  }

  async checkUsername(username) {
    return this.request(`/api/auth/check-username/${username}`);
  }

  async login(identifier, password) {
    const normalizedIdentifier = String(identifier || '').trim();
    const looksLikeEmail = normalizedIdentifier.includes('@');
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: normalizedIdentifier,
        email: looksLikeEmail ? normalizedIdentifier : undefined,
        username: looksLikeEmail ? undefined : normalizedIdentifier,
        password,
      }),
    });
    if (response.data?.token) {
      await this.setToken(response.data.token);
    }
    return response;
  }

  async loginAnonymous() {
    const response = await this.request('/api/auth/anonymous', {
      method: 'POST',
    });
    if (response.data?.token) {
      await this.setToken(response.data.token);
    }
    return response;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore errors on logout
    }
    await this.setToken(null);
  }

  // User endpoints
  async getProfile() {
    return this.request('/api/users/profile');
  }

  async updateProfile(updates) {
    return this.request('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getStats() {
    return this.request('/api/users/stats');
  }

  async getUserById(userId) {
    // Get public profile of another user
    return this.request(`/api/users/${userId}`);
  }

  async deleteAccount() {
    const response = await this.request('/api/users/account', {
      method: 'DELETE',
    });
    await this.setToken(null);
    return response;
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/users/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Workout endpoints
  async getWorkouts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/workouts${query ? `?${query}` : ''}`);
  }

  async logWorkout(workout) {
    return this.request('/api/workouts', {
      method: 'POST',
      body: JSON.stringify(workout),
    });
  }

  async deleteWorkout(id) {
    return this.request(`/api/workouts/${id}`, {
      method: 'DELETE',
    });
  }

  // Leaderboard endpoints
  async getLeaderboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/leaderboard${query ? `?${query}` : ''}`);
  }

  async getTopLeaderboard(count = 10, region = 'Global') {
    return this.request(`/api/leaderboard/top?count=${count}&region=${region}`);
  }

  async getWeightClasses() {
    return this.request('/api/leaderboard/weight-classes');
  }

  // Challenge endpoints
  async getChallenges(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/challenges${query ? `?${query}` : ''}`);
  }

  async getChallengeById(id) {
    return this.request(`/api/challenges/${id}`);
  }

  async joinChallenge(id) {
    return this.request(`/api/challenges/${id}/join`, {
      method: 'POST',
    });
  }

  async leaveChallenge(id) {
    return this.request(`/api/challenges/${id}/leave`, {
      method: 'POST',
    });
  }

  // Challenge submission endpoints
  async submitChallengeEntry(challengeId, entryData) {
    return this.request(`/api/challenges/${challengeId}/submit`, {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  }

  async getMyChallengeSubmissions(challengeId) {
    return this.request(`/api/challenges/${challengeId}/my-submissions`);
  }

  async getTopChallengeSubmissions(challengeId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/challenges/${challengeId}/top-submissions${query ? `?${query}` : ''}`);
  }

  // Admin challenge endpoints
  async getAdminChallenges(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/challenges${query ? `?${query}` : ''}`);
  }

  async getAdminChallengeDetails(challengeId) {
    return this.request(`/api/admin/challenges/${challengeId}`);
  }

  async createChallenge(challengeData) {
    return this.request('/api/admin/challenges', {
      method: 'POST',
      body: JSON.stringify(challengeData),
    });
  }

  async updateChallenge(challengeId, challengeData) {
    return this.request(`/api/admin/challenges/${challengeId}`, {
      method: 'PATCH',
      body: JSON.stringify(challengeData),
    });
  }

  async deleteChallenge(challengeId) {
    return this.request(`/api/admin/challenges/${challengeId}`, {
      method: 'DELETE',
    });
  }

  async getChallengeParticipants(challengeId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/challenges/${challengeId}/participants${query ? `?${query}` : ''}`);
  }

  async getChallengeSubmissions(challengeId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/challenges/${challengeId}/submissions${query ? `?${query}` : ''}`);
  }

  async verifyChallengeSubmission(submissionId, action, rejectionReason = '') {
    return this.request(`/api/admin/challenges/submissions/${submissionId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ action, rejectionReason }),
    });
  }

  async getChallengeLeaderboard(challengeId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/challenges/${challengeId}/leaderboard${query ? `?${query}` : ''}`);
  }

  async getPendingChallengeSubmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/challenges/pending-submissions${query ? `?${query}` : ''}`);
  }

  async getMyInviteCodes() {
    return this.request('/api/auth/invites');
  }

  async generateInviteCode() {
    return this.request('/api/auth/invites', {
      method: 'POST',
    });
  }

  async sendAdminNotification({ userIds, type = 'welcome', title, message, data = {} }) {
    return this.request('/api/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify({
        userIds,
        type,
        title,
        message,
        data,
      }),
    });
  }

  async broadcastAdminNotification({ type = 'welcome', title, message, data = {} }) {
    return this.request('/api/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type,
        title,
        message,
        data,
      }),
    });
  }

  async getMyChallengeSubmissions() {
    return this.request('/api/challenges/my-submissions');
  }

  // Notification endpoints
  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/notifications${query ? `?${query}` : ''}`);
  }

  async markNotificationRead(id) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async registerPushToken(pushToken) {
    try {
      return await this.request('/api/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ pushToken }),
      });
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      // Some fallback environments can be behind an older backend contract.
      // Treat missing route as non-fatal so login UX is not interrupted.
      if (message.includes('route not found') || message.includes('404')) {
        return {
          success: false,
          skipped: true,
          error: 'Push token endpoint unavailable on current backend',
        };
      }
      throw error;
    }
  }

  async getNotificationPreferences() {
    return this.request('/api/notifications/preferences');
  }

  async updateNotificationPreferences(preferences) {
    return this.request('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }

  // Video submission endpoints
  async uploadVideo(fileUri) {
    console.log('[UPLOAD] Starting video upload...', { fileUri });

    const getExtension = (uri) => {
      if (!uri) return null;
      const cleanUri = uri.split('?')[0].split('#')[0];
      const match = cleanUri.match(/\.([a-z0-9]+)$/i);
      return match ? match[1].toLowerCase() : null;
    };

    const extensionToMime = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mpeg: 'video/mpeg',
      mpg: 'video/mpeg',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
    };

    const mimeToExtension = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
      'video/mpeg': 'mpeg',
      'video/x-msvideo': 'avi',
      'video/x-ms-wmv': 'wmv',
    };

    const resolveVideoMeta = (uri, mimeType) => {
      const extFromUri = getExtension(uri);
      const resolvedMime = mimeType || (extFromUri ? extensionToMime[extFromUri] : null) || 'video/mp4';
      const resolvedExt = mimeToExtension[resolvedMime] || extFromUri || 'mp4';
      return {
        name: `video.${resolvedExt}`,
        type: resolvedMime,
      };
    };

    const formData = new FormData();

    // Detect if running on web by checking for blob: protocol (web returns blob URLs)
    const isWeb = fileUri.startsWith('blob:');

    if (isWeb) {
      // Web: Fetch the blob and append it directly
      console.log('[UPLOAD] Web platform detected, fetching blob...');
      try {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const fileMeta = resolveVideoMeta(fileUri, blob.type);
        // Append the blob directly with filename
        formData.append('video', blob, fileMeta.name);
        console.log('[UPLOAD] Blob fetched and appended to FormData');
      } catch (error) {
        console.error('[UPLOAD] Failed to fetch blob:', error);
        throw new Error('Failed to process video file. Please try again.');
      }
    } else {
      // React Native (iOS/Android): Use the object format
      const fileMeta = resolveVideoMeta(fileUri);
      formData.append('video', {
        uri: fileUri,
        type: fileMeta.type,
        name: fileMeta.name,
      });
      console.log('[UPLOAD] React Native FormData created');
    }

    console.log('[UPLOAD] FormData created', { formDataKeys: Array.from(formData.keys()) });

    // Use fetch directly for multipart/form-data
    const token = await this.getToken();
    const baseCandidates = this.getBaseUrlCandidates();
    let lastUploadError = null;
    const timeoutMessage = 'Upload timed out. Please check your connection and try again.';

    // Helper to safely parse JSON
    const safeJsonParse = async (response) => {
      try {
        return await response.json();
      } catch (e) {
        // Get response text for debugging
        const text = await response.text();
        console.error('[UPLOAD] JSON parse error. Response text:', text.substring(0, 500));
        throw new Error(`Server returned invalid response. Please try again. (${response.status})`);
      }
    };

    const uploadOnce = async (baseUrl) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
      try {
        return await fetch(`${baseUrl}/api/videos/upload`, {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(isLocaltunnelUrl(baseUrl) ? { 'bypass-tunnel-reminder': 'true' } : {}),
            // Don't set Content-Type - let fetch set it with the boundary
          },
          body: formData,
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error(timeoutMessage);
          timeoutError.name = 'AbortError';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    for (const baseUrl of baseCandidates) {
      for (let attempt = 0; attempt <= UPLOAD_RETRIES; attempt += 1) {
        try {
          console.log('[UPLOAD] Starting upload request', {
            baseUrl,
            attempt: attempt + 1,
            maxAttempts: UPLOAD_RETRIES + 1,
            timeoutMs: UPLOAD_TIMEOUT,
          });

          const uploadResponse = await uploadOnce(baseUrl);

          console.log('[UPLOAD] Response received', {
            baseUrl,
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            ok: uploadResponse.ok
          });

          if (!uploadResponse.ok) {
            const errorData = await safeJsonParse(uploadResponse);
            console.error('[UPLOAD] Upload failed', errorData);
            const uploadError = new Error(errorData.error || errorData.message || 'Upload failed');
            uploadError.status = uploadResponse.status;
            throw uploadError;
          }

          const result = await safeJsonParse(uploadResponse);
          this.markWorkingBaseUrl(baseUrl);
          console.log('[UPLOAD] Upload successful', { result });
          return result;
        } catch (error) {
          lastUploadError = error;
          const retryable = (
            isNetworkLikeError(error) ||
            (typeof error?.status === 'number' && (error.status === 408 || error.status >= 500))
          );

          if (retryable && attempt < UPLOAD_RETRIES) {
            const waitMs = (attempt + 1) * 1500;
            console.warn('[UPLOAD] Attempt failed, retrying...', {
              baseUrl,
              attempt: attempt + 1,
              waitMs,
              error: error.message,
            });
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }

          if (!retryable) {
            throw error;
          }

          console.warn('[UPLOAD] Base URL failed after retries, trying next candidate...', {
            baseUrl,
            error: error.message,
          });
          break;
        }
      }
    }

    if (lastUploadError?.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw lastUploadError || new Error(`Upload failed for all API endpoints: ${baseCandidates.join(', ')}`);
  }

  async submitVideo(videoData) {
    console.log('[API] submitVideo called with:', videoData);
    try {
      const result = await this.request('/api/videos', {
        method: 'POST',
        body: JSON.stringify(videoData),
      });
      console.log('[API] submitVideo successful:', result);
      return result;
    } catch (error) {
      console.error('[API] submitVideo failed:', error);
      throw error;
    }
  }

  async getMyVideos(status) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/api/videos${query}`);
  }

  async getUserVideos(userId) {
    // Get another user's public videos (approved only)
    return this.request(`/api/users/${userId}/videos`);
  }

  async getVideo(id) {
    return this.request(`/api/videos/${id}`);
  }

  async deleteVideo(id) {
    return this.request(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteChallengeSubmission(id) {
    return this.request(`/api/challenges/submissions/${id}`, {
      method: 'DELETE',
    });
  }

  async getVerificationQueue() {
    return this.request('/api/videos/queue');
  }

  async verifyVideo(id, action, rejectionReason) {
    return this.request(`/api/videos/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ action, rejectionReason }),
    });
  }

  async reportVideo(id, reportType, reason) {
    return this.request(`/api/videos/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reportType, reason }),
    });
  }

  async appealVideo(id, reason) {
    return this.request(`/api/videos/${id}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getAppealsQueue() {
    return this.request('/api/videos/appeals/queue');
  }

  async reviewAppeal(id, action, reviewNotes) {
    return this.request(`/api/videos/appeals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, reviewNotes }),
    });
  }

  async getReportsQueue() {
    return this.request('/api/videos/reports/queue');
  }

  async reviewReport(id, action, reviewNotes, actionTaken) {
    return this.request(`/api/videos/reports/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, reviewNotes, actionTaken }),
    });
  }

  // Core Lift Leaderboard endpoints
  async getCoreLiftLeaderboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/core-lifts/leaderboard${query ? `?${query}` : ''}`);
  }

  async submitCoreLift(liftData) {
    return this.request('/api/core-lifts/submit', {
      method: 'POST',
      body: JSON.stringify(liftData),
    });
  }

  async getMyCoreLiftRecords() {
    return this.request('/api/core-lifts/my-records');
  }

  // Seasonal Challenges endpoints
  async getSeasonalChallenges(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/challenges/seasonal${query ? `?${query}` : ''}`);
  }

  async refreshChallengeLeaderboard(challengeId) {
    return this.request(`/api/challenges/${challengeId}/leaderboard-refresh`, {
      method: 'POST',
    });
  }

  // Admin video moderation endpoints
  async getAdminPendingVideos(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/videos/pending${query ? `?${query}` : ''}`);
  }

  async adminVerifyVideo(videoId, action, rejectionReason = '', pointsAwarded = null) {
    const body = {
      action,
      rejectionReason,
    };
    if (pointsAwarded !== null) {
      body.pointsAwarded = pointsAwarded;
    }
    console.log('[API] adminVerifyVideo called:', { videoId, action, rejectionReason, pointsAwarded });
    return this.request(`/api/admin/videos/${videoId}/verify`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Blur faces in video using the Python faceblurapi service
  async blurVideo(videoUrl) {
    console.log('[API] blurVideo called with videoUrl:', videoUrl?.substring(0, 50) + '...');
    if (!videoUrl) {
      return { success: false, error: 'videoUrl is required' };
    }

    try {
      const data = await this.request('/api/videos/blur', {
        method: 'POST',
        body: JSON.stringify({ videoUrl }),
        timeout: BLUR_TIMEOUT,
        retries: 3, // Allow retries for network issues when app resumes from background
      });

      console.log('[API] blurVideo response:', data.success ? 'success' : data.error);
      return data;
    } catch (error) {
      console.error('[API] blurVideo error:', error);
      return { success: false, error: error.message || 'Face blur service unavailable' };
    }
  }

  // Detect faces in video without blurring (for testing)
  async detectFaces(videoUrl) {
    const FACE_BLUR_API_URL = process.env.EXPO_PUBLIC_FACE_BLUR_API_URL || 'https://unyield-faceblur-api-production.up.railway.app';

    try {
      const response = await fetch(`${FACE_BLUR_API_URL}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export const api = new ApiService();
export default api;
