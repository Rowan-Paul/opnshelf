import { useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { authControllerMeOptions, authControllerLogoutMutation } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';

export function HeaderRight() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logoutMutation = useMutation({
    ...authControllerLogoutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
      router.replace('/');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync({});
  };

  if (isLoading) {
    return (
      <View className="mr-4">
        <ActivityIndicator size="small" color="#a855f7" />
      </View>
    );
  }

  if (!user) {
    return (
      <TouchableOpacity
        className="mr-4 flex-row items-center gap-2"
        onPress={() => router.push('/login')}
        activeOpacity={0.7}
      >
        <Ionicons name="log-in" size={24} color="#a855f7" />
      </TouchableOpacity>
    );
  }

  return (
    <View className="flex-row items-center gap-3 mr-4">
      <TouchableOpacity
        onPress={() => router.push('/shelf')}
        activeOpacity={0.7}
      >
        <Ionicons name="book" size={24} color="#a855f7" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLogout}
        disabled={logoutMutation.isPending}
        activeOpacity={0.7}
      >
        {logoutMutation.isPending ? (
          <ActivityIndicator size="small" color="#a855f7" />
        ) : user.avatar ? (
          <Image
            source={{ uri: String(user.avatar) }}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <View className="w-8 h-8 rounded-full bg-gray-800 justify-center items-center">
            <Ionicons name="person" size={16} color="#9ca3af" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
