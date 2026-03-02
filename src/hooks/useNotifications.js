import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../services/api';

const PUSH_CHANNEL_ID = 'unyield_high_priority';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Custom hook for managing Expo push notifications
 * Handles permission requests, token registration, and notification response handling
 */
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const tokenRegisteredRef = useRef(false);
  const lastRegisteredTokenRef = useRef('');
  const invalidProjectIdWarnedRef = useRef(false);

  // Placeholder project ID should never be used for push token requests.
  const KNOWN_INVALID_PROJECT_IDS = new Set([
    '5f0a7b7e-5e3f-4b5a-8c9d-1e2f3a4b5c6d',
  ]);

  const warnInvalidProjectIdOnce = useCallback((projectId) => {
    if (invalidProjectIdWarnedRef.current) return;
    invalidProjectIdWarnedRef.current = true;
    console.warn(
      `[Notifications] Invalid Expo projectId "${projectId}". Falling back to Expo Go token flow. ` +
      'Set expo.extra.eas.projectId to your real EAS project ID for production builds.'
    );
  }, []);

  const resolveProjectId = useCallback(() => {
    const projectId = (
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.expoConfig?.extra?.projectId ||
      Constants.expoConfig?.projectId
    );

    if (!projectId || KNOWN_INVALID_PROJECT_IDS.has(projectId)) {
      if (projectId) {
        warnInvalidProjectIdOnce(projectId);
      }
      return null;
    }

    return projectId;
  }, [warnInvalidProjectIdOnce]);

  const isExperienceNotFoundError = useCallback((error) => {
    const message = String(error?.message || error || '');
    return message.includes('EXPERIENCE_NOT_FOUND');
  }, []);

  const ensureAndroidChannel = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'UNYIELD Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9b2c2c',
      sound: 'default',
    });
  }, []);

  const registerTokenWithBackend = useCallback(async (token) => {
    if (!token) return false;

    if (lastRegisteredTokenRef.current === token) {
      tokenRegisteredRef.current = true;
      return true;
    }

    const authToken = await api.getToken();
    if (!authToken) {
      console.log('Auth token not available yet; deferring push token backend registration');
      return false;
    }

    await api.registerPushToken(token);
    lastRegisteredTokenRef.current = token;
    tokenRegisteredRef.current = true;
    console.log('Push token registered with backend');
    return true;
  }, []);

  /**
   * Register for push notifications and get Expo push token
   */
  const registerForPushNotificationsAsync = useCallback(async ({ requestIfNotGranted = true } = {}) => {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted' && requestIfNotGranted) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Expo Go on Android (SDK 53+) does not support remote push notifications.
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
      console.warn(
        '[Notifications] Remote push is unavailable in Expo Go on Android (SDK 53+). ' +
        'Use a development build (`npx expo run:android` or EAS development build) to receive push notifications.'
      );
      return null;
    }

    await ensureAndroidChannel();

    const projectId = resolveProjectId();

    // Get Expo push token
    try {
      let token;

      if (projectId) {
        try {
          token = await Notifications.getExpoPushTokenAsync({ projectId });
        } catch (error) {
          if (!isExperienceNotFoundError(error)) {
            throw error;
          }
          warnInvalidProjectIdOnce(projectId);
          token = await Notifications.getExpoPushTokenAsync();
        }
      } else {
        token = await Notifications.getExpoPushTokenAsync();
      }

      setExpoPushToken(token.data);

      console.log('Expo push token:', token.data);

      try {
        await registerTokenWithBackend(token.data);
      } catch (error) {
        console.warn('Failed to register push token with backend:', error?.message || error);
      }

      return token.data;
    } catch (error) {
      if (isExperienceNotFoundError(error)) {
        warnInvalidProjectIdOnce(projectId);
        try {
          const fallbackToken = await Notifications.getExpoPushTokenAsync();
          setExpoPushToken(fallbackToken.data);
          try {
            await registerTokenWithBackend(fallbackToken.data);
          } catch (registerError) {
            console.warn('Failed to register fallback push token with backend:', registerError?.message || registerError);
          }
          return fallbackToken.data;
        } catch (fallbackError) {
          console.error('Failed to get Expo push token from fallback flow:', fallbackError?.message || fallbackError);
          return null;
        }
      }
      console.error('Failed to get Expo push token:', error?.message || error);
      if (String(error?.message || '').includes('projectId')) {
        warnInvalidProjectIdOnce(projectId);
      }
      return null;
    }
  }, [resolveProjectId, ensureAndroidChannel, isExperienceNotFoundError, registerTokenWithBackend, warnInvalidProjectIdOnce]);

  /**
   * Request notification permissions
   */
  const requestPermissions = useCallback(async () => {
    if (!Device.isDevice) {
      alert('Push notifications only work on physical devices');
      return false;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);

    if (status !== 'granted') {
      return false;
    }

    // Try to register for push notifications (get push token)
    // Don't fail if token registration fails - permission is still granted
    await registerForPushNotificationsAsync({ requestIfNotGranted: false });

    return true;
  }, [registerForPushNotificationsAsync]);

  /**
   * Handle notification response (user tapping on notification)
   */
  const handleNotificationResponse = useCallback((response) => {
    const data = response.notification.request.content.data;

    console.log('Notification tapped:', data);

    // Handle deep linking based on notification data
    if (data?.screen) {
      // Navigation would be handled by the navigation container
      // This is where you'd navigate to the appropriate screen
      console.log('Should navigate to:', data.screen, data);
    }
  }, []);

  /**
   * Set up notification listeners
   */
  useEffect(() => {
    let mounted = true;
    // Check if we're on a physical device
    if (!Device.isDevice) {
      if (mounted) setIsReady(true);
      return;
    }

    (async () => {
      await ensureAndroidChannel();

      const { status } = await Notifications.getPermissionsAsync();
      if (mounted) setPermissionStatus(status);

      if (status === 'granted') {
        await registerForPushNotificationsAsync({ requestIfNotGranted: false });
      }

      if (mounted) setIsReady(true);
    })();

    // Listen for notification responses (user tapping)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Listen for notifications received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received in foreground:', notification);
      }
    );

    return () => {
      mounted = false;
      subscription.remove();
      foregroundSubscription.remove();
    };
  }, [ensureAndroidChannel, registerForPushNotificationsAsync, handleNotificationResponse]);

  // If token exists but backend registration was deferred (e.g. before auth was ready),
  // try again when this hook re-renders with a known token.
  useEffect(() => {
    if (!expoPushToken) return;
    if (lastRegisteredTokenRef.current === expoPushToken) return;

    registerTokenWithBackend(expoPushToken).catch((error) => {
      console.warn('Deferred push token sync failed:', error?.message || error);
    });
  }, [expoPushToken, registerTokenWithBackend]);

  const syncPushTokenToServer = useCallback(async () => {
    const token = expoPushToken || await registerForPushNotificationsAsync({ requestIfNotGranted: false });
    if (!token) {
      return { success: false, reason: 'no_token' };
    }

    try {
      const synced = await registerTokenWithBackend(token);
      return { success: synced, token };
    } catch (error) {
      return { success: false, token, error: error?.message || String(error) };
    }
  }, [expoPushToken, registerForPushNotificationsAsync, registerTokenWithBackend]);

  return {
    expoPushToken,
    permissionStatus,
    isReady,
    requestPermissions,
    registerForPushNotificationsAsync,
    syncPushTokenToServer,
  };
}

/**
 * Hook to schedule local notifications
 */
export function useLocalNotifications() {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      if (!Device.isDevice) {
        setHasPermission(false);
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  /**
   * Schedule a local notification
   */
  const scheduleNotification = async (title, body, data = {}, trigger = null) => {
    if (!hasPermission) {
      console.warn('No notification permission');
      return null;
    }

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: trigger || null, // null = show immediately
      });

      console.log('Scheduled notification:', id);
      return id;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  };

  /**
   * Cancel a scheduled notification
   */
  const cancelNotification = async (id) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      console.log('Cancelled notification:', id);
      return true;
    } catch (error) {
      console.error('Failed to cancel notification:', error);
      return false;
    }
  };

  /**
   * Cancel all scheduled notifications
   */
  const cancelAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled all notifications');
      return true;
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
      return false;
    }
  };

  return {
    hasPermission,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
  };
}

export default useNotifications;
