import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { authControllerMeOptions } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { RootStackParamList } from '../navigation';
import { useIsTablet } from '../utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = useIsTablet();

  // Check auth state using generated TanStack Query hook
  const { data: user } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-12 pb-6">
      <View className="items-center mb-12">
        <View className="mb-6">
          <Ionicons name="film" size={48} color="#a855f7" />
        </View>
        <Text className="text-4xl font-bold text-gray-50 mb-4">OpnShelf</Text>
        <Text className="text-lg text-gray-400 text-center mb-8">
          Your personal media tracker powered by AT Protocol
        </Text>

        {/* User greeting if logged in */}
        {user && (
          <View className="flex-row items-center gap-3 mb-6 bg-gray-900 py-3 px-4 rounded-lg border border-gray-800">
            {user.avatar ? (
              <Image
                source={{ uri: String(user.avatar) }}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-gray-800 justify-center items-center">
                <Ionicons name="person" size={20} color="#9ca3af" />
              </View>
            )}
            <View>
              <Text className="text-gray-50 font-semibold">
                {user.displayName ? String(user.displayName) : user.handle}
              </Text>
              <Text className="text-gray-500 text-sm">@{user.handle}</Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View className={`${isTablet ? 'flex-row gap-4' : 'flex-col gap-3'}`}>
          <Button
            size="lg"
            onPress={() => navigation.navigate('Search', {})}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <Text className="text-white text-base font-semibold ml-2">
              Search Movies
            </Text>
          </Button>

          {user ? (
            <TouchableOpacity
              className="flex-row items-center gap-2 bg-gray-800 py-3 px-6 rounded-lg border border-gray-700"
              onPress={() => navigation.navigate('Shelf')}
              activeOpacity={0.8}
            >
              <Ionicons name="book" size={20} color="#a855f7" />
              <Text className="text-gray-50 text-base font-semibold">
                My Shelf
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="flex-row items-center gap-2 bg-gray-800 py-3 px-6 rounded-lg border border-gray-700"
              onPress={() => navigation.navigate('Login', {})}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in" size={20} color="#a855f7" />
              <Text className="text-gray-50 text-base font-semibold">
                Sign In
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

        <View className={`${isTablet ? 'flex-row flex-wrap gap-4' : 'gap-6'}`}>
        <Card className={`${isTablet ? 'flex-1 min-w-[45%]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg">Track Your Media</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Keep track of movies, shows, and games you&apos;ve watched and played
            </CardDescription>
          </CardContent>
        </Card>
        <Card className={`${isTablet ? 'flex-1 min-w-[45%]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg">Own Your Data</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Built on AT Protocol - your data belongs to you
            </CardDescription>
          </CardContent>
        </Card>
        <Card className={`${isTablet ? 'flex-1 min-w-[45%]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg">Discover & Share</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              See what others are watching and share your favorites
            </CardDescription>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}
