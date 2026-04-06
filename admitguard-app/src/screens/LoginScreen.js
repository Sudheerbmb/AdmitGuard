import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants';
import { loginCounselor } from '../utils/api';
import { saveToken, saveUser } from '../utils/storage';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginCounselor(username.trim(), password.trim());
      await saveToken(res.data.token);
      await saveUser(res.data.user);
      onLoginSuccess(res.data.user);
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>AG</Text>
          </View>
          <Text style={styles.logoText}>ADMITGUARD</Text>
          <Text style={styles.logoSub}>COUNSELOR PORTAL</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Staff Login</Text>
          <Text style={styles.cardSub}>Authenticate to access the admission system</Text>

          <Text style={styles.label}>ID / Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter Staff ID"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Security Key / Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
          />

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginBtnText}>AUTHENTICATE</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>🛡️ Encrypted Session Key Protocol</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 20,
  },
  logoIconText: { fontWeight: '700', fontSize: 18, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logoText: { color: COLORS.accent, fontSize: 20, fontWeight: '700', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logoSub: { color: COLORS.muted, fontSize: 10, letterSpacing: 2, marginTop: 4 },

  card: {
    width: '100%', backgroundColor: COLORS.surface,
    borderRadius: 20, padding: 28, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSub: { color: COLORS.muted, fontSize: 12, marginBottom: 24 },

  label: { color: COLORS.muted, fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, color: COLORS.text, fontSize: 14, padding: 12, marginBottom: 16,
  },

  errorBox: {
    backgroundColor: 'rgba(255,75,110,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,75,110,0.3)', borderRadius: 8, padding: 10, marginBottom: 16,
  },
  errorText: { color: COLORS.error, fontSize: 12 },

  loginBtn: {
    backgroundColor: COLORS.accent, borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontWeight: '700', fontSize: 13, letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  footer: { color: COLORS.muted, fontSize: 11, marginTop: 32, letterSpacing: 1 },
});
