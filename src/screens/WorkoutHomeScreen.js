import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';
import { SKINS } from '../constants/colors';
import ScreenHeader from '../components/ScreenHeader';
import QuickWorkoutModal from '../components/QuickWorkoutModal';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function WorkoutHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const { templates, completedSessions, activeSession, startSession, deleteTemplate, addExercisesToSession } = useWorkout();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const isDark = skin === SKINS.operator || skin === SKINS.midnight;
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickWorkoutModal, setShowQuickWorkoutModal] = useState(false);

  // Sort templates by recently updated
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [templates]);

  // Sort sessions by recently completed
  const recentSessions = useMemo(() => {
    return [...completedSessions].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 10);
  }, [completedSessions]);

  const handleStartWorkout = (templateId) => {
    startSession({ templateId });
    navigation.navigate('ActiveSession');
  };

  const handleQuickStart = () => {
    setShowQuickWorkoutModal(true);
  };

  const handleGenerateWorkout = async (workout, workoutName) => {
    // Start a new session with the generated exercises directly
    const result = startSession({ 
      templateId: null, 
      name: workoutName,
      initialExercises: workout 
    });

    if (result.success && result.data) {
      // Navigate to the active session
      navigation.navigate('ActiveSession');
    }
  };

  const handleDeleteTemplate = (templateId) => {
    showAlert({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this workout template?',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplate(templateId),
        },
      ]
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Templates are loaded from AsyncStorage, so no refresh needed
    // This is for consistency with other screens
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const calculateSessionStats = (session) => {
    let totalVolume = 0;
    let completedSets = 0;

    session.exercises?.forEach(exercise => {
      exercise.sets?.forEach(set => {
        if (set.completed && set.reps && set.weight) {
          totalVolume += set.reps * set.weight;
          completedSets++;
        }
      });
    });

    return { totalVolume, completedSets };
  };

  const styles = createStyles(theme, isDark);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="WORKOUTS"
        subtitle="Templates & Sessions"
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('SessionHistory')}
            style={styles.historyButton}
          >
            <Ionicons name="time-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Active Session Banner */}
        {activeSession && (
          <TouchableOpacity
            style={styles.activeSessionBanner}
            onPress={() => navigation.navigate('ActiveSession')}
          >
            <View style={styles.activeSessionLeft}>
              <Ionicons name="play-circle" size={24} color="#fff" />
              <View style={styles.activeSessionText}>
                <Text style={styles.activeSessionTitle}>{activeSession.name}</Text>
                <Text style={styles.activeSessionSubtitle}>Workout in progress</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>QUICK ACTIONS</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionCard} onPress={handleQuickStart}>
              <View style={styles.quickActionIcon}>
                <Ionicons name="flash" size={24} color={theme.primary} />
              </View>
              <Text style={styles.quickActionTitle}>Quick Workout</Text>
              <Text style={styles.quickActionSubtitle}>Generate instantly</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('TemplateBuilder')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="add" size={24} color={theme.primary} />
              </View>
              <Text style={styles.quickActionTitle}>Create Template</Text>
              <Text style={styles.quickActionSubtitle}>Build custom workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Templates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY TEMPLATES</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TemplateBuilder')}>
              <Text style={styles.seeAll}>Create New</Text>
            </TouchableOpacity>
          </View>

          {sortedTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No workout templates yet</Text>
              <Text style={styles.emptySubtext}>Create a template to quickly start workouts</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('TemplateBuilder')}
              >
                <Text style={styles.emptyButtonText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedTemplates.map((template) => (
              <View key={template.id} style={styles.templateCard}>
                <View style={styles.templateLeft}>
                  <View style={styles.templateIcon}>
                    <Text style={styles.templateInitials}>
                      {template.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {template.exercises?.length || 0} exercises
                    </Text>
                  </View>
                </View>
                <View style={styles.templateActions}>
                  <TouchableOpacity
                    style={styles.templateButton}
                    onPress={() => handleStartWorkout(template.id)}
                  >
                    <Ionicons name="play" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.templateButton, styles.templateButtonEdit]}
                    onPress={() => navigation.navigate('TemplateBuilder', { templateId: template.id })}
                  >
                    <Ionicons name="create-outline" size={18} color="#888" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.templateButton, styles.templateButtonDelete]}
                    onPress={() => handleDeleteTemplate(template.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff003c" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SessionHistory')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {recentSessions.map((session) => {
              const stats = calculateSessionStats(session);
              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionCard}
                  onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
                >
                  <View style={styles.sessionLeft}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name="checkmark-done" size={20} color="#9b2c2c" />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionName}>{session.name}</Text>
                      <Text style={styles.sessionMeta}>
                        {formatDate(session.finishedAt)} • {stats.completedSets} sets
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={styles.sessionVolume}>{stats.totalVolume.toLocaleString()} kg</Text>
                    <Text style={styles.sessionVolumeLabel}>volume</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Workout Modal */}
      <QuickWorkoutModal
        visible={showQuickWorkoutModal}
        onClose={() => setShowQuickWorkoutModal(false)}
        onGenerate={handleGenerateWorkout}
      />

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

function createStyles(theme, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0a0a0a',
    },
    historyButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },

    // Active Session Banner - Tactical Style
    activeSessionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.primary,
      borderRadius: 6,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: '#fff',
    },
    activeSessionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    activeSessionText: {
      marginLeft: 12,
    },
    activeSessionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },
    activeSessionSubtitle: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
      fontWeight: '600',
    },

    // Sections
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#555',
      letterSpacing: 2,
    },
    sectionTitleSpaced: {
      marginBottom: 12,
    },
    seeAll: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.primary,
      letterSpacing: 0.5,
    },

    // Quick Actions - Tactical Style
    quickActions: {
      flexDirection: 'row',
      gap: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: '#161616',
      borderRadius: 6,
      borderTopWidth: 2,
      borderTopColor: '#333',
      padding: 16,
      alignItems: 'center',
    },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 4,
      backgroundColor: 'rgba(155, 44, 44, 0.2)',
      borderWidth: 2,
      borderColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    quickActionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    quickActionSubtitle: {
      fontSize: 10,
      color: '#666',
      textAlign: 'center',
      letterSpacing: 0.5,
    },

    // Empty State - Tactical Style
    emptyState: {
      backgroundColor: '#121212',
      borderRadius: 6,
      borderTopWidth: 2,
      borderTopColor: '#333',
      padding: 32,
      alignItems: 'center',
      borderStyle: 'dashed',
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#666',
      marginTop: 16,
      letterSpacing: 0.5,
    },
    emptySubtext: {
      fontSize: 12,
      color: '#444',
      marginTop: 4,
      marginBottom: 20,
    },
    emptyButton: {
      backgroundColor: '#121212',
      borderWidth: 2,
      borderColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 6,
    },
    emptyButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 1,
    },

    // Template Cards - Tactical Style
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#161616',
      borderRadius: 4,
      padding: 14,
      marginBottom: 8,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
    },
    templateLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    templateIcon: {
      width: 40,
      height: 40,
      borderRadius: 4,
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
      borderWidth: 1,
      borderColor: '#333',
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateInitials: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.primary,
      letterSpacing: 0.5,
    },
    templateInfo: {
      marginLeft: 12,
      flex: 1,
    },
    templateName: {
      fontSize: 14,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.3,
    },
    templateMeta: {
      fontSize: 11,
      color: '#666',
      marginTop: 2,
      fontWeight: '600',
    },
    templateActions: {
      flexDirection: 'row',
      gap: 6,
    },
    templateButton: {
      width: 36,
      height: 36,
      borderRadius: 4,
      backgroundColor: 'rgba(155, 44, 44, 0.2)',
      borderWidth: 1,
      borderColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateButtonEdit: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: '#333',
    },
    templateButtonDelete: {
      backgroundColor: 'rgba(255, 0, 60, 0.1)',
      borderColor: '#ff003c',
    },

    // Session Cards - Tactical Style
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#161616',
      borderRadius: 4,
      padding: 14,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#333',
    },
    sessionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    sessionIcon: {
      width: 36,
      height: 36,
      borderRadius: 4,
      backgroundColor: 'rgba(155, 44, 44, 0.1)',
      borderWidth: 1,
      borderColor: '#333',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sessionInfo: {
      marginLeft: 12,
      flex: 1,
    },
    sessionName: {
      fontSize: 14,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.3,
    },
    sessionMeta: {
      fontSize: 10,
      color: '#666',
      marginTop: 2,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    sessionRight: {
      alignItems: 'flex-end',
    },
    sessionVolume: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.primary,
      letterSpacing: -0.5,
    },
    sessionVolumeLabel: {
      fontSize: 9,
      color: '#555',
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 1,
    },
  });
}
