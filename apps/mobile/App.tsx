import './src/global.css';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  type NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { configureApiClient, setOnUnauthorized } from '@opnshelf/api';
import type { RootStackParamList } from './src/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { ShelfScreen } from './src/screens/ShelfScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { AuthCompleteScreen } from './src/screens/AuthCompleteScreen';
import { MovieDetailScreen } from './src/screens/MovieDetailScreen';
import { HeaderRight } from './src/components/HeaderRight';
import { loadSession, clearSession } from './src/lib/session';
import { env } from './src/env';

configureApiClient(env.API_URL);

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});

const linking = {
  prefixes: ['opnshelf://'],
  config: {
    screens: {
      Home: '',
      Search: 'search',
      Shelf: 'shelf',
      Login: 'login',
      AuthComplete: 'auth/complete',
      MovieDetail: 'movie/:movieId/:title',
    },
  },
};

function AppNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const queryClientLocal = useQueryClient();
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Load session from secure storage on app start
  useEffect(() => {
    console.log('[App] AppNavigator mounted - loading session');
    loadSession().then((token) => {
      console.log('[App] loadSession completed with token:', token ? 'YES' : 'NO');
    }).finally(() => {
      console.log('[App] Session loaded or completed');
      setIsSessionLoaded(true);
    });
  }, []);

  // Set up 401 handler
  useEffect(() => {
    setOnUnauthorized(() => {
      console.log('[App] onUnauthorized called - 401 detected');
      // Clear stored session on 401
      clearSession();

      // Invalidate auth queries
      queryClientLocal.invalidateQueries({ queryKey: ['auth'] });

      // Navigate to login with session_expired reason
      if (navigationRef.current) {
        console.log('[App] Navigating to Login screen with session_expired reason');
        navigationRef.current.reset({
          index: 0,
          routes: [
            {
              name: 'Login',
              params: { reason: 'session_expired' as const },
            },
          ],
        });
      }
    });

    return () => {
      setOnUnauthorized(null);
    };
  }, [queryClientLocal]);

  // Show loading screen while restoring session
  if (!isSessionLoaded) {
    console.log('[App] Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  console.log('[App] Session loaded, showing app');

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#030712' },
          headerTintColor: '#f9fafb',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#030712' },
          headerRight: () => <HeaderRight />,
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
        <Stack.Screen
          name="Shelf"
          component={ShelfScreen}
          options={{ title: 'My Shelf' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            title: 'Sign In',
            headerRight: undefined,
          }}
        />
        <Stack.Screen
          name="AuthComplete"
          component={AuthCompleteScreen}
          options={{
            title: '',
            headerRight: undefined,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="MovieDetail"
          component={MovieDetailScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigator />
    </QueryClientProvider>
  );
}
