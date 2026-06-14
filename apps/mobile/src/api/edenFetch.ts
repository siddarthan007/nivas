export async function edenFetch<T>(
  queryPromise: Promise<{ data: T | null; error: any; status: number }>
): Promise<T> {
  const res = await queryPromise;
  
  if (res.error) {
    // Standardize error throwing so React Query correctly enters the isError state
    throw new Error(res.error?.message || res.error?.error || 'An error occurred during fetch');
  }
  
  // If data is somehow null but there is no error (rare), we cast it or throw
  if (res.data === null) {
    throw new Error('Received null data without an explicit error');
  }
  
  return res.data;
}
