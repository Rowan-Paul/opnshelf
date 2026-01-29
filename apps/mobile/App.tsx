import './src/global.css';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient } from '@opnshelf/api';
import type { RootStackParamList } from './src/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { env } from './src/env';

configureApiClient(env.API_URL);

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

const linking = {
  config: {
    screens: {
      Home: '',
      Search: 'search',
    },
  },
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#030712' },
            headerTintColor: '#f9fafb',
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#030712' },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'OpnShelf' }}
          />
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: 'Search Movies' }}
          />
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
