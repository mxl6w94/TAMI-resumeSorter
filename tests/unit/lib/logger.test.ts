import { describe, it, expect, vi, afterEach } from 'vitest'
import { logger } from '@/lib/logger'

afterEach(() => vi.restoreAllMocks())

describe('logger', () => {
  it('logger.info writes a JSON entry at level info', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('test info', { folderId: 'f1' })
    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('test info')
    expect(parsed.folderId).toBe('f1')
    expect(parsed.timestamp).toBeDefined()
  })

  it('logger.warn writes a JSON entry at level warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('test warn')
    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('warn')
  })

  it('logger.error writes a JSON entry at level error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('test error', { resumeId: 'r1', error: 'boom' })
    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('error')
    expect(parsed.resumeId).toBe('r1')
    expect(parsed.error).toBe('boom')
  })

  it('logger works without context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('no context')
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.message).toBe('no context')
  })
})
