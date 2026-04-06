import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Platform } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import FormScreen from './src/screens/FormScreen';
import AuditScreen from './src/screens/AuditScreen';
import { getToken, getUser, clearAuth } from './src/utils/storage';
import { COLORS } from './src/constants';

const Tab = createBottomTabNavigator();

export default function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await getToken();
      const savedUser = await getUser();
      if (token && savedUser) {
        setUser(savedUser);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    } catch {
      setAuthState('unauthenticated');
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setAuthState('authenticated');
  };

  const handleLogout = async () => {
    await clearAuth();
    setUser(null);
    setAuthState('unauthenticated');
  };

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>AG</Text>
        </View>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
          headerStyle: { backgroundColor: COLORS.surface, shadowColor: 'transparent', elevation: 0, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '700', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: COLORS.accent },
          headerRight: () => (
            <Text
              style={{ color: COLORS.muted, fontSize: 11, marginRight: 16, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
              onPress={handleLogout}
            >
              LOGOUT
            </Text>
          ),
        }}
      >
        <Tab.Screen
          name="Form"
          options={{
            title: 'ADMITGUARD',
            tabBarLabel: 'SUBMIT',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📝</Text>,
          }}
        >
          {() => <FormScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
          name="Audit"
          options={{
            title: 'AUDIT LOG',
            tabBarLabel: 'AUDIT',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
          }}
          component={AuditScreen}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
