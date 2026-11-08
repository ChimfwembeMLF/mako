/**
 * A thin bar along the top of the window while a page loads. It never covers the
 * sidebar or header, so moving between pages feels like one app instead of a reload.
 */
export function RouteProgress() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[130] h-0.5 overflow-hidden bg-primary/15"
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="route-progress-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
