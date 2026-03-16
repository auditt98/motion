/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PARTYKIT_HOST: string;
  readonly VITE_AGENT_RUNTIME_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
