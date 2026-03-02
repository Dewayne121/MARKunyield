import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { COMPETITIVE_LIFTS } from '../constants/competitiveLifts';
import api from '../services/api';

const WEIGHT_CLASSES = [
  { id: null, label: 'All Classes' },
  { id: 'W55_64', label: '55-64 kg' },
  { id: 'W65_74', label: '65-74 kg' },
  { id: 'W75_84', label: '75-84 kg' },
  { id: 'W85_94', label: '85-94 kg' },
  { id: 'W95_109', label: '95-109 kg' },
  { id: 'W110_PLUS', label: '110+ kg' },
];

const LOCATION_TYPES = [
  { id: null, label: 'All Locations' },
  { id: 'home', label: 'Home' },
  { id: 'gym', label: 'Gym' },
];

const REGIONS = [
  { id: 'Global', label: 'Global' },
  { id: 'London', label: 'London' },
  { id: 'Manchester', label: 'Manchester' },
  { id: 'Birmingham', label: 'Birmingham' },
  { id: 'Leeds', label: 'Leeds' },
  { id: 'Glasgow', label: 'Glasgow' },
];

export default function CoreLiftLeaderboardScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, weightUnit } = useApp();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState(null);

  // Filters
  const [selectedLift, setSelectedLift] = useState('bench_press');
  const [selectedWeightClass, setSelectedWeightClass] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [selectedLocation, setSelectedLocation] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const params = {
        liftType: selectedLift,
        weightClass: selectedWeightClass,
        region: selectedRegion,
        locationType: selectedLocation,
        limit: 100,
      };

      const response = await api.getCoreLiftLeaderboard(params);

      if (response.success && response.data) {
        setEntries(response.data.leaderboard || []);
        setCurrentUserRank(response.data.currentUser);
      }
    } catch (error) {
      console.error('Error fetching core lift leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLift, selectedWeightClass, selectedRegion, selectedLocation]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const format1RM = (valueKg) => {
    const value = Number(valueKg) || 0;
    if (value <= 0) return '--';
    if (weightUnit === 'lbs') return `${Math.round(value * 2.20462)} lb`;
    return `${value.toFixed(1)} kg`;
  };

  const getLiftIcon = (liftType) => {
    switch (liftType) {
      case 'bench_press': return 'barbell-outline';
      case 'deadlift': return 'fitness-outline';
      case 'squat': return 'walk-outline';
      default: return 'barbell-outline';
    }
  };

  const styles = createStyles(theme, insets);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { borderColor: theme.primary + '60' }]}>
            <Ionicons name={getLiftIcon(selectedLift)} size={24} color={theme.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>CORE LIFT LEADERBOARD</Text>
            <Text style={styles.headerSubtitle}>PERMANENT STATUS</Text>
          </View>
        </View>
        <View style={styles.liftBadge}>
          <Text style={styles.liftBadgeText}>{selectedLift.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Lift Selector */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>LIFT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {COMPETITIVE_LIFTS.map(lift => (
              <TouchableOpacity
                key={lift.id}
                style={[
                  styles.filterButton,
                  selectedLift === lift.id && styles.filterButtonActive
                ]}
                onPress={() => setSelectedLift(lift.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedLift === lift.id && styles.filterButtonTextActive
                ]}>
                  {lift.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Weight Class Selector */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>WEIGHT CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {WEIGHT_CLASSES.map(wc => (
              <TouchableOpacity
                key={wc.id || 'all'}
                style={[
                  styles.filterButton,
                  selectedWeightClass === wc.id && styles.filterButtonActive
                ]}
                onPress={() => setSelectedWeightClass(wc.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedWeightClass === wc.id && styles.filterButtonTextActive
                ]}>
                  {wc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Region Selector */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>REGION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {REGIONS.map(region => (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.filterButton,
                  selectedRegion === region.id && styles.filterButtonActive
                ]}
                onPress={() => setSelectedRegion(region.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedRegion === region.id && styles.filterButtonTextActive
                ]}>
                  {region.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Location Type Selector */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>LOCATION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {LOCATION_TYPES.map(loc => (
              <TouchableOpacity
                key={loc.id || 'all'}
                style={[
                  styles.filterButton,
                  selectedLocation === loc.id && styles.filterButtonActive
                ]}
                onPress={() => setSelectedLocation(loc.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedLocation === loc.id && styles.filterButtonTextActive
                ]}>
                  {loc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Leaderboard */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Podium */}
        {topThree.length === 3 && (
          <View style={styles.podiumContainer}>
            <Text style={styles.podiumLabel}>TOP ATHLETES</Text>
            <View style={styles.podiumRow}>
              {[topThree[1], topThree[0], topThree[2]].map((item, index) => {
                const isFirst = item.rank === 1;
                const badgeColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32';
                return (
                  <View
                    key={item.userId}
                    style={[styles.podiumCard, isFirst && styles.podiumCardFirst, { borderTopColor: badgeColor }]}
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
                    <Text style={styles.podium1RM}>{format1RM(item.estimated1RM)}</Text>
                    <View style={[styles.locationBadge, { backgroundColor: item.locationType === 'home' ? '#9b2c2c' : '#3a3a3a' }]}>
                      <Text style={styles.locationBadgeText}>{item.locationType === 'home' ? 'HOME' : 'GYM'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Rank List */}
        {(topThree.length === 3 ? restEntries : entries).map((item, index) => {
          const actualIndex = topThree.length === 3 ? index + 3 : index;
          const isCurrentUser = user && item.userId === user.id;
          return (
            <TouchableOpacity
              key={item.userId}
              style={[
                styles.rankRow,
                actualIndex < 10 && styles.rankRowTopTen,
                isCurrentUser && styles.rankRowCurrentUser
              ]}
            >
              <View style={styles.rankNum}>
                <Text style={[styles.rankNumText, { color: getRankColor(actualIndex + 1) }]}>
                  {actualIndex + 1}
                </Text>
              </View>

              <View style={styles.athlete}>
                {item.profileImage ? (
                  <Image source={{ uri: item.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.nameContainer}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {isCurrentUser && (
                    <View style={[styles.youBadge, { backgroundColor: theme.primary }]}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.classCol}>
                <Text style={styles.classText}>{item.weightClass?.split(' ')[0] || '--'}</Text>
              </View>

              <View style={styles.bwCol}>
                <Text style={styles.bwText}>{item.weight ? `${item.weight.toFixed(1)}kg` : '--'}</Text>
              </View>

              <View style={styles.locationCol}>
                <View style={[styles.locBadge, { backgroundColor: item.locationType === 'home' ? '#9b2c2c' : '#3a3a3a' }]}>
                  <Text style={styles.locBadgeText}>{item.locationType === 'home' ? 'H' : 'G'}</Text>
                </View>
              </View>

              <View style={styles.liftCol}>
                <View style={[styles.liftPill, isCurrentUser && { borderColor: theme.primary }]}>
                  <Text style={[styles.liftPillText, isCurrentUser && { color: theme.primary }]}>
                    {format1RM(item.estimated1RM)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {entries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>NO RECORDS YET</Text>
            <Text style={styles.emptySubtext}>Submit a verified lift to rank!</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Current User Rank */}
      {currentUserRank && !entries.some(e => e.userId === user?.id) && (
        <View style={[styles.stickyRank, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText, { color: theme.primary }]}>YOUR RANK</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={[styles.rankRow, styles.rankRowCurrentUser]}>
            <View style={styles.rankNum}>
              <Text style={[styles.rankNumText, { color: theme.primary }]}>
                {currentUserRank.rank || '--'}
              </Text>
            </View>
            <View style={styles.athlete}>
              <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                <Text style={[styles.avatarText, { color: '#fff' }]}>{user?.name?.substring(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>You</Text>
            </View>
            <View style={styles.liftCol}>
              <View style={[styles.liftPill, { borderColor: theme.primary }]}>
                <Text style={[styles.liftPillText, { color: theme.primary }]}>
                  {format1RM(currentUserRank.estimated1RM)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getRankColor = (rank) => {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  if (rank <= 10) return '#888888';
  return '#555555';
};

function createStyles(theme, insets) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#050505',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#050505',
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#121212',
      backgroundColor: '#0a0a0a',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#1a0e0e',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      marginLeft: 14,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    headerSubtitle: {
      fontSize: 10,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    liftBadge: {
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#9b2c2c',
    },
    liftBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    filtersContainer: {
      backgroundColor: '#050505',
      zIndex: 10,
    },
    filterSection: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#0f0f0f',
    },
    filterLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 2,
      marginBottom: 6,
    },
    filterButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: '#161616',
      marginRight: 6,
      borderWidth: 1,
      borderColor: '#1a1a1a',
    },
    filterButtonActive: {
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
      borderColor: '#9b2c2c',
    },
    filterButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 0.5,
    },
    filterButtonTextActive: {
      color: '#ffffff',
    },
    content: {
      flex: 1,
    },
    podiumContainer: {
      padding: 16,
      marginTop: 12,
    },
    podiumLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 2,
      marginBottom: 12,
    },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    podiumCard: {
      flex: 1,
      backgroundColor: '#161616',
      borderRadius: 14,
      borderTopWidth: 3,
      padding: 12,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    podiumCardFirst: {
      paddingBottom: 16,
    },
    podiumAvatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      marginBottom: 8,
    },
    podiumAvatarLarge: {
      width: 56,
      height: 56,
      borderRadius: 14,
      marginBottom: 8,
    },
    podiumAvatarFallback: {
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#333333',
    },
    podiumAvatarText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#dddddd',
    },
    podiumRankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -12,
      marginBottom: 6,
    },
    podiumRankText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#000000',
    },
    podiumName: {
      fontSize: 12,
      fontWeight: '900',
      color: '#ffffff',
      marginBottom: 4,
    },
    podium1RM: {
      fontSize: 15,
      fontWeight: '900',
      color: '#dddddd',
      marginBottom: 4,
    },
    locationBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    locationBadgeText: {
      fontSize: 8,
      fontWeight: '800',
      color: '#ffffff',
      letterSpacing: 0.5,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 4,
      backgroundColor: '#0a0a0a',
      borderRadius: 12,
    },
    rankRowTopTen: {
      backgroundColor: '#0f0f0f',
    },
    rankRowCurrentUser: {
      borderLeftWidth: 3,
      borderLeftColor: '#9b2c2c',
      backgroundColor: 'rgba(155, 44, 44, 0.1)',
    },
    rankNum: {
      width: 32,
      alignItems: 'center',
    },
    rankNumText: {
      fontSize: 14,
      fontWeight: '900',
    },
    athlete: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 10,
      marginRight: 10,
    },
    avatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#161616',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#2a2a2a',
    },
    avatarText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#555555',
    },
    nameContainer: {
      marginLeft: 10,
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffffff',
    },
    youBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
      alignSelf: 'flex-start',
    },
    youBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    classCol: {
      width: 60,
      alignItems: 'center',
    },
    classText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#888888',
    },
    bwCol: {
      width: 50,
      alignItems: 'center',
    },
    bwText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#888888',
    },
    locationCol: {
      width: 40,
      alignItems: 'center',
    },
    locBadge: {
      width: 24,
      height: 24,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    locBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#ffffff',
    },
    liftCol: {
      flex: 1,
      alignItems: 'flex-end',
    },
    liftPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#333333',
    },
    liftPillText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#e5e5e5',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#666666',
      letterSpacing: 2,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 11,
      fontWeight: '800',
      color: '#444444',
    },
    stickyRank: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#050505',
      borderTopWidth: 2,
      borderTopColor: '#1a1a1a',
      zIndex: 20,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingHorizontal: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#333333',
    },
    dividerText: {
      fontSize: 9,
      fontWeight: '900',
      marginHorizontal: 12,
      letterSpacing: 2,
    },
  });
}
