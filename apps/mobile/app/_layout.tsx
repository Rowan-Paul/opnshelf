import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient } from '@opnshelf/api';
import { useEffect, useState } from 'react';
import { HeaderRight } from '@/components/HeaderRight';
import { loadSession } from '@/lib/session';
import { env } from '@/env';
import '../src/global.css';

configureApiClient(env.EXPO_PUBLIC_API_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

function LoadingScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-gray-950">
      <View className="items-center">
        <View className="w-20 h-20 rounded-2xl bg-violet-600/20 justify-center items-center mb-6">
          <Ionicons name="film" size={48} color="#a855f7" />
        </View>
        <Text className="text-xl font-semibold text-gray-100 mb-2">
          OpnShelf
        </Text>
        <Text className="text-gray-400 mb-6">
          Loading...
        </Text>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    loadSession().finally(() => {
      setIsSessionLoaded(true);
    });
  }, []);

  if (!isSessionLoaded) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoadingScreen />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#030712' },
          headerTintColor: '#f9fafb',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#030712' },
          headerRight: () => <HeaderRight />,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'OpnShelf' }}
        />
        <Stack.Screen
          name="search"
          options={{ title: 'Search Movies' }}
        />
        <Stack.Screen
          name="shelf"
          options={{ title: 'My Shelf' }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: 'Sign In',
            headerRight: () => null,
          }}
        />
        <Stack.Screen
          name="auth/complete"
          options={{
            title: '',
            headerRight: () => null,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="movie/[movieId]/[title]"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
