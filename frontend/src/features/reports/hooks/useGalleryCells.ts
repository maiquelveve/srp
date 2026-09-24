import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { structureApi } from '@/features/structure/api';

/** Galeria selecionada da unidade (primeira por padrão) e as celas dela. */
export function useGalleryCells(unitId: number | null) {
  const [galleryId, setGalleryId] = useState<number | null>(null);

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

  const galleries = useMemo(() => galleriesQuery.data?.data ?? [], [galleriesQuery.data]);
  useEffect(() => {
    if (galleries.length === 0) {
      setGalleryId(null);
      return;
    }
    if (galleryId === null || !galleries.some((gallery) => gallery.id === galleryId)) {
      setGalleryId(galleries[0].id);
    }
  }, [galleries, galleryId]);

  const cells = useMemo(() => cellsQuery.data?.data ?? [], [cellsQuery.data]);

  return { galleryId, setGalleryId, galleries, cells };
}
