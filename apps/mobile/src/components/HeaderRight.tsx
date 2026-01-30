import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthUser, logout } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import type { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HeaderRight() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
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
        disabled={isLoggingOut}
        activeOpacity={0.7}
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color="#a855f7" />
        ) : user.avatar ? (
          <Image
            source={{ uri: user.avatar }}
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
