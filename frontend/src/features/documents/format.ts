const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

/** Só a data, sem hora — card de documento compacto (evita quebrar linha). */
export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

/** `850` -> "850 B", `245678` -> "240 KB", `3145728` -> "3.0 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${Math.round(kilobytes)} KB`;
  }
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

/** Extensão em maiúsculas pro selo do card (ex.: "portaria.pdf" -> "PDF"). */
export function extensionOf(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName);
  return match ? match[1].toUpperCase() : '';
}
