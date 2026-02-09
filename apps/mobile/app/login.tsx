import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authControllerMeOptions, getLoginUrl } from '@opnshelf/api';
import { useIsTablet } from '@/utils';

export default function LoginScreen() {
  const [handle, setHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams<{
    error?: 'auth_failed' | 'callback_failed';
    redirect?: string;
    reason?: 'session_expired';
  }>();
  const { error, redirect, reason } = params;
  const isTablet = useIsTablet();

  const { data: user, isLoading: isAuthLoading } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (user && !isAuthLoading) {
      if (redirect === 'shelf') {
        router.replace('/shelf');
      } else if (redirect === 'search') {
        router.replace('/search');
      } else {
        router.replace('/');
      }
    }
  }, [user, isAuthLoading, router, redirect]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const loginUrl = `${getLoginUrl(handle || undefined)}&platform=mobile`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        'opnshelf://auth/complete'
      );

      if (result.type === 'success') {
        const url = new URL(result.url);
        const session = url.searchParams.get('session');
        router.replace({ pathname: '/auth/complete', params: { session: session || undefined } });
      } else {
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setIsSubmitting(false);
    }
  };

  const errorMessages: Record<string, string> = {
    auth_failed: 'Authentication failed. Please try again.',
    callback_failed: 'Something went wrong during sign in. Please try again.',
  };

  if (isAuthLoading) {
    return (
      <View className="flex-1 bg-gray-950 justify-center items-center">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-950"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={`flex-1 justify-center ${isTablet ? 'items-center' : ''}`}>
          <View className={`items-center mb-8 ${isTablet ? 'w-full max-w-md' : ''}`}>
            <View className="mb-4">
              <Ionicons name="film" size={48} color="#a855f7" />
            </View>
            <Text className="text-3xl font-bold text-gray-50 mb-2">
              Sign in to OpnShelf
            </Text>
            <Text className="text-base text-gray-400 text-center">
              Use your ATProto account to sign in
            </Text>
          </View>

          {reason === 'session_expired' && (
            <View className="mb-6 p-4 bg-amber-950/50 border border-amber-800 rounded-lg">
              <Text className="text-amber-200 font-semibold mb-1">
                You have been logged out
              </Text>
              <Text className="text-amber-300/80 text-sm">
                Your session has expired. Please sign in again to continue.
              </Text>
            </View>
          )}

          {error && (
            <View className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex-row items-start gap-3">
              <Ionicons name="alert-circle" size={20} color="#f87171" />
              <Text className="text-red-200 text-sm flex-1">
                {errorMessages[error] || 'An error occurred. Please try again.'}
              </Text>
            </View>
          )}

          <View className={`gap-6 ${isTablet ? 'w-full max-w-md' : ''}`}>
            <View>
              <Text className="text-sm font-medium text-gray-300 mb-2">
                Handle
              </Text>
              <TextInput
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                value={handle}
                onChangeText={setHandle}
                placeholder="username.bsky.social"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isSubmitting}
              />
            </View>

            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 px-4 py-3 bg-violet-600 rounded-lg disabled:bg-violet-800"
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-semibold">Redirecting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="log-in" size={20} color="#fff" />
                  <Text className="text-white font-semibold">
                    Sign in
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text className="text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <Text
                className="text-violet-400 underline"
                onPress={() => {}}
              >
                Sign up on Bluesky
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
