/**
 * Server-side pagination utilities
 * Optimizes pagination for large datasets by fetching only needed data
 */

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Calculate pagination offsets
 */
export function getPaginationOffset(page: number, pageSize: number): {
  from: number
  to: number
} {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to }
}

/**
 * Create pagination result from data
 */
export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / pageSize)
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}

/**
 * Pagination helper for Supabase queries
 * Returns optimized query with range and count
 */
export function applyPagination<T>(
  query: any,
  page: number,
  pageSize: number
): {
  query: any
  countQuery: any
} {
  const { from, to } = getPaginationOffset(page, pageSize)
  
  return {
    query: query.range(from, to),
    countQuery: query.select('*', { count: 'exact', head: true }),
  }
}

/**
 * Fetch paginated data with count
 */
export async function fetchPaginated<T>(
  queryFn: (range: { from: number; to: number }) => Promise<{ data: T[] | null; error: any }>,
  countFn: () => Promise<{ count: number | null; error: any }>,
  page: number,
  pageSize: number
): Promise<PaginationResult<T>> {
  const { from, to } = getPaginationOffset(page, pageSize)
  
  const [dataResult, countResult] = await Promise.all([
    queryFn({ from, to }),
    countFn(),
  ])
  
  if (dataResult.error) {
    throw new Error(dataResult.error.message || 'Failed to fetch data')
  }
  
  if (countResult.error) {
    throw new Error(countResult.error.message || 'Failed to fetch count')
  }
  
  const data = dataResult.data || []
  const total = countResult.count || 0
  
  return createPaginationResult(data, total, page, pageSize)
}

/**
 * Cursor-based pagination (for very large datasets)
 */
export interface CursorPaginationParams {
  cursor?: string | number
  limit: number
  direction?: 'forward' | 'backward'
}

export interface CursorPaginationResult<T> {
  data: T[]
  nextCursor?: string | number
  previousCursor?: string | number
  hasMore: boolean
}

/**
 * Create cursor from record (using created_at or id)
 */
export function createCursor(record: { id?: string; created_at?: string }): string {
  if (record.created_at) {
    return `${record.id}:${new Date(record.created_at).getTime()}`
  }
  return record.id || ''
}

/**
 * Parse cursor
 */
export function parseCursor(cursor: string): { id?: string; timestamp?: number } {
  const parts = cursor.split(':')
  if (parts.length === 2) {
    return {
      id: parts[0],
      timestamp: parseInt(parts[1], 10),
    }
  }
  return { id: cursor }
}







