import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
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
        <TouchableOpacity
          className="flex-row items-center gap-2 bg-violet-600 py-3 px-6 rounded-lg"
          onPress={() => navigation.navigate('Search', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text className="text-white text-base font-semibold">
            Search Movies
          </Text>
        </TouchableOpacity>
      </View>

      <View className="gap-6">
        <View className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <Text className="text-lg font-semibold text-gray-50 mb-2">
            Track Your Media
          </Text>
          <Text className="text-sm text-gray-400">
            Keep track of movies, shows, and games you've watched and played
          </Text>
        </View>
        <View className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <Text className="text-lg font-semibold text-gray-50 mb-2">
            Own Your Data
          </Text>
          <Text className="text-sm text-gray-400">
            Built on AT Protocol - your data belongs to you
          </Text>
        </View>
        <View className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <Text className="text-lg font-semibold text-gray-50 mb-2">
            Discover & Share
          </Text>
          <Text className="text-sm text-gray-400">
            See what others are watching and share your favorites
          </Text>
        </View>
      </View>
    </View>
  );
}
