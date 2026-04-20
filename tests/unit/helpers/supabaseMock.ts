import { vi } from 'vitest'

/**
 * Creates a chainable Supabase query builder mock.
 * Every method returns `this` (for chaining), and the object is thenable
 * so `await supabase.from('x').select('*').eq('id', y)` resolves to `result`.
 */
export function makeChain(result: { data?: unknown; error?: unknown; count?: number | null } = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }

  const chain: Record<string, unknown> = {}
  const methods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'match', 'single', 'limit', 'order', 'head', 'rpc',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (v: unknown) => unknown) => Promise.resolve(resolved).catch(reject)

  return chain
}

/**
 * Creates a Supabase storage mock that returns a fixed upload result and public URL.
 */
export function makeStorageMock(
  uploadResult: { error?: unknown } = {},
  publicUrl = 'https://example.com/file.pdf'
) {
  return {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: uploadResult.error ?? null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl } })),
    })),
  }
}

/**
 * Creates a full Supabase client mock where every `.from()` call
 * returns the same chain. Override with `fromOverrides` keyed by table name.
 */
export function makeSupabaseMock(
  defaultResult: { data?: unknown; error?: unknown; count?: number | null } = {},
  fromOverrides: Record<string, ReturnType<typeof makeChain>> = {},
  storageMock?: ReturnType<typeof makeStorageMock>
) {
  const defaultChain = makeChain(defaultResult)
  return {
    from: vi.fn((table: string) => fromOverrides[table] ?? defaultChain),
    rpc: vi.fn(() => makeChain(defaultResult)),
    storage: storageMock ?? makeStorageMock(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  }
}
