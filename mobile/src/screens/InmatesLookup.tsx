import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from '@/features/structure/api';

/**
 * FR-007 — consultar lista de presos por cela/galeria, somente leitura.
 * Policial Penal never writes structure data from mobile (contracts/structure.md).
 */
export default function InmatesLookup(): JSX.Element {
  const { user, logout } = useAuth();

  const [unitId, setUnitId] = useState<number | null>(null);
  const [galleryId, setGalleryId] = useState<number | null>(null);
  const [cellId, setCellId] = useState<number | null>(null);

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });
  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId as number),
    enabled: galleryId !== null,
  });
  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates(cellId as number),
    enabled: cellId !== null,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{user?.name}</Text>
        <Pressable onPress={() => void logout()}>
          <Text style={styles.logout}>Sair</Text>
        </Pressable>
      </View>

      {cellId === null ? (
        galleryId === null ? (
          unitId === null ? (
            <FlatList
              data={unitsQuery.data?.data ?? []}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => setUnitId(item.id)}>
                  <Text style={styles.rowText}>{item.name}</Text>
                </Pressable>
              )}
              ListHeaderComponent={<Text style={styles.sectionTitle}>Unidades</Text>}
            />
          ) : (
            <FlatList
              data={galleriesQuery.data?.data ?? []}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => setGalleryId(item.id)}>
                  <Text style={styles.rowText}>Galeria {item.code}</Text>
                </Pressable>
              )}
              ListHeaderComponent={
                <BackHeader title="Galerias" onBack={() => setUnitId(null)} />
              }
            />
          )
        ) : (
          <FlatList
            data={cellsQuery.data?.data ?? []}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => setCellId(item.id)}>
                <Text style={styles.rowText}>
                  Cela {item.code} ({item.occupancy}/{item.capacity})
                </Text>
              </Pressable>
            )}
            ListHeaderComponent={<BackHeader title="Celas" onBack={() => setGalleryId(null)} />}
          />
        )
      ) : (
        <FlatList
          data={inmatesQuery.data?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>{item.name}</Text>
              <Text style={styles.rowSubtext}>
                {item.status}
                {item.inMovement ? ' — fora da cela' : ''}
              </Text>
            </View>
          )}
          ListHeaderComponent={<BackHeader title="Presos" onBack={() => setCellId(null)} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum preso nesta cela.</Text>}
        />
      )}
    </View>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }): JSX.Element {
  return (
    <View style={styles.backHeader}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>{'< Voltar'}</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerText: { fontWeight: '600' },
  logout: { color: '#0f172a', textDecorationLine: 'underline' },
  sectionTitle: { fontSize: 16, fontWeight: '600', padding: 16 },
  backHeader: { paddingHorizontal: 16, paddingTop: 8 },
  backLink: { color: '#0f172a' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f1f1',
  },
  rowText: { fontSize: 15 },
  rowSubtext: { fontSize: 13, color: '#666', marginTop: 2 },
  empty: { padding: 16, color: '#666' },
});
