# T91 — Runtime marker expansion: animation, audio, lighting, VFX

> **Depends on**: T86-bevy-plugin-runtime, T90-generated-bevy-systems.

## Goal

Extend the editor's `GameObject` and the companion crate's marker set
so consumers can author four more runtime concerns from the editor:

1. **Animation** — link an `AnimationClip` / `AnimationPlayer` to a mesh.
2. **Audio** — link an ambient `AudioSource` + `PlaybackSettings` to a point.
3. **Lighting** — emit `PointLight`, `SpotLight`, `DirectionalLight` from a marker.
4. **VFX** — link a particle / `Billboard` handle for tagged VFX entities.

After T91, a level with a torch (PointLight), a fountain loop (Audio),
an animated banner (AnimationClip), and a particle campfire (VFX)
exports to a Bevy project that runs the four behaviors without the
consumer writing systems.

## Project Context

- Project: `morgan-bevy` — Morgan-Bevy is a hybrid Rust/TypeScript
  desktop 3D level editor for Bevy game development.
- Editor emits Rust source / JSON / RON per level (T39).
- Companion crate `bevy-morgan-integration` ships marker components
  (T86) and per-marker systems (T90).

This task adds four more marker components in the same shape: typed
field on `GameObject`, mirror enum in the companion crate, generator
emission rule, optional Bevy system.

- Language: typescript (editor) + Rust (companion crate)
- Architecture: modular

### Architecture: Modular

- Each module is self-contained with its own models, handlers, and storage.
- Modules communicate through well-defined public interfaces.
- Shared code goes in a `common/` or `shared/` module.
- Prefer module-level encapsulation over cross-cutting layers.

## Strategy: Complete (End-to-End)

### Completion contract

- Implement the root fix for this task end-to-end (avoid temporary workaround paths).
- Add/update tests for behavior changes, including at least one edge/failure case.
- Update relevant documentation in this task before marking complete.

### Implementation

#### Editor side (`src-tauri/src/main.rs` + `src-tauri/src/export/exporters.rs`)

Add four typed `Option<...>` fields to `GameObject` alongside the
existing `collision_shape`, `spawn_point`, `trigger_volume`:

```rust
/// Optional light marker (T91). When set, the exporter emits a
/// Bevy `PointLight` / `SpotLight` / `DirectionalLight` component
/// using the given parameters.
#[serde(default, skip_serializing_if = "Option::is_none")]
pub light: Option<LightMarker>,

/// Optional animation marker (T91). When set, the exporter emits
/// an `AnimationPlayer` + `AnimationClip` reference.
#[serde(default, skip_serializing_if = "Option::is_none")]
pub animation: Option<AnimationMarker>,

/// Optional audio marker (T91). When set, the exporter emits an
/// `AudioSource` + `PlaybackSettings` reference.
#[serde(default, skip_serializing_if = "Option::is_none")]
pub audio: Option<AudioMarker>,

/// Optional VFX marker (T91). When set, the exporter emits a
/// `Billboard` + particle handle reference.
#[serde(default, skip_serializing_if = "Option::is_none")]
pub vfx: Option<VfxMarker>,
```

The four new enums live in a new module
`src-tauri/src/markers.rs`:

```rust
pub enum LightMarker {
    Point { color: [f32; 3], intensity: f32, range: f32, shadows: bool },
    Spot  { color: [f32; 3], intensity: f32, range: f32, inner_angle: f32, outer_angle: f32, shadows: bool },
    Directional { color: [f32; 3], intensity: f32, shadows: bool },
}

pub enum AnimationMarker {
    Play { clip: String, repeat: bool, speed: f32 },
    PlayOnce { clip: String },
}

pub enum AudioMarker {
    Ambient { path: String, volume: f32, looping: bool },
    OneShot  { path: String, volume: f32 },
}

pub enum VfxMarker {
    Particle { path: String, count: u32 },
    Billboard { texture: String, size: [f32; 2] },
}
```

`LevelData` gains no new fields; the markers travel inside
`GameObject` like `collision_shape` does.

`generate_rust_code` (`src-tauri/src/export/exporters.rs`) gets four
new emission branches, each tag-driven via `MarkerSet`:

- `light_present` → emits `if let Some(light) = obj.light { ... }`
  per object, producing the appropriate `PointLight`/`SpotLight`/
  `DirectionalLight` bundle.
- `animation_present` → emits `AnimationPlayer::new(clip_handle)`
  with the clip path resolved by `asset_server.load(clip)`.
- `audio_present` → emits `AudioPlayer` + `AudioSource` with the
  provided path. Ambient loops play immediately; one-shots play on
  `OnAdd<AudioMarker>` observer.
- `vfx_present` → emits a `Billboard` entity whose texture is the
  given path. Particle variant emits the standard `ParticleEffect`
  handle from `bevy_hanabi` if the consumer has it; the editor
  emits a `// requires bevy_hanabi = "0.19"` comment hint.

The frontend UI (`src/components/Inspector/`) gets new panels for
each marker; UI is wired through the existing discriminated-union
action shape (see T82). The store (`src/store/editorStore.ts`)
gains `updateObjectLight(id, light)`, `updateObjectAudio(id, audio)`,
etc. — one helper per marker.

#### Companion crate side (`crates/bevy-morgan-integration/src/markers.rs`)

Add four marker components mirroring the editor types. Re-use
existing `MarkerSet` shape (extended to 4 more bools):

```rust
pub enum Light {
    Point { color: [f32; 3], intensity: f32, range: f32, shadows: bool },
    Spot  { color: [f32; 3], intensity: f32, range: f32, inner_angle: f32, outer_angle: f32, shadows: bool },
    Directional { color: [f32; 3], intensity: f32, shadows: bool },
}

pub enum Animation { Play { clip: HandleId, repeat: bool, speed: f32 }, PlayOnce { clip: HandleId } }
pub enum Audio { Ambient { handle: HandleId, volume: f32 }, OneShot { handle: HandleId, volume: f32 } }
pub enum Vfx { Particle { handle: HandleId, count: u32 }, Billboard { texture: HandleId, size: [f32; 2] } }
```

Reference systems in `systems.rs`:

- `light_observer` — `OnAdd<Light>` inserts the matching
  `PointLight`/`SpotLight`/`DirectionalLight` bundle.
- `animation_player_observer` — `OnAdd<Animation::Play>` starts
  looping; `OnAdd<Animation::PlayOnce>` plays once and despawns.
- `audio_ambient_observer` — `OnAdd<Audio::Ambient>` starts the loop.
- `audio_oneshot_observer` — `OnAdd<Audio::OneShot>` plays and
  despawns the entity when the buffer finishes.
- `vfx_billboard_observer` — `OnAdd<Vfx::Billboard>` inserts a
  `Billboard` + texture handle.

#### Mirroring in `ExportedEntity` / `ExportedLevel`

`crates/bevy-morgan-integration/src/lib.rs` `ExportedEntity`
gains four optional fields matching the editor shape, with the same
`#[serde(default, skip_serializing_if = "Option::is_none")]` rules
so old JSON exports still parse.

#### Tag-driven emission (continuing T90's pattern)

`MarkerSet` in the editor gains four more bools:
`light_present`, `animation_present`, `audio_present`,
`vfx_present`. The corresponding systems + plugin registration are
only emitted when the level contains at least one object with the
marker set. The generator's emit rule follows the T90 template
verbatim — no new structural changes.

### Tests

#### Rust (`crates/bevy-morgan-integration/`)

- **`light_observer_inserts_point_light`** — spawn an entity with `Light::Point`, run one tick, assert `PointLight` is attached with the right intensity.
- **`light_observer_inserts_spot_light`** — same for `Spot`.
- **`light_observer_inserts_directional_light`** — same for `Directional`.
- **`animation_play_loop_starts_on_add`** — spawn entity with `Animation::Play { repeat: true, .. }`, run one tick, assert `AnimationPlayer` is playing.
- **`animation_play_once_stops_after_clip`** — `PlayOnce` advances one tick; assert `AnimationPlayer` is no longer playing.
- **`audio_ambient_inserts_audio_player`** — spawn entity with `Audio::Ambient`, assert `AudioPlayer` is attached and `PlaybackSettings` is looping.
- **`audio_oneshot_despawns_after_play`** — `OneShot`, run one tick, assert the entity is despawned (assuming a 0-length buffer).
- **`vfx_billboard_observer_inserts_billboard`** — spawn entity with `Vfx::Billboard`, assert `Billboard` + texture `HandleId`.
- **`vfx_particle_observer_inserts_handle`** — `Vfx::Particle`, assert handle is recorded.
- **`marker_set_records_all_four_markers`** — `marker_tags_present` returns all four bools as true for a level with one of each.
- **`marker_set_excludes_markers_when_no_objects`** — empty level yields all four bools as false.
- **`exported_entity_round_trips_all_four_markers`** — serde round-trip with all four fields populated.
- **`exported_entity_omits_unset_marker_fields`** — JSON output contains no `"light": null`, `"animation": null`, etc.

#### Editor side (`src-tauri/src/export/exporters.rs`)

- **`generated_rust_includes_light_component_for_point_light`** — level with `Light::Point` produces output containing `PointLight`.
- **`generated_rust_includes_spot_light_bundle`** — `Light::Spot` produces `SpotLight`.
- **`generated_rust_includes_directional_light_bundle`** — `Light::Directional` produces `DirectionalLight`.
- **`generated_rust_includes_animation_player_for_play`** — `Animation::Play` produces `AnimationPlayer`.
- **`generated_rust_includes_audio_player_for_ambient`** — `Audio::Ambient` produces `AudioPlayer`.
- **`generated_rust_includes_billboard_for_vfx_billboard`** — `Vfx::Billboard` produces `Billboard`.
- **`generated_rust_excludes_systems_when_no_markers_present`** — level with none of the four markers emits no systems or plugin registration.
- **`generated_rust_emits_marker_set_systems_when_any_present`** — level with `Light::Point` emits the `light_observer` system.

#### Frontend (vitest)

- **`updateObjectLight_updates_store`** — call `useEditorStore.getState().updateObjectLight('obj-1', Light::Point { ... })`, assert `objects.get('obj-1').light` reflects the change.
- **`updateObjectAnimation_updates_store`** — same for animation.
- **`updateObjectAudio_updates_store`** — same for audio.
- **`updateObjectVfx_updates_store`** — same for VFX.
- **`inspector_panels_render_for_each_marker`** — `InspectorPanel` renders the four new sub-panels when the selected object has the marker.

### Docs updates

- `docs/user/bevy-integration.md` — section 7 ("Lighting, animation, audio, VFX") added showing the marker shapes and emitted Bevy components.
- `crates/bevy-morgan-integration/README.md` — markers table extended to list all 10 marker components (the 6 from T86 plus the 4 from T91).
- `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md` — note that `bevy_hanabi` particle integration is opt-in (consumer adds the crate; the editor emits a comment hint).
- `docs/user/markers.md` (new) — table of every marker, what it emits, and a worked example per marker.

## File Structure (Anti-Godfile)

- Keep each changed file focused on one primary responsibility.
- If this task introduces a new concern, create a focused module/file instead of extending an unrelated catch-all file.
- Do not expand `utils`, `helpers`, or `common` into multi-purpose dumping grounds.
- If a file is already overloaded, extract cohesive pieces before adding new behavior.

Specifically:

- `src-tauri/src/markers.rs` (new) — the four marker enums (Light, Animation, Audio, Vfx).
- `src-tauri/src/main.rs` — `GameObject` gains 4 typed `Option<...>` fields.
- `src-tauri/src/export/exporters.rs` — `generate_rust_code` gains 4 emission branches; `MarkerSet` gains 4 bools.
- `crates/bevy-morgan-integration/src/markers.rs` (new) — mirror enums.
- `crates/bevy-morgan-integration/src/lib.rs` — `ExportedEntity` gains 4 fields; `MarkerSet` re-exported (if added).
- `crates/bevy-morgan-integration/src/systems.rs` — 5 new systems added (light, animation, audio×2, vfx).
- `crates/bevy-morgan-integration/src/loader.rs` — `attach_marker_components` extended to attach the four new markers.
- `src/store/editorStore.ts` — 4 new `updateObjectX` actions + reducers.
- `src/components/Inspector/` — 4 new sub-panels.
- `src/test/markerStore.test.ts` (new) — vitest cases for the 4 store actions.
- `src/test/markerExport.test.ts` (new) — vitest cases for the editor export integration.
- `src-tauri/src/markers.rs` + companion `crates/bevy-morgan-integration/src/markers.rs` keep markers paired across editor / runtime — no `common/` dumping ground.

## Housekeeping: TODO / FIXME Sweep

Before running preflight, scan all files you created or modified in this task for `TODO`, `FIXME`, `HACK`, `XXX`, and similar markers.

- **Resolve** any that fall within the scope of this task's goal.
- **Leave in place** any that reference work belonging to a later task or phase — but ensure they include a task reference (e.g. `// TODO(T07): wire up auth adapter`).
- **Remove** any placeholder markers that are no longer relevant after your implementation.

If none are found, move on.

## Preflight

```bash
npm run build && npm test -- --run && cargo test --manifest-path src-tauri/Cargo.toml && cargo test -p bevy-morgan-integration && npm run lint && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -W clippy::all -W clippy::pedantic -W clippy::nursery -W clippy::cargo -W clippy::perf -A clippy::module_name_repetitions -A clippy::must_use_candidate -A clippy::missing_errors_doc -A clippy::missing_panics_doc -A clippy::struct_excessive_bools -A clippy::multiple_crate_versions -D clippy::unwrap_used -D clippy::expect_used -D clippy::panic -D clippy::indexing_slicing -D clippy::cast_ptr_alignment -D clippy::suspicious -D warnings && cargo clippy -p bevy-morgan-integration --all-targets -- -D warnings && cargo deny --manifest-path src-tauri/Cargo.toml check
```

## Exit Criteria

- [ ] Type-checking passes without errors
- [ ] All tests pass (existing 268 vitest + 48 cargo + 20 companion + new tests)
- [ ] Linter passes with no warnings (editor + companion crate)
- [ ] `cargo deny --manifest-path src-tauri/Cargo.toml check` reports no vulnerabilities
- [ ] Implementation matches the goal described above
- [ ] No unresolved TODO/FIXME/HACK markers that belong to this task's scope
- [ ] 13 Rust unit tests + 8 editor export tests + 9 vitest tests pass
- [ ] Companion crate exposes all 10 marker components; loader attaches all 10
- [ ] Frontend inspector renders all 4 new marker panels
- [ ] Old JSON exports (pre-T91) still parse (backwards compat via `#[serde(default)]`)

## After Completion

Update PROGRESS.md row for T91 to `[x]`.
Commit: `feat(markers): lighting, animation, audio, VFX runtime markers (T91)`
