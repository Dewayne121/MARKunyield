import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getWeightClassLabel } from '../context/AppContext';
import { COMPETITIVE_LIFTS, resolveCompetitiveLiftId } from '../constants/competitiveLifts';
import api from '../services/api';
import ScreenHeader from '../components/ScreenHeader';

const WEIGHT_CLASSES = [
  { id: null, label: 'All Classes' },
  { id: 'W55_64', label: '55-64 kg' },
  { id: 'W65_74', label: '65-74 kg' },
  { id: 'W75_84', label: '75-84 kg' },
  { id: 'W85_94', label: '85-94 kg' },
  { id: 'W95_109', label: '95-109 kg' },
  { id: 'W110_PLUS', label: '110+ kg' },
];

const TIMEFRAMES = [
  { id: 'all_time', label: 'ALL TIME' },
  { id: 'weekly', label: 'WEEKLY' },
];

const getRankStyle = (rank) => {
  if (rank === 1) return { color: '#FFD700' };
  if (rank === 2) return { color: '#C0C0C0' };
  if (rank === 3) return { color: '#CD7F32' };
  if (rank <= 10) return { color: '#888' };
  return { color: '#555' };
};

const formatLoad = (weightKg, unit) => {
  const value = Number(weightKg) || 0;
  if (value <= 0) return '--';
  if (unit === 'lbs') return `${Math.round(value * 2.20462)} lb`;
  return `${value.toFixed(1)} kg`;
};

const formatBodyweight = (weightKg, unit) => {
  const value = Number(weightKg) || 0;
  if (value <= 0) return '--';
  if (unit === 'lbs') return `${Math.round(value * 2.20462)}lb`;
  return `${value.toFixed(1)}kg`;
};

const extractEntryName = (entry) => entry?.username || entry?.name || 'Unknown';

export default function LeaderboardScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, weightUnit } = useApp();

  const requestedLift = useMemo(
    () => resolveCompetitiveLiftId(route?.params?.exerciseId || route?.params?.exercise),
    [route?.params?.exerciseId, route?.params?.exercise]
  );

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [selectedWeightClass, setSelectedWeightClass] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all_time');
  const [selectedLift, setSelectedLift] = useState(requestedLift || COMPETITIVE_LIFTS[0].id);

  useEffect(() => {
    if (requestedLift) {
      setSelectedLift(requestedLift);
    }
  }, [requestedLift]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const params = {
        limit: 100,
        exercise: selectedLift,
        timeframe: selectedTimeframe,
      };
      if (selectedWeightClass) {
        params.weightClass = selectedWeightClass;
      }

      const response = await api.getLeaderboard(params);
      if (response.success && response.data) {
        const leaderboardData = (response.data.leaderboard || []).map((entry) => ({
          id: entry.id,
          name: extractEntryName(entry),
          username: entry.username,
          profileImage: entry.profileImage,
          bestValue: Number(entry.bestValue) || 0,
          bestReps: Number(entry.bestReps) || 0,
          bestAt: entry.bestAt,
          weight: entry.weight,
          weightClass: entry.weightClass,
          weightClassLabel: entry.weightClassLabel || getWeightClassLabel(entry.weightClass),
          rank: entry.rank,
          isCurrentUser: user && entry.id === user.id,
        }));
        setEntries(leaderboardData);
        setCurrentUserRank(response.data.currentUser || null);
      } else {
        setEntries([]);
        setCurrentUserRank(null);
      }
    } catch (error) {
      console.error('Error fetching lift leaderboard:', error);
      setEntries([]);
      setCurrentUserRank(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLift, selectedTimeframe, selectedWeightClass, user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleViewProfile = (userId) => {
    navigation.navigate('Profile', { userId });
  };

  const selectedLiftObj = COMPETITIVE_LIFTS.find((lift) => lift.id === selectedLift) || COMPETITIVE_LIFTS[0];
  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) return <View style={{ flex: 1, backgroundColor: '#050505' }} />;

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const currentUserVisible = entries.some((entry) => entry.id === user.id);
  const showStickyCurrentUser = currentUserRank && currentUserRank.rank && !currentUserVisible;

  return (
    <View style={styles.page}>
      <ScreenHeader
        title="LEADERBOARD"
        subtitle={`${selectedLiftObj.label.toUpperCase()} • ${selectedTimeframe === 'weekly' ? 'WEEKLY' : 'ALL TIME'}`}
      />

      <View style={styles.fixedHeader}>
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>LIFT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorScrollContent}
          >
            {COMPETITIVE_LIFTS.map((lift) => (
              <TouchableOpacity
                key={lift.id}
                style={[styles.selectorButton, selectedLift === lift.id && styles.selectorButtonActive]}
                onPress={() => setSelectedLift(lift.id)}
              >
                <Text style={[styles.selectorButtonText, selectedLift === lift.id && styles.selectorButtonTextActive]}>
                  {lift.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>WEIGHT CLASS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorScrollContent}
          >
            {WEIGHT_CLASSES.map((wc) => (
              <TouchableOpacity
                key={wc.id || 'all'}
                style={[styles.selectorButton, selectedWeightClass === wc.id && styles.selectorButtonActive]}
                onPress={() => setSelectedWeightClass(wc.id)}
              >
                <Text style={[styles.selectorButtonText, selectedWeightClass === wc.id && styles.selectorButtonTextActive]}>
                  {wc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.timeframeContainer}>
          <View style={styles.timeframeSelector}>
            {TIMEFRAMES.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.timeframeTab, selectedTimeframe === tab.id && styles.timeframeTabActive]}
                onPress={() => setSelectedTimeframe(tab.id)}
              >
                <Text style={[styles.timeframeText, selectedTimeframe === tab.id && styles.timeframeTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.columnHeaderRow}>
          <Text style={[styles.columnHeaderText, { width: 32 }]}>#</Text>
          <Text style={[styles.columnHeaderText, { flex: 1.2 }]}>ATHLETE</Text>
          <Text style={[styles.columnHeaderText, { flex: 0.8, textAlign: 'center' }]}>CLASS</Text>
          <Text style={[styles.columnHeaderText, { flex: 0.8, textAlign: 'center' }]}>BW</Text>
          <Text style={[styles.columnHeaderText, { flex: 1, textAlign: 'right' }]}>BEST</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.listContainer}>
          {entries.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color="#333" />
              <Text style={styles.emptyStateText}>No entries yet</Text>
              <Text style={styles.emptyStateSubtext}>Log and submit a verified lift to rank.</Text>
            </View>
          )}

          {topThree.length === 3 && (
            <View style={styles.podiumSection}>
              <Text style={styles.podiumLabel}>TOP CONTENDERS</Text>
              <View style={styles.podiumRow}>
                {[topThree[1], topThree[0], topThree[2]].map((item) => {
                  const isFirst = item.rank === 1;
                  const badgeColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32';
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.podiumCard,
                        isFirst && styles.podiumCardFirst,
                        { borderTopColor: badgeColor },
                      ]}
                    >
                      {item.profileImage ? (
                        <Image source={{ uri: item.profileImage }} style={isFirst ? styles.podiumAvatarLarge : styles.podiumAvatar} />
                      ) : (
                        <View style={[isFirst ? styles.podiumAvatarLarge : styles.podiumAvatar, styles.podiumAvatarFallback]}>
                          <Text style={styles.podiumAvatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={[styles.podiumRankBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.podiumRankText}>{item.rank}</Text>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.podiumLiftValue}>{formatLoad(item.bestValue, weightUnit)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {(topThree.length === 3 ? restEntries : entries).map((item) => {
            const rankStyle = getRankStyle(item.rank);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleViewProfile(item.id)}
                activeOpacity={0.7}
                style={[
                  styles.rankRow,
                  item.rank <= 10 && styles.rankRowTopTen,
                  item.isCurrentUser && styles.rankRowActive,
                ]}
              >
                <View style={styles.rankNumCol}>
                  <Text style={[styles.rankNumText, { color: rankStyle.color }]}>
                    {item.rank}
                  </Text>
                </View>

                <View style={[styles.athleteCol, { flex: 1.2 }]}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.listAvatar} />
                  ) : (
                    <View style={styles.listAvatarFallback}>
                      <Text style={styles.listAvatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.nameWrap}>
                    <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                    {item.isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.classCol, { flex: 0.8 }]}>
                  <Text style={styles.columnValueText}>{item.weightClassLabel?.split(' ')[0] || '--'}</Text>
                </View>

                <View style={[styles.weightCol, { flex: 0.8 }]}>
                  <Text style={styles.columnValueText}>{formatBodyweight(item.weight, weightUnit)}</Text>
                </View>

                <View style={[styles.bestCol, { flex: 1 }]}>
                  <View style={styles.bestPill}>
                    <Text style={styles.bestPillText}>{formatLoad(item.bestValue, weightUnit)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {showStickyCurrentUser && (
        <View style={[styles.stickyRankContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.stickyDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>YOUR RANK</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            onPress={() => handleViewProfile(user.id)}
            activeOpacity={0.7}
            style={[styles.rankRow, styles.rankRowActive, { marginHorizontal: 12 }]}
          >
            <View style={styles.rankNumCol}>
              <Text style={[styles.rankNumText, { color: theme.primary }]}>
                {currentUserRank.rank || '--'}
              </Text>
            </View>
            <View style={[styles.athleteCol, { flex: 1.2 }]}>
              <View style={[styles.listAvatarFallback, { backgroundColor: theme.primary }]}>
                <Text style={[styles.listAvatarText, { color: '#fff' }]}>{user.name?.substring(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.nameWrap}>
                <Text style={styles.listName}>You</Text>
              </View>
            </View>
            <View style={[styles.classCol, { flex: 0.8 }]}>
              <Text style={styles.columnValueText}>{getWeightClassLabel(currentUserRank.weightClass)?.split(' ')[0] || '--'}</Text>
            </View>
            <View style={[styles.weightCol, { flex: 0.8 }]}>
              <Text style={styles.columnValueText}>{formatBodyweight(user.weight, weightUnit)}</Text>
            </View>
            <View style={[styles.bestCol, { flex: 1 }]}>
              <View style={[styles.bestPill, { borderColor: theme.primary }]}>
                <Text style={[styles.bestPillText, { color: theme.primary }]}>
                  {currentUserRank.hasEntry ? formatLoad(currentUserRank.bestValue, weightUnit) : '--'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: '#050505' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
    content: { flex: 1 },
    contentContainer: { paddingBottom: 100 },
    fixedHeader: { backgroundColor: '#050505', zIndex: 10 },

    selectorSection: { paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },
    selectorLabel: { fontSize: 10, fontWeight: '900', color: '#444', letterSpacing: 2, marginBottom: 8 },
    selectorScrollContent: { paddingRight: 20, gap: 8 },
    selectorButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: '#161616',
      borderTopWidth: 2,
      borderTopColor: '#333',
    },
    selectorButtonActive: {
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
      borderTopColor: theme.primary,
    },
    selectorButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#555',
    },
    selectorButtonTextActive: {
      color: theme.primary,
    },

    timeframeContainer: { paddingHorizontal: 16, marginBottom: 12 },
    timeframeSelector: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 6, padding: 4, borderWidth: 1, borderColor: '#222' },
    timeframeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 4 },
    timeframeTabActive: { backgroundColor: theme.primary },
    timeframeText: { fontSize: 11, fontWeight: '800', color: '#555', letterSpacing: 1 },
    timeframeTextActive: { color: '#fff' },

    columnHeaderRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: '#222',
    },
    columnHeaderText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#555',
      letterSpacing: 1.5,
    },

    listContainer: { paddingHorizontal: 12, marginTop: 12 },
    podiumSection: { marginBottom: 24, paddingHorizontal: 8 },
    podiumLabel: { fontSize: 10, fontWeight: '900', color: '#444', letterSpacing: 2, marginBottom: 12 },
    podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
    podiumCard: {
      flex: 1,
      backgroundColor: '#161616',
      borderRadius: 6,
      borderTopWidth: 2,
      padding: 12,
      alignItems: 'center',
    },
    podiumCardFirst: { paddingBottom: 16 },
    podiumAvatar: { width: 40, height: 40, borderRadius: 20, marginBottom: 8 },
    podiumAvatarLarge: { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
    podiumAvatarFallback: {
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#333',
    },
    podiumAvatarText: { fontSize: 14, fontWeight: '900', color: '#ddd' },
    podiumRankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -12,
      marginBottom: 6,
    },
    podiumRankText: { fontSize: 12, fontWeight: '900', color: '#000' },
    podiumName: { fontSize: 12, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 2 },
    podiumLiftValue: { fontSize: 14, fontWeight: '900', color: '#ddd', marginBottom: 2 },

    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 4,
      borderRadius: 6,
      backgroundColor: '#0a0a0a',
      borderLeftWidth: 3,
      borderLeftColor: '#222',
    },
    rankRowTopTen: { borderLeftColor: '#333', backgroundColor: '#0f0f0f' },
    rankRowActive: { backgroundColor: 'rgba(155, 44, 44, 0.1)', borderLeftColor: theme.primary },
    rankNumCol: { width: 28, alignItems: 'center', marginRight: 8 },
    rankNumText: { fontSize: 14, fontWeight: '900' },
    athleteCol: { flexDirection: 'row', alignItems: 'center' },
    listAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#333' },
    listAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#161616', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
    listAvatarText: { fontSize: 12, fontWeight: '800', color: '#555' },
    nameWrap: { marginLeft: 10, flex: 1 },
    listName: { fontSize: 14, fontWeight: '800', color: '#fff' },
    youBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
      alignSelf: 'flex-start',
    },
    youBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    classCol: { alignItems: 'center' },
    weightCol: { alignItems: 'center' },
    columnValueText: { fontSize: 12, fontWeight: '700', color: '#888' },
    bestCol: { alignItems: 'flex-end' },
    bestPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#333',
      minWidth: 68,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    bestPillText: { fontSize: 12, fontWeight: '900', color: '#e5e5e5' },

    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    emptyStateText: { fontSize: 16, fontWeight: '800', color: '#555', marginTop: 16 },
    emptyStateSubtext: { fontSize: 12, fontWeight: '600', color: '#333', marginTop: 8 },

    stickyRankContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#050505',
      paddingTop: 12,
      borderTopWidth: 2,
      borderTopColor: '#222',
      zIndex: 20,
    },
    stickyDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
    dividerText: { fontSize: 9, fontWeight: '900', color: theme.primary, marginHorizontal: 12, letterSpacing: 2 },
  });
}
