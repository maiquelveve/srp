import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/screens/LoginScreen';
import InmatesLookup from '@/screens/InmatesLookup';
import MovementRegister from '@/screens/MovementRegister';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): JSX.Element {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="InmatesLookup" component={InmatesLookup} />
            <Stack.Screen
              name="MovementRegister"
              component={MovementRegister}
              options={{ headerShown: true, title: '' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
