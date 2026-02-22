import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SKINS } from '../constants/colors';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const isDark = skin === SKINS.operator || skin === SKINS.midnight;

  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    loading,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [authType, setAuthType] = useState('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localError, setLocalError] = useState('');

  const styles = createStyles(theme, isDark);

  const handleEmailAuth = async () => {
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (mode === 'signup' && !username) {
      setLocalError('Please enter a username');
      return;
    }

    if (mode === 'signup') {
      if (!inviteCode.trim()) {
        setLocalError('Invite code is required');
        return;
      }
      if (username.length < 3 || username.length > 20) {
        setLocalError('Username must be 3-20 characters');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setLocalError('Username can only contain letters, numbers, and underscores');
        return;
      }
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    let result;
    if (mode === 'signin') {
      result = await signInWithEmail(email, password);
    } else {
      result = await signUpWithEmail(email, password, username, inviteCode.trim().toUpperCase());
    }

    if (!result?.success) {
      setLocalError(result?.error || 'Authentication failed');
    }
    // Navigation is handled automatically by auth state change
  };

  const handleGoogleSignIn = async () => {
    setLocalError('');
    const result = await signInWithGoogle();
    if (!result?.success) {
      setLocalError(result?.error || 'Google sign-in failed');
    }
  };

  const handleAppleSignIn = async () => {
    setLocalError('');
    const result = await signInWithApple();
    if (!result?.success) {
      setLocalError(result?.error || 'Apple sign-in failed');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgDeep }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.branding}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={[styles.tagline, { color: theme.textMuted }]}>Compete. Conquer. Repeat.</Text>
          </View>

          {/* Auth Options */}
          {authType === 'options' && (
            <View style={[styles.authCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Text style={[styles.authTitle, { color: theme.textMain }]}>Enter the Arena</Text>
              <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
                Choose your path to dominance
              </Text>

              {/* Email Sign In - Now prominent */}
              <TouchableOpacity
                onPress={() => {
                  setMode('signin');
                  setAuthType('email');
                }}
                activeOpacity={0.9}
                style={[styles.emailButton, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="mail" size={20} color="#fff" style={styles.socialIcon} />
                <Text style={[styles.emailButtonText, { color: '#fff' }]}>
                  Continue with Email
                </Text>
              </TouchableOpacity>

              {/* Google Sign In */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.9}
                style={styles.socialButton}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#1a1a1a" />
                  </View>
                ) : (
                  <>
                    <View style={styles.googleButtonIcon}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple Sign In */}
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={loading}
                activeOpacity={0.9}
                style={styles.appleButton}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#fff" style={styles.socialIcon} />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Email Auth */}
          {authType === 'email' && (
            <View style={[styles.authCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              {/* Back button row */}
              <TouchableOpacity
                onPress={() => setAuthType('options')}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color={theme.textMain} />
              </TouchableOpacity>

              <View style={{ marginTop: 16 }}>
                <Text style={[styles.authTitle, { color: theme.textMain }]}>
                  {mode === 'signin' ? 'Welcome Back' : 'Join UNYIELD'}
                </Text>
                <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
                  {mode === 'signin' ? 'Sign in to continue' : 'Create your account with an invite code'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                {mode === 'signup' && (
                  <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                    <Ionicons name="at-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: theme.textMain }]}
                      placeholder="Username (@handle for login)"
                      placeholderTextColor={theme.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                    />
                  </View>
                )}
                {mode === 'signup' && (
                  <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                    <Ionicons name="ticket-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: theme.textMain }]}
                      placeholder="Invite Code"
                      placeholderTextColor={theme.textMuted}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.replace(/\s+/g, '').toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={16}
                    />
                  </View>
                )}
                <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textMain }]}
                    placeholder="Email"
                    placeholderTextColor={theme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoCorrect={false}
                  />
                </View>
                <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textMain }]}
                    placeholder="Password"
                    placeholderTextColor={theme.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="password"
                    autoCorrect={false}
                  />
                </View>

                {/* Error inside form */}
                {localError ? (
                  <View style={[styles.errorContainer, { backgroundColor: `${theme.danger}15` }]}>
                    <Ionicons name="warning-outline" size={16} color={theme.danger} />
                    <Text style={[styles.errorText, { color: theme.danger }]}>{localError}</Text>
                    <TouchableOpacity onPress={() => setLocalError('')}>
                      <Ionicons name="close-circle" size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleEmailAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: '#fff' }]}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.switchContainer}>
                <Text style={[styles.switchText, { color: theme.textMuted }]}>
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                </Text>
                <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                  <Text style={[styles.switchLink, { color: theme.primary }]}>
                    {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error Message for options screen */}
          {authType === 'options' && localError ? (
            <View style={[styles.errorContainer, { backgroundColor: `${theme.danger}15` }]}>
              <Ionicons name="warning-outline" size={16} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{localError}</Text>
              <TouchableOpacity onPress={() => setLocalError('')}>
                <Ionicons name="close-circle" size={16} color={theme.danger} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Terms */}
          <Text style={[styles.terms, { color: theme.textMuted }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(theme, isDark) {
  return StyleSheet.create({
    container: { flex: 1 },
    contentContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    branding: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoImage: {
      width: 120,
      height: 120,
      marginBottom: 16,
    },
    tagline: {
      fontSize: 14,
      marginTop: 8,
      textTransform: 'uppercase',
      letterSpacing: 2,
      fontWeight: '700',
    },
    authCard: {
      borderRadius: 6,
      borderWidth: 1,
      borderTopWidth: 2,
      borderLeftWidth: 4,
      borderColor: '#2A2A2A',
      backgroundColor: '#161616',
      padding: 24,
      marginBottom: 20,
    },
    authTitle: {
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: 1,
    },
    authSubtitle: {
      fontSize: 11,
      textAlign: 'center',
      marginBottom: 24,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    // Email button - now primary/prominent
    emailButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 4,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      marginBottom: 16,
    },
    emailButtonText: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1,
    },
    // Google button - dark tactical
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 4,
      borderWidth: 1,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      borderColor: '#2A2A2A',
      backgroundColor: '#161616',
      marginBottom: 16,
    },
    googleButtonIcon: {
      position: 'absolute',
      left: 24,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleIconText: {
      fontSize: 20,
      fontWeight: '600',
      color: '#fff',
    },
    googleButtonText: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1,
      color: '#fff',
    },
    // Apple button - tactical dark
    appleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 4,
      borderWidth: 1,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      borderColor: '#2A2A2A',
      backgroundColor: '#0a0a0a',
    },
    appleButtonText: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1,
      color: '#ffffff',
    },
    socialIcon: {
      position: 'absolute',
      left: 24,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      backgroundColor: '#161616',
      borderWidth: 1,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      borderColor: '#333',
    },
    inputContainer: {
      marginTop: 20,
      gap: 12,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      borderColor: '#2A2A2A',
      backgroundColor: '#0a0a0a',
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
    primaryButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 4,
      borderTopWidth: 2,
      borderLeftWidth: 3,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1.5,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    switchText: {
      fontSize: 14,
    },
    switchLink: {
      fontSize: 14,
      fontWeight: '700',
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 4,
      marginBottom: 16,
      gap: 8,
      borderWidth: 1,
      borderLeftWidth: 4,
      backgroundColor: '#1a0a0a',
    },
    errorText: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    terms: {
      fontSize: 11,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
  });
}
