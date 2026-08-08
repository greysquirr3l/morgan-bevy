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
    <mesh ref={brushIndicatorRef} visible={false} renderOrder={999} data-testid="paint-brush-ring">
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
