import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StreamlinedOnboardingProvider } from '../context/StreamlinedOnboardingContext';
import { SKINS } from '../constants/colors';
import { NavigationService } from './NavigationService';

// Screens
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { StreamlinedOnboardingNavigator } from '../screens/onboarding/streamlined';
import DashboardScreen from '../screens/DashboardScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrainingNavigator from './TrainingNavigator';
import CompeteScreen from '../screens/CompeteScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import ChallengeSubmissionScreen from '../screens/ChallengeSubmissionScreen';
import WorkoutSubmitScreen from '../screens/WorkoutSubmitScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import TrainingReportScreen from '../screens/TrainingReportScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CoreLiftLeaderboardScreen from '../screens/CoreLiftLeaderboardScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import VideoModerationScreen from '../screens/admin/VideoModerationScreen';
import AppealsManagementScreen from '../screens/admin/AppealsManagementScreen';
import ReportsManagementScreen from '../screens/admin/ReportsManagementScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import ChallengeManagementScreen from '../screens/admin/ChallengeManagementScreen';
import ChallengeBuilderScreen from '../screens/admin/ChallengeBuilderScreen';
import AdminSendNotificationScreen from '../screens/admin/AdminSendNotificationScreen';
import DebugNotificationScreen from '../screens/DebugNotificationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ------------------------------------------------------------------
// SUBTLE GRITTY FIRE EFFECTS (Triggers on COMPETE tab)
// ------------------------------------------------------------------

const FlameParticle = ({ delay, xOffset, size, color, duration, heightOffset }) => {
  const anim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: duration,
        delay: delay,
        useNativeDriver: true,
      })
    ).start();
  }, [anim, duration, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [5, heightOffset] });
  const scale = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0.2, 1, 0.6, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 0.8, 0.5, 0] });

  return (
    <Animated.View style={[
      styles.flameParticle,
      {
        left: xOffset,
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: size,
        shadowColor: color,
        transform: [{ translateY }, { scale }],
        opacity,
      }
    ]} />
  );
};

const FireFlames = () => {
  // Generate subtle but visible fire particles
  const particles = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      delay: Math.random() * 1200,
      xOffset: `${(i / 19) * 96}%`, // Distribute across the bar
      size: 10 + Math.random() * 15, // Noticeable ember chunks
      color: Math.random() > 0.5 ? '#b91c1c' : (Math.random() > 0.3 ? '#8b0000' : '#ff4500'),
      duration: 600 + Math.random() * 800, 
      heightOffset: -30 - Math.random() * 40 // Shoots up just enough to be seen clearly over the pill
    }));
  }, []);

  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, [glowAnim]);

  return (
    <View style={styles.flamesContainer} pointerEvents="none">
      {/* Pulsing core glow representing the smoldering base */}
      <Animated.View style={[
        styles.coreGlow,
        {
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.7] }),
          transform: [{ scaleY: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }]
        }
      ]} />
      {/* Individual leaping embers */}
      {particles.map(p => (
        <FlameParticle key={p.id} {...p} />
      ))}
    </View>
  );
};

// ------------------------------------------------------------------
// TAB NAVIGATION COMPONENTS
// ------------------------------------------------------------------

const TabItem = ({ route, index, isFocused, onPress, tabConfig }) => {
  const isCompete = route.name === 'Compete';
  const focusAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      tension: 120, 
      friction: 12,
    }).start();
  }, [isFocused]);

  const scale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const translateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.tabItemWrapper}
    >
      <Animated.View 
        style={[
          styles.tabItemInner, 
          isCompete && styles.competeInner,
          isCompete && isFocused && styles.competeInnerActive, // Extra burn when compete is selected
          { transform: [{ scale }, { translateY }] }
        ]}
      >
        <Ionicons
          name={tabConfig.icon}
          size={isCompete ? 22 : 20}
          color={
            isFocused 
              ? (isCompete ? '#fff' : '#b91c1c') 
              : (isCompete ? '#e5e5e5' : '#666')
          }
        />
        {!isCompete && (
          <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
            {tabConfig.label}
          </Text>
        )}
        {isCompete && isFocused && (
          <Text
            style={styles.competeLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            allowFontScaling={false}
          >
            COMPETE
          </Text>
        )}
      </Animated.View>
      
      {!isCompete && (
        <Animated.View 
          style={[
            styles.activeIndicator, 
            { 
              opacity: focusAnim,
              transform: [
                { scaleX: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }
              ] 
            }
          ]} 
        />
      )}
    </TouchableOpacity>
  );
};

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const isCompeteActive = state.routes[state.index].name === 'Compete';

  const tabs = {
    'Base': { icon: 'home', label: 'HOME' },
    'Training': { icon: 'barbell', label: 'TRAIN' },
    'Compete': { icon: 'trophy', label: 'COMPETE' }, 
    'Leagues': { icon: 'ribbon', label: 'RANKS' },
    'Stats': { icon: 'person', label: 'STATS' },
  };

  return (
    <View style={[styles.floatingPillContainer, { bottom: Math.max(insets.bottom, 16) }]}>
      
      {/* Mount the fiery eruption behind the pill when compete is active */}
      {isCompeteActive && <FireFlames />}

      {/* The Main Pill Navigation Bar */}
      <View style={[
        styles.floatingPill, 
        isCompeteActive && styles.floatingPillOnFire // Dynamically changes border & shadow to match fire
      ]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tabConfig = tabs[route.name] || { icon: 'square', label: route.name.toUpperCase() };

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TabItem 
              key={route.key}
              route={route}
              index={index}
              isFocused={isFocused}
              onPress={onPress}
              tabConfig={tabConfig}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tabs() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgDeep }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          sceneContainerStyle: { paddingBottom: 110 } 
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tab.Screen name="Base" component={DashboardScreen} options={{ tabBarLabel: 'Base' }} />
        <Tab.Screen name="Training" component={TrainingNavigator} options={{ tabBarLabel: 'Training' }} />
        <Tab.Screen name="Compete" component={CompeteScreen} options={{ tabBarLabel: 'Compete' }} />
        <Tab.Screen name="Leagues" component={LeaderboardScreen} options={{ tabBarLabel: 'Leagues' }} />
        <Tab.Screen name="Stats" component={ProfileScreen} options={{ tabBarLabel: 'Stats' }} />
      </Tab.Navigator>
    </View>
  );
}

function RootNavigator() {
  const { isReady } = useApp();
  const { loading: authLoading, isAuthenticated, onboardingCompleted } = useAuth();

  if (!isReady || authLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
      ) : !onboardingCompleted ? (
        <Stack.Screen name="Onboarding" component={StreamlinedOnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={Tabs} />
      )}

      {/* Overlays & Modals */}
      <Stack.Screen name="LogModal" component={WorkoutSubmitScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="CalendarLog" component={TrainingReportScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />

      {/* Challenge Routes */}
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="ChallengeSubmission" component={ChallengeSubmissionScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="CoreLiftLeaderboard" component={CoreLiftLeaderboardScreen} options={{ presentation: 'card' }} />

      {/* Admin Routes */}
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminUsers" component={UserManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminUserDetail" component={UserDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminVideoModeration" component={VideoModerationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminAppeals" component={AppealsManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminReports" component={ReportsManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminAnalytics" component={AnalyticsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminChallenges" component={ChallengeManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminNotifications" component={AdminSendNotificationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminSendNotification" component={AdminSendNotificationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminChallengeBuilder" component={ChallengeBuilderScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="DebugNotifications" component={DebugNotificationScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: theme.bgDeep },
  };

  return (
    <StreamlinedOnboardingProvider>
      <NavigationContainer
        ref={(navigator) => {
          if (navigator) {
            NavigationService.setTopLevelNavigator(navigator);
          }
        }}
        theme={navTheme}
      >
        <RootNavigator />
      </NavigationContainer>
    </StreamlinedOnboardingProvider>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Floating Pill, Gritty, Industrial Aesthetic + Subtle Fire
// -------------------------------------------------------------
const styles = StyleSheet.create({
  floatingPillContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100, 
  },
  
  // Base Pill state
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 22, 0.98)', 
    borderWidth: 2, 
    borderColor: '#3a3a3a', 
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 20,
    zIndex: 10, // Ensure pill renders above flames
  },
  
  // Smoldering state when COMPETE is active
  floatingPillOnFire: {
    borderColor: '#8b0000', // Deep smoldering red edge
    backgroundColor: 'rgba(26, 14, 14, 0.98)', // Warmer dark background
    shadowColor: '#ff0000', // Subtle red glow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 22,
  },
  
  // Fire Effect Positioning
  flamesContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10, // Sits properly behind the pill now
    height: 100, // Taller container so flames aren't clipped
    // Removed zIndex: -1 so it doesn't render behind the entire screen
  },
  coreGlow: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 40,
    backgroundColor: '#b91c1c', // Darker red core glow
    borderRadius: 20,
    shadowColor: '#ff0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 8,
  },
  flameParticle: {
    position: 'absolute',
    bottom: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },

  // Tab Item
  tabItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: '100%',
  },
  
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1,
    marginTop: 4,
  },
  tabLabelFocused: {
    color: '#fff',
    fontWeight: '900',
  },

  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 16,
    height: 3,
    backgroundColor: '#b91c1c',
    borderRadius: 2,
  },

  competeInner: {
    backgroundColor: '#9b2c2c',
    borderRadius: 22, 
    borderWidth: 1,
    borderColor: '#d32f2f',
    width: 56,
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  competeInnerActive: {
    backgroundColor: '#b91c1c', // Gritty red
    borderColor: '#ff4500', // Subtle hot rim
    shadowColor: '#ff0000',
    shadowRadius: 12,
  },
  competeLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    marginTop: 2,
    maxWidth: '90%',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
