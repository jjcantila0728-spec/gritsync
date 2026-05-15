-- Migration: add get_table_columns helper function
-- Used by server/routes/query.ts to safely enumerate columns for a given table.
-- The function runs with SECURITY DEFINER so the caller only needs EXECUTE privilege.
-- search_path is fixed to prevent search-path injection.

CREATE OR REPLACE FUNCTION public.get_table_columns(p_table text)
RETURNS TABLE(column_name text, data_type text, is_nullable boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.column_name::text,
    c.data_type::text,
    (c.is_nullable = 'YES') AS is_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name  = p_table
  ORDER BY c.ordinal_position;
$$;

-- Grant execute to authenticated and service_role so the server client can call it.
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO service_role;
