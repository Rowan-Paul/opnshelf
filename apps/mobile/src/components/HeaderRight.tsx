import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { authControllerMeOptions, authControllerLogoutMutation } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HeaderRight() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  // Fetch auth state using generated TanStack Query hook
  const { data: user, isLoading } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Logout mutation using generated TanStack Query hook
  const logoutMutation = useMutation({
    ...authControllerLogoutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
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
        onPress={() => navigation.navigate('Login', {})}
        activeOpacity={0.7}
      >
        <Ionicons name="log-in" size={24} color="#a855f7" />
      </TouchableOpacity>
    );
  }

  return (
    <View className="flex-row items-center gap-3 mr-4">
      {/* Shelf button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Shelf')}
        activeOpacity={0.7}
      >
        <Ionicons name="book" size={24} color="#a855f7" />
      </TouchableOpacity>

      {/* User avatar/logout */}
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
