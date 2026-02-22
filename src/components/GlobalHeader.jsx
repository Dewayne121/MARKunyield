import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getUserTier, getTierProgress } from '../constants/tiers';

export default function GlobalHeader() {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const { user } = useApp();
  const navigation = useNavigation();

  if (!user) return null;

  const totalPoints = Number(user?.totalPoints || 0);

  // Get current tier and progress
  const currentTier = getUserTier(totalPoints);
  const tierProgress = getTierProgress(totalPoints);

  const displayName = user?.name || 'Grinder';
  const profileImage = user?.profileImage;

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
      
      {/* Top Row: Profile, Name, Tier */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={handleProfilePress}
          style={styles.profilePicContainer}
          activeOpacity={0.8}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profilePic} />
          ) : (
            <View style={styles.profilePicPlaceholder}>
              <Text style={styles.profilePicInitials}>
                {displayName.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{displayName.toUpperCase()}</Text>
          <Text style={[styles.userTier, { color: currentTier.color }]}>
            RANK: {currentTier.name.toUpperCase()}
          </Text>
        </View>

        {/* Tactical Status Block */}
        <View style={styles.statusBlock}>
          <View style={styles.tierBadgeContainer}>
            <Image
              source={currentTier.image}
              style={styles.tierBadgeImage}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.streakBadge, { borderColor: theme.primary || '#FF4500' }]}>
            <Ionicons name="flame" size={12} color={theme.primary || '#FF4500'} />
            <Text style={[styles.streakText, { color: theme.primary || '#FF4500' }]}>
              {user.streak || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: Industrial Progress Track */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabelText, { color: currentTier.color }]}>
            {totalPoints} TOTAL XP
          </Text>
          {tierProgress.nextTier ? (
            <Text style={styles.xpLabel}>
              [ {tierProgress.current} / {tierProgress.target} ]
            </Text>
          ) : (
            <Text style={styles.xpLabel}>[ MAX TIER ]</Text>
          )}
        </View>
        
        <View style={styles.xpTrackOuter}>
          <View style={styles.xpTrackInner}>
            <View 
              style={[
                styles.xpFill, 
                { width: `${tierProgress.percentage}%`, backgroundColor: currentTier.color }
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Dark, Gritty, Industrial Gym Aesthetic
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  
  // --- Top Row ---
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  // Profile Picture (Sharp Box)
  profilePicContainer: {
    width: 48,
    height: 48,
    borderRadius: 4, 
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
    backgroundColor: '#121212',
    marginRight: 16,
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  profilePicPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  profilePicInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  
  // User Info
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 4,
  },
  userTier: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  
  // Status Block (Tier + Streak)
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 4,
  },
  tierBadgeImage: {
    width: 26,
    height: 26,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    gap: 6,
    height: 40,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '900',
  },
  
  // --- Progress Section ---
  progressContainer: {
    backgroundColor: '#121212',
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  progressLabelText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1.5,
  },
  
  // Industrial Progress Track
  xpTrackOuter: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 3,
    borderRadius: 4,
    backgroundColor: '#0a0a0a',
  },
  xpTrackInner: {
    height: 6,
    backgroundColor: '#161616',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
  },
});