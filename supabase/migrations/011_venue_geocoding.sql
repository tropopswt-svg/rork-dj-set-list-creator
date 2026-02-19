-- Venue Coordinates: geocoded venue locations for artist heat maps

CREATE TABLE IF NOT EXISTS venue_coordinates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venue_coords_name ON venue_coordinates(venue_name);
CREATE INDEX IF NOT EXISTS idx_venue_coords_geo ON venue_coordinates(latitude, longitude);

-- RLS: public read
ALTER TABLE venue_coordinates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_coords_public_read" ON venue_coordinates
  FOR SELECT USING (true);

-- Pre-populate with well-known electronic music venues
INSERT INTO venue_coordinates (venue_name, latitude, longitude, city, country) VALUES
  ('Berghain', 52.5112, 13.4421, 'Berlin', 'Germany'),
  ('Fabric', 51.5196, -0.1044, 'London', 'UK'),
  ('Amnesia', 38.9178, 1.4306, 'Ibiza', 'Spain'),
  ('DC-10', 38.8686, 1.3694, 'Ibiza', 'Spain'),
  ('Pacha', 38.9086, 1.4355, 'Ibiza', 'Spain'),
  ('Ushuaia', 38.8800, 1.3925, 'Ibiza', 'Spain'),
  ('Hi Ibiza', 38.8800, 1.3925, 'Ibiza', 'Spain'),
  ('Privilege', 38.9383, 1.4233, 'Ibiza', 'Spain'),
  ('Space', 38.8800, 1.3925, 'Ibiza', 'Spain'),
  ('Circoloco', 38.5111, 13.4421, 'Various', 'Various'),
  ('Tresor', 52.5097, 13.4201, 'Berlin', 'Germany'),
  ('Watergate', 52.5015, 13.4425, 'Berlin', 'Germany'),
  ('Panorama Bar', 52.5112, 13.4421, 'Berlin', 'Germany'),
  ('Output', 40.7221, -73.9572, 'New York', 'USA'),
  ('Nowadays', 40.7043, -73.9166, 'New York', 'USA'),
  ('Warehouse Project', 53.4721, -2.2527, 'Manchester', 'UK'),
  ('Printworks', 51.5038, -0.0049, 'London', 'UK'),
  ('Ministry of Sound', 51.4978, -0.1000, 'London', 'UK'),
  ('Coachella', 33.6803, -116.2376, 'Indio', 'USA'),
  ('Tomorrowland', 51.0939, 4.3863, 'Boom', 'Belgium'),
  ('Sonar', 41.3710, 2.1444, 'Barcelona', 'Spain'),
  ('Movement', 42.3314, -83.0458, 'Detroit', 'USA'),
  ('ADE', 52.3676, 4.9041, 'Amsterdam', 'Netherlands'),
  ('Awakenings', 52.3676, 4.9041, 'Amsterdam', 'Netherlands'),
  ('Dekmantel', 52.3676, 4.9041, 'Amsterdam', 'Netherlands'),
  ('Time Warp', 49.4875, 8.4660, 'Mannheim', 'Germany'),
  ('Rex Club', 48.8677, 2.3407, 'Paris', 'France'),
  ('Concrete', 48.8384, 2.3751, 'Paris', 'France'),
  ('Shelter', 52.3667, 4.9027, 'Amsterdam', 'Netherlands'),
  ('De School', 52.3456, 4.8560, 'Amsterdam', 'Netherlands'),
  ('Robert Johnson', 50.0994, 8.6310, 'Frankfurt', 'Germany'),
  ('Corsica Studios', 51.4937, -0.0999, 'London', 'UK'),
  ('E1', 51.5183, -0.0678, 'London', 'UK'),
  ('Phonox', 51.4631, -0.1145, 'London', 'UK'),
  ('Burning Man', 40.7864, -119.2065, 'Black Rock', 'USA'),
  ('EDC Las Vegas', 36.2710, -115.0073, 'Las Vegas', 'USA'),
  ('Ultra Music Festival', 25.7655, -80.1877, 'Miami', 'USA'),
  ('Electric Forest', 43.6488, -85.9815, 'Rothbury', 'USA'),
  ('Nuits Sonores', 45.7578, 4.8320, 'Lyon', 'France'),
  ('Dimensions', 44.8831, 13.7973, 'Pula', 'Croatia')
ON CONFLICT (venue_name) DO NOTHING;
