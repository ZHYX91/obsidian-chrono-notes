export interface AcceptanceVaultOptions {
  acceptanceRoot?: string;
  now?: Date;
  sourceRoot?: string;
}

export interface AcceptanceVaultTargetOptions {
  acceptanceRoot?: string;
  target: string;
}

export interface AcceptanceVaultMarker {
  kind: string;
  markerVersion: number;
  state: string;
  createdAt: string;
  pluginVersion: string;
  generatedFiles: Record<string, string>;
}

export const ACCEPTANCE_MARKER_NAME: string;
export const ACCEPTANCE_MARKER_KIND: string;
export const ACCEPTANCE_MARKER_VERSION: number;
export const DEFAULT_RETENTION_HOURS: number;

export function getDefaultAcceptanceRoot(): string;
export function createAcceptanceVault(
  options?: AcceptanceVaultOptions,
): Promise<string>;
export function verifyAcceptanceVault(
  options: AcceptanceVaultTargetOptions,
): Promise<AcceptanceVaultMarker>;
export function cleanAcceptanceVault(
  options: AcceptanceVaultTargetOptions,
): Promise<void>;
export function pruneAcceptanceVaults(
  options?: {
    acceptanceRoot?: string;
    maxAgeHours?: number;
    now?: Date;
  },
): Promise<string[]>;
