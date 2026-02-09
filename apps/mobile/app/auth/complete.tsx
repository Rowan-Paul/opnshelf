import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { saveSession } from '@/lib/session';

export default function AuthCompleteScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string }>();
  const { session } = params;

  useEffect(() => {
    async function completeAuth() {
      if (session) {
        await saveSession(session);
      }

      await queryClient.invalidateQueries({ queryKey: ['auth'] });

      router.replace('/');
    }

    completeAuth();
  }, [router, queryClient, session]);

  return (
    <View className="flex-1 bg-gray-950 justify-center items-center p-4">
      <Ionicons name="film" size={48} color="#a855f7" />
      <ActivityIndicator
        size="large"
        color="#a855f7"
        className="my-4"
      />
      <Text className="text-gray-400">Completing sign-in...</Text>
    </View>
  );
}
