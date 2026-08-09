//! Waypoint + patrol route data model (T57).
//!
//! These are plain serde mirrors of the TS types in
//! `src/types/waypoints.ts` — editor-authored objects (like scene
//! objects / lights), not something this crate computes. The actual
//! A* pathfinding (routing between waypoints across a [`crate::spatial::NavMesh`]'s
//! polygon connectivity graph) is implemented in pure TypeScript
//! (`src/utils/navPathfinding.ts`), not here: the `NavMesh` is
//! already client-side via `useNavMesh()` (T56), so there's no need
//! for a Rust round trip to path between two points the frontend
//! already has full graph data for. This module's only job is
//! carrying waypoint/route data through the export pipeline (JSON /
//! RON / Rust source), the same role `spatial::navmesh::NavMesh`
//! plays for the navmesh itself.

use serde::{Deserialize, Serialize};

/// A single navigation waypoint. Mirrors `Waypoint` in
/// `src/types/waypoints.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Waypoint {
    pub id: String,
    pub position: [f32; 3],
    /// Seconds to pause at this waypoint before continuing. Absent
    /// means "no dwell" (pass through immediately).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dwell_time: Option<f32>,
    /// Optional explicit link to the next waypoint, independent of
    /// patrol route membership.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_waypoint_id: Option<String>,
}

/// Traversal mode for a [`PatrolRoute`]. Mirrors `PatrolMode` in
/// `src/types/waypoints.ts`; the wire format uses the *exact* same
/// strings the TS union does (`"loop"` / `"ping-pong"` / `"random"`)
/// so the two sides never drift -- `PingPong` needs an explicit
/// rename because Rust identifiers can't contain a hyphen and
/// `#[serde(rename_all = "snake_case")]` alone would produce
/// `"ping_pong"`, not `"ping-pong"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PatrolMode {
    Loop,
    #[serde(rename = "ping-pong")]
    PingPong,
    Random,
}

/// An ordered patrol route: a sequence of waypoint ids plus how to
/// traverse them. Mirrors `PatrolRoute` in `src/types/waypoints.ts`.
/// Unlike `Waypoint`, every field here is `Eq`-able (no floats), so
/// `Eq` is derived too.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PatrolRoute {
    pub id: String,
    pub waypoint_ids: Vec<String>,
    pub mode: PatrolMode,
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]

    use super::*;

    #[test]
    fn patrol_mode_serializes_with_hyphenated_ping_pong() {
        let json = serde_json::to_string(&PatrolMode::PingPong).expect("should serialize");
        assert_eq!(json, "\"ping-pong\"");
        let json = serde_json::to_string(&PatrolMode::Loop).expect("should serialize");
        assert_eq!(json, "\"loop\"");
        let json = serde_json::to_string(&PatrolMode::Random).expect("should serialize");
        assert_eq!(json, "\"random\"");
    }

    #[test]
    fn patrol_mode_round_trips_through_json() {
        for mode in [PatrolMode::Loop, PatrolMode::PingPong, PatrolMode::Random] {
            let json = serde_json::to_string(&mode).expect("should serialize");
            let back: PatrolMode = serde_json::from_str(&json).expect("should deserialize");
            assert_eq!(mode, back);
        }
    }

    #[test]
    fn waypoint_omits_absent_optional_fields() {
        let wp = Waypoint {
            id: "wp1".to_string(),
            position: [1.0, 0.0, 2.0],
            dwell_time: None,
            next_waypoint_id: None,
        };
        let json = serde_json::to_string(&wp).expect("should serialize");
        assert!(!json.contains("dwell_time"));
        assert!(!json.contains("next_waypoint_id"));
    }

    #[test]
    fn waypoint_round_trips_through_json_with_optional_fields_set() {
        let wp = Waypoint {
            id: "wp1".to_string(),
            position: [1.0, 0.0, 2.0],
            dwell_time: Some(2.5),
            next_waypoint_id: Some("wp2".to_string()),
        };
        let json = serde_json::to_string(&wp).expect("should serialize");
        let back: Waypoint = serde_json::from_str(&json).expect("should deserialize");
        assert_eq!(wp, back);
    }

    #[test]
    fn patrol_route_round_trips_through_json() {
        let route = PatrolRoute {
            id: "route1".to_string(),
            waypoint_ids: vec!["wp1".to_string(), "wp2".to_string(), "wp3".to_string()],
            mode: PatrolMode::Loop,
        };
        let json = serde_json::to_string(&route).expect("should serialize");
        assert!(json.contains("\"waypoint_ids\""));
        let back: PatrolRoute = serde_json::from_str(&json).expect("should deserialize");
        assert_eq!(route, back);
    }
}
