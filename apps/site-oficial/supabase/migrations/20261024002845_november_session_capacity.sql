-- Add groups without replacing arrivals, assignments or history.
DO $$
DECLARE cfg record; current_state jsonb; additions jsonb; existing integer;
BEGIN
 FOR cfg IN SELECT * FROM (VALUES
 ('2026-11-09'::date,25),('2026-11-13'::date,20),('2026-11-14'::date,30),
 ('2026-11-19'::date,20),('2026-11-20'::date,30),('2026-11-21'::date,30)
 ) AS limits(day,groups) LOOP
  SELECT state INTO STRICT current_state FROM peniel_ops.session_state WHERE session_date=cfg.day FOR UPDATE;
  existing := jsonb_array_length(current_state->'groups');
  IF existing > cfg.groups THEN RAISE EXCEPTION 'Session % has more groups than configured',cfg.day; END IF;
  IF existing < cfg.groups THEN
   SELECT jsonb_agg(jsonb_build_object('id','G'||lpad(n::text,2,'0'),'status','forming','guide','','members','[]'::jsonb) ORDER BY n)
   INTO additions FROM generate_series(existing+1,cfg.groups) AS n;
   UPDATE peniel_ops.session_state
   SET state=jsonb_set(state,'{groups}',(state->'groups')||additions),revision=revision+1,updated_at=now()
   WHERE session_date=cfg.day;
  END IF;
 END LOOP;
END $$;
