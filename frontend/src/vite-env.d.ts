/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'exifr' {
  const exifr: {
    gps(file: File | string | Blob): Promise<{ latitude?: number; longitude?: number } | undefined>;
    parse(file: File | string | Blob): Promise<any>;
  };
  export default exifr;
}
