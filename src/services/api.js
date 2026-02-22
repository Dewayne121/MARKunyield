import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Use environment variable or default to production
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unyielding-api-production.up.railway.app';

const TOKEN_KEY = 'unyield_auth_token';

// Upload timeout in milliseconds
const UPLOAD_TIMEOUT = 120000; // 2 minutes
const BLUR_TIMEOUT = 300000; // 5 minutes

class ApiService {
  constructor() {
    this.token = null;
    this.rateLimitUntil = 0;
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

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const timeout = options.timeout || 30000; // 30 second default timeout (increased for cold starts)
    const maxRetries = options.retries ?? 2; // Retry up to 2 times on timeout

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-JSON responses (like 204 No Content)
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = { success: response.ok };
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
          throw new Error(data.error || data.message || 'Request failed');
        }

        return data;
      } catch (error) {
        lastError = error;

        // Only retry on timeout or network errors, not on server errors
        const isRetryable = error.name === 'AbortError' ||
                           error.message === 'Network request failed' ||
                           error.message.includes('network');

        if (isRetryable && attempt < maxRetries) {
          // Wait before retrying (exponential backoff: 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
          continue;
        }

        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        if (error.message === 'Network request failed') {
          throw new Error('Cannot connect to server. Check your network connection.');
        }
        throw error;
      }
    }

    throw lastError;
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

  async login(email, password) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
    return this.request('/api/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
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
    console.log('[UPLOAD] Token retrieved, starting fetch to', `${API_BASE_URL}/api/videos/upload`);

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Upload timed out. Please check your connection and try again.')), UPLOAD_TIMEOUT);
    });

    // Race between fetch and timeout
    const uploadPromise = fetch(`${API_BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let fetch set it with the boundary
      },
      body: formData,
    });

    const uploadResponse = await Promise.race([uploadPromise, timeoutPromise]);

    console.log('[UPLOAD] Response received', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });

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

    if (!uploadResponse.ok) {
      const errorData = await safeJsonParse(uploadResponse);
      console.error('[UPLOAD] Upload failed', errorData);
      throw new Error(errorData.error || errorData.message || 'Upload failed');
    }

    const result = await safeJsonParse(uploadResponse);
    console.log('[UPLOAD] Upload successful', { result });
    return result;
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
