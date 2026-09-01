import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/pages/LoginScreen';
import HomeScreen from '@/pages/HomeScreen';
import ProfileScreen from '@/pages/ProfileScreen';
import SelectUnitScreen from '@/features/structure/screens/SelectUnitScreen';
import GalleriesScreen from '@/features/structure/screens/GalleriesScreen';
import CellsScreen from '@/features/structure/screens/CellsScreen';
import InmatesScreen from '@/features/structure/screens/InmatesScreen';
import InmateDetailScreen from '@/features/structure/screens/InmateDetailScreen';
import MovementRegister from '@/features/movements/screens/MovementRegister';
import CellTransferSelect from '@/features/movements/screens/CellTransferSelect';
import CellChange from '@/features/movements/screens/CellChange';
import CellSwap from '@/features/movements/screens/CellSwap';
import { colors } from '@/theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema escuro/dourado (research.md #16/#27) aplicado ao chrome nativo
// (transições de tela) — DarkTheme como base pra herdar fontConfig. Header
// nativo fica sempre oculto (headerShown: false) — todas as telas usam o
// ScreenHeader próprio, pra manter um único padrão de navegação (research.md
// #29).
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    primary: colors.primary,
    notification: colors.destructive,
  },
};

export default function RootNavigator(): JSX.Element {
  const { user } = useAuth();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SelectUnit" component={SelectUnitScreen} />
            <Stack.Screen name="Galleries" component={GalleriesScreen} />
            <Stack.Screen name="Cells" component={CellsScreen} />
            <Stack.Screen name="Inmates" component={InmatesScreen} />
            <Stack.Screen name="InmateDetail" component={InmateDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="MovementRegister" component={MovementRegister} />
            <Stack.Screen name="CellTransferSelect" component={CellTransferSelect} />
            <Stack.Screen name="CellChange" component={CellChange} />
            <Stack.Screen name="CellSwap" component={CellSwap} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
