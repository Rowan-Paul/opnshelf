import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="film" size={48} color="#a855f7" />
        </View>
        <Text style={styles.title}>OpnShelf</Text>
        <Text style={styles.subtitle}>
          Your personal media tracker powered by AT Protocol
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.ctaText}>Search Movies</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Track Your Media</Text>
          <Text style={styles.cardText}>
            Keep track of movies, shows, and games you've watched and played
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Own Your Data</Text>
          <Text style={styles.cardText}>
            Built on AT Protocol - your data belongs to you
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Discover & Share</Text>
          <Text style={styles.cardText}>
            See what others are watching and share your favorites
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 32,
    textAlign: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#9333ea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cards: {
    gap: 24,
  },
  card: {
    backgroundColor: '#111827',
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
