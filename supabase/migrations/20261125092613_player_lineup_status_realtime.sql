
CREATE TABLE IF NOT EXISTS public.player_lineup_status (
  id smallint PRIMARY KEY CHECK (id = 1),
  status jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_lineup_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.player_lineup_status FROM PUBLIC;
GRANT SELECT ON TABLE public.player_lineup_status TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read current lineup status" ON public.player_lineup_status;
CREATE POLICY "Public can read current lineup status"
  ON public.player_lineup_status
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

CREATE OR REPLACE FUNCTION public.sync_player_lineup_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_next_match jsonb;
  v_status jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.player_status->'next_match' IS NOT DISTINCT FROM NEW.player_status->'next_match'
  THEN
    RETURN NEW;
  END IF;

  v_next_match := COALESCE(NEW.player_status->'next_match', '{}'::jsonb);

  v_status := jsonb_strip_nulls(jsonb_build_object(
    'status', v_next_match->'status',
    'type', v_next_match->'type',
    'phase', v_next_match->'phase',
    'tone', v_next_match->'tone',
    'label', v_next_match->'label',
    'pillLabel', v_next_match->'pillLabel',
    'reason', v_next_match->'reason',
    'lineup_fixture_id', v_next_match->'lineup_fixture_id',
    'lineup_checked_at', v_next_match->'lineup_checked_at'
  ));

  INSERT INTO public.player_lineup_status AS existing (id, status, updated_at)
  VALUES (1, v_status, now())
  ON CONFLICT (id) DO UPDATE
    SET status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    WHERE existing.status IS DISTINCT FROM EXCLUDED.status;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_player_lineup_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS player_page_lineup_status_realtime ON public.player_page;
CREATE TRIGGER player_page_lineup_status_realtime
  AFTER INSERT OR UPDATE OF player_status ON public.player_page
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_player_lineup_status();

INSERT INTO public.player_lineup_status (id, status, updated_at)
SELECT
  1,
  jsonb_strip_nulls(jsonb_build_object(
    'status', p.player_status->'next_match'->'status',
    'type', p.player_status->'next_match'->'type',
    'phase', p.player_status->'next_match'->'phase',
    'tone', p.player_status->'next_match'->'tone',
    'label', p.player_status->'next_match'->'label',
    'pillLabel', p.player_status->'next_match'->'pillLabel',
    'reason', p.player_status->'next_match'->'reason',
    'lineup_fixture_id', p.player_status->'next_match'->'lineup_fixture_id',
    'lineup_checked_at', p.player_status->'next_match'->'lineup_checked_at'
  )),
  now()
FROM public.player_page AS p
WHERE p.id = 1
ON CONFLICT (id) DO UPDATE
  SET status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  WHERE public.player_lineup_status.status IS DISTINCT FROM EXCLUDED.status;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'player_lineup_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.player_lineup_status;
  END IF;
END;
$publication$;
