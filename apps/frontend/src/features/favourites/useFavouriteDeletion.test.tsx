import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFavouriteDeletion } from './useFavouriteDeletion'

const home = { id: 7, userId: 'driver-1', locationName: 'Home', address: '1 Main St', latitude: 1.3, longitude: 103.8, createdAt: '2026-09-30T00:00:00.000Z' }
const office = { ...home, id: 8, locationName: 'Office' }

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('useFavouriteDeletion', () => {
  it('hides immediately and Undo cancels the HTTP request', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useFavouriteDeletion(remove))
    act(() => result.current.scheduleDelete(home))
    expect(result.current.isHidden(home.id)).toBe(true)
    expect(result.current.pendingFavourite).toEqual(home)

    act(() => result.current.undoDelete())
    expect(result.current.isHidden(home.id)).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(remove).not.toHaveBeenCalled()
  })

  it('sends exactly one DELETE after 5000ms', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useFavouriteDeletion(remove))
    act(() => result.current.scheduleDelete(home))
    await act(async () => vi.advanceTimersByTimeAsync(4999))
    expect(remove).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(remove).toHaveBeenCalledExactlyOnceWith(home.id)
    expect(result.current.pendingFavourite).toBeNull()
    expect(result.current.isHidden(home.id)).toBe(true)
  })

  it('restores the item and reports a failed DELETE', async () => {
    const remove = vi.fn().mockRejectedValue(new Error('Favourite not found'))
    const { result } = renderHook(() => useFavouriteDeletion(remove))
    act(() => result.current.scheduleDelete(home))
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.current.isHidden(home.id)).toBe(false)
    expect(result.current.error).toContain('Favourite not found')
  })

  it('allows only one pending item and cancels its timer on unmount', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useFavouriteDeletion(remove))
    act(() => { result.current.scheduleDelete(home); result.current.scheduleDelete(office) })
    expect(result.current.pendingFavourite).toEqual(home)
    expect(result.current.isHidden(office.id)).toBe(false)
    unmount()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(remove).not.toHaveBeenCalled()
  })

  it('uses the removal callback captured when deletion was scheduled', async () => {
    const removeA = vi.fn().mockResolvedValue(undefined)
    const removeB = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ remove }) => useFavouriteDeletion(remove), {
      initialProps: { remove: removeA },
    })
    act(() => result.current.scheduleDelete(home))
    rerender({ remove: removeB })
    await act(async () => vi.advanceTimersByTimeAsync(5000))

    expect(removeA).toHaveBeenCalledExactlyOnceWith(home.id)
    expect(removeB).not.toHaveBeenCalled()
  })
})
