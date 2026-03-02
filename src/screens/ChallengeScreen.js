import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, ProgressBar } from '../components/common';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/colors';

const BR = BorderRadius;

// Countdown Timer Component for Challenges Ending Soon
const CountdownTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date(endDate);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ text: 'ENDED', expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        text: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        days,
        urgent: diff < 24 * 60 * 60 * 1000 // less than 1 day
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <View style={[styles.countdownContainer, timeLeft?.urgent && styles.countdownUrgent]}>
      <Ionicons name="time" size={14} color={timeLeft?.urgent ? '#ff003c' : '#d4af37'} />
      <Text style={[styles.countdownText, timeLeft?.urgent && styles.countdownTextUrgent]}>
        {timeLeft?.text}
      </Text>
    </View>
  );
};

export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { challenge, userChallenge, toggleChallenge, leaderboard } = useApp();

  const getChallengeStatus = () => {
    const now = new Date();
    const start = new Date(challenge.startDate);
    const end = new Date(challenge.endDate);

    if (now < start) return { text: 'Starting Soon', color: Colors.warning };
    if (now > end) return { text: 'Ended', color: Colors.textMuted };
    return { text: 'Active', color: Colors.success };
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const end = new Date(challenge.endDate);
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getProgressPercent = () => {
    return Math.min((userChallenge.progress / challenge.target) * 100, 100);
  };

  const getChallengeLeaderboard = () => {
    return leaderboard.slice(0, 10).map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      score: Math.floor(entry.weeklyPoints * 0.5 + Math.random() * challenge.target),
    }));
  };

  const challengeLeaderboard = getChallengeLeaderboard();
  const status = getChallengeStatus();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tactical HUD Header */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.headerIconBox, { borderColor: theme.primary + '60' }]}>
              <Ionicons name="flag" size={20} color={theme.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>CHALLENGES</Text>
              <Text style={styles.headerSubtitle}>
                {status.text.toUpperCase()} | {getTimeRemaining()}
              </Text>
            </View>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatBlock}>
                <Text style={styles.headerStatLabel}>ACTIVE</Text>
                <Text style={[styles.headerStatValue, { color: '#10B981' }]}>1</Text>
              </View>
              <View style={styles.headerStatBlock}>
                <Text style={styles.headerStatLabel}>ATHLETES</Text>
                <Text style={[styles.headerStatValue, { color: theme.primary }]}>{leaderboard.length}</Text>
              </View>
            </View>
          </View>
          {/* Type Toggle Row */}
          <View style={styles.typeToggleRow}>
            <TouchableOpacity
              style={styles.typeButton}
              onPress={() => {}}
            >
              <Text style={styles.typeButtonText}>
                CORE LIFTS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, styles.typeButtonActive]}
            >
              <Text style={[styles.typeButtonText, styles.typeButtonTextActive]}>
                CHALLENGES
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Card */}
        <Card style={styles.statusCard} variant="elevated">
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>{challenge.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
          </View>
          <Text style={styles.statusDesc}>{challenge.description}</Text>

          <CountdownTimer endDate={challenge.endDate} />
        </Card>

        {/* Join/Progress */}
        <Card style={styles.actionCard} variant="elevated">
          {userChallenge?.joined ? (
            <>
              <View style={styles.progressContainer}>
                <Text style={styles.progressTitle}>Your Progress</Text>
                <ProgressBar
                  progress={userChallenge.progress}
                  total={challenge.target}
                  color={Colors.primary}
                  showLabel={false}
                />
                <Text style={styles.progressTarget}>
                  {challenge.target - userChallenge.progress} {challenge.metricType} remaining
                </Text>
              </View>
              <Button
                title="Leave Challenge"
                onPress={toggleChallenge}
                variant="outline"
              />
            </>
          ) : (
            <>
              <View style={styles.rewardContainer}>
                <View style={[styles.rewardIconBox, { backgroundColor: `${Colors.warning}15` }]}>
                  <Ionicons name="trophy" size={22} color={Colors.warning} />
                </View>
                <View>
                  <Text style={styles.rewardLabel}>Reward</Text>
                  <Text style={styles.rewardValue}>+{challenge.reward} bonus points</Text>
                </View>
              </View>
              <Button
                title="Join Challenge"
                onPress={toggleChallenge}
              />
            </>
          )}
        </Card>

        {/* Details */}
        <Card style={styles.detailsCard} variant="elevated">
          <Text style={styles.sectionTitle}>Challenge Details</Text>
          <DetailRow label="Target" value={`${challenge.target} ${challenge.metricType}`} />
          <DetailRow label="Ends" value={new Date(challenge.endDate).toLocaleDateString()} />
          <DetailRow label="Scope" value={challenge.regionScope === 'global' ? 'Global' : 'Regional'} />
        </Card>

        {/* Leaderboard */}
        {userChallenge?.joined && (
          <Card style={styles.leaderboardCard} variant="elevated">
            <Text style={styles.sectionTitle}>Current Rankings</Text>
            {challengeLeaderboard.map((entry) => (
              <View key={entry.username} style={styles.leaderboardItem}>
                <Text style={[styles.leaderboardRank, { color: getRankColor(entry.rank) }]}>
                  #{entry.rank}
                </Text>
                <Text style={styles.leaderboardUsername}>{entry.username}</Text>
                <Text style={styles.leaderboardScore}>{entry.score}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const getRankColor = (rank) => {
  if (rank === 1) return Colors.gold;
  if (rank === 2) return Colors.silver;
  if (rank === 3) return Colors.bronze;
  return Colors.textSecondary;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollView: {
    flex: 1,
  },
  // --- Tactical HUD Header ---
  headerContainer: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
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
  headerStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  headerStatBlock: {
    alignItems: 'center',
    gap: 2,
  },
  headerStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  typeToggleRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#161616',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(155, 44, 44, 0.2)',
    borderColor: '#9b2c2c',
  },
  typeButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1,
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  statusCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BR.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  statusDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    padding: Spacing.sm,
    borderRadius: BR.md,
  },
  timerText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    padding: Spacing.sm,
    borderRadius: BR.md,
  },
  countdownUrgent: {
    backgroundColor: 'rgba(255, 0, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 60, 0.3)',
  },
  countdownText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  countdownTextUrgent: {
    color: '#ff003c',
    fontWeight: '700',
  },
  actionCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressTitle: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  progressTarget: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: `${Colors.warning}10`,
    padding: Spacing.md,
    borderRadius: BR.md,
    marginBottom: Spacing.md,
  },
  rewardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  rewardValue: {
    ...Typography.body,
    color: Colors.warning,
    fontWeight: '700',
  },
  detailsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  leaderboardCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  leaderboardRank: {
    ...Typography.body,
    fontWeight: '700',
    width: 45,
  },
  leaderboardUsername: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  leaderboardScore: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
});
