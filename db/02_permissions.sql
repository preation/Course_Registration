-- Grant the API role access required by the course catalog and registration RPC.
GRANT SELECT ON TABLE public.courses TO service_role;
GRANT INSERT ON TABLE public.enrollments TO service_role;
GRANT EXECUTE ON FUNCTION public.register_for_course(INT, UUID) TO service_role;
