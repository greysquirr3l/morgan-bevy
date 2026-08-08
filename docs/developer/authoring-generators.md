# Authoring Generators

> How to add a new procedural-generation algorithm. The existing
> BSP and WFC generators are the references — read those first if
> you're in a hurry. The worked example below adds a Voronoi-
> diagram generator end-to-end.

## What a generator is, formally

A generator is a pure Rust function that:

1. Takes a **seed** (`u64`) and a set of **parameters**
   (`GenerationParams`).
2. Produces a `LevelData` — the same wire format the editor's
   JSON / Rust exporters consume.

The generator is **deterministic given the seed**: same seed + same params → byte-identical output. This is a hard requirement; it means the function must not call `Instant::now()` or `SystemTime::now()` anywhere. The editor round-trips tests rely on it.

```rust
pub trait Generator {
    fn generate(seed: u64, params: &GenerationParams) -> Result<LevelData, GenerationError>;
}
```

`LevelData` is the on-disk shape — see
[user/export-formats.md](../user/export-formats.md). The
generator returns it directly; the export layer picks it up
from there.

## Worked example: a Voronoi generator

Voronoi diagrams partition a plane into cells, one per seed
point. Each cell is the locus of points closer to that seed
than any other. Useful for natural-looking terrain, faction
territory, or organic room layouts.

We'll add a generator that:

1. Scatters N seed points across the level bounds.
2. Builds the Voronoi cells.
3. Renders each cell as a floor tile + four wall tiles.

### Step 1 — declare the generator

Create `src-tauri/src/generation/voronoi.rs`:

```rust
use crate::generation::bsp::GenerationParams;
use crate::generation::LevelData;

pub fn generate_voronoi(
    seed: u64,
    params: &GenerationParams,
) -> Result<LevelData, Box<dyn std::error::Error>> {
    let mut rng = StdRng::seed_from_u64(seed);

    // 1. Scatter seed points.
    let points: Vec<(i32, i32)> = (0..params.room_count.unwrap_or(10))
        .map(|_| {
            (
                rng.gen_range(0..params.width),
                rng.gen_range(0..params.height),
            )
        })
        .collect();

    // 2. Build cells via a brute-force Voronoi — fine for ≤20 cells.
    let objects = points
        .iter()
        .enumerate()
        .flat_map(|(i, &(x, y))| {
            build_cell_objects(i, x, y, &points, params)
        })
        .collect();

    Ok(LevelData {
        metadata: LevelMetadata {
            generator: "voronoi".to_string(),
            seed,
            algorithm: "voronoi".to_string(),
            theme: "default".to_string(),
        },
        dimensions: LevelDimensions {
            width: params.width,
            height: params.height,
            floors: 1,
        },
        entities: objects,
    })
}

fn build_cell_objects(
    index: usize,
    x: i32,
    y: i32,
    points: &[(i32, i32)],
    params: &GenerationParams,
) -> Vec<LevelEntity> {
    // 3. Render floor + walls for each cell. The exact geometry
    //    depends on the cell boundary — for v1 we emit a single
    //    floor tile at the seed point and let the wall-detection
    //    pass fill in the rest.
    vec![LevelEntity::Floor {
        position: [x as f32, 0.0, y as f32],
        size: [params.tile_size, params.tile_size],
        cell_index: index,
    }]
}
```

### Step 2 — register the Tauri command

In `src-tauri/src/main.rs`:

```rust
#[tauri::command]
pub async fn generate_voronoi_level(
    seed: u64,
    params: GenerationParams,
) -> Result<LevelData, String> {
    generation::voronoi::generate_voronoi(seed, &params)
        .map_err(|e| format!("Voronoi generation failed: {e}"))
}
```

Register in the `generate_handler![...]` list:

```rust
.invoke_handler(tauri::generate_handler![
    // ...
    generate_bsp_level,
    generate_wfc_level,
    generate_voronoi_level,
    // ...
])
```

### Step 3 — wire the frontend

In `src/components/GenerationPanel/GenerationPanel.tsx`, add a
button next to the BSP / WFC buttons:

```tsx
<button onClick={() => runGeneration('voronoi')}>Voronoi</button>
```

The `runGeneration` function takes a `kind` string and calls
the matching `invoke<>('generate_<kind>_level', { ... })`. Add
the new case to its dispatch:

```ts
case 'voronoi':
    return invoke<LevelData>('generate_voronoi_level', {
        seed: seedRef.current,
        params: { width: 48, height: 36, ... },
    })
```

The returned `LevelData` flows through the existing `LevelDataSchema`
validation before landing in the store — no new schema needed
since the result is the same shape as the existing generators.

### Step 4 — write the test

Per the project rule: every new public function needs at least one
test. Drop `src-tauri/src/generation/voronoi.rs::tests`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voronoi_is_deterministic_for_same_seed() {
        let a = generate_voronoi(42, &GenerationParams::default()).unwrap();
        let b = generate_voronoi(42, &GenerationParams::default()).unwrap();
        assert_eq!(a.entities.len(), b.entities.len());
        // Walk every position + size + cell index; same seed must
        // produce identical coordinates.
        for (ea, eb) in a.entities.iter().zip(b.entities.iter()) {
            assert_eq!(ea.position(), eb.position());
            assert_eq!(ea.size(), eb.size());
        }
    }

    #[test]
    fn voronoi_respects_room_count() {
        let data = generate_voronoi(1, &GenerationParams {
            room_count: Some(5),
            ..GenerationParams::default()
        }).unwrap();
        assert_eq!(data.entities.len(), 5);
    }
}
```

The determinism test is the critical one — it pins the "same
seed → same output" contract.

### Step 5 — document in the **Generate** panel tooltip

The GenerationPanel reads each generator's metadata (name,
description, default params) from a constant in
`src/components/GenerationPanel/generatorMetadata.ts`. Add an
entry:

```ts
{
  id: 'voronoi',
  label: 'Voronoi',
  description: 'Scatters seed points and renders Voronoi cells as floor tiles. Good for natural / organic layouts.',
  defaultParams: { roomCount: 10 },
}
```

The tooltip / default-params flow uses this constant — no
hard-coded list in the panel component.

### Step 6 — add an example project

If your generator produces a distinctive shape worth
showcasing, drop a `*.example.json` in `src/data/examples/`
and add it to `loadExampleLevels()` in
`src/utils/exampleLevels.ts`. The Vite glob picks it up
automatically.

## What you do NOT need to do

- **Touch the export pipeline.** The exporter reads
  `LevelData`; if your generator produces that shape, the
  exporter handles it.
- **Add a new Tauri command file.** Commands live in
  `src-tauri/src/main.rs` or the relevant domain module
  (assets / export / generation).
- **Touch the companion crate.** Bevy-side changes are
  only needed if your generator emits new marker types.
- **Write a frontend store action.** The generated
  `LevelData` flows through the existing `LoadCommand` path.

## Common mistakes

- **Calling `Instant::now()`** — breaks the determinism
  contract. Use `seed` (or a derived `StdRng::seed_from_u64(seed)`).
- **Reading the project file for params** — generators
  don't have access to the project. Take all params in
  `GenerationParams`.
- **Hardcoding wall heights / tile sizes** — every numeric
  constant should come from `params`. The user can tune the
  generator by passing different params.
- **Skipping the test** — the determinism test is the
  regression detector. Without it, a future change that adds
  `Instant::now()` would silently break round-trip tests.
