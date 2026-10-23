DROP TRIGGER IF EXISTS companies_before_update ON public.companies;
DROP FUNCTION IF EXISTS public.companies_before_update ();
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.company_revisions;
DROP TABLE IF EXISTS public.companies;
