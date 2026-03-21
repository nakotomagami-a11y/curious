-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  waves_cleared integer NOT NULL DEFAULT 0,
  time_survived real NOT NULL DEFAULT 0,
  enemies_killed integer NOT NULL DEFAULT 0,
  game_mode text NOT NULL DEFAULT 'survival',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "leaderboard_read" ON leaderboard FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "leaderboard_insert" ON leaderboard FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id text PRIMARY KEY,
  host_name text NOT NULL,
  game_mode text NOT NULL DEFAULT 'coop-survival',
  player_count integer NOT NULL DEFAULT 1,
  max_players integer NOT NULL DEFAULT 4,
  state text NOT NULL DEFAULT 'lobby',
  wave integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sessions_read" ON game_sessions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "sessions_insert" ON game_sessions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "sessions_update" ON game_sessions FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "sessions_delete" ON game_sessions FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
