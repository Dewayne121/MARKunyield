import React, { memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, BorderRadius, Typography } from '../../constants/colors';

const OPTION_CARD_HEIGHT = 100;

const OptionCard = memo(({
  title,
  subtitle,
  description,
  icon,
  color,
  selected,
  onPress,
  disabled = false,
  recommended = false,
  size = 'large',
  style,
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const isCompact = size === 'compact';

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      disabled={disabled}
      style={[styles.container, style]}
    >
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.bgCard,
              borderColor: selected ? color : theme.border,
            },
          ]}
        >
          {/* Selection Border */}
          {selected && (
            <View
              style={[
                styles.selectionBorder,
                { borderColor: color },
              ]}
            >
              <LinearGradient
                colors={[color, color + '00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Icon Section */}
            {icon && !isCompact && (
              <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={28} color={color} />
              </View>
            )}

            {/* Text Section */}
            <View style={[styles.textSection, isCompact && styles.textSectionCompact]}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    { color: selected ? color : theme.textMain },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {recommended && (
                  <View style={[styles.recommendedBadge, { backgroundColor: color + '30' }]}>
                    <Text style={[styles.recommendedText, { color }]}>Recommended</Text>
                  </View>
                )}
              </View>

              {subtitle && (
                <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}

              {description && !isCompact && (
                <Text style={[styles.description, { color: theme.textMuted }]} numberOfLines={2}>
                  {description}
                </Text>
              )}
            </View>

            {/* Selection Indicator */}
            <View style={[styles.checkContainer, { borderColor: selected ? color : theme.border }]}>
              {selected ? (
                <View style={[styles.checkInner, { backgroundColor: color }]}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              ) : (
                <View style={styles.checkPlaceholder} />
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 2,
    borderLeftWidth: 4,
    padding: Spacing.md,
    minHeight: OPTION_CARD_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#161616',
  },
  selectionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 4,
    borderTopWidth: 2,
    borderLeftWidth: 3,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textSection: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  textSectionCompact: {
    marginRight: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    ...Typography.body,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
    marginRight: Spacing.sm,
    flex: 1,
  },
  recommendedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderTopWidth: 1,
    borderLeftWidth: 2,
  },
  recommendedText: {
    ...Typography.caption,
    fontWeight: '800',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    ...Typography.bodySmall,
    fontSize: 14,
    marginTop: 2,
  },
  description: {
    ...Typography.bodySmall,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPlaceholder: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});

export default OptionCard;
