import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { EXERCISES, EXERCISE_CATEGORIES } from '../constants/exercises';

export { EXERCISES, EXERCISE_CATEGORIES };

// ----------------------------
// Preloadable hoodie images
// ----------------------------
const HOODIE_IMAGES = {
  1: require('../../assets/unyieldgold.png'),
  2: require('../../assets/unyieldsilver.png'),
  3: require('../../assets/unyieldbronze.png'),
};

// Preload all hoodie images
function preloadAssets() {
  const imageSources = Object.values(HOODIE_IMAGES);
  return Promise.all(
    imageSources.map(async (source) => {
      try {
        const asset = Asset.fromModule(source);
        await asset.downloadAsync();
      } catch {
        // Asset preloading is best-effort only.
      }
    })
  );
}

// ----------------------------
// Storage keys
// ----------------------------
export const LS_USER = 'unyield_user';
export const LS_LOGS = 'unyield_logs';
export const LS_GEMINI_KEY = 'unyield_gemini_api_key';
export const LS_WORKOUT_VIDEOS = 'unyield_workout_videos';
export const LS_WEIGHT_UNIT = 'unyield_weight_unit';
export const LS_HEIGHT_UNIT = 'unyield_height_unit';

// ----------------------------
// Limits
// ----------------------------
export const MAX_REPS = 2000;
export const MAX_WEIGHT_KG = 1000;
export const MAX_WEIGHT_LBS = 2200;

// ----------------------------
// Reference data
// ----------------------------
export const REGIONS = [
  'Global',
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Glasgow',
];

export const GOALS = ['Hypertrophy', 'Leanness', 'Performance'];

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// ----------------------------
// Helpers
// ----------------------------

// OLD - DEPRECATED (kept for backward compatibility)
// This function is deprecated. Use calcStrengthRatio() instead.
export function calcPoints(exercise, reps, weight, streak) {
  const intensity = exercise?.intensity ?? 1;
  const base = reps * intensity;
  const weightBonus = Math.max(0, Math.round((weight || 0) * 0.1));
  const streakBonus = Math.min(50, (streak || 0) * 4);
  return Math.max(1, Math.round(base + weightBonus + streakBonus));
}

// ----------------------------
// Strength Ratio System (NEW)
// ----------------------------

/**
 * Calculate Strength Ratio for a workout
 * Formula: (Total weight lifted / Bodyweight) * (Reps * 0.1)
 *
 * @param {Object} params
 * @param {number} params.reps - Number of reps
 * @param {number} params.weightLifted - Weight lifted per rep (kg)
 * @param {number} params.bodyweight - User's bodyweight (kg)
 * @returns {number} Strength ratio score (rounded to 3 decimal places)
 */
export function calcStrengthRatio({ reps, weightLifted, bodyweight }) {
  // Validation
  if (!bodyweight || bodyweight <= 0) {
    console.warn('calcStrengthRatio: Invalid bodyweight, returning 0');
    return 0;
  }

  if (!weightLifted || weightLifted <= 0) {
    return 0;
  }

  if (!reps || reps <= 0) {
    return 0;
  }

  // Total weight lifted
  const totalWeight = reps * weightLifted;

  // Base ratio: total weight / bodyweight
  const baseRatio = totalWeight / bodyweight;

  // Rep multiplier: reps * 0.1
  const repMultiplier = reps * 0.1;

  // Final score
  const strengthRatio = baseRatio * repMultiplier;

  // Round to 3 decimal places
  return Math.round(strengthRatio * 1000) / 1000;
}

/**
 * Get weight class from bodyweight in kg
 *
 * @param {number} weightKg - Bodyweight in kg
 * @returns {string|null} Weight class identifier
 */
export function getWeightClassFromWeight(weightKg) {
  if (!weightKg || weightKg < 55) return null;
  if (weightKg <= 64) return 'W55_64';
  if (weightKg <= 74) return 'W65_74';
  if (weightKg <= 84) return 'W75_84';
  if (weightKg <= 94) return 'W85_94';
  if (weightKg <= 109) return 'W95_109';
  return 'W110_PLUS';
}

/**
 * Get display label for weight class
 * @param {string} weightClass - Weight class identifier
 * @returns {string} Human-readable label
 */
export function getWeightClassLabel(weightClass) {
  const labels = {
    'W55_64': '55-64 kg',
    'W65_74': '65-74 kg',
    'W75_84': '75-84 kg',
    'W85_94': '85-94 kg',
    'W95_109': '95-109 kg',
    'W110_PLUS': '110+ kg',
    'UNCLASSIFIED': 'Unclassified'
  };
  return labels[weightClass] || 'Unknown';
}

/**
 * Format strength ratio for display
 * @param {number} ratio - Strength ratio
 * @returns {string} Formatted string (e.g., "2.456")
 */
export function formatStrengthRatio(ratio) {
  if (ratio === null || ratio === undefined) return '0.000';
  return ratio.toFixed(3);
}

// ----------------------------
// Provider
// ----------------------------
export function AppProvider({ children }) {
  const { signOut, user: authUser, refreshUser } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Sync user from AuthContext
  useEffect(() => {
    if (authUser) {
      console.log('AppContext: Syncing user from AuthContext:', {
        ...authUser,
        profileImage: authUser.profileImage ? `[IMAGE - ${authUser.profileImage.length} chars]` : null
      });
      setUser(authUser);
    } else {
      setUser(null);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [authUser]);

  // Load local data on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedLogs, savedWeightUnit, savedHeightUnit] = await Promise.all([
          AsyncStorage.getItem(LS_LOGS),
          AsyncStorage.getItem(LS_WEIGHT_UNIT),
          AsyncStorage.getItem(LS_HEIGHT_UNIT),
        ]);

        if (!mounted) return;

        if (savedLogs) {
          try {
            const parsed = JSON.parse(savedLogs);
            setLogs(Array.isArray(parsed) ? parsed : []);
          } catch {
            setLogs([]);
          }
        }

        if (savedWeightUnit && (savedWeightUnit === 'kg' || savedWeightUnit === 'lbs')) {
          setWeightUnit(savedWeightUnit);
        }

        if (savedHeightUnit && (savedHeightUnit === 'cm' || savedHeightUnit === 'ft')) {
          setHeightUnit(savedHeightUnit);
        }

        // Preload assets
        await preloadAssets();
      } finally {
        if (mounted) setIsReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Persist logs locally (as backup)
  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(LS_LOGS, JSON.stringify(logs)).catch(() => {});
  }, [logs, isReady]);

  // Persist weight unit
  useEffect(() => {
    AsyncStorage.setItem(LS_WEIGHT_UNIT, weightUnit).catch(() => {});
  }, [weightUnit]);

  // Persist height unit
  useEffect(() => {
    AsyncStorage.setItem(LS_HEIGHT_UNIT, heightUnit).catch(() => {});
  }, [heightUnit]);

  const onboardingComplete = useCallback(async ({ name, region, goal }) => {
    // Update profile on backend
    try {
      await api.updateProfile({ name, region, goal });
      // Refresh user data from server
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }, [refreshUser]);

  const refreshNotifications = useCallback(async (params = {}) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setNotificationsLoading(true);
    try {
      const response = await api.getNotifications(params);
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
      return response;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, error: error.message };
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshNotifications().catch(() => {});
    }
  }, [user, refreshNotifications]);

  const markNotificationRead = useCallback(async (id) => {
    if (!id) return { success: false, error: 'Missing notification id' };
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, read: true, readAt: notification.readAt || new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      return await api.markNotificationRead(id);
    } catch (error) {
      console.error('Error marking notification read:', error);
      refreshNotifications().catch(() => {});
      return { success: false, error: error.message };
    }
  }, [refreshNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
        readAt: notification.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    try {
      return await api.markAllNotificationsRead();
    } catch (error) {
      console.error('Error marking all notifications read:', error);
      refreshNotifications().catch(() => {});
      return { success: false, error: error.message };
    }
  }, [refreshNotifications]);

  const updateUser = useCallback(async (partial) => {
    try {
      await api.updateProfile(partial);
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      // Update locally as fallback
      setUser((prev) => prev ? { ...prev, ...partial } : prev);
    }
  }, [refreshUser]);

  const addLog = useCallback(async (log) => {
    try {
      // Send workout to backend
      const response = await api.logWorkout({
        exercise: log.exercise?.name || log.exercise,
        reps: log.reps,
        weight: log.weight || null,
        duration: log.duration || null,
        notes: log.notes || null,
        // New PB and reflection fields
        isPB: log.isPB || false,
        pbNote: log.pbNote || null,
        dayNotes: log.dayNotes || null,
        mood: log.mood || null,
        energyLevel: log.energyLevel || null,
      });

      if (response.success) {
        // Add to local logs - preserve the original log date
        const newLog = {
          ...log,
          id: response.data?.workout?._id || log.id,
          points: response.data?.pointsEarned || log.points,
          // Preserve the original date from the log (don't overwrite)
          date: log.date || new Date().toISOString(),
        };
        setLogs((prev) => [newLog, ...(prev || [])]);

        // Refresh user to get updated points/streak
        if (refreshUser) {
          await refreshUser();
        }

        return { success: true, data: response.data };
      }
    } catch (error) {
      console.error('Error logging workout:', error);
      // Still add locally as fallback
      setLogs((prev) => [log, ...(prev || [])]);
      setUser((prev) => {
        if (!prev) return prev;
        const nextTotal = (prev.totalPoints || 0) + (log.points || 0);
        return {
          ...prev,
          totalPoints: nextTotal,
          rank: Math.max(1, 100 - Math.floor(nextTotal / 250)),
        };
      });
      return { success: false, error: error.message };
    }
  }, [refreshUser]);

  const deleteLog = useCallback(async (logId) => {
    try {
      // Find log to get points
      const logToDelete = logs.find(l => l.id === logId);
      const pointsLost = logToDelete?.points || 0;

      // Remove from local logs immediately for UI responsiveness
      setLogs((prev) => prev.filter(log => log.id !== logId));

      // Update user profile on backend
      const updatedLogs = (user?.logs || logs || []).filter(log => log.id !== logId);
      const newTotalPoints = Math.max(0, (user?.totalPoints || 0) - pointsLost);

      await api.updateProfile({
        logs: updatedLogs,
        totalPoints: newTotalPoints,
      });

      // Refresh user to sync state
      if (refreshUser) {
        await refreshUser();
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting log:', error);
      // Refresh to restore state on error
      if (refreshUser) {
        await refreshUser();
      }
      return { success: false, error: error.message };
    }
  }, [logs, user, refreshUser]);

  const updateLog = useCallback(async (logId, updates) => {
    try {
      // Update local logs immediately for UI responsiveness
      setLogs((prev) =>
        prev.map((log) =>
          log.id === logId ? { ...log, ...updates } : log
        )
      );

      // Also update on backend via profile update
      const updatedLogs = logs.map((log) =>
        log.id === logId ? { ...log, ...updates } : log
      );

      await api.updateProfile({
        logs: updatedLogs,
      });

      // Refresh user to sync state
      if (refreshUser) {
        await refreshUser();
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating log:', error);
      // Refresh to restore state on error
      if (refreshUser) {
        await refreshUser();
      }
      return { success: false, error: error.message };
    }
  }, [logs, refreshUser]);

  const deleteAllLogs = useCallback(async () => {
    try {
      // Clear local logs immediately
      setLogs([]);

      // Update user profile on backend
      await api.updateProfile({
        logs: [],
        totalPoints: 0,
      });

      // Refresh user to sync state
      if (refreshUser) {
        await refreshUser();
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting all logs:', error);
      // Refresh to restore state on error
      if (refreshUser) {
        await refreshUser();
      }
      return { success: false, error: error.message };
    }
  }, [refreshUser]);

  const resetAll = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        LS_USER,
        LS_LOGS,
        LS_GEMINI_KEY,
        LS_WORKOUT_VIDEOS,
        LS_WEIGHT_UNIT,
        LS_HEIGHT_UNIT,
        'unyield_user_data',
        'unyield_seen_onboarding',
        'unyield_auth_token',
      ]);
    } catch (e) {
      console.error('Error clearing AsyncStorage:', e);
    }
    setUser(null);
    setLogs([]);
    setWeightUnit('kg');
    setHeightUnit('cm');
    await signOut();
  }, [signOut]);

  const toggleWeightUnit = useCallback(() => {
    setWeightUnit((prev) => (prev === 'kg' ? 'lbs' : 'kg'));
  }, []);

  const toggleHeightUnit = useCallback(() => {
    setHeightUnit((prev) => (prev === 'cm' ? 'ft' : 'cm'));
  }, []);

  const value = useMemo(() => ({
    isReady,
    user,
    logs,
    weightUnit,
    heightUnit,
    notifications,
    unreadCount,
    notificationsLoading,
    toggleWeightUnit,
    toggleHeightUnit,
    onboardingComplete,
    updateUser,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    addLog,
    updateLog,
    deleteLog,
    deleteAllLogs,
    resetAll,
  }), [isReady, user, logs, weightUnit, heightUnit, notifications, unreadCount, notificationsLoading, toggleWeightUnit, toggleHeightUnit, onboardingComplete, updateUser, refreshNotifications, markNotificationRead, markAllNotificationsRead, addLog, updateLog, deleteLog, deleteAllLogs, resetAll]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
