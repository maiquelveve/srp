import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellTransferSelect'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellTransferSelect'>['route'];

export function useCellTransferSelectViewModel(navigation: Navigation, route: Route) {
  const { inmate, cellId, galleryId, galleryCode } = route.params;

  function goToCellChange(): void {
    navigation.navigate('CellChange', { inmate, cellId, galleryId, galleryCode });
  }

  function goToCellSwap(): void {
    navigation.navigate('CellSwap', { inmate, cellId, galleryId, galleryCode });
  }

  return {
    inmate,
    goToCellChange,
    goToCellSwap,
  };
}
