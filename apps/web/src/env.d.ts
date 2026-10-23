/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** subdominio del proyecto de Nhost (por ejemplo, abcdefgh) */
  readonly VITE_NHOST_SUBDOMAIN?: string;
  /** región del proyecto de Nhost (por ejemplo, eu-central-1) */
  readonly VITE_NHOST_REGION?: string;
  /** opcional: URL completa de Auth y de GraphQL (para Nhost local o un dominio propio) */
  readonly VITE_NHOST_AUTH_URL?: string;
  readonly VITE_NHOST_GRAPHQL_URL?: string;
}
