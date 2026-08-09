// T54 — Paint tool: in-Canvas piece. Rendered inside `<Canvas>` in
// `Viewport3D.tsx`, alongside `TransformGizmos` / `BoxSelection` —
// same "R3F component that owns `useThree()` + a ref-driven
// indicator mesh" shape those two already use.
//
// All the interaction logic (raycasting, brush application, stroke
// -> PaintCommand) lives in `usePaintTool`; this component only
// renders the ring the hook drives.
import { usePaintTool } from '@/hooks/usePaintTool'
import { DoubleSide } from 'three'

export default function PaintToolViewport() {
  const { brushIndicatorRef, paintToolActive } = usePaintTool()

  if (!paintToolActive) return null

  return (
    // Note: don't use `data-testid` here — R3F's applyProps walks
    // `instance.data.testid`, which crashes on Three.js objects
    // (no `.data` property). `name` is a real Object3D property.
    <mesh ref={brushIndicatorRef} name="paint-brush-ring" visible={false} renderOrder={999}>
      <ringGeometry args={[0.85, 1, 48]} />
      <meshBasicMaterial
        color="#60a5fa"
        transparent
        opacity={0.85}
        side={DoubleSide}
        depthTest={false}
      />
    </mesh>
  )
}
