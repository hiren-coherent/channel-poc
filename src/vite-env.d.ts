/// <reference types="vite/client" />

// Stamped by the deploy workflows at build time; unset under `pnpm dev`.
interface ImportMetaEnv {
  readonly VITE_CHANNEL?: string;
  readonly VITE_BRANCH?: string;
  readonly VITE_COMMIT?: string;
  readonly VITE_BUILD_TIME?: string;
}
