/**
 * Quaternion helpers for converting between Euler and quaternion
 * representations. The editor's Zustand store keeps rotations as
 * Euler `[x, y, z]` (degrees, per-axis) for direct user editing;
 * the Bevy-runtime `Transform3D` and the `update_object_transform`
 * Rust command expect a quaternion `[x, y, z, w]`.
 *
 * `eulerToQuat` here uses YXZ order (Yaw-Pitch-Roll) which matches
 * Three.js's default `Euler` order; the Bevy `Quat::from_euler`
 * also defaults to YXZ when no order is specified, so the two
 * conventions agree.
 */
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

export function eulerToQuat(eulerDeg: [number, number, number]): [number, number, number, number] {
  const [xDeg, yDeg, zDeg] = eulerDeg
  const x = xDeg * DEG_TO_RAD
  const y = yDeg * DEG_TO_RAD
  const z = zDeg * DEG_TO_RAD
  const cx = Math.cos(x / 2)
  const sx = Math.sin(x / 2)
  const cy = Math.cos(y / 2)
  const sy = Math.sin(y / 2)
  const cz = Math.cos(z / 2)
  const sz = Math.sin(z / 2)
  // YXZ order: q = q_y * q_x * q_z
  const qx = sx * cy * cz - cx * sy * sz
  const qy = cx * sy * cz + sx * cy * sz
  const qz = cx * cy * sz - sx * sy * cz
  const qw = cx * cy * cz + sx * sy * sz
  return [qx, qy, qz, qw]
}

export function quatToEuler(quat: [number, number, number, number]): [number, number, number] {
  const [x, y, z, w] = quat
  // YXZ order extraction.
  const sinr_cosp = 2 * (w * x + y * z)
  const cosr_cosp = 1 - 2 * (x * x + y * y)
  const roll = Math.atan2(sinr_cosp, cosr_cosp)
  const sinp = 2 * (w * y - z * x)
  const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp)
  const siny_cosp = 2 * (w * z + x * y)
  const cosy_cosp = 1 - 2 * (y * y + z * z)
  const yaw = Math.atan2(siny_cosp, cosy_cosp)
  return [roll * RAD_TO_DEG, pitch * RAD_TO_DEG, yaw * RAD_TO_DEG]
}
