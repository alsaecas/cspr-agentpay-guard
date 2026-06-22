export function ModeBadge({ mode = "mock" }: { mode?: string }) {
  return <span className="badge badge-mock">{mode.toUpperCase()} MODE</span>;
}
