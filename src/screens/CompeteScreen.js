import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import {
  COMPETITIVE_LIFTS,
  getCompetitiveLiftLabel,
  resolveCompetitiveLiftId,
} from '../constants/competitiveLifts';

const FILTERS = [
  { key: 'active', label: 'ACTIVE' },
  { key: 'ended', label: 'COMPLETED' },
  { key: 'all', label: 'ALL' },
];

const LIFT_FILTERS = [{ id: null, label: 'ALL LIFTS' }, ...COMPETITIVE_LIFTS.map((lift) => ({
  id: lift.id,
  label: lift.label.toUpperCase(),
}))];

// Countdown Timer Component for Challenges
const CountdownTimer = ({ endDate, isSeasonal, styles }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date(endDate);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ text: 'ENDED', expired: true, days: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft({ text: `${days}d ${hours}h remaining`, expired: false, days });
      } else {
        setTimeLeft({ text: `${hours}h ${minutes}m remaining`, expired: false, days: 0 });
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <View style={styles.timerBlock}>
      <Ionicons name="time" size={12} color={timeLeft?.expired ? '#ff003c' : (timeLeft?.days < 3 && isSeasonal) ? '#ff003c' : '#666'} />
      <Text style={[styles.timerText, timeLeft?.expired && styles.timerTextExpired, timeLeft?.days < 3 && isSeasonal && styles.timerTextUrgent]}>
        {timeLeft?.text}
      </Text>
    </View>
  );
};

export default function CompeteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { theme } = useTheme();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('active');
  const [selectedLift, setSelectedLift] = useState(null);
  const [joining, setJoining] = useState(null);

  const getChallengeId = (challenge) => challenge?.id || challenge?._id || null;
  const getChallengeLiftId = (challenge) => {
    if (challenge?.primaryExercise) return resolveCompetitiveLiftId(challenge.primaryExercise);
    const normalized = (challenge?.normalizedExercises || [])
      .map((value) => resolveCompetitiveLiftId(value))
      .filter(Boolean);
    if (normalized.length > 0) return normalized[0];
    const raw = (challenge?.exercises || [])
      .map((value) => resolveCompetitiveLiftId(value))
      .filter(Boolean);
    return raw[0] || null;
  };

  useEffect(() => {
    loadChallenges();
  }, [selectedFilter, selectedLift]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const params = {
        region: user?.region || 'global',
        includeExpired: selectedFilter !== 'active' ? 'true' : 'false',
        competitiveOnly: 'true',
      };
      if (selectedLift) {
        params.exercise = selectedLift;
      }

      const response = await api.getChallenges(params);

      if (response.success) {
        const filtered = (response.data || []).filter((challenge) => {
          const liftId = getChallengeLiftId(challenge);
          if (!(selectedLift ? liftId === selectedLift : !!liftId)) {
            return false;
          }

          if (selectedFilter === 'ended') {
            const ended = new Date(challenge.endDate) <= new Date();
            return ended || challenge.isActive === false;
          }

          return true;
        });
        setChallenges(filtered);
      } else {
        setChallenges([]);
      }
    } catch (err) {
      console.error('Error loading challenges:', err);
      setChallenges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const confirmLeave = (challenge) => {
    showAlert({
      title: "LEAVE CHALLENGE?",
      message: "LEAVING WILL FORFEIT YOUR PROGRESS IN THIS CHALLENGE. ARE YOU SURE?",
      icon: 'warning',
      buttons: [
        { text: "STAY", style: "cancel" },
        {
          text: "LEAVE",
          style: "destructive",
          onPress: () => handleJoinLeave(challenge)
        }
      ]
    });
  };

  const handleJoinLeave = async (challenge) => {
    try {
      const challengeId = getChallengeId(challenge);
      if (!challengeId) {
        throw new Error('Challenge ID is missing.');
      }
      setJoining(challengeId);

      if (challenge.joined) {
        await api.leaveChallenge(challengeId);
        setChallenges(prev => prev.map(c => (
          getChallengeId(c) === challengeId ? { ...c, joined: false, progress: 0 } : c
        )));
      } else {
        await api.joinChallenge(challengeId);
        setChallenges(prev => prev.map(c => (
          getChallengeId(c) === challengeId ? { ...c, joined: true, progress: 0 } : c
        )));
        showAlert({
          title: "JOINED",
          message: `YOU ARE NOW IN: ${challenge.title.toUpperCase()}. GIVE IT EVERYTHING.`,
          icon: 'success',
          buttons: [{ text: 'GOT IT', style: 'default' }]
        });
      }
    } catch (err) {
      showAlert({
        title: "ERROR",
        message: err.message?.toUpperCase() || "COULD NOT JOIN CHALLENGE.",
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setJoining(null);
    }
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    if (diff <= 0) return { text: 'TERMINATED', expired: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { text: `T-${days}D:${hours}H`, expired: false };
  };

  const renderChallengeCard = (challenge, index) => {
    const challengeId = getChallengeId(challenge);
    const timeInfo = getTimeRemaining(challenge.endDate);
    const isJoined = challenge.joined;
    const isCompleted = challenge.completed;
    const progressPercent = challenge.target > 0
      ? Math.min(100, ((challenge.progress || 0) / challenge.target) * 100)
      : 0;
    const liftId = getChallengeLiftId(challenge);
    const liftLabel = getCompetitiveLiftLabel(liftId) || 'Unknown';

    return (
      <TouchableOpacity
        key={challengeId || index}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ChallengeDetail', { challengeId })}
        style={[
          styles.gridCard,
          isJoined && styles.gridCardJoined,
          isCompleted && styles.gridCardCompleted
        ]}
      >
        {/* Top Tactical Row */}
        <View style={styles.cardTopRow}>
          <View style={[
            styles.statusIconBlock,
            isCompleted ? { backgroundColor: 'rgba(0, 212, 170, 0.15)', borderColor: '#00d4aa' } :
            isJoined ? { backgroundColor: 'rgba(185, 28, 28, 0.2)', borderColor: theme.primary } : {}
          ]}>
            <Ionicons
              name={isCompleted ? "shield-checkmark" : (isJoined ? "flame" : "skull")}
              size={16}
              color={isCompleted ? "#00d4aa" : (isJoined ? theme.primary : "#555")}
            />
          </View>
          <View style={styles.rewardRow}>
            {/* Seasonal badge for seasonal challenges */}
            {challenge.isSeasonal && (
              <View style={styles.seasonalBadge}>
                <Ionicons name="star" size={10} color="#ffd700" />
                <Text style={styles.seasonalBadgeText}>SEASONAL</Text>
              </View>
            )}
            <View style={styles.rewardBlock}>
              <Text style={styles.rewardText}>+{challenge.reward || 100} XP</Text>
            </View>
          </View>
        </View>

        {/* Seasonal Prize Pool Display */}
        {challenge.isSeasonal && (
          <View style={styles.prizePoolBlock}>
            <View style={styles.prizePoolIcon}>
              <Ionicons name="trophy" size={14} color="#ffd700" />
            </View>
            <View style={styles.prizePoolInfo}>
              <Text style={styles.prizePoolLabel}>PRIZE POOL</Text>
              <Text style={styles.prizePoolValue}>{challenge.prizePool || 'TBD'}</Text>
            </View>
            {challenge.xpMultiplier && challenge.xpMultiplier > 1 && (
              <View style={styles.xpMultiplierBadge}>
                <Text style={styles.xpMultiplierText}>{challenge.xpMultiplier}x XP</Text>
              </View>
            )}
          </View>
        )}

        {/* Title & Region */}
        <View style={styles.cardMainInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {challenge.title.toUpperCase()}
          </Text>
          <View style={styles.liftBadge}>
            <Text style={styles.liftBadgeText}>{liftLabel.toUpperCase()}</Text>
          </View>
          <Text style={styles.regionText}>
            [ {challenge.regionScope?.toUpperCase() || 'GLOBAL'} ]
          </Text>
        </View>

        {/* Time & Contenders */}
        <View style={styles.metricsRow}>
          <CountdownTimer endDate={challenge.endDate} isSeasonal={challenge.isSeasonal} styles={styles} />
          <View style={styles.metricItem}>
            <Ionicons name="people-outline" size={12} color="#666" />
            <Text style={styles.metricText}>
              {challenge.participantCount || 0}
            </Text>
          </View>
        </View>

        {/* HUD Progress (If Joined) - Nested Armor Track */}
        {isJoined && (
          <View style={styles.miniProgressContainer}>
            <View style={styles.miniProgressHeader}>
              <Text style={styles.miniProgressLabel}>STATUS</Text>
              <Text style={styles.miniProgressValue}>{challenge.progress || 0}/{challenge.target}</Text>
            </View>
            {/* Nested HUD Track: Outer -> Inner -> Fill */}
            <View style={styles.miniProgressOuter}>
              <View style={styles.miniProgressInner}>
                <View style={[
                  styles.miniProgressFill,
                  { width: `${progressPercent}%`, backgroundColor: isCompleted ? '#00d4aa' : theme.primary }
                ]} />
              </View>
            </View>
          </View>
        )}

        {/* Brutalist Action Button at Bottom */}
        <View style={styles.cardActionWrapper}>
          <TouchableOpacity
            style={[
              styles.blockBtn,
              isJoined ? styles.blockBtnAbort : styles.blockBtnEnlist,
              (joining === challengeId || timeInfo.expired) && styles.blockBtnDisabled
            ]}
            activeOpacity={0.85}
            onPress={(e) => {
              e.stopPropagation();
              if (isJoined) confirmLeave(challenge);
              else handleJoinLeave(challenge);
            }}
            disabled={joining === challengeId || timeInfo.expired}
          >
            {joining === challengeId ? (
              <ActivityIndicator size="small" color={isJoined ? "#ff003c" : "#000"} />
            ) : (
              <Text style={[
                styles.blockBtnText,
                isJoined ? { color: '#ff003c' } : { color: '#000' }
              ]}>
                {isJoined ? 'LEAVE' : 'JOIN'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = createStyles(theme, insets);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Tactical HUD Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerIconBox}>
            <Ionicons name="trophy" size={22} color={theme.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.pageTitle}>CHALLENGES</Text>
            <Text style={styles.pageSubtitle}>PUSH YOUR LIMITS. NO EXCUSES.</Text>
          </View>
          <View style={styles.headerCountBlock}>
            <Text style={styles.headerCountLabel}>ACTIVE</Text>
            <Text style={[styles.headerCountValue, { color: theme.primary }]}>
              {challenges.filter(c => c.joined && !c.completed).length}
            </Text>
          </View>
        </View>
      </View>

      {/* Tactical Tabs */}
      <View style={styles.tabBar}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={styles.tab}
            activeOpacity={0.85}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[
                styles.tabText,
                selectedFilter === filter.key && styles.tabTextActive,
            ]}>
              {filter.label}
            </Text>
            {selectedFilter === filter.key && (
              <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lift Filter Scroll */}
      <View style={styles.liftFilterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.liftFilterScroll}
        >
          {LIFT_FILTERS.map((lift) => (
            <TouchableOpacity
              key={lift.id || 'all'}
              style={[
                styles.liftFilterChip,
                selectedLift === lift.id && styles.liftFilterChipActive,
              ]}
              onPress={() => setSelectedLift(lift.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.liftFilterChipText,
                  selectedLift === lift.id && styles.liftFilterChipTextActive,
                ]}
              >
                {lift.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {challenges.length > 0 ? (
            <View style={styles.gridContainer}>
              {challenges.map((challenge, index) => renderChallengeCard(challenge, index))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="scan-outline" size={40} color="#555" />
              </View>
              <Text style={styles.emptyText}>NO CHALLENGES</Text>
              <Text style={styles.emptySubtext}>NO ACTIVE CHALLENGES FOUND. CHECK BACK LATER.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Gritty Gym Industrial HUD - Compete Screen
// -------------------------------------------------------------
function createStyles(theme, insets) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#050505', // Abyss black
    },

    // --- Tactical HUD Header ---
    header: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#121212',
      backgroundColor: '#0a0a0a',
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    headerIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#1a0e0e',
      borderWidth: 2,
      borderColor: theme.primary + '60',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    pageSubtitle: {
      fontSize: 9,
      fontWeight: '900',
      color: theme.primary,
      letterSpacing: 2,
      marginTop: 2,
    },
    headerCountBlock: {
      alignItems: 'flex-end',
    },
    headerCountLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
    },
    headerCountValue: {
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.5,
    },

    // --- Tactical Tabs ---
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      backgroundColor: '#0a0a0a',
      borderBottomWidth: 1,
      borderBottomColor: '#1a1a1a',
    },
    tab: {
      marginRight: 28,
      paddingVertical: 16,
      position: 'relative',
    },
    tabText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.5,
      color: '#555555',
    },
    tabTextActive: {
      color: '#ffffff',
    },
    activeIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 3,
    },

    // --- Lift Filter Scroll ---
    liftFilterWrap: {
      backgroundColor: '#0a0a0a',
      borderBottomWidth: 1,
      borderBottomColor: '#1a1a1a',
      paddingVertical: 12,
    },
    liftFilterScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    liftFilterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#2a2a2a',
      backgroundColor: '#121212',
    },
    liftFilterChipActive: {
      borderColor: theme.primary,
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
    },
    liftFilterChipText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color: '#666666',
    },
    liftFilterChipTextActive: {
      color: '#ffffff',
    },

    // --- Content ---
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#050505',
    },

    // --- 2-Column Grid Layout ---
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },

    // --- Tactical Challenge Card ---
    gridCard: {
      width: '48%',
      backgroundColor: '#121212',
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 16, // Smooth armor curve
      marginBottom: 4,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.7,
      shadowRadius: 12,
      elevation: 8,
      borderTopWidth: 2,
      borderTopColor: '#333333',
      overflow: 'hidden',
      position: 'relative',
    },
    gridCardJoined: {
      borderColor: theme.primary,
      backgroundColor: '#160a0a',
      borderTopColor: theme.primary,
    },
    gridCardCompleted: {
      borderColor: '#00d4aa',
      backgroundColor: '#0a1612',
      borderTopColor: '#00d4aa',
    },

    // --- Card Top Row ---
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    statusIconBlock: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#333333',
    },
    rewardBlock: {
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: '#4a3f12',
      borderRadius: 8,
    },
    rewardText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#D4AF37',
      letterSpacing: 1,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    seasonalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 215, 0, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#ffd700',
    },
    seasonalBadgeText: {
      fontSize: 7,
      fontWeight: '900',
      color: '#ffd700',
      letterSpacing: 1,
      marginLeft: 2,
    },
    prizePoolBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(212, 175, 55, 0.08)',
      padding: 10,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    prizePoolIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 215, 0, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    prizePoolInfo: {
      flex: 1,
    },
    prizePoolLabel: {
      fontSize: 8,
      fontWeight: '800',
      color: '#888888',
      letterSpacing: 1,
      marginBottom: 2,
    },
    prizePoolValue: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffd700',
      letterSpacing: 0.5,
    },
    xpMultiplierBadge: {
      backgroundColor: 'rgba(155, 44, 44, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#9b2c2c',
    },
    xpMultiplierText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },

    // --- Card Main Info ---
    cardMainInfo: {
      flex: 1,
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 0.3,
      lineHeight: 18,
      marginBottom: 8,
    },
    regionText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#666666',
      letterSpacing: 1.5,
    },
    liftBadge: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: '#333333',
      backgroundColor: '#1a1a1a',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginBottom: 6,
    },
    liftBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: '#bbbbbb',
      letterSpacing: 1,
    },

    // --- Metrics Row ---
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#222222',
      paddingTop: 10,
      marginBottom: 12,
    },
    metricItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metricText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#888888',
      letterSpacing: 1,
    },
    timerBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.03)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timerText: {
      fontSize: 8,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 0.5,
    },
    timerTextExpired: {
      color: '#ff003c',
    },
    timerTextUrgent: {
      color: '#ff003c',
      fontWeight: '900',
    },

    // --- Mini HUD Progress (Nested Armor Track) ---
    miniProgressContainer: {
      marginBottom: 12,
    },
    miniProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    miniProgressLabel: {
      fontSize: 8,
      fontWeight: '900',
      color: '#666666',
      letterSpacing: 1,
    },
    miniProgressValue: {
      fontSize: 10,
      fontWeight: '900',
      color: '#ffffff',
    },
    // Nested track: Outer border -> Inner track -> Fill
    miniProgressOuter: {
      borderWidth: 1,
      borderColor: '#2A2A2A',
      borderRadius: 10,
      padding: 2,
      backgroundColor: '#0a0a0a',
    },
    miniProgressInner: {
      height: 6,
      backgroundColor: '#161616',
      borderRadius: 999,
      overflow: 'hidden',
    },
    miniProgressFill: {
      height: '100%',
      borderRadius: 999,
    },

    // --- Block Action Buttons ---
    cardActionWrapper: {
      marginTop: 'auto',
    },
    blockBtn: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    blockBtnEnlist: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    blockBtnAbort: {
      backgroundColor: 'transparent',
      borderColor: '#ff003c',
    },
    blockBtnDisabled: {
      opacity: 0.3,
    },
    blockBtnText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2,
      color: '#000000',
    },

    // --- Empty State ---
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 80,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: '#161616',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderColor: '#1a1a1a',
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#666666',
      marginBottom: 8,
      letterSpacing: 2,
    },
    emptySubtext: {
      fontSize: 10,
      fontWeight: '800',
      color: '#444444',
      letterSpacing: 1.5,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });
}
