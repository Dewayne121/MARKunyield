import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import api from '../../services/api';
import { COMPETITIVE_LIFTS } from '../../constants/competitiveLifts';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_TYPOGRAPHY,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;
const T = ADMIN_TYPOGRAPHY;

export default function ChallengeBuilderScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const { challenge, isEdit } = route.params || {};
  const [saving, setSaving] = useState(false);
  const getChallengeId = (item) => item?.id || item?._id || null;

  // Form state - simplified for big 3 lifts
  const [title, setTitle] = useState(challenge?.title || '');
  const [description, setDescription] = useState(challenge?.description || '');
  const [selectedLift, setSelectedLift] = useState(challenge?.exercises?.[0] || 'bench_press');
  const [targetWeight, setTargetWeight] = useState(
    challenge?.target?.toString() || ''
  );
  const [startDate, setStartDate] = useState(
    challenge?.startDate ? new Date(challenge.startDate) : new Date()
  );
  const [endDate, setEndDate] = useState(
    challenge?.endDate
      ? new Date(challenge.endDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [reward, setReward] = useState(challenge?.reward?.toString() || '100');
  const [rules, setRules] = useState(challenge?.rules || '');
  const [requiresVideo, setRequiresVideo] = useState(
    challenge?.requiresVideo !== false
  );

  // UI state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      showAlert({
        title: 'Required',
        message: 'Please enter a challenge title',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    if (!description.trim()) {
      showAlert({
        title: 'Required',
        message: 'Please enter a description',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    if (!targetWeight || parseFloat(targetWeight) <= 0) {
      showAlert({
        title: 'Required',
        message: 'Please enter a valid target weight (kg)',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    if (endDate <= startDate) {
      showAlert({
        title: 'Invalid',
        message: 'End date must be after start date',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      setSaving(true);

      const challengeData = {
        title: title.trim(),
        description: description.trim(),
        challengeType: 'exercise',
        exercises: [selectedLift],
        metricType: 'weight',
        target: parseFloat(targetWeight),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        regionScope: 'global',
        reward: parseInt(reward) || 100,
        rules: rules.trim(),
        completionType: 'best_effort', // Highest single lift wins
        winnerCriteria: 'best_single',
        requiresVideo,
        maxParticipants: 0,
      };

      let response;
      if (isEdit && challenge) {
        const challengeId = getChallengeId(challenge);
        if (!challengeId) {
          throw new Error('Challenge ID is missing.');
        }
        response = await api.updateChallenge(challengeId, challengeData);
      } else {
        response = await api.createChallenge(challengeData);
      }

      if (response.success) {
        showAlert({
          title: 'Success',
          message: isEdit ? 'Challenge updated successfully' : 'Challenge created successfully',
          icon: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to save challenge',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedLiftData = COMPETITIVE_LIFTS.find((l) => l.id === selectedLift);

  return (
    <View style={[styles.container, { paddingTop: insets.top + S.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.pageTitle}>{isEdit ? 'EDIT CHALLENGE' : 'CREATE CHALLENGE'}</Text>
          <Text style={styles.pageSubtitle}>COMPETITIVE LIFT CHALLENGE</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color={C.white} />
              <Text style={styles.saveButtonText}>SAVE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Lift Selection - Big 3 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="barbell" size={14} color={C.accent} />
            <Text style={styles.sectionTitle}>SELECT LIFT</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Choose one of the big 3 compound lifts</Text>
          <View style={styles.liftSelector}>
            {COMPETITIVE_LIFTS.map((lift) => (
              <TouchableOpacity
                key={lift.id}
                style={[styles.liftButton, selectedLift === lift.id && styles.liftButtonActive]}
                onPress={() => setSelectedLift(lift.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.liftIconContainer, selectedLift === lift.id && styles.liftIconActive]}>
                  <Ionicons
                    name={lift.id === 'bench_press' ? 'barbell-outline' : lift.id === 'deadlift' ? 'fitness-outline' : 'trending-up-outline'}
                    size={22}
                    color={selectedLift === lift.id ? C.accent : C.textSubtle}
                  />
                </View>
                <Text style={[styles.liftButtonText, selectedLift === lift.id && styles.liftButtonTextActive]}>
                  {lift.label}
                </Text>
                {selectedLift === lift.id && (
                  <View style={styles.liftCheckBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={C.accent} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title & Description */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create" size={14} color={C.info} />
            <Text style={styles.sectionTitle}>CHALLENGE DETAILS</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TITLE</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter challenge title..."
              placeholderTextColor={C.textSubtle}
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what competitors need to achieve..."
              placeholderTextColor={C.textSubtle}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Target Weight */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={14} color={C.warning} />
            <Text style={styles.sectionTitle}>TARGET WEIGHT</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            The weight competitors must lift (in kg)
          </Text>
          <View style={styles.targetInputContainer}>
            <TextInput
              style={styles.targetInput}
              placeholder="0"
              placeholderTextColor={C.textSubtle}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="numeric"
            />
            <View style={styles.targetUnitBadge}>
              <Text style={styles.targetUnit}>KG</Text>
            </View>
          </View>
          {targetWeight && parseFloat(targetWeight) > 0 && (
            <View style={styles.targetHint}>
              <Ionicons name="information-circle" size={14} color={C.textSubtle} />
              <Text style={styles.targetHintText}>
                Competitors must lift {targetWeight}kg in {selectedLiftData?.label || 'the selected lift'}
              </Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={14} color={C.success} />
            <Text style={styles.sectionTitle}>CHALLENGE DURATION</Text>
          </View>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateButtonLeft}>
              <View style={[styles.dateIconBadge, { backgroundColor: C.success + '20' }]}>
                <Ionicons name="play" size={12} color={C.success} />
              </View>
              <Text style={styles.dateButtonLabel}>START DATE</Text>
            </View>
            <Text style={styles.dateButtonValue}>{startDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateButtonLeft}>
              <View style={[styles.dateIconBadge, { backgroundColor: C.danger + '20' }]}>
                <Ionicons name="stop" size={12} color={C.danger} />
              </View>
              <Text style={styles.dateButtonLabel}>END DATE</Text>
            </View>
            <Text style={styles.dateButtonValue}>{endDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>

        {/* Reward */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={14} color={C.warning} />
            <Text style={styles.sectionTitle}>REWARD POINTS</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Bonus points awarded when challenge is completed
          </Text>
          <View style={styles.rewardInputContainer}>
            <TextInput
              style={styles.rewardInput}
              placeholder="100"
              placeholderTextColor={C.textSubtle}
              value={reward}
              onChangeText={setReward}
              keyboardType="numeric"
            />
            <Text style={styles.rewardUnit}>XP</Text>
          </View>
        </View>

        {/* Rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={14} color={C.textSubtle} />
            <Text style={styles.sectionTitle}>RULES (OPTIONAL)</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea, styles.rulesInput]}
            placeholder="Enter any specific rules or requirements..."
            placeholderTextColor={C.textSubtle}
            value={rules}
            onChangeText={setRules}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Video Requirement */}
        <View style={styles.section}>
          <View style={styles.toggleCard}>
            <View style={styles.toggleLeft}>
              <View style={[styles.toggleIconBadge, requiresVideo && { backgroundColor: C.accent + '20' }]}>
                <Ionicons name="videocam" size={18} color={requiresVideo ? C.accent : C.textSubtle} />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Require Video Proof</Text>
                <Text style={styles.toggleHint}>All lifts must be verified via video</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggle, requiresVideo && styles.toggleActive]}
              onPress={() => setRequiresVideo(!requiresVideo)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={requiresVideo ? 'checkmark' : 'close'}
                size={16}
                color={requiresVideo ? C.black : C.textSubtle}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <View style={styles.infoBoxIcon}>
            <Ionicons name="information-circle" size={20} color={C.accent} />
          </View>
          <View style={styles.infoBoxContent}>
            <Text style={styles.infoTitle}>CHALLENGE FORMAT</Text>
            <Text style={styles.infoText}>
              Challenges are <Text style={styles.infoHighlight}>best effort</Text> - the highest
              single lift above the target weight wins. All submissions require video verification.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowStartDatePicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)}
          onChange={(event, date) => {
            setShowEndDatePicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerCenter: {
    flex: 1,
    marginLeft: S.md,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1,
  },
  pageSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 2,
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.sm,
    gap: 4,
  },
  saveButtonDisabled: {
    backgroundColor: C.surface,
  },
  saveButtonText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // Content
  content: {
    flex: 1,
    padding: S.xl,
  },
  bottomSpacer: {
    height: 60,
  },

  // Section
  section: {
    marginBottom: S.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: S.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: C.textSubtle,
    marginBottom: 12,
    marginTop: 4,
  },

  // Lift Selector
  liftSelector: {
    gap: 10,
    marginTop: 8,
  },
  liftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  liftButtonActive: {
    borderColor: C.accent,
    backgroundColor: C.accent + '10',
  },
  liftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: R.xs,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
  },
  liftIconActive: {
    backgroundColor: C.accent + '20',
  },
  liftButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: C.textSubtle,
  },
  liftButtonTextActive: {
    color: C.text,
  },
  liftCheckBadge: {
    marginLeft: S.sm,
  },

  // Input
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: 12,
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: C.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rulesInput: {
    minHeight: 100,
  },

  // Target Input
  targetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.sm,
    borderWidth: 2,
    borderColor: C.accent,
    overflow: 'hidden',
  },
  targetInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '900',
    color: C.text,
    padding: 16,
    textAlign: 'center',
  },
  targetUnitBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  targetUnit: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 1,
  },
  targetHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  targetHintText: {
    fontSize: 11,
    color: C.textSubtle,
    fontStyle: 'italic',
    flex: 1,
  },

  // Date Button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  dateButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIconBadge: {
    width: 28,
    height: 28,
    borderRadius: R.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.sm,
  },
  dateButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
  },
  dateButtonValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  // Reward Input
  rewardInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  rewardInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: C.warning,
    textAlign: 'center',
  },
  rewardUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: C.warning,
    marginLeft: 8,
    letterSpacing: 1,
  },

  // Toggle Card
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleIconBadge: {
    width: 36,
    height: 36,
    borderRadius: R.xs,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  toggleHint: {
    fontSize: 11,
    color: C.textSubtle,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.xl,
  },
  infoBoxIcon: {
    marginRight: S.md,
    marginTop: 2,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: C.textSubtle,
    lineHeight: 18,
  },
  infoHighlight: {
    color: C.accent,
    fontWeight: '700',
  },
});
