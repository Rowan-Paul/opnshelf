import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import type { RootStackParamList } from '../navigation';
import { saveSession } from '../lib/session';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthComplete'>;

export function AuthCompleteScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { session } = route.params ?? {};

  useEffect(() => {
    async function completeAuth() {
      // Save session token if provided (mobile auth flow)
      if (session) {
        await saveSession(session);
      }

      // Invalidate auth query so app picks up the new session
      await queryClient.invalidateQueries({ queryKey: ['auth'] });

      // Navigate to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }

    completeAuth();
  }, [navigation, queryClient, session]);

  return (
    <View className="flex-1 bg-gray-950 justify-center items-center p-4">
      <Ionicons name="film" size={48} color="#a855f7" />
      <ActivityIndicator
        size="large"
        colorClassName="accent-violet-500"
        className="my-4"
      />
      <Text className="text-gray-400">Completing sign-in...</Text>
    </View>
  );
}
