export const IBEX_HAD_CORE_VERSION = '0.0.0' as const;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
