-- marker: company_drafts
-- Borradores sin aplicar de los formularios (Configurar empresa, Procesos): uno por empresa y tipo.
-- Se puede ejecutar más de una vez.
CREATE TABLE IF NOT EXISTS public.company_drafts (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('config', 'hub')),
  -- versión de la empresa sobre la que se hizo el borrador
  base_version integer NOT NULL,
  body text NOT NULL CHECK (octet_length(body) <= 26214400),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, kind)
);

CREATE OR REPLACE FUNCTION public.company_drafts_before_update () RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.company_id := OLD.company_id;
  NEW.user_id := OLD.user_id;
  NEW.kind := OLD.kind;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_drafts_before_update ON public.company_drafts;
CREATE TRIGGER company_drafts_before_update BEFORE UPDATE ON public.company_drafts
  FOR EACH ROW EXECUTE FUNCTION public.company_drafts_before_update ();
