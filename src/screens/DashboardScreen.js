import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useWorkout } from '../context/WorkoutContext';

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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  const styles = createStyles(theme, skin, insets);

  return (
    <View style={styles.page}>
      
      {/* Tactical HUD Header (Replaces Blocky GlobalHeader) */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerProfileBox}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.profileImage} />
          ) : (
            <Ionicons name="person" size={24} color="#555" />
          )}
          {/* Online/Active Indicator */}
          <View style={[styles.onlineIndicator, { backgroundColor: theme.primary }]} />
        </View>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerName}>{(user?.name || user?.username)?.toUpperCase() || 'OPR-77'}</Text>
            <Text style={[styles.headerRank, { color: theme.primary }]}>RANK IV</Text>
          </View>
          
          {/* Smooth Nested Armor Track for XP */}
          <View style={styles.headerXpTrackOuter}>
            <View style={styles.headerXpTrackInner}>
              <View style={[styles.headerXpFill, { backgroundColor: theme.primary, width: '68%' }]} />
            </View>
          </View>
          
          <View style={styles.headerBottomRow}>
            <Text style={styles.headerXpText}>XP 12,450</Text>
            <Text style={styles.headerXpText}>NEXT 15,000</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hierarchical Action Board */}
        <View style={styles.actionBoard}>
          {/* Primary Action */}
          <TouchableOpacity
            style={[styles.primaryAction, { borderColor: theme.primary }]}
            onPress={() => navigation.navigate('Training', { screen: 'WorkoutHome' })}
            activeOpacity={0.85}
          >
            <View style={styles.primaryActionLeft}>
              <View style={[styles.primaryIconBox, { borderColor: theme.primary + '80' }]}>
                <Ionicons name="flash" size={20} color={theme.primary} />
              </View>
              <View style={styles.primaryActionTextWrapper}>
                <Text style={styles.primaryActionTitle}>INITIATE WORKOUT</Text>
                <Text style={styles.primaryActionSub}>HEAVY RESISTANCE PROTOCOL</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={28} color={theme.primary} />
          </TouchableOpacity>

          {/* Secondary Actions Row */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('CalendarLog')}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryActionHeader}>
                <Text style={styles.secondaryActionText}>HISTORY</Text>
                <Ionicons name="calendar" size={14} color="#555" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Compete')}
              activeOpacity={0.85}
            >
              <View style={styles.secondaryActionHeader}>
                <Text style={styles.secondaryActionText}>RANKINGS</Text>
                <Ionicons name="trophy" size={14} color="#555" />
              </View>
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
                    {/* HUD Nested Armor Track */}
                    <View style={styles.graphOuterTrack}>
                      <View style={styles.graphInnerTrack}>
                        <View 
                          style={[
                            styles.graphFill, 
                            { height: Math.max(4, heightPct) + '%' }, 
                            item.hasData && { backgroundColor: theme.primary }
                          ]} 
                        />
                      </View>
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
            <Text style={styles.sectionTitle}>COMBAT LOGS</Text>
            {recentSessionsSummary.length > 0 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.jumpTo('Training')}>
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
                activeOpacity={0.85}
              >
                <View style={styles.workoutMainInfo}>
                  <Text style={styles.workoutName} numberOfLines={1}>{session.name.toUpperCase()}</Text>
                  <Text style={styles.workoutDate}>T-MINUS {new Date(session.finishedAt).toLocaleDateString().toUpperCase()}</Text>
                </View>
                
                <View style={styles.workoutDataBlocks}>
                  <View style={styles.workoutDataPoint}>
                    <Text style={styles.workoutDataLabel}>YIELD</Text>
                    <Text style={[styles.workoutDataValue, { color: theme.primary }]}>{session.volume.toLocaleString()}</Text>
                  </View>
                  <View style={styles.verticalDivider} />
                  <View style={styles.workoutDataPoint}>
                    <Text style={styles.workoutDataLabel}>TIME</Text>
                    <Text style={styles.workoutDataValue}>{session.duration}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="scan-outline" size={40} color="#555" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>NO DATA RECORDED</Text>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.jumpTo('Training')}
                activeOpacity={0.85}
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
// STYLESHEET: Gritty Gym Industrial HUD
// -------------------------------------------------------------
function createStyles(theme, skin, insets) {
  return StyleSheet.create({
    page: { 
      flex: 1, 
      backgroundColor: '#050505', // Abyss black
    },
    
    // --- Tactical HUD Header ---
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#121212',
      backgroundColor: '#0a0a0a',
      gap: 16,
    },
    headerProfileBox: {
      width: 56,
      height: 56,
      borderRadius: 18, // Smooth curve discipline
      borderWidth: 2,
      borderColor: '#333333',
      backgroundColor: '#121212',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 5,
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    onlineIndicator: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: '#050505',
    },
    headerInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 6,
    },
    headerName: {
      fontSize: 16,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    headerRank: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    headerXpTrackOuter: {
      borderWidth: 1,
      borderColor: '#2A2A2A',
      borderRadius: 12,
      padding: 3,
      backgroundColor: '#0a0a0a',
      marginBottom: 6,
    },
    headerXpTrackInner: {
      height: 6,
      backgroundColor: '#161616',
      borderRadius: 999,
      overflow: 'hidden',
    },
    headerXpFill: {
      height: '100%',
      borderRadius: 999,
    },
    headerBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerXpText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
    },

    content: { 
      flex: 1, 
      paddingHorizontal: 16,
    },

    // --- Typography Utilities ---
    sectionTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 2,
      marginBottom: 16,
      textTransform: 'uppercase',
    },

    // --- Action Board ---
    actionBoard: {
      marginTop: 16,
      marginBottom: 40,
      gap: 12,
    },
    primaryAction: {
      backgroundColor: '#121212',
      borderWidth: 2,
      borderRadius: 20, // Armored curve discipline
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 20,
      elevation: 10,
    },
    primaryActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    primaryIconBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#1a0e0e',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    primaryActionTextWrapper: {
      justifyContent: 'center',
    },
    primaryActionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    primaryActionSub: {
      color: '#888888',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    secondaryActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    secondaryAction: {
      flex: 1,
      backgroundColor: '#161616',
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 16,
      padding: 16,
      justifyContent: 'center',
    },
    secondaryActionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    secondaryActionText: {
      color: '#666666',
      fontSize: 10,
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
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    // --- Industrial Activity Panel ---
    activityPanel: {
      backgroundColor: '#161616',
      borderRadius: 20,
      padding: 24,
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      height: 180,
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
    // Nested HUD track
    graphOuterTrack: {
      width: 14,
      flex: 1,
      backgroundColor: '#0a0a0a',
      borderWidth: 1,
      borderColor: '#2A2A2A',
      borderRadius: 12,
      padding: 3,
      justifyContent: 'flex-end',
    },
    graphInnerTrack: {
      flex: 1,
      backgroundColor: '#161616',
      borderRadius: 999,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    graphFill: {
      width: '100%',
      backgroundColor: '#333333', 
      borderRadius: 999,
    },
    graphDay: {
      marginTop: 12,
      fontSize: 9,
      fontWeight: '800',
      color: '#555555',
      letterSpacing: 1,
    },

    // --- Combat Logs (Operations) ---
    workoutCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#161616',
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#222222',
      borderTopColor: '#333333',
    },
    workoutMainInfo: {
      flex: 1,
      paddingRight: 16,
    },
    workoutName: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffffff',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    workoutDate: {
      fontSize: 9,
      fontWeight: '800',
      color: '#555555',
      letterSpacing: 1,
    },
    workoutDataBlocks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    verticalDivider: {
      height: 24,
      width: 1,
      backgroundColor: '#333333',
    },
    workoutDataPoint: {
      alignItems: 'flex-start',
    },
    workoutDataLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    workoutDataValue: {
      fontSize: 16,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: -0.5,
    },

    // --- Empty State ---
    emptyCard: {
      backgroundColor: '#161616',
      borderRadius: 16,
      padding: 40,
      alignItems: 'center',
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderWidth: 1,
      borderColor: '#1a1a1a',
    },
    emptyText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#555555',
      letterSpacing: 1.5,
      marginBottom: 24,
    },
    startBtn: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    startBtnText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#ffffff', 
      letterSpacing: 1,
    },
  });
}