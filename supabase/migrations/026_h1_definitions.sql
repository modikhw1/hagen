-- ============================================================================
-- H1 DEFINITIONS TABLE
-- Persistent H1 models that can be iterated and improved over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS h1_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- H1 identification
  name TEXT NOT NULL,  -- Short name: "humor_similarity", "steve_poke_fit"
  question TEXT NOT NULL,  -- The belonging question: "Do these belong together in humor style?"
  description TEXT,  -- Optional longer description

  -- Mode: clip-to-clip or brand-to-clip
  mode TEXT NOT NULL DEFAULT 'clip' CHECK (mode IN ('clip', 'brand')),

  -- For brand mode: which brand is the anchor
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,

  -- Dimensional lens (optional categorization)
  dimension TEXT CHECK (dimension IN (
    'humor', 'audience', 'quality', 'style', 'replicability', 'brand_fit', 'custom'
  )),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique name per mode
  CONSTRAINT h1_definitions_unique_name UNIQUE (name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_h1_definitions_status ON h1_definitions(status);
CREATE INDEX IF NOT EXISTS idx_h1_definitions_mode ON h1_definitions(mode);
CREATE INDEX IF NOT EXISTS idx_h1_definitions_brand ON h1_definitions(brand_id) WHERE brand_id IS NOT NULL;

-- Link training pairs to H1 definitions
ALTER TABLE h1_training_pairs
ADD COLUMN IF NOT EXISTS h1_definition_id UUID REFERENCES h1_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_h1_pairs_definition ON h1_training_pairs(h1_definition_id) WHERE h1_definition_id IS NOT NULL;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_h1_definitions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS h1_definitions_updated_at ON h1_definitions;
CREATE TRIGGER h1_definitions_updated_at
  BEFORE UPDATE ON h1_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_h1_definitions_timestamp();

-- RLS
ALTER TABLE h1_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access h1_definitions"
  ON h1_definitions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated read h1_definitions"
  ON h1_definitions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anon read h1_definitions"
  ON h1_definitions FOR SELECT USING (true);

-- Comments
COMMENT ON TABLE h1_definitions IS 'Persistent H1 model definitions - the questions being trained';
COMMENT ON COLUMN h1_definitions.name IS 'Short identifier for the H1 (e.g., humor_similarity)';
COMMENT ON COLUMN h1_definitions.question IS 'The belonging question shown during annotation';
COMMENT ON COLUMN h1_definitions.mode IS 'clip = Clip A -> Clip B, brand = Brand -> Clip';
COMMENT ON COLUMN h1_definitions.dimension IS 'Which aspect of belonging this H1 measures';
