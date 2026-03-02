import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/colors';
import api from '../services/api';
import { EXERCISES } from '../constants/exercises';
import { getCompetitiveLiftLabel, resolveCompetitiveLiftId } from '../constants/competitiveLifts';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

// Rank Movement Component for Leaderboard Changes
const RankMovement = ({ rank, previousRank, styles }) => {
  if (previousRank === null || previousRank === undefined || previousRank === rank) return null;

  const movement = previousRank - rank;

  if (movement > 0) {
    return (
      <View style={styles.rankUp}>
        <Ionicons name="arrow-up" size={12} color="#00ff88" />
        <Text style={styles.rankUpText}>+{movement}</Text>
      </View>
    );
  }

  return (
    <View style={styles.rankDown}>
      <Ionicons name="arrow-down" size={12} color="#ff003c" />
      <Text style={styles.rankDownText}>{Math.abs(movement)}</Text>
    </View>
  );
};

export default function ChallengeDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const { challengeId } = route.params;
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [joining, setJoining] = useState(false);
  const [coreLiftSubmittingId, setCoreLiftSubmittingId] = useState(null);
  const [addedToCoreLiftIds, setAddedToCoreLiftIds] = useState([]);
  const getChallengeId = (item) => item?.id || item?._id || null;

  // Initialize styles at the top level
  const styles = createStyles(theme);

  const loadChallengeData = async () => {
    try {
      setLoading(true);

      // Load challenge details
      const challengeResponse = await api.getChallengeById(challengeId);
      const found = challengeResponse?.data || null;
      const resolvedChallengeId = getChallengeId(found) || challengeId;

      if (found) {
        setChallenge(found);
      } else {
        throw new Error('Challenge not found');
      }

      // Load leaderboard
      const leaderboardResponse = await api.request(`/api/challenges/${resolvedChallengeId}/leaderboard?limit=100`);

      if (leaderboardResponse.success) {
        setLeaderboard(leaderboardResponse.data.leaderboard || []);
      }

      // Load my submissions regardless of joined state so previously approved entries remain visible.
      const submissionsResponse = await api.getMyChallengeSubmissions(resolvedChallengeId);
      if (submissionsResponse.success) {
        setMySubmissions(submissionsResponse.data || []);
      }
    } catch (err) {
      console.error('Error loading challenge:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load challenge',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmLeave = () => {
    showAlert({
      title: "Leave Challenge?",
      message: "You will lose your progress and remove your entry from the leaderboard. Are you sure?",
      icon: 'warning',
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: handleJoinLeave
        }
      ]
    });
  };

  const handleJoinLeave = async () => {
    try {
      setJoining(true);
      const resolvedChallengeId = getChallengeId(challenge) || challengeId;

      if (challenge.joined) {
        const response = await api.leaveChallenge(resolvedChallengeId);
        if (response.success) {
          setChallenge({ ...challenge, joined: false, progress: 0 });
          setMySubmissions([]);
          showAlert({
            title: "Left Challenge",
            message: "You have successfully left the challenge.",
            icon: 'success',
            buttons: [{ text: 'OK', style: 'default' }]
          });
        }
      } else {
        const response = await api.joinChallenge(resolvedChallengeId);
        if (response.success) {
          setChallenge({ ...challenge, joined: true, progress: 0 });
          showAlert({
            title: "Joined!",
            message: "Good luck with the challenge!",
            icon: 'success',
            buttons: [{ text: 'OK', style: 'default' }]
          });
        }
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update challenge status',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setJoining(false);
    }
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return { text: 'Ended', expired: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return { text: `${days}d ${hours}h remaining`, expired: false };
    }
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { text: `${hours}h ${minutes}m remaining`, expired: false };
  };

  const getExerciseNames = () => {
    if (challenge.challengeType !== 'exercise' || !challenge.exercises?.length) return null;
    return challenge.exercises.map(exId => {
      const liftLabel = getCompetitiveLiftLabel(resolveCompetitiveLiftId(exId));
      if (liftLabel) return liftLabel;
      const exercise = EXERCISES.find(e => e.id === exId);
      return exercise?.name || exId;
    }).join(', ');
  };

  useFocusEffect(
    useCallback(() => {
      loadChallengeData();
    }, [challengeId])
  );

  const getPrimaryLiftId = () => {
    if (challenge?.primaryExercise) {
      const resolved = resolveCompetitiveLiftId(challenge.primaryExercise);
      if (resolved) return resolved;
    }

    const fromExercises = (challenge?.exercises || [])
      .map((value) => resolveCompetitiveLiftId(value))
      .filter(Boolean);

    return fromExercises[0] || null;
  };

  const renderRankBadge = (rank) => {
    if (rank === 1) return <Ionicons name="medal" size={20} color={theme.gold} />;
    if (rank === 2) return <Ionicons name="medal" size={20} color="#c0c0c0" />;
    if (rank === 3) return <Ionicons name="medal" size={20} color="#cd7f32" />;
    return (
      <View style={styles.rankNumber}>
        <Text style={styles.rankNumberText}>{rank}</Text>
      </View>
    );
  };

  const getCoreLiftPayload = (submission) => {
    const liftType = resolveCompetitiveLiftId(submission?.exercise);
    const reps = Number(submission?.reps) || 0;
    const weight = Number(submission?.weight) || 0;

    if (!liftType || reps <= 0 || weight <= 0) {
      return null;
    }

    return {
      liftType,
      reps,
      weight,
      locationType: 'gym',
      notes: `Imported from approved challenge submission ${submission?.id || ''}`.trim(),
    };
  };

  const handleAddToCoreLifts = async (submission) => {
    const payload = getCoreLiftPayload(submission);
    if (!payload) {
      showAlert({
        title: 'Not Eligible',
        message: 'Only approved bench, squat, or deadlift submissions with weight and reps can be added.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      setCoreLiftSubmittingId(submission.id);
      const response = await api.submitCoreLift(payload);
      if (response?.success) {
        setAddedToCoreLiftIds((prev) => (prev.includes(submission.id) ? prev : [...prev, submission.id]));
        showAlert({
          title: 'Added',
          message: 'Submission added to Core Lifts leaderboard.',
          icon: 'success',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      } else {
        throw new Error(response?.error || response?.message || 'Failed to add to Core Lifts');
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (message.toLowerCase().includes('already in core lifts')) {
        setAddedToCoreLiftIds((prev) => (prev.includes(submission.id) ? prev : [...prev, submission.id]));
      }
      showAlert({
        title: 'Error',
        message: message || 'Failed to add to Core Lifts',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setCoreLiftSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Challenge not found</Text>
        </View>
      </View>
    );
  }

  const timeInfo = getTimeRemaining(challenge.endDate);
  const progressPercent = challenge.target > 0
    ? Math.min(100, (challenge.progress / challenge.target) * 100)
    : 0;
  const latestPendingSubmission = mySubmissions.find((submission) => submission.status === 'pending');
  const primaryLiftId = getPrimaryLiftId();
  const primaryLiftLabel = getCompetitiveLiftLabel(primaryLiftId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>CHALLENGE DETAILS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Challenge Header */}
        <View style={styles.challengeHeader}>
          <View style={styles.headerTop}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
               <Ionicons name="trophy" size={24} color={theme.gold} />
            </View>
            <View style={[styles.rewardBadge, { borderColor: theme.gold }]}>
              <Text style={[styles.rewardAmount, { color: theme.gold }]}>+{challenge.reward || 100}</Text>
              <Text style={[styles.rewardLabel, { color: theme.gold }]}>PTS</Text>
            </View>
          </View>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Text style={styles.challengeDescription}>{challenge.description}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={14} color={theme.textMuted} />
              <Text style={[styles.metaText, timeInfo.expired && { color: theme.danger }]}>
                {timeInfo.text}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="globe" size={14} color={theme.textMuted} />
              <Text style={styles.metaText}>{challenge.regionScope?.toUpperCase() || 'GLOBAL'}</Text>
            </View>
          </View>
        </View>

        {/* Rules Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Ionicons name="information-circle-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
             <Text style={styles.cardTitle}>RULES</Text>
          </View>
          
          {challenge.rules && (
            <Text style={styles.rulesText}>{challenge.rules}</Text>
          )}
          
          <View style={styles.rulesGrid}>
            {challenge.challengeType === 'exercise' && (
                <View style={styles.ruleBox}>
                <Text style={styles.rulesLabel}>EXERCISES</Text>
                <Text style={styles.exercisesText}>{getExerciseNames()}</Text>
                </View>
            )}
            
            <View style={styles.ruleRow}>
                <View style={styles.ruleBox}>
                    <Text style={styles.rulesLabel}>TARGET</Text>
                    <Text style={styles.rulesValue}>{challenge.target} {challenge.metricType}</Text>
                </View>
                <View style={styles.ruleBox}>
                    <Text style={styles.rulesLabel}>WINNER CRITERIA</Text>
                    <Text style={styles.rulesValue}>
                        {challenge.winnerCriteria === 'first_to_complete' ? 'First to Complete' :
                        challenge.winnerCriteria === 'highest_total' ? 'Highest Total' : 'Best Single'}
                    </Text>
                </View>
            </View>
          </View>

          {primaryLiftId && (
            <TouchableOpacity
              style={[styles.leaderboardShortcut, { borderColor: theme.primary }]}
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'Leagues',
                  params: { exerciseId: primaryLiftId },
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="barbell-outline" size={14} color={theme.primary} />
              <Text style={[styles.leaderboardShortcutText, { color: theme.primary }]}>
                VIEW {primaryLiftLabel?.toUpperCase()} LEADERBOARD
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress (if joined) */}
        {challenge.joined && (
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <Text style={styles.cardTitle}>YOUR PROGRESS</Text>
              <Text style={styles.progressText}>
                {challenge.progress || 0} / {challenge.target}
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: theme.primary }]} />
            </View>
            {challenge.completed && (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                <Text style={[styles.completedText, { color: theme.success }]}>CHALLENGE COMPLETED</Text>
              </View>
            )}
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Ionicons name="podium-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
             <Text style={styles.cardTitle}>LEADERBOARD</Text>
          </View>

          {latestPendingSubmission && (
            <View style={styles.pendingLeaderboardNotice}>
              <Ionicons name="time-outline" size={16} color="#ff9500" />
              <Text style={styles.pendingLeaderboardNoticeText}>
                Latest entry pending verification ({latestPendingSubmission.value}). Rank updates after approval.
              </Text>
            </View>
          )}

          {leaderboard.length > 0 ? (
            <View style={styles.leaderboardList}>
                {leaderboard.map((entry, index) => (
                <View
                    key={`${entry.userId || entry.user?._id || entry.id || 'entry'}-${index}`}
                    style={[styles.leaderboardItem, index === leaderboard.length - 1 && { borderBottomWidth: 0 }]}
                >
                    <View style={styles.leaderboardRank}>
                      {renderRankBadge(entry.rank || index + 1)}
                      <RankMovement rank={entry.rank || index + 1} previousRank={entry.previousRank} styles={styles} />
                    </View>
                    <View style={styles.leaderboardInfo}>
                        <Text style={styles.leaderboardName} numberOfLines={1}>
                          {entry.name || entry.username || entry.user?.name || entry.user?.username || 'Athlete'}
                        </Text>
                        <Text style={styles.leaderboardProgress}>
                            {entry.progress || 0} / {challenge.target}
                        </Text>
                    </View>
                    <View style={styles.leaderboardPercentage}>
                        <Text style={[styles.leaderboardPercentageText, { color: theme.primary }]}>
                            {challenge.target > 0
                              ? `${Math.round(((entry.progress || 0) / challenge.target) * 100)}%`
                              : '0%'}
                        </Text>
                    </View>
                </View>
                ))}
            </View>
          ) : (
             <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No participants yet</Text>
             </View>
          )}
        </View>

        {/* My Submissions */}
        {mySubmissions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
             <Ionicons name="list-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
             <Text style={styles.cardTitle}>MY SUBMISSIONS</Text>
            </View>

            {mySubmissions.map((submission, index) => (
              <View
                key={`${submission.id || submission._id || submission.createdAt || 'submission'}-${index}`}
                style={styles.submissionItem}
              >
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionExercise}>{submission.exercise}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: submission.status === 'approved' ? 'rgba(0, 212, 170, 0.1)' :
                                     submission.status === 'rejected' ? 'rgba(255, 0, 60, 0.1)' : 'rgba(255, 149, 0, 0.1)' }
                  ]}>
                    <Text style={[
                        styles.statusText, 
                        { color: submission.status === 'approved' ? theme.success :
                                 submission.status === 'rejected' ? theme.danger : '#ff9500' }
                    ]}>
                        {submission.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.submissionDetails}>
                  <Text style={styles.submissionDetail}>
                    Value: <Text style={styles.submissionDetailValue}>{submission.value}</Text>
                  </Text>
                  {submission.verifiedAt && (
                    <Text style={styles.submissionDate}>
                      {new Date(submission.verifiedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                {submission.rejectionReason && (
                  <Text style={[styles.rejectionReason, { color: theme.danger }]}>Reason: {submission.rejectionReason}</Text>
                )}
                {submission.status === 'approved' && !!getCoreLiftPayload(submission) && !addedToCoreLiftIds.includes(submission.id) && (
                  <TouchableOpacity
                    style={[styles.coreLiftButton, { borderColor: theme.primary }]}
                    onPress={() => handleAddToCoreLifts(submission)}
                    disabled={coreLiftSubmittingId === submission.id}
                  >
                    {coreLiftSubmittingId === submission.id ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <Ionicons name="barbell-outline" size={14} color={theme.primary} />
                        <Text style={[styles.coreLiftButtonText, { color: theme.primary }]}>
                          ADD TO CORE LIFTS
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {submission.status === 'approved' && addedToCoreLiftIds.includes(submission.id) && (
                  <View style={styles.coreLiftAddedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                    <Text style={[styles.coreLiftAddedText, { color: theme.success }]}>ADDED TO CORE LIFTS</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        
        <View style={{ height: 100 }} /> 
      </ScrollView>

      {/* Bottom Action Bar */}
      {!timeInfo.expired && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
          {challenge.joined ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.leaveButton]}
                onPress={() => confirmLeave()}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.leaveButtonText}>LEAVE</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('ChallengeSubmission', { challenge })}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>SUBMIT ENTRY</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.joinButton, { backgroundColor: theme.primary }]}
              onPress={handleJoinLeave}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.joinButtonText}>JOIN CHALLENGE</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

function createStyles(theme) {
    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.bgDeep,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      },
      backButton: {
        padding: 8,
      },
      pageTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        color: theme.textMain,
        textAlign: 'center',
        letterSpacing: 1,
      },
      headerSpacer: {
        width: 40,
      },
      centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      errorText: {
        fontSize: 16,
        color: theme.textMuted,
      },
      content: {
        flex: 1,
        padding: 16,
      },
      challengeHeader: {
        backgroundColor: theme.bgCard,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      },
      headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      },
      iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
      },
      rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
      },
      rewardAmount: {
        fontSize: 14,
        fontWeight: '800',
      },
      rewardLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginLeft: 4,
      },
      challengeTitle: {
        ...Typography.h3,
        color: theme.textMain,
        marginBottom: 8,
      },
      challengeDescription: {
        fontSize: 14,
        color: theme.textMuted,
        lineHeight: 22,
        marginBottom: 16,
      },
      metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12,
        borderRadius: 8,
      },
      metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      metaDivider: {
        width: 1,
        height: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 12,
      },
      metaText: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.textMuted,
        marginLeft: 6,
        letterSpacing: 0.5,
      },
      card: {
        backgroundColor: theme.bgCard,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      },
      cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
      },
      cardTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: theme.textMuted,
        letterSpacing: 1,
      },
      rulesText: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 22,
        marginBottom: 16,
      },
      rulesGrid: {
        gap: 16,
      },
      leaderboardShortcut: {
        marginTop: 14,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
      },
      leaderboardShortcutText: {
        marginLeft: 8,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
      },
      ruleRow: {
        flexDirection: 'row',
        gap: 16,
      },
      ruleBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
      },
      rulesLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: theme.textMuted,
        marginBottom: 4,
        letterSpacing: 0.5,
      },
      rulesValue: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.textMain,
      },
      exercisesText: {
        fontSize: 13,
        color: theme.textMain,
        lineHeight: 18,
      },
      progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      },
      progressText: {
        fontSize: 12,
        fontWeight: '800',
        color: theme.textMain,
      },
      progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
      },
      progressBar: {
        height: '100%',
      },
      completedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        padding: 8,
        borderRadius: 8,
      },
      completedText: {
        fontSize: 12,
        fontWeight: '800',
        marginLeft: 8,
        letterSpacing: 0.5,
      },
      emptyState: {
        padding: 20,
        alignItems: 'center',
      },
      emptyText: {
        fontSize: 13,
        color: theme.textMuted,
        fontStyle: 'italic',
      },
      leaderboardList: {
        marginTop: -8,
      },
      pendingLeaderboardNotice: {
        marginTop: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: 'rgba(255, 149, 0, 0.4)',
        backgroundColor: 'rgba(255, 149, 0, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      pendingLeaderboardNoticeText: {
        flex: 1,
        fontSize: 11,
        fontWeight: '700',
        color: '#ff9500',
        letterSpacing: 0.3,
      },
      leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      },
      leaderboardRank: {
        width: 32,
        alignItems: 'center',
        marginRight: 8,
      },
      rankNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      rankUp: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
      },
      rankUpText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#00ff88',
        marginLeft: 2,
      },
      rankDown: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
      },
      rankDownText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ff003c',
        marginLeft: 2,
      },
      rankNumberText: {
        fontSize: 10,
        fontWeight: '800',
        color: theme.textMuted,
      },
      leaderboardInfo: {
        flex: 1,
      },
      leaderboardName: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.textMain,
      },
      leaderboardProgress: {
        fontSize: 11,
        color: theme.textMuted,
        marginTop: 2,
      },
      leaderboardPercentage: {
        width: 40,
        alignItems: 'flex-end',
      },
      leaderboardPercentageText: {
        fontSize: 12,
        fontWeight: '800',
      },
      submissionItem: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
      },
      submissionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      },
      submissionExercise: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.textMain,
      },
      statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
      },
      statusText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
      },
      submissionDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
      submissionDetail: {
        fontSize: 11,
        color: theme.textMuted,
      },
      submissionDetailValue: {
        color: theme.textMain,
        fontWeight: '600',
      },
      submissionDate: {
        fontSize: 11,
        color: theme.textMuted,
      },
      rejectionReason: {
        fontSize: 11,
        marginTop: 6,
      },
      coreLiftButton: {
        marginTop: 10,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.02)',
      },
      coreLiftButtonText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
      },
      coreLiftAddedRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      },
      coreLiftAddedText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
      },
      bottomBar: {
        backgroundColor: theme.bgCard,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingTop: 16,
        flexDirection: 'row',
        gap: 12,
      },
      actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 14,
      },
      joinButton: {
        // bg set inline
      },
      joinButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1,
      },
      leaveButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      },
      leaveButtonText: {
        fontSize: 12,
        fontWeight: '800',
        color: theme.textMuted,
        letterSpacing: 1,
      },
      submitButton: {
        // bg set inline
      },
      submitButtonText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#fff',
        marginLeft: 8,
        letterSpacing: 1,
      },
    });
}
