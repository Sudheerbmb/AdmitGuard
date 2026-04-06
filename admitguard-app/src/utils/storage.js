import * as SecureStore from 'expo-secure-store';

export const saveToken = async (token) => {
  await SecureStore.setItemAsync('counselor_token', token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync('counselor_token');
};

export const saveUser = async (user) => {
  await SecureStore.setItemAsync('counselor_user', JSON.stringify(user));
};

export const getUser = async () => {
  const raw = await SecureStore.getItemAsync('counselor_user');
  return raw ? JSON.parse(raw) : null;
};

export const clearAuth = async () => {
  await SecureStore.deleteItemAsync('counselor_token');
  await SecureStore.deleteItemAsync('counselor_user');
};
