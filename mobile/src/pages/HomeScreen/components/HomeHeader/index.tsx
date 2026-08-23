import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChartColumn, LogOut, MapPin, UsersRound } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { initials } from '@/lib/initials';
import StatCard from '../StatCard';

interface HomeHeaderProps {
  userName: string;
  firstName: string;
  currentUnitName: string | null;
  inmatesTotal: number | null;
  occupancyPercent: number | null;
  openMovementsTotal: number;
  onPressAvatar: () => void;
  onPressUnitLabel: () => void;
}

export default function HomeHeader({
  userName,
  firstName,
  currentUnitName,
  inmatesTotal,
  occupancyPercent,
  openMovementsTotal,
  onPressAvatar,
  onPressUnitLabel,
}: HomeHeaderProps): JSX.Element {
  return (
    <View className="gap-7 px-6 pb-2 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onPressAvatar} className="active:opacity-70">
            <Avatar alt={`Foto de ${userName}`} className="h-11 w-11">
              <AvatarFallback>
                <Text className="text-sm font-bold">{initials(userName)}</Text>
              </AvatarFallback>
            </Avatar>
          </Pressable>
          <View>
            <Text variant="h4" className="text-left">
              {userName}
            </Text>
            <Text variant="muted" className="text-sm">
              Bem-vindo ao sistema
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onPressUnitLabel}
          className="border-primary flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70"
        >
          <Icon as={MapPin} size={14} color={colors.primary} />
          <Text className="text-primary text-xs font-bold">{currentUnitName ?? 'Selecionar'}</Text>
        </Pressable>
      </View>

      <View className="border-primary overflow-hidden rounded-2xl border-l-4 bg-[#111113]">
        <View style={{ padding: 18, minHeight: 118, justifyContent: 'center' }}>
          <Image
            source={require('../../../../../assets/logo-pp-rs.png')}
            resizeMode="contain"
            style={{
              position: 'absolute',
              right: 6,
              top: 9,
              width: 96,
              height: 96,
              opacity: 0.5,
            }}
          />
          <LinearGradient
            colors={['#111113', '#111113', 'rgba(17,17,19,0.55)', 'rgba(17,17,19,0.4)']}
            locations={[0, 0.72, 0.9, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <Text variant="h4" className="text-left text-white">
            Olá, {firstName}
          </Text>
          <Text className="mt-1 text-sm text-white/80">Aqui está o resumo da unidade.</Text>
        </View>
      </View>

      <View className="gap-3">
        <Text variant="muted" className="text-sm font-bold uppercase">
          Resumo da unidade
        </Text>

        <View className="flex-row gap-3">
          <StatCard
            icon={UsersRound}
            value={inmatesTotal === null ? '—' : String(inmatesTotal)}
            label="Presos"
            sublabel="Total"
          />
          <StatCard
            icon={ChartColumn}
            value={occupancyPercent === null ? '—' : `${occupancyPercent}%`}
            label="Ocupação"
            sublabel="Taxa"
          />
          <StatCard
            icon={LogOut}
            value={String(openMovementsTotal)}
            label="Saídas"
            sublabel="Externas"
          />
        </View>
      </View>
    </View>
  );
}
