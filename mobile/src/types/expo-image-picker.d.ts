declare module 'expo-image-picker' {
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: string[] | string;
    quality?: number;
  }): Promise<{
    canceled: boolean;
    assets?: Array<{ uri: string; mimeType?: string; fileName?: string }>;
  }>;
}
