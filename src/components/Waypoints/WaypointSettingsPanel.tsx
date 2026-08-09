// T57 — Waypoint / patrol-route settings panel. Rendered as a
// floating overlay in `Viewport3D.tsx` (outside `<Canvas>`, same
// tier as `PaintSettingsPanel` / the "Camera Mode Controls" overlay),
// visible whenever waypoint placement is active OR at least one
// waypoint exists (so the patrol-route builder stays reachable after
// the user turns placement mode off to stop adding more).
//
// Structure mirrors `PaintSettingsPanel.tsx` (floating pill toolbar)
// for the placement toggle + dwell time, and `LightingTools.tsx`
// (list of existing entities with per-row controls) for the
// waypoint/route lists.

import { useEditorStore } from '@/store/editorStore'
import { PatrolRouteId, type WaypointId } from '@/types/brand'
import { PATROL_MODES, type PatrolMode } from '@/types/waypoints'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

export default function WaypointSettingsPanel() {
  const {
    waypoints,
    patrolRoutes,
    waypointPlacementActive,
    waypointDefaultDwellTime,
    setWaypointPlacementActive,
    setWaypointDefaultDwellTime,
    removeWaypoint,
    updateWaypoint,
    addPatrolRoute,
    removePatrolRoute,
  } = useEditorStore(
    useShallow(s => ({
      waypoints: s.waypoints,
      patrolRoutes: s.patrolRoutes,
      waypointPlacementActive: s.waypointPlacementActive,
      waypointDefaultDwellTime: s.waypointDefaultDwellTime,
      setWaypointPlacementActive: s.setWaypointPlacementActive,
      setWaypointDefaultDwellTime: s.setWaypointDefaultDwellTime,
      removeWaypoint: s.removeWaypoint,
      updateWaypoint: s.updateWaypoint,
      addPatrolRoute: s.addPatrolRoute,
      removePatrolRoute: s.removePatrolRoute,
    }))
  )

  // Route builder: an ordered, locally-held selection of waypoint
  // ids (order = click order) plus the chosen traversal mode. Local
  // state, not store state — it's a draft that only becomes a real
  // `PatrolRoute` on "Create Route".
  const [routeDraft, setRouteDraft] = useState<WaypointId[]>([])
  const [routeMode, setRouteMode] = useState<PatrolMode>('loop')

  if (!waypointPlacementActive && waypoints.length === 0) return null

  const toggleInDraft = (id: WaypointId) => {
    setRouteDraft(prev => (prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]))
  }

  const createRoute = () => {
    if (routeDraft.length < 2) return
    addPatrolRoute({
      id: PatrolRouteId(`route_${Date.now()}`),
      waypointIds: routeDraft,
      mode: routeMode,
    })
    setRouteDraft([])
  }

  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black bg-opacity-70 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xl"
      data-testid="waypoint-settings-panel"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">Waypoints</span>

        <button
          onClick={() => setWaypointPlacementActive(!waypointPlacementActive)}
          aria-pressed={waypointPlacementActive}
          className={`px-2 py-0.5 rounded ${
            waypointPlacementActive
              ? 'bg-editor-accent text-white'
              : 'bg-white bg-opacity-10 hover:bg-opacity-20'
          }`}
          title="Click in the viewport to place a waypoint"
        >
          {waypointPlacementActive ? 'Placing… (click viewport)' : 'Place Waypoint'}
        </button>

        <label className="flex items-center gap-1">
          Dwell (s)
          <input
            type="number"
            min={0}
            step={0.5}
            value={waypointDefaultDwellTime}
            onChange={event => setWaypointDefaultDwellTime(parseFloat(event.target.value) || 0)}
            aria-label="Default dwell time"
            className="w-14 bg-editor-bg border border-editor-border rounded px-1 py-0.5"
          />
        </label>

        <span className="text-editor-textMuted">
          {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'}, {patrolRoutes.length}{' '}
          route{patrolRoutes.length === 1 ? '' : 's'}
        </span>
      </div>

      {waypoints.length > 0 && (
        <div className="mt-2 space-y-2">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-editor-textMuted mb-1">
              Build Patrol Route (click waypoints in order)
            </h4>
            <div className="flex flex-wrap gap-1">
              {waypoints.map((wp, i) => {
                const draftIndex = routeDraft.indexOf(wp.id)
                const selected = draftIndex !== -1
                return (
                  <button
                    key={wp.id}
                    onClick={() => toggleInDraft(wp.id)}
                    aria-pressed={selected}
                    className={`px-2 py-0.5 rounded ${
                      selected
                        ? 'bg-editor-accent text-white'
                        : 'bg-white bg-opacity-10 hover:bg-opacity-20'
                    }`}
                    title={`(${wp.position[0].toFixed(1)}, ${wp.position[1].toFixed(1)}, ${wp.position[2].toFixed(1)})`}
                  >
                    {selected ? `${draftIndex + 1}. ` : ''}WP{i + 1}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={routeMode}
                onChange={event => setRouteMode(event.target.value as PatrolMode)}
                aria-label="Patrol traversal mode"
                className="bg-editor-bg border border-editor-border rounded px-1 py-0.5"
              >
                {PATROL_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <button
                onClick={createRoute}
                disabled={routeDraft.length < 2}
                className="px-2 py-0.5 rounded bg-white bg-opacity-10 hover:bg-opacity-20 disabled:opacity-40"
              >
                Create Route
              </button>
            </div>
          </div>

          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {waypoints.map((wp, i) => (
              <li
                key={wp.id}
                className="flex items-center gap-2 px-2 py-1 bg-white bg-opacity-5 rounded"
              >
                <span>WP{i + 1}</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={wp.dwellTime ?? 0}
                  onChange={event => {
                    const value = parseFloat(event.target.value) || 0
                    updateWaypoint(
                      wp.id,
                      value > 0 ? { dwellTime: value } : { dwellTime: undefined }
                    )
                  }}
                  aria-label={`Dwell time for waypoint ${i + 1}`}
                  className="w-14 bg-editor-bg border border-editor-border rounded px-1 py-0.5"
                />
                <button
                  onClick={() => removeWaypoint(wp.id)}
                  className="ml-auto text-red-400 hover:text-red-300"
                  title="Remove this waypoint"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {patrolRoutes.length > 0 && (
            <ul className="space-y-1">
              {patrolRoutes.map((route, i) => (
                <li
                  key={route.id}
                  className="flex items-center gap-2 px-2 py-1 bg-white bg-opacity-5 rounded"
                >
                  <span>
                    Route {i + 1} ({route.mode}, {route.waypointIds.length} pts)
                  </span>
                  <button
                    onClick={() => removePatrolRoute(route.id)}
                    className="ml-auto text-red-400 hover:text-red-300"
                    title="Remove this patrol route"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
