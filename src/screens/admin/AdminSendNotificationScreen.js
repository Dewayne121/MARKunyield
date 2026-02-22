import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import api from '../../services/api';
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

const MODE_DIRECT = 'direct';
const MODE_BROADCAST = 'broadcast';

const parseUserIds = (input) => {
  if (!input) return [];
  return [...new Set(
    String(input)
      .split(/[\s,\n]+/)
      .map(part => part.trim())
      .filter(Boolean)
  )];
};

export default function AdminSendNotificationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const initialUserId = route?.params?.userId ? String(route.params.userId) : '';
  const initialUserName = route?.params?.userName ? String(route.params.userName) : '';
  const lockedRecipient = Boolean(initialUserId);

  const [mode, setMode] = useState(MODE_DIRECT);
  const [userIdsInput, setUserIdsInput] = useState(initialUserId);
  const [typeInput, setTypeInput] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const parsedUserIds = useMemo(() => parseUserIds(userIdsInput), [userIdsInput]);
  const effectiveUserIds = useMemo(() => {
    if (lockedRecipient && initialUserId) {
      return [initialUserId];
    }
    return parsedUserIds;
  }, [lockedRecipient, initialUserId, parsedUserIds]);

  useEffect(() => {
    if (lockedRecipient && initialUserId) {
      setUserIdsInput(initialUserId);
    }
  }, [lockedRecipient, initialUserId]);

  const validateMessage = () => {
    const titleValue = title.trim();
    const messageValue = message.trim();

    if (!titleValue || !messageValue) {
      showAlert({
        title: 'Missing Fields',
        message: 'Title and message are required.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return null;
    }

    if (modeIsDirect && effectiveUserIds.length === 0) {
      showAlert({
        title: 'Missing Recipient',
        message: 'Enter at least one user ID.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return null;
    }

    return {
      type: typeInput.trim() || 'welcome',
      title: titleValue,
      message: messageValue,
    };
  };

  const sendDirect = async () => {
    const payload = validateMessage();
    if (!payload) return;

    try {
      setSending(true);
      const response = await api.sendAdminNotification({
        userIds: effectiveUserIds,
        type: payload.type,
        title: payload.title,
        message: payload.message,
      });

      const recipientCount = response?.data?.recipientCount || effectiveUserIds.length;
      const pushSent = response?.data?.pushSent || 0;
      const pushAttempted = response?.data?.pushAttempted || 0;
      showAlert({
        title: 'Notification Sent',
        message: `Delivered to ${recipientCount} user(s). Push sent: ${pushSent}/${pushAttempted}.`,
        icon: 'success',
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error) {
      showAlert({
        title: 'Send Failed',
        message: error.message || 'Failed to send notification.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async () => {
    const payload = validateMessage();
    if (!payload) return;

    showAlert({
      title: 'Broadcast Notification',
      message: 'This will notify all users. Continue?',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            try {
              setSending(true);
              const response = await api.broadcastAdminNotification({
                type: payload.type,
                title: payload.title,
                message: payload.message,
              });
              const recipientCount = response?.data?.recipientCount || 0;
              const pushSent = response?.data?.pushSent || 0;
              const pushAttempted = response?.data?.pushAttempted || 0;
              showAlert({
                title: 'Broadcast Sent',
                message: `Delivered to ${recipientCount} user(s). Push sent: ${pushSent}/${pushAttempted}.`,
                icon: 'success',
                buttons: [
                  {
                    text: 'OK',
                    style: 'default',
                    onPress: () => navigation.goBack(),
                  },
                ],
              });
            } catch (error) {
              showAlert({
                title: 'Broadcast Failed',
                message: error.message || 'Failed to send broadcast notification.',
                icon: 'error',
                buttons: [{ text: 'OK', style: 'default' }],
              });
            } finally {
              setSending(false);
            }
          },
        },
      ],
    });
  };

  const modeIsDirect = lockedRecipient || mode === MODE_DIRECT;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.pageTitle}>SEND NOTIFICATION</Text>
          <Text style={styles.pageSubtitle}>Direct or broadcast message</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Recipient Card (if locked) */}
          {lockedRecipient && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RECIPIENT</Text>
              <View style={styles.recipientCard}>
                <View style={styles.recipientIcon}>
                  <Ionicons name="person" size={20} color={C.accent} />
                </View>
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>
                    {initialUserName || 'User'}
                  </Text>
                  <Text style={styles.recipientId}>ID: {initialUserId}</Text>
                </View>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={10} color={C.textSubtle} />
                  <Text style={styles.lockedBadgeText}>Locked</Text>
                </View>
              </View>
            </View>
          )}

          {/* Mode Selection */}
          {!lockedRecipient && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DELIVERY MODE</Text>
              <View style={styles.modeContainer}>
                <TouchableOpacity
                  onPress={() => setMode(MODE_DIRECT)}
                  style={[styles.modeButton, mode === MODE_DIRECT && styles.modeButtonActive]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modeIcon, mode === MODE_DIRECT && styles.modeIconActive]}>
                    <Ionicons name="send" size={18} color={mode === MODE_DIRECT ? C.white : C.textSubtle} />
                  </View>
                  <Text style={[styles.modeTitle, mode === MODE_DIRECT && styles.modeTitleActive]}>Direct</Text>
                  <Text style={[styles.modeDesc, mode === MODE_DIRECT && styles.modeDescActive]}>
                    Send to selected users
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode(MODE_BROADCAST)}
                  style={[styles.modeButton, mode === MODE_BROADCAST && styles.modeButtonActive]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modeIcon, mode === MODE_BROADCAST && styles.modeIconActive]}>
                    <Ionicons name="megaphone" size={18} color={mode === MODE_BROADCAST ? C.white : C.textSubtle} />
                  </View>
                  <Text style={[styles.modeTitle, mode === MODE_BROADCAST && styles.modeTitleActive]}>Broadcast</Text>
                  <Text style={[styles.modeDesc, mode === MODE_BROADCAST && styles.modeDescActive]}>
                    Send to all users
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modeHint}>
                <Ionicons name="information-circle" size={14} color={C.info} />
                <Text style={styles.modeHintText}>
                  Direct sends to selected user IDs. Broadcast sends to all users (super admin only).
                </Text>
              </View>
            </View>
          )}

          {/* User IDs Input */}
          {modeIsDirect && !lockedRecipient && (
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionTitle}>USER IDS</Text>
                <View style={styles.parsedBadge}>
                  <Text style={styles.parsedBadgeText}>{parsedUserIds.length} recipients</Text>
                </View>
              </View>
              <View style={styles.inputCard}>
                <TextInput
                  value={userIdsInput}
                  onChangeText={setUserIdsInput}
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Paste one or more IDs, separated by commas or spaces"
                  placeholderTextColor={C.textSubtle}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          )}

          {/* Notification Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTIFICATION TYPE</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputWithIcon}>
                <Ionicons name="pricetag-outline" size={18} color={C.textSubtle} />
                <TextInput
                  value={typeInput}
                  onChangeText={setTypeInput}
                  style={styles.inputWithIconText}
                  placeholder="Optional: announcement, update, etc."
                  placeholderTextColor={C.textSubtle}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Text style={styles.inputHint}>
              Custom types are accepted and mapped safely server-side.
            </Text>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TITLE *</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputWithIcon}>
                <Ionicons name="text-outline" size={18} color={C.textSubtle} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={styles.inputWithIconText}
                  placeholder="Notification title"
                  placeholderTextColor={C.textSubtle}
                  maxLength={120}
                />
                <Text style={styles.charCount}>{title.length}/120</Text>
              </View>
            </View>
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MESSAGE *</Text>
            <View style={styles.inputCard}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                style={[styles.input, styles.inputMultiline, styles.messageInput]}
                placeholder="Notification message..."
                placeholderTextColor={C.textSubtle}
                multiline
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={styles.messageFooter}>
                <View style={styles.messageHintRow}>
                  <Ionicons name="information-circle-outline" size={12} color={C.textSubtle} />
                  <Text style={styles.messageHintText}>Supports plain text only</Text>
                </View>
                <Text style={styles.charCount}>{message.length}/1000</Text>
              </View>
            </View>
          </View>

          {/* Preview */}
          {(title || message) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PREVIEW</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewIcon}>
                    <Ionicons name="notifications" size={16} color={C.accent} />
                  </View>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {title || 'Notification Title'}
                  </Text>
                </View>
                <Text style={styles.previewMessage} numberOfLines={3}>
                  {message || 'Notification message will appear here...'}
                </Text>
                <Text style={styles.previewMeta}>
                  {modeIsDirect ? `To: ${effectiveUserIds.length} user(s)` : 'To: All users'}
                </Text>
              </View>
            </View>
          )}

          {/* Send Button */}
          <View style={styles.sendSection}>
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              disabled={sending}
              onPress={modeIsDirect ? sendDirect : sendBroadcast}
              activeOpacity={0.8}
            >
              {sending ? (
                <View style={styles.sendingContainer}>
                  <ActivityIndicator color={C.white} size="small" />
                  <Text style={styles.sendButtonText}>Sending...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name={modeIsDirect ? 'send' : 'megaphone'} size={18} color={C.white} />
                  <Text style={styles.sendButtonText}>
                    {modeIsDirect ? 'Send Notification' : 'Broadcast to All Users'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {!modeIsDirect && (
              <Text style={styles.broadcastWarning}>
                This will send a push notification to all registered users
              </Text>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
        type={alertConfig.type}
        icon={alertConfig.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  headerRight: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: S.xxl,
  },
  section: {
    paddingHorizontal: S.xl,
    marginTop: S.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: S.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  parsedBadge: {
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  parsedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  recipientIcon: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  recipientId: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modeContainer: {
    flexDirection: 'row',
    gap: S.md,
  },
  modeButton: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modeTitleActive: {
    color: C.white,
  },
  modeDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  modeDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  modeHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: S.md,
    padding: S.md,
    backgroundColor: `${C.info}08`,
    borderRadius: R.md,
    borderLeftWidth: 3,
    borderLeftColor: C.info,
    gap: S.sm,
  },
  modeHintText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  inputCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    letterSpacing: 0.2,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  messageInput: {
    minHeight: 140,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  inputWithIconText: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: S.sm,
    letterSpacing: 0.2,
  },
  charCount: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  inputHint: {
    marginTop: S.sm,
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  messageHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageHintText: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  previewCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  previewIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.sm,
  },
  previewTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.3,
  },
  previewMessage: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.2,
    lineHeight: 18,
    marginBottom: S.sm,
  },
  previewMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sendSection: {
    paddingHorizontal: S.xl,
    marginTop: S.xl,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: R.lg,
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
    gap: S.sm,
    ...ADMIN_SHADOWS.card,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  broadcastWarning: {
    marginTop: S.md,
    fontSize: 10,
    fontWeight: '500',
    color: C.warning,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: S.xxl,
  },
});
