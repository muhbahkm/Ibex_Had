import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
let generationCounter = 0;

type StorageMeta = {
  readonly version: 1;
  readonly generation: string;
  readonly chunks: number;
};

function encodeKey(key: string): string {
  return Array.from(key)
    .map((character) => character.codePointAt(0)?.toString(16).padStart(6, '0') ?? '000000')
    .join('');
}

function keyPrefix(key: string): string {
  return `ibex.session.${encodeKey(key)}`;
}

function metaKey(key: string): string {
  return `${keyPrefix(key)}.meta`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${keyPrefix(key)}.${generation}.${index}`;
}

function splitValue(value: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    chunks.push(value.slice(index, index + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}

function parseMeta(raw: string | null): StorageMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StorageMeta>;
    const chunks = parsed.chunks;
    if (
      parsed.version !== 1 ||
      typeof parsed.generation !== 'string' ||
      typeof chunks !== 'number' ||
      !Number.isInteger(chunks) ||
      chunks < 1 ||
      chunks > 128
    ) {
      return null;
    }
    return {
      version: 1,
      generation: parsed.generation,
      chunks,
    };
  } catch {
    return null;
  }
}

async function removeGeneration(key: string, meta: StorageMeta | null): Promise<void> {
  if (!meta) return;
  await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, meta.generation, index)),
    ),
  );
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    if (!meta) return null;

    const chunks = await Promise.all(
      Array.from({ length: meta.chunks }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, meta.generation, index)),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) {
      await this.removeItem(key);
      return null;
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousMeta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    generationCounter += 1;
    const generation = `${Date.now().toString(36)}-${generationCounter.toString(36)}`;
    const chunks = splitValue(value);

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      ),
    );

    const nextMeta: StorageMeta = { version: 1, generation, chunks: chunks.length };
    await SecureStore.setItemAsync(metaKey(key), JSON.stringify(nextMeta), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    await removeGeneration(key, previousMeta);
  },

  async removeItem(key: string): Promise<void> {
    const meta = parseMeta(await SecureStore.getItemAsync(metaKey(key)));
    await SecureStore.deleteItemAsync(metaKey(key));
    await removeGeneration(key, meta);
  },
};
