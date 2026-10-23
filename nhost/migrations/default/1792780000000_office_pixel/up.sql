-- Office-Pixel en Nhost: empresas por usuario, historial de versiones y preferencias.
-- Se aplica sola si conectas el repositorio a Nhost, o pégala en Base de datos → SQL del panel.

-- ---------------------------------------------------------------------------
-- Empresas: cada usuario tiene las suyas (user_id = auth.users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text NOT NULL,
  -- la empresa completa (áreas, personas, procesos, procedimientos, ilustraciones…) en YAML
  yaml text NOT NULL CHECK (octet_length(yaml) <= 26214400),
  yaml_bytes integer GENERATED ALWAYS AS (octet_length(yaml)) STORED,
  -- sube sola en cada cambio; sirve para no pisar lo que guardó otra pestaña
  version integer NOT NULL DEFAULT 1,
  -- reservado (la app ya no lo usa: una cuenta nueva empieza sin empresas)
  bootstrap boolean NOT NULL DEFAULT false,
  -- nota del cambio que se está guardando (se pasa al historial y se limpia)
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX companies_user_updated_idx ON public.companies (user_id, updated_at DESC);
CREATE UNIQUE INDEX companies_one_bootstrap_per_user ON public.companies (user_id) WHERE bootstrap;

-- ---------------------------------------------------------------------------
-- Versiones anteriores (solo lectura para el usuario; las crea el trigger)
-- ---------------------------------------------------------------------------
CREATE TABLE public.company_revisions (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  name text NOT NULL,
  yaml text NOT NULL,
  yaml_bytes integer GENERATED ALWAYS AS (octet_length(yaml)) STORED,
  saved_at timestamptz NOT NULL,
  note text
);

CREATE INDEX company_revisions_company_idx ON public.company_revisions (company_id, id DESC);

-- ---------------------------------------------------------------------------
-- Preferencias (por usuario)
-- ---------------------------------------------------------------------------
CREATE TABLE public.settings (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[A-Za-z0-9_.-]{1,64}$'),
  value text NOT NULL CHECK (length(value) <= 10000),
  PRIMARY KEY (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Al guardar un cambio: se conserva la versión anterior (las últimas 40), sube la versión
-- y no se puede cambiar de dueño ni de identificador.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.companies_before_update () RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.bootstrap := OLD.bootstrap;
  NEW.version := OLD.version;

  IF NEW.yaml IS DISTINCT FROM OLD.yaml OR NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.company_revisions (company_id, user_id, version, name, yaml, saved_at, note)
    VALUES (OLD.id, OLD.user_id, OLD.version, OLD.name, OLD.yaml, OLD.updated_at, NEW.change_note);

    DELETE FROM public.company_revisions
    WHERE company_id = OLD.id
      AND id NOT IN (
        SELECT id FROM public.company_revisions WHERE company_id = OLD.id ORDER BY id DESC LIMIT 40
      );

    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  NEW.change_note := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_before_update
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_before_update ();
