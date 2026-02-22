import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useWorkout } from '../context/WorkoutContext';
import GlobalHeader from '../components/GlobalHeader';

export default function DashboardScreen({ navigation }) {
  const { theme, skin } = useTheme();
  const { user, logs } = useApp();
  const { completedSessions } = useWorkout();
  const insets = useSafeAreaInsets();

  const [workoutLimit] = useState(3);

  // Activity chart data (Untouched)
  const activityData = useMemo(() => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const today = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toLocaleDateString();
      const dayLogs = (logs || []).filter(l => new Date(l.date).toLocaleDateString() === dateKey);
      const total = dayLogs.reduce((acc, curr) => acc + (curr.points || 0), 0);
      data.push({ day: days[d.getDay()], total, hasData: total > 0 });
    }
    return data;
  }, [logs]);

  // Recent sessions summary (Untouched)
  const recentSessionsSummary = useMemo(() => {
    return (completedSessions || [])
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
      .slice(0, workoutLimit)
      .map(session => {
        let volume = 0;
        let sets = 0;
        session.exercises?.forEach(ex => {
          ex.sets?.forEach(set => {
            if (set.completed && set.reps && set.weight) {
              volume += set.reps * set.weight;
              sets++;
            }
          });
        });

        const duration = session.startedAt && session.finishedAt 
          ? Math.floor((new Date(session.finishedAt) - new Date(session.startedAt)) / 60000)
          : 0;

        return {
          ...session,
          volume,
          sets,
          duration,
        };
      });
  }, [completedSessions, workoutLimit]);

  if (!user) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bgDeep }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const styles = createStyles(theme, skin, insets);

  return (
    <View style={styles.page}>
      <GlobalHeader />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hierarchical Action Board (Improved UX) */}
        <View style={styles.actionBoard}>
          {/* Primary Action */}
          <TouchableOpacity
            style={[styles.primaryAction, { borderColor: theme.primary }]}
            onPress={() => navigation.navigate('Training', { screen: 'WorkoutHome' })}
            activeOpacity={0.8}
          >
            <View style={styles.primaryActionLeft}>
              <Ionicons name="barbell" size={32} color={theme.primary} />
              <View style={styles.primaryActionTextWrapper}>
                <Text style={styles.primaryActionTitle}>INITIATE WORKOUT</Text>
                <Text style={styles.primaryActionSub}>CRUSH YOUR GOALS TODAY</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.primary} />
          </TouchableOpacity>

          {/* Secondary Actions Row */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('CalendarLog')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={20} color="#888" style={{ marginBottom: 6 }} />
              <Text style={styles.secondaryActionText}>HISTORY</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Compete')}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy" size={20} color="#888" style={{ marginBottom: 6 }} />
              <Text style={styles.secondaryActionText}>RANKINGS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Industrial Activity Graph */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVITY LOG</Text>
          <View style={styles.activityPanel}>
            <View style={styles.graphStage}>
              {activityData.map((item, idx) => {
                const heightPct = Math.min(100, (item.total / 600) * 100);
                return (
                  <View key={idx} style={styles.graphCol}>
                    <View style={styles.graphTrack}>
                      <View 
                        style={[
                          styles.graphFill, 
                          { height: Math.max(4, heightPct) + '%' }, 
                          item.hasData && { backgroundColor: theme.primary }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.graphDay, item.hasData && { color: '#fff' }]}>{item.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Recent Activity (Workouts) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            {recentSessionsSummary.length > 0 && (
              <TouchableOpacity onPress={() => navigation.jumpTo('Training')}>
                <Text style={[styles.seeAllText, { color: theme.primary }]}>VIEW ALL</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentSessionsSummary.length > 0 ? (
            recentSessionsSummary.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[styles.workoutCard, { borderLeftColor: theme.primary }]}
                onPress={() => navigation.jumpTo('Training')}
                activeOpacity={0.8}
              >
                <View style={styles.workoutMainInfo}>
                  <Text style={styles.workoutName} numberOfLines={1}>{session.name.toUpperCase()}</Text>
                  <Text style={styles.workoutDate}>{new Date(session.finishedAt).toLocaleDateString().toUpperCase()}</Text>
                </View>
                
                <View style={styles.workoutDataBlocks}>
                  <View style={styles.workoutDataPoint}>
                    <Text style={styles.workoutDataValue}>{session.volume.toLocaleString()}</Text>
                    <Text style={styles.workoutDataLabel}>KG VOL</Text>
                  </View>
                  <View style={styles.workoutDataPoint}>
                    <Text style={styles.workoutDataValue}>{session.duration}</Text>
                    <Text style={styles.workoutDataLabel}>MINS</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="scan-outline" size={40} color="#333" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>NO DATA RECORDED</Text>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.jumpTo('Training')}
                activeOpacity={0.8}
              >
                <Text style={styles.startBtnText}>START WORKOUT</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Dark, Gritty, Industrial Gym Aesthetic
// -------------------------------------------------------------
function createStyles(theme, skin, insets) {
  return StyleSheet.create({
    page: { 
      flex: 1, 
      backgroundColor: theme.bgDeep || '#0a0a0a', 
    },
    content: { 
      flex: 1, 
      paddingHorizontal: 16,
    },

    // --- Typography Utilities ---
    sectionTitle: {
      fontSize: 14,
      fontFamily: 'System',
      fontWeight: '900',
      color: '#555',
      letterSpacing: 2,
      marginBottom: 16,
    },

    // --- Action Board (UX Overhaul) ---
    actionBoard: {
      marginTop: 16,
      marginBottom: 40,
      gap: 12,
    },
    primaryAction: {
      backgroundColor: '#121212',
      borderWidth: 2,
      borderRadius: 6,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    primaryActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    primaryActionTextWrapper: {
      justifyContent: 'center',
    },
    primaryActionTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 4,
    },
    primaryActionSub: {
      color: '#888',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    secondaryActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    secondaryAction: {
      flex: 1,
      backgroundColor: '#161616',
      borderWidth: 1,
      borderColor: '#2A2A2A',
      borderRadius: 6,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryActionText: {
      color: '#AAA',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    // --- Sections ---
    section: {
      marginBottom: 40,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    seeAllText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },

    // --- Industrial Activity Panel ---
    activityPanel: {
      backgroundColor: '#161616',
      borderRadius: 6,
      padding: 24,
      borderWidth: 1,
      borderColor: '#2A2A2A',
      height: 160,
    },
    graphStage: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    graphCol: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    graphTrack: {
      width: 12,
      flex: 1,
      backgroundColor: '#0a0a0a',
      borderRadius: 2,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    graphFill: {
      width: '100%',
      backgroundColor: '#333', 
      borderRadius: 2,
    },
    graphDay: {
      marginTop: 12,
      fontSize: 11,
      fontWeight: '800',
      color: '#555',
    },

    // --- Recent Workouts (Operations) ---
    workoutCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#161616',
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#222',
    },
    workoutMainInfo: {
      flex: 1,
      paddingRight: 16,
    },
    workoutName: {
      fontSize: 16,
      fontWeight: '900',
      color: '#fff',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    workoutDate: {
      fontSize: 11,
      fontWeight: '700',
      color: '#666',
      letterSpacing: 1,
    },
    workoutDataBlocks: {
      flexDirection: 'row',
      gap: 16,
    },
    workoutDataPoint: {
      alignItems: 'flex-end',
    },
    workoutDataValue: {
      fontSize: 16,
      fontWeight: '900',
      color: '#fff',
    },
    workoutDataLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#666',
      letterSpacing: 1,
      marginTop: 2,
    },

    // --- Empty State ---
    emptyCard: {
      backgroundColor: '#121212',
      borderRadius: 6,
      padding: 40,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#333',
      borderStyle: 'dashed',
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#555',
      letterSpacing: 1.5,
      marginBottom: 24,
    },
    startBtn: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 4,
    },
    startBtnText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#000', 
      letterSpacing: 1,
    },
  });
}
