import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { authControllerMeOptions, getLoginUrl } from '@opnshelf/api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const [handle, setHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { error, redirect, reason } = route.params ?? {};

  console.log('[LoginScreen] Rendered with params:', route.params);

  // Check if user is already logged in using generated TanStack Query hook
  const { data: user, isLoading: isAuthLoading } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isAuthLoading) {
      if (redirect === 'Shelf') {
        navigation.replace('Shelf');
      } else if (redirect === 'Search') {
        navigation.replace('Search', {});
      } else {
        navigation.replace('Home');
      }
    }
  }, [user, isAuthLoading, navigation, redirect]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Append platform=mobile so backend knows to redirect to deep link
      const loginUrl = `${getLoginUrl(handle || undefined)}&platform=mobile`;
      
      // Open login URL in web browser
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        'opnshelf://auth/complete'
      );

      if (result.type === 'success') {
        // Browser redirected back via deep link, extract session from URL
        const url = new URL(result.url);
        const session = url.searchParams.get('session');
        navigation.replace('AuthComplete', { session: session || undefined });
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
    console.log('[LoginScreen] Showing loading indicator');
    return (
      <View className="flex-1 bg-gray-950 justify-center items-center">
        <ActivityIndicator size="large" colorClassName="accent-violet-500" />
      </View>
    );
  }

  console.log('[LoginScreen] Rendering login UI, user:', user ? 'found' : 'not found');
      <View className="flex-1 justify-center">
        <View className="items-center mb-8">
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

        {/* Session expired message */}
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

        {/* Error message */}
        {error && (
          <View className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex-row items-start gap-3">
            <Ionicons name="alert-circle" size={20} color="#f87171" />
            <Text className="text-red-200 text-sm flex-1">
              {errorMessages[error] || 'An error occurred. Please try again.'}
            </Text>
          </View>
        )}

        {/* Login form */}
        <View className="gap-6">
          <View>
            <Text className="text-sm font-medium text-gray-300 mb-2">
              Handle
            </Text>
            <TextInput
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
              value={handle}
              onChangeText={setHandle}
              placeholder="username.bsky.social"
              placeholderTextColorClassName="accent-gray-500"
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
            Don't have an account?{' '}
            <Text
              className="text-violet-400 underline"
              onPress={() => Linking.openURL('https://bsky.app/')}
            >
              Sign up on Bluesky
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
