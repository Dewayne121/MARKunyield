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

export default function CompeteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
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
        activeOpacity={0.8}
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
            isCompleted ? { backgroundColor: 'rgba(0, 212, 170, 0.1)' } : (isJoined ? { backgroundColor: 'rgba(185, 28, 28, 0.15)' } : {})
          ]}>
            <Ionicons 
              name={isCompleted ? "shield-checkmark" : (isJoined ? "flame" : "skull")} 
              size={16} 
              color={isCompleted ? "#00d4aa" : (isJoined ? "#b91c1c" : "#555")} 
            />
          </View>
          <View style={styles.rewardBlock}>
            <Text style={styles.rewardText}>+{challenge.reward || 100} XP</Text>
          </View>
        </View>

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
          <View style={styles.metricItem}>
            <Ionicons name="timer-outline" size={12} color={timeInfo.expired ? '#ff003c' : '#666'} />
            <Text style={[styles.metricText, timeInfo.expired && { color: '#ff003c' }]}>
              {timeInfo.text}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="people-outline" size={12} color="#666" />
            <Text style={styles.metricText}>
              {challenge.participantCount || 0}
            </Text>
          </View>
        </View>

        {/* HUD Progress (If Joined) */}
        {isJoined && (
          <View style={styles.miniProgressContainer}>
            <View style={styles.miniProgressHeader}>
              <Text style={styles.miniProgressLabel}>STATUS</Text>
              <Text style={styles.miniProgressValue}>{challenge.progress || 0}/{challenge.target}</Text>
            </View>
            <View style={styles.miniProgressTrack}>
              <View style={[styles.miniProgressFill, { width: `${progressPercent}%`, backgroundColor: isCompleted ? '#00d4aa' : '#b91c1c' }]} />
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
            activeOpacity={0.8}
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.titleRow}>
          <Ionicons name="trophy" size={28} color="#b91c1c" style={{ marginRight: 12 }} />
          <View>
            <Text style={styles.pageTitle}>CHALLENGES</Text>
            <Text style={styles.pageSubtitle}>PUSH YOUR LIMITS. NO EXCUSES.</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={styles.tab}
            activeOpacity={0.8}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[
                styles.tabText, 
                selectedFilter === filter.key && { color: '#fff' },
                selectedFilter !== filter.key && { color: '#555' }
            ]}>
              {filter.label}
            </Text>
            {selectedFilter === filter.key && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

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
              activeOpacity={0.8}
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
          <ActivityIndicator size="large" color="#b91c1c" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b91c1c" />}
          showsVerticalScrollIndicator={false}
        >
          {challenges.length > 0 ? (
            <View style={styles.gridContainer}>
              {challenges.map((challenge, index) => renderChallengeCard(challenge, index))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="scan-outline" size={48} color="#333" />
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
// STYLESHEET: Gritty Gym Industrial HUD (2-Column Grid)
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 2,
    marginTop: 2,
  },
  
  // Tactical Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    marginRight: 24,
    paddingVertical: 16,
    position: 'relative',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#b91c1c',
  },

  liftFilterWrap: {
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  liftFilterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  liftFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#121212',
  },
  liftFilterChipActive: {
    borderColor: '#b91c1c',
    backgroundColor: 'rgba(185, 28, 28, 0.15)',
  },
  liftFilterChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#666',
  },
  liftFilterChipTextActive: {
    color: '#fff',
  },
  
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
  },

  // 2-Column Grid Layout
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  // 2-Column Brutalist Card
  gridCard: {
    width: '48%', // Fits two side-by-side with a small gap
    backgroundColor: '#121212',
    borderWidth: 2,
    borderColor: '#222',
    borderRadius: 4,
    marginBottom: 16,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  gridCardJoined: {
    borderColor: '#b91c1c',
    backgroundColor: '#160a0a', // Slight red tint
  },
  gridCardCompleted: {
    borderColor: '#00d4aa',
    backgroundColor: '#0a1612', // Slight green tint
  },
  
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusIconBlock: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  rewardBlock: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#4a3f12',
    borderRadius: 2,
  },
  rewardText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },

  cardMainInfo: {
    flex: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  regionText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1.5,
  },
  liftBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 6,
  },
  liftBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#bbb',
    letterSpacing: 1,
  },

  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 8,
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
    color: '#888',
    letterSpacing: 1,
  },

  // Mini HUD Progress for the tight grid
  miniProgressContainer: {
    marginBottom: 12,
  },
  miniProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniProgressLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  miniProgressValue: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  miniProgressTrack: {
    height: 4,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Block Action Buttons inside Grid
  cardActionWrapper: {
    marginTop: 'auto', // pushes button to bottom if cards are varying heights
  },
  blockBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  blockBtnEnlist: {
    backgroundColor: '#b91c1c',
    borderColor: '#ff003c',
  },
  blockBtnAbort: {
    backgroundColor: 'transparent',
    borderColor: '#ff003c',
    borderStyle: 'dashed',
  },
  blockBtnDisabled: {
    opacity: 0.3,
  },
  blockBtnText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#222',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 3,
  },
  emptySubtext: {
    fontSize: 10,
    fontWeight: '900',
    color: '#444',
    letterSpacing: 1.5,
  },
});
