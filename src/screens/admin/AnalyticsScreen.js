import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_TYPOGRAPHY,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;
const T = ADMIN_TYPOGRAPHY;

export default function AnalyticsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/stats');
      if (response?.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
          <Text style={styles.pageTitle}>ANALYTICS</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading platform data...</Text>
        </View>
      </View>
    );
  }

  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value?.toLocaleString() || 0}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle !== undefined && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const ChartBar = ({ label, value, maxValue, color }) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
      <View style={styles.chartBarContainer}>
        <Text style={styles.chartBarLabel}>{label}</Text>
        <View style={styles.chartBarTrack}>
          <View style={[styles.chartBarFill, { width: percentage + '%', backgroundColor: color }]} />
        </View>
        <Text style={styles.chartBarValue}>{value?.toLocaleString()}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <View>
          <Text style={styles.pageTitle}>PLATFORM ANALYTICS</Text>
          <Text style={styles.pageSubtitle}>REAL-TIME METRICS</Text>
        </View>
        <TouchableOpacity onPress={loadStats} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color={C.textSubtle} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* User Metrics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={16} color={C.accent} />
            <Text style={styles.sectionTitle}>USER METRICS</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Users"
              value={stats?.users?.total}
              subtitle={`+${stats?.users?.newToday} today`}
              icon="people"
              color={C.accent}
            />
            <StatCard
              title="Active Users"
              value={stats?.users?.active}
              subtitle="Last 7 days"
              icon="person"
              color={C.success}
            />
            <StatCard
              title="New This Week"
              value={stats?.users?.newWeek}
              subtitle="Registrations"
              icon="person-add"
              color={C.warning}
            />
            <StatCard
              title="New This Month"
              value={stats?.users?.newMonth}
              subtitle="Registrations"
              icon="calendar"
              color={C.info}
            />
          </View>
        </View>

        {/* Workout Metrics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness" size={16} color={C.success} />
            <Text style={styles.sectionTitle}>WORKOUT METRICS</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Workouts"
              value={stats?.workouts?.total}
              subtitle={`+${stats?.workouts?.today} today`}
              icon="fitness"
              color={C.success}
            />
            <StatCard
              title="This Week"
              value={stats?.workouts?.week}
              subtitle="Workouts logged"
              icon="barbell"
              color={C.warning}
            />
            <StatCard
              title="This Month"
              value={stats?.workouts?.month}
              subtitle="Workouts logged"
              icon="calendar"
              color={C.info}
            />
          </View>
        </View>

        {/* Video Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="videocam" size={16} color={C.info} />
            <Text style={styles.sectionTitle}>VIDEO VERIFICATION</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Videos"
              value={stats?.videos?.total}
              subtitle="All time"
              icon="videocam"
              color={C.info}
            />
            <StatCard
              title="Pending Review"
              value={stats?.videos?.pending}
              subtitle="Awaiting action"
              icon="time"
              color={C.warning}
            />
            <StatCard
              title="Approved"
              value={stats?.videos?.approved}
              subtitle={`${((stats?.videos?.approved || 0) / Math.max(stats?.videos?.total || 1, 1) * 100).toFixed(0)}% rate`}
              icon="checkmark-circle"
              color={C.success}
            />
            <StatCard
              title="Rejected"
              value={stats?.videos?.rejected}
              subtitle={`${((stats?.videos?.rejected || 0) / Math.max(stats?.videos?.total || 1, 1) * 100).toFixed(0)}% rate`}
              icon="close-circle"
              color={C.danger}
            />
          </View>
        </View>

        {/* Moderation Queue */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield" size={16} color={C.danger} />
            <Text style={styles.sectionTitle}>MODERATION QUEUE</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Pending Reports"
              value={stats?.moderation?.pendingReports}
              subtitle="Need review"
              icon="flag"
              color={C.danger}
            />
            <StatCard
              title="Pending Appeals"
              value={stats?.moderation?.pendingAppeals}
              subtitle="Need review"
              icon="refresh"
              color={C.warning}
            />
          </View>
        </View>

        {/* Points System */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={16} color={C.warning} />
            <Text style={styles.sectionTitle}>POINTS SYSTEM</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Awarded"
              value={stats?.points?.totalAwarded}
              subtitle="All time"
              icon="trophy"
              color={C.warning}
            />
            <StatCard
              title="Today"
              value={stats?.points?.today}
              subtitle="Points awarded"
              icon="star"
              color={C.info}
            />
          </View>
        </View>

        {/* User Growth Chart */}
        {stats?.userGrowth && stats.userGrowth.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={16} color={C.accent} />
              <Text style={styles.sectionTitle}>USER GROWTH (12 MONTHS)</Text>
            </View>
            <View style={styles.chartContainer}>
              {stats.userGrowth.map((item, index) => {
                const maxValue = Math.max(...stats.userGrowth.map(u => u.count));
                const barHeight = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                return (
                  <View key={index} style={styles.growthBarContainer}>
                    <Text style={styles.growthBarValue}>{item.count}</Text>
                    <View style={styles.growthBarWrapper}>
                      <View style={[styles.growthBar, { height: barHeight + '%' }]} />
                    </View>
                    <Text style={styles.growthBarLabel}>{item.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Workout Activity Chart */}
        {stats?.workoutActivity && stats.workoutActivity.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="barbell" size={16} color={C.success} />
              <Text style={styles.sectionTitle}>WORKOUT ACTIVITY (12 MONTHS)</Text>
            </View>
            <View style={styles.chartContainer}>
              {stats.workoutActivity.map((item, index) => {
                const maxValue = Math.max(...stats.workoutActivity.map(w => w.count));
                const barHeight = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                return (
                  <View key={index} style={styles.growthBarContainer}>
                    <Text style={styles.growthBarValue}>{item.count}</Text>
                    <View style={styles.growthBarWrapper}>
                      <View style={[styles.growthBar, styles.workoutBar, { height: barHeight + '%' }]} />
                    </View>
                    <Text style={styles.growthBarLabel}>{item.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Region Distribution */}
        {stats?.regionDistribution && stats.regionDistribution.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="globe" size={16} color={C.info} />
              <Text style={styles.sectionTitle}>REGION DISTRIBUTION</Text>
            </View>
            <View style={styles.barChartContainer}>
              {stats.regionDistribution.map((item, index) => {
                const maxValue = Math.max(...stats.regionDistribution.map(r => r.count));
                const colors = [C.accent, C.success, C.warning, C.info, '#4C8DFF', C.danger];
                return (
                  <ChartBar
                    key={index}
                    label={item._id || 'Unknown'}
                    value={item.count}
                    maxValue={maxValue}
                    color={colors[index % colors.length]}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Top Users */}
        {stats?.topUsers && stats.topUsers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medal" size={16} color={C.warning} />
              <Text style={styles.sectionTitle}>TOP USERS</Text>
            </View>
            <View style={styles.topUsersList}>
              {stats.topUsers.slice(0, 10).map((user, index) => (
                <View key={user.id || user._id} style={styles.topUserItem}>
                  <View style={[styles.topUserRankBadge, index < 3 && styles.topUserRankBadgeHighlight]}>
                    <Text style={[styles.topUserRank, index < 3 && styles.topUserRankHighlight]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={styles.topUserName}>{user.name}</Text>
                  <View style={styles.topUserPointsBadge}>
                    <Text style={styles.topUserPoints}>{user.totalPoints?.toLocaleString()} XP</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
  },
  pageSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 2,
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Center Container
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  loadingText: {
    marginTop: S.md,
    fontSize: 12,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 1,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: S.xxl, paddingTop: S.md },
  bottomSpacer: { height: 40 },

  // Section
  section: {
    paddingHorizontal: S.xl,
    marginBottom: S.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.md,
    gap: S.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -S.xs,
  },
  statCard: {
    width: (SCREEN_WIDTH - (S.xl * 2) - (S.sm * 2)) / 2,
    margin: S.xs,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    ...ADMIN_SHADOWS.soft,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: 9,
    fontWeight: '500',
    color: C.textSubtle,
    textAlign: 'center',
    marginTop: 2,
  },

  // Chart Container
  chartContainer: {
    flexDirection: 'row',
    height: 160,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.md,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
  },
  growthBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  growthBarValue: {
    fontSize: 9,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  growthBarWrapper: {
    width: '70%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  growthBar: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: R.xs,
    minWidth: 14,
  },
  workoutBar: {
    backgroundColor: C.success,
  },
  growthBarLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: C.textSubtle,
    marginTop: 6,
    textAlign: 'center',
  },

  // Bar Chart
  barChartContainer: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  chartBarContainer: {
    marginBottom: 14,
  },
  chartBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  chartBarTrack: {
    height: 8,
    backgroundColor: C.surface,
    borderRadius: R.xs,
    overflow: 'hidden',
    marginBottom: 4,
  },
  chartBarFill: {
    height: '100%',
    borderRadius: R.xs,
  },
  chartBarValue: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSubtle,
  },

  // Top Users
  topUsersList: {
    backgroundColor: C.card,
    borderRadius: R.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  topUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topUserRankBadge: {
    width: 28,
    height: 28,
    borderRadius: R.xs,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
  },
  topUserRankBadgeHighlight: {
    backgroundColor: C.warning + '20',
  },
  topUserRank: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textSubtle,
  },
  topUserRankHighlight: {
    color: C.warning,
  },
  topUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    flex: 1,
  },
  topUserPointsBadge: {
    backgroundColor: C.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.xs,
  },
  topUserPoints: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
  },
});
