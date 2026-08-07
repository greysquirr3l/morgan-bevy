//! New marker components added by T91: lighting, animation, audio, VFX.
//!
//! Each marker is a Bevy `Component` that the editor's exporter references
//! in the generated Rust source. The marker types are **enums** so the
//! per-component variant data travels with the entity (e.g. a `Light::Point`
//! carries its `color` / `intensity` / `range`; an `Animation::Play` carries
//! its clip + speed).
//!
//! Per the T90 `MarkerSet` pattern, the editor only emits a `use` line +
//! per-marker system for the markers that are actually present in the
//! level. `MarkerSet` is extended in this module with 4 new bools:
//! `light_present`, `animation_present`, `audio_present`, `vfx_present`.
//!
//! The five systems that respond to these markers live in
//! `super::systems` (`light_observer`, `animation_player_observer`,
//! `audio_ambient_observer`, `audio_oneshot_observer`,
//! `vfx_billboard_observer`) and are `OnAdd` observers registered by
//! `MorganLevelSystems` when the matching `MarkerSet` bit is set.

use bevy_ecs::prelude::*;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

/// Lighting marker emitted by `Morgan-Bevy` for a single object.
///
/// The editor's `LightMarker` enum has three variants:
/// - `Point` — `PointLight` with `color`, `intensity`, `range`, `shadows`.
/// - `Spot` — `SpotLight` with `inner_angle` / `outer_angle` in radians.
/// - `Directional` — `DirectionalLight` with no falloff.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Light {
    Point {
        color: [f32; 3],
        intensity: f32,
        range: f32,
        shadows: bool,
    },
    Spot {
        color: [f32; 3],
        intensity: f32,
        range: f32,
        inner_angle: f32,
        outer_angle: f32,
        shadows: bool,
    },
    Directional {
        color: [f32; 3],
        intensity: f32,
        shadows: bool,
    },
}

impl Default for Light {
    fn default() -> Self {
        Self::Point {
            color: [1.0, 1.0, 1.0],
            intensity: 1.0,
            range: 10.0,
            shadows: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/// Animation marker. `Play` runs the clip in a loop at the given speed;
/// `PlayOnce` plays the clip a single time.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Animation {
    Play {
        clip: String,
        repeat: bool,
        speed: f32,
    },
    PlayOnce {
        clip: String,
    },
}

impl Default for Animation {
    fn default() -> Self {
        Self::Play {
            clip: String::new(),
            repeat: true,
            speed: 1.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/// Audio marker. `Ambient` is a looping sound (e.g. a fountain);
/// `OneShot` plays once and despawns the entity on completion.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Audio {
    Ambient {
        path: String,
        volume: f32,
        looping: bool,
    },
    OneShot {
        path: String,
        volume: f32,
    },
}

impl Audio {
    /// Asset path to load (relative to the consumer's `assets/`).
    #[must_use]
    pub fn path(&self) -> &str {
        match self {
            Self::Ambient { path, .. } | Self::OneShot { path, .. } => path,
        }
    }

    /// Volume in `[0.0, 1.0]`.
    #[must_use]
    pub const fn volume(&self) -> f32 {
        match self {
            Self::Ambient { volume, .. } | Self::OneShot { volume, .. } => *volume,
        }
    }

    /// `true` for `Ambient` (or `OneShot` with the loop bit set in
    /// future variants). Currently always `true` for `Ambient` and
    /// `false` for `OneShot`.
    #[must_use]
    pub const fn is_looping(&self) -> bool {
        match self {
            Self::Ambient { looping, .. } => *looping,
            Self::OneShot { .. } => false,
        }
    }

    /// `true` for `OneShot` (plays once, then despawn).
    #[must_use]
    pub const fn is_oneshot(&self) -> bool {
        matches!(self, Self::OneShot { .. })
    }
}

impl Default for Audio {
    fn default() -> Self {
        Self::Ambient {
            path: String::new(),
            volume: 1.0,
            looping: true,
        }
    }
}

// ---------------------------------------------------------------------------
// VFX
// ---------------------------------------------------------------------------

/// VFX marker. `Particle` references a particle-effect asset (consumer
/// wires their own particle system, e.g. `bevy_hanabi`); `Billboard`
/// references a 2D texture rendered facing the camera.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Vfx {
    Particle { path: String, count: u32 },
    Billboard { texture: String, size: [f32; 2] },
}

impl Default for Vfx {
    fn default() -> Self {
        Self::Billboard {
            texture: String::new(),
            size: [1.0, 1.0],
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn light_default_is_white_point() {
        let l = Light::default();
        match l {
            Light::Point {
                color,
                intensity,
                range,
                shadows,
            } => {
                assert!(color.iter().all(|c| (*c - 1.0).abs() < 1e-6));
                assert!((intensity - 1.0).abs() < 1e-6);
                assert!((range - 10.0).abs() < 1e-6);
                assert!(!shadows);
            }
            other => panic!("expected Point, got {other:?}"),
        }
    }

    #[test]
    fn light_round_trips_through_serde() {
        let cases = [
            Light::Point {
                color: [1.0, 0.5, 0.0],
                intensity: 2.5,
                range: 15.0,
                shadows: true,
            },
            Light::Spot {
                color: [0.0, 0.0, 1.0],
                intensity: 5.0,
                range: 8.0,
                inner_angle: 0.3,
                outer_angle: 0.6,
                shadows: false,
            },
            Light::Directional {
                color: [1.0, 1.0, 1.0],
                intensity: 3.0,
                shadows: true,
            },
        ];
        for light in cases {
            let json = serde_json::to_string(&light).expect("serialize");
            let back: Light = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(back, light);
        }
    }

    #[test]
    fn animation_default_is_looping() {
        let a = Animation::default();
        assert!(matches!(
            a,
            Animation::Play {
                repeat: true,
                speed,
                ..
            } if (speed - 1.0).abs() < 1e-6
        ));
    }

    #[test]
    fn audio_default_is_looping_ambient() {
        let a = Audio::default();
        assert!(matches!(a, Audio::Ambient { looping: true, .. }));
    }

    #[test]
    fn vfx_default_is_billboard() {
        let v = Vfx::default();
        assert!(matches!(v, Vfx::Billboard { .. }));
    }

    #[test]
    fn light_serializes_with_snake_case_tag() {
        let light = Light::Directional {
            color: [1.0, 1.0, 1.0],
            intensity: 1.0,
            shadows: false,
        };
        let json = serde_json::to_string(&light).expect("serialize");
        // The `tag = "kind"` + `rename_all = "snake_case"` means the
        // variant is encoded as `{"kind": "directional", ...}`.
        assert!(json.contains("\"kind\":\"directional\""));
    }
}
