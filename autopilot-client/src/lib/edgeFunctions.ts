/** Stub for legacy Supabase edge functions — wire to autopilot API when available. */
export async function invokeEdgeFunction(
  name: string,
  _options?: { body?: Record<string, unknown> },
): Promise<{ data: null; error: { message: string } }> {
  return {
    data: null,
    error: {
      message: `"${name}" is not available yet. This feature requires a backend endpoint.`,
    },
  };
}
