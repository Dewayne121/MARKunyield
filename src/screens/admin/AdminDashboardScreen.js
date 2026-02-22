import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
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

export default function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [pendingVideosCount, setPendingVideosCount] = useState(null);

  // Check if user is full admin or just community support
  const isFullAdmin = user?.accolades?.includes('admin');
  const isCommunitySupport = user?.accolades?.includes('community_support') && !isFullAdmin;

  const loadStats = async () => {
    try {
      setError(null);
      const [statsResponse, videosResponse, challengesResponse] = await Promise.all([
        api.get('/api/admin/stats').catch(() => ({ success: false, data: null })),
        api.getAdminPendingVideos({ limit: 1000 }).catch(() => ({ success: false, data: null })),
        api.getPendingChallengeSubmissions({ limit: 1000 }).catch(() => ({ success: false, data: null })),
      ]);

      if (statsResponse?.success) {
        setStats(statsResponse.data);
      }

      // Calculate actual pending count from real data (same as VideoModerationScreen)
      const workoutCount = videosResponse?.data?.videos?.length || 0;
      const challengeCount = challengesResponse?.success ? (challengesResponse.data || []).length : 0;
      setPendingVideosCount(workoutCount + challengeCount);
    } catch (err) {
      console.error('Error loading admin stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  // --- Components ---

  const StatCard = ({ title, value, subtitle, icon, color, onPress }) => {
    const displayValue = typeof value === 'number' ? formatNumber(value) : formatNumber(0);
    const displaySubtitle = subtitle !== undefined && subtitle !== null ? String(subtitle) : null;
    const isPressable = !!onPress;

    return (
      <TouchableOpacity
        style={[styles.statCard, isPressable && styles.statCardPressable]}
        onPress={onPress}
        activeOpacity={isPressable ? 0.7 : 1}
        disabled={!isPressable}
      >
        <View style={styles.statCardInner}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconContainer, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            {isPressable && (
              <View style={styles.statArrowContainer}>
                <Ionicons name="chevron-forward" size={14} color={C.textSubtle} />
              </View>
            )}
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue} numberOfLines={1}>{displayValue}</Text>
            <Text style={styles.statTitle} numberOfLines={1}>{String(title)}</Text>
            {displaySubtitle !== null && (
              <Text style={[styles.statSubtitle, { color }]} numberOfLines={1}>{displaySubtitle}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const QuickAction = ({ title, icon, color, onPress }) => (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.quickActionTitle} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );

  const TopUserItem = ({ user, index }) => {
    const userName = String(user?.name || user?.username || 'Unknown');
    const userHandle = String(user?.username || 'unknown');
    const userInitial = userName.charAt(0).toUpperCase();
    const isTopThree = index < 3;

    return (
      <TouchableOpacity
        style={styles.topUserItem}
        onPress={() => navigation.navigate('AdminUserDetail', { userId: user.id || user._id })}
        activeOpacity={0.7}
      >
        <View style={[styles.rankBadge, isTopThree && styles.rankBadgeTop]}>
          <Text style={[styles.rankText, isTopThree && styles.topRankText]}>#{index + 1}</Text>
        </View>

        <View style={styles.topUserAvatar}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.topUserImage} />
          ) : (
            <View style={[styles.topUserImagePlaceholder, isTopThree && styles.topUserImagePlaceholderTop]}>
              <Text style={[styles.topUserInitial, isTopThree && styles.topUserInitialTop]}>{userInitial}</Text>
            </View>
          )}
        </View>

        <View style={styles.topUserInfo}>
          <Text style={styles.topUserName} numberOfLines={1}>{userName}</Text>
          <Text style={styles.topUserHandle} numberOfLines={1}>@{userHandle}</Text>
        </View>

        <View style={styles.topUserPointsContainer}>
          <Text style={[styles.topUserPoints, isTopThree && styles.topUserPointsTop]}>
            {formatNumber(user.totalPoints || 0)}
          </Text>
          <Text style={styles.topUserPointsLabel}>XP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const RegionStatItem = ({ region, count, color }) => {
    const maxCount = Math.max(...(stats?.regionDistribution || []).map(r => r.count || 0));
    const percentage = maxCount > 0 ? ((count || 0) / maxCount) * 100 : 0;

    return (
      <View style={styles.regionStatItem}>
        <View style={styles.regionStatHeader}>
          <Text style={styles.regionStatName}>{region}</Text>
          <Text style={styles.regionStatCount}>{count || 0}</Text>
        </View>
        <View style={styles.regionProgressBarBg}>
          <View style={[styles.regionProgressFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>ADMIN DASHBOARD</Text>
            <Text style={styles.pageSubtitle}>System Overview</Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>ADMIN DASHBOARD</Text>
            <Text style={styles.pageSubtitle}>System Overview</Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={48} color={C.danger} />
            </View>
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
              <Ionicons name="refresh" size={16} color={C.text} />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <View style={styles.headerContent}>
          <Text style={styles.pageTitle}>ADMIN DASHBOARD</Text>
          <Text style={styles.pageSubtitle}>System Overview</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={18} color={C.textSubtle} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
            colors={[C.accent]}
            progressBackgroundColor={C.card}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isCommunitySupport ? (
          <>
            {/* Community Support View */}
            <View style={styles.section}>
              <View style={styles.infoCard}>
                <View style={styles.infoCardIcon}>
                  <Ionicons name="information-circle" size={20} color={C.info} />
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>Community Support Access</Text>
                  <Text style={styles.infoCardText}>
                    You have access to video moderation tools to help maintain platform quality.
                  </Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>VIDEO MODERATION</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Pending Videos"
                  value={pendingVideosCount ?? 0}
                  subtitle="Awaiting review"
                  icon="videocam"
                  color="#ff9500"
                  onPress={() => navigation.navigate('AdminVideoModeration')}
                />
                <StatCard
                  title="Approved Videos"
                  value={stats?.videos?.approved || 0}
                  subtitle={`${((stats?.videos?.approved || 0) / Math.max(stats?.videos?.total || 1, 1) * 100).toFixed(0)}% rate`}
                  icon="checkmark-circle"
                  color="#34c759"
                />
              </View>
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => navigation.navigate('AdminVideoModeration')}
                activeOpacity={0.8}
              >
                <View style={styles.primaryActionContent}>
                  <View style={styles.primaryActionIcon}>
                    <Ionicons name="play-circle" size={24} color={C.white} />
                  </View>
                  <View style={styles.primaryActionTextContainer}>
                    <Text style={styles.primaryActionTitle}>Start Moderation Queue</Text>
                    <Text style={styles.primaryActionSubtitle}>Review pending workout videos</Text>
                  </View>
                </View>
                {(pendingVideosCount ?? 0) > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingVideosCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Full Admin View */}

            {/* Quick Stats Row */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>PLATFORM OVERVIEW</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Users"
                  value={stats?.users?.total || 0}
                  subtitle={`+${stats?.users?.newToday || 0} today`}
                  icon="people"
                  color={C.accent}
                  onPress={() => navigation.navigate('AdminUsers')}
                />
                <StatCard
                  title="Active Users"
                  value={stats?.users?.active || 0}
                  subtitle="7-day activity"
                  icon="pulse"
                  color={C.info}
                />
                <StatCard
                  title="Pending Videos"
                  value={pendingVideosCount ?? 0}
                  subtitle="To review"
                  icon="videocam"
                  color="#ff9500"
                  onPress={() => navigation.navigate('AdminVideoModeration')}
                />
                <StatCard
                  title="Pending Reports"
                  value={stats?.moderation?.pendingReports || 0}
                  subtitle={`${stats?.moderation?.pendingAppeals || 0} appeals`}
                  icon="flag"
                  color="#ff3b30"
                  onPress={() => navigation.navigate('AdminReports')}
                />
              </View>
            </View>

            {/* Quick Actions Grid */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>MANAGEMENT TOOLS</Text>
              </View>
              <View style={styles.quickActionsContainer}>
                <QuickAction
                  title="Users"
                  icon="people"
                  color={C.accent}
                  onPress={() => navigation.navigate('AdminUsers')}
                />
                <QuickAction
                  title="Review"
                  icon="shield-checkmark"
                  color={C.success}
                  onPress={() => navigation.navigate('AdminVideoModeration')}
                />
                <QuickAction
                  title="Challenges"
                  icon="trophy"
                  color={C.info}
                  onPress={() => navigation.navigate('AdminChallenges')}
                />
                <QuickAction
                  title="Appeals"
                  icon="refresh-circle"
                  color={C.warning}
                  onPress={() => navigation.navigate('AdminAppeals')}
                />
                <QuickAction
                  title="Reports"
                  icon="alert-circle"
                  color={C.danger}
                  onPress={() => navigation.navigate('AdminReports')}
                />
                <QuickAction
                  title="Notify"
                  icon="megaphone"
                  color={C.accent}
                  onPress={() => navigation.navigate('AdminNotifications')}
                />
                <QuickAction
                  title="Analytics"
                  icon="bar-chart"
                  color={C.info}
                  onPress={() => navigation.navigate('AdminAnalytics')}
                />
                <QuickAction
                  title="Logs"
                  icon="receipt"
                  color={C.textSubtle}
                  onPress={() => navigation.navigate('AdminAuditLog')}
                />
              </View>
            </View>

            {/* Activity Stats */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>SYSTEM ACTIVITY</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Workouts"
                  value={stats?.workouts?.total || 0}
                  subtitle={`+${stats?.workouts?.today || 0} today`}
                  icon="fitness"
                  color={C.info}
                />
                <StatCard
                  title="Approval Rate"
                  value={stats?.videos?.approved || 0}
                  subtitle="Videos"
                  icon="checkmark-done"
                  color={C.success}
                />
                <StatCard
                  title="Points Given"
                  value={stats?.points?.totalAwarded || 0}
                  subtitle={`Today: ${stats?.points?.today || 0}`}
                  icon="star"
                  color={C.warning}
                />
                <StatCard
                  title="Active Events"
                  value={stats?.challenges?.active || 0}
                  subtitle="Challenges"
                  icon="ribbon"
                  color="#af52de"
                  onPress={() => navigation.navigate('AdminChallenges')}
                />
              </View>
            </View>

            <View style={styles.section}>
              {/* Top Users */}
              {stats?.topUsers && stats.topUsers.length > 0 && (
                <View style={styles.cardListSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>TOP GRINDERS</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminLeaderboard')}>
                      <Text style={styles.seeAllText}>View All</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardListContainer}>
                    {stats.topUsers.slice(0, 5).map((topUser, index) => (
                      <TopUserItem key={topUser.id || topUser._id} user={topUser} index={index} />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Region Distribution */}
            {stats?.regionDistribution && stats.regionDistribution.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>USER DEMOGRAPHICS</Text>
                </View>
                <View style={styles.cardContainer}>
                  {stats.regionDistribution.map((item, index) => {
                    const colors = [C.accent, C.info, C.warning, '#7C5CFF', C.success, C.danger];
                    return (
                      <RegionStatItem
                        key={item._id}
                        region={item._id}
                        count={item.count}
                        color={colors[index % colors.length]}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {/* User Growth Chart */}
            {stats?.userGrowth && stats.userGrowth.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>GROWTH TRAJECTORY</Text>
                </View>
                <View style={styles.chartCard}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chartContent}>
                      {stats.userGrowth.map((item, index) => {
                        const maxCount = Math.max(...stats.userGrowth.map(u => Number(u.count) || 0), 1);
                        const barHeight = maxCount > 0 ? ((Number(item.count) || 0) / maxCount) * 100 : 0;
                        return (
                          <View key={index} style={styles.chartBarGroup}>
                            <Text style={styles.chartBarValue}>{item.count || 0}</Text>
                            <View style={styles.chartBarTrack}>
                              <View style={[styles.chartBarFill, { height: `${barHeight}%` }]} />
                            </View>
                            <Text style={styles.chartBarLabel}>{String(item.month || '').substring(0, 3)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: S.lg,
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${C.danger}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: S.sm,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: S.xl,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: S.sm,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: S.xxl,
    paddingTop: S.lg,
  },
  section: {
    paddingHorizontal: S.xl,
    marginBottom: S.lg,
  },
  sectionHeader: {
    marginBottom: S.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.md,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -S.xs,
  },
  statCard: {
    width: (SCREEN_WIDTH - (S.xl * 2) - (S.sm * 2)) / 2,
    margin: S.xs,
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  statCardPressable: {
    borderColor: C.borderSoft,
  },
  statCardInner: {
    padding: S.md,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statArrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    minHeight: 60,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -S.xs,
  },
  quickAction: {
    width: '25%',
    alignItems: 'center',
    padding: S.xs,
    marginBottom: S.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  quickActionTitle: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: C.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardListSection: {
    width: '100%',
  },
  cardListContainer: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  cardContainer: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
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
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  rankBadgeTop: {
    backgroundColor: `${C.warning}15`,
    borderColor: `${C.warning}40`,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },
  topRankText: {
    color: C.warning,
    fontWeight: '900',
  },
  topUserAvatar: {
    marginRight: S.sm,
  },
  topUserImage: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  topUserImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  topUserImagePlaceholderTop: {
    backgroundColor: `${C.warning}15`,
    borderColor: `${C.warning}40`,
  },
  topUserInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  topUserInitialTop: {
    color: C.warning,
  },
  topUserInfo: {
    flex: 1,
    marginRight: S.sm,
  },
  topUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.2,
  },
  topUserHandle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginTop: 2,
  },
  topUserPointsContainer: {
    alignItems: 'flex-end',
  },
  topUserPoints: {
    fontSize: 14,
    fontWeight: '900',
    color: C.accent,
    letterSpacing: -0.5,
  },
  topUserPointsTop: {
    color: C.warning,
  },
  topUserPointsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  regionStatItem: {
    marginBottom: S.md,
  },
  regionStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  regionStatName: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.3,
  },
  regionStatCount: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  regionProgressBarBg: {
    height: 8,
    backgroundColor: C.surface,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  regionProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  chartCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 220,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    paddingRight: S.lg,
  },
  chartBarGroup: {
    width: 36,
    alignItems: 'center',
    marginRight: S.md,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarTrack: {
    width: 10,
    height: '70%',
    backgroundColor: C.surface,
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  chartBarLabel: {
    marginTop: S.sm,
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  chartBarValue: {
    position: 'absolute',
    top: 0,
    fontSize: 10,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: `${C.info}08`,
    padding: S.lg,
    borderRadius: R.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: S.xl,
    borderWidth: 1,
    borderColor: `${C.info}20`,
    borderLeftWidth: 3,
    borderLeftColor: C.info,
  },
  infoCardIcon: {
    marginRight: S.md,
    marginTop: 2,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  infoCardText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    lineHeight: 18,
  },
  primaryActionButton: {
    borderRadius: R.lg,
    overflow: 'hidden',
    backgroundColor: C.accent,
    borderWidth: 1,
    borderColor: `${C.accent}80`,
    ...ADMIN_SHADOWS.card,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
  },
  primaryActionIcon: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.lg,
  },
  primaryActionTextContainer: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.pill,
    marginRight: S.xl,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: S.xxl,
  },
});
