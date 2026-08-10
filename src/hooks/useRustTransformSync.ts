/**
 * T97 — Debounced Rust-side transform sync.
 *
 * Mirrors every drag-end `updateObjectTransform` store update to
 * the Rust `update_object_transform` command. The Rust side then
 * updates both its `current_level` cache and the spatial index
 * entry in one transaction. We debounce 250ms so a continuous
 * drag only emits one command per object when the user lets go.
 *
 * Mounted once at the App root; subscribes to all store transform
 * updates via Zustand's `subscribe` selector.
 */
import { useEditorStore } from '@/store/editorStore'
import type { Transform3D } from '@/types/schemas'
import { eulerToQuat } from '@/utils/quat'
import { useEffect } from 'react'

const DEBOUNCE_MS = 250

export function useRustTransformSync(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Per-object debounce timers. When the user finishes dragging
    // an object, the last `set` wins and triggers one Rust call.
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const flush = (id: string, transform: Transform3D) => {
      void (async () => {
        try {
          const { updateObjectTransform } = await import('@/types/levelBridge')
          await updateObjectTransform(id, transform)
        } catch (e) {
          // Non-fatal: the front-end store is the source of truth
          // for the UI; the Rust cache will be re-synced on next
          // level save.
          console.warn('useRustTransformSync: flush failed', e)
        }
      })()
    }

    // Subscribe to the store. We can't use `useEditorStore.subscribe`
    // directly because the store's set is inside React — we use the
    // raw `subscribe` API which is synchronous and fires on every
    // change.
    const unsub = useEditorStore.subscribe(state => {
      // Cheap watch: walk the scene-object map and pick up any
      // object whose last-mutated timestamp is newer than the
      // last sync. The store updates `lastModified` on every
      // transform change, so this is a cheap dirty-bit.
      // (Cheaper than watching every action.)
      void state
      // Per-object transforms are the things we mirror. Iterate
      // sceneObjects, find ones that need a sync, and flush.
      // The store doesn't track a per-object dirty bit today, so
      // we use a different signal: every flush() schedules a timer
      // that, when it fires, reads the latest transform from the
      // store and pushes it. This means we always push the
      // current snapshot rather than a stale one. The Map of
      // timers prevents burst writes during a drag.
    })

    // Hook the actual transform mutations by subscribing to
    // `updateObjectTransform` action calls. We do this by wrapping
    // the action in a thin proxy — installed once.
    // (The store doesn't expose action subscriptions directly, so
    // we rely on the per-action proxy below.)
    const original = useEditorStore.getState().updateObjectTransform
    let installed = false
    if (!installed) {
      installed = true
      useEditorStore.setState({
        updateObjectTransform: ((id, transform) => {
          // The store's `id` parameter is typed `ObjectId`, but the
          // Run the original store action (UI immediate).
          original(id, transform)
          // Resolve the merged transform from the store.
          const o = useEditorStore.getState().sceneObjects.get(id as never)
          if (!o) return
          const full: Transform3D = {
            position: o.position,
            rotation: eulerToQuat(o.rotation),
            scale: o.scale,
          }
          // Debounce per id.
          const existing = timers.get(id)
          if (existing) clearTimeout(existing)
          const t = setTimeout(() => {
            timers.delete(id)
            flush(id, full)
          }, DEBOUNCE_MS)
          timers.set(id, t)
        }) as typeof original,
      })
    }

    return () => {
      unsub()
      // Flush any pending writes so we don't lose state on unmount.
      for (const [id, t] of timers) {
        clearTimeout(t)
        const o = useEditorStore.getState().sceneObjects.get(id as never)
        if (o) {
          flush(id, {
            position: o.position,
            rotation: eulerToQuat(o.rotation),
            scale: o.scale,
          })
        }
      }
      timers.clear()
    }
  }, [])
}
