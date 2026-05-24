// Minimal ambient declaration for @mkkellogg/gaussian-splats-3d, which ships
// no TypeScript types. We use it loosely (DropInViewer added to a three scene),
// so a permissive shim is enough to compile.
declare module '@mkkellogg/gaussian-splats-3d' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const DropInViewer: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Viewer: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _default: any
  export default _default
}
