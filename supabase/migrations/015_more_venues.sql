-- Add more venue coordinates based on actual sets in the database
INSERT INTO venue_coordinates (venue_name, latitude, longitude, city, country) VALUES
  -- London venues
  ('93 Feet East', 51.5210, -0.0720, 'London', 'UK'),
  ('Fabric London', 51.5196, -0.1044, 'London', 'UK'),
  ('fabric London', 51.5196, -0.1044, 'London', 'UK'),
  ('Printworks London', 51.5038, -0.0049, 'London', 'UK'),
  ('Phonox London', 51.4631, -0.1145, 'London', 'UK'),
  ('Village Underground London', 51.5253, -0.0780, 'London', 'UK'),
  ('The Roundhouse London', 51.5434, -0.1530, 'London', 'UK'),
  ('Old Royal Naval College London', 51.4834, -0.0064, 'London', 'UK'),
  ('Finsbury Park London', 51.5650, -0.1056, 'London', 'UK'),
  ('Mixmag Lab London', 51.5074, -0.1278, 'London', 'UK'),
  ('Boiler Room London', 51.5074, -0.1278, 'London', 'UK'),
  -- Manchester
  ('Depot Mayfield', 53.4740, -2.2310, 'Manchester', 'UK'),
  ('Warehouse Project Manchester', 53.4721, -2.2527, 'Manchester', 'UK'),
  -- Bristol
  ('Motion', 51.4470, -2.5720, 'Bristol', 'UK'),
  ('Motion Bristol', 51.4470, -2.5720, 'Bristol', 'UK'),
  -- Edinburgh
  ('Boiler Room Edinburgh', 55.9533, -3.1883, 'Edinburgh', 'UK'),
  -- Dublin
  ('District 8', 53.3381, -6.2746, 'Dublin', 'Ireland'),
  -- Berlin venues
  ('Berghain Berlin', 52.5112, 13.4421, 'Berlin', 'Germany'),
  ('Panorama Bar Berlin', 52.5112, 13.4421, 'Berlin', 'Germany'),
  ('Boiler Room Berlin', 52.5200, 13.4050, 'Berlin', 'Germany'),
  -- Amsterdam venues
  ('De Marktkantine', 52.3683, 4.8537, 'Amsterdam', 'Netherlands'),
  ('Shelter Amsterdam', 52.3667, 4.9027, 'Amsterdam', 'Netherlands'),
  ('Transformatorhuis Amsterdam', 52.3860, 4.9020, 'Amsterdam', 'Netherlands'),
  ('Music On Festival Amsterdam', 52.3676, 4.9041, 'Amsterdam', 'Netherlands'),
  ('NDSM', 52.4012, 4.8915, 'Amsterdam', 'Netherlands'),
  ('Flevopark', 52.3613, 4.9367, 'Amsterdam', 'Netherlands'),
  ('DGTL Festival', 52.4012, 4.8915, 'Amsterdam', 'Netherlands'),
  -- Paris
  ('Rex Club Paris', 48.8677, 2.3407, 'Paris', 'France'),
  -- Ibiza venues
  ('Amnesia Ibiza', 38.9178, 1.4306, 'Ibiza', 'Spain'),
  ('DC-10 Ibiza', 38.8686, 1.3694, 'Ibiza', 'Spain'),
  ('Pacha Ibiza', 38.9086, 1.4355, 'Ibiza', 'Spain'),
  ('Ushuaia Ibiza', 38.8800, 1.3925, 'Ibiza', 'Spain'),
  ('Space Ibiza', 38.8800, 1.3925, 'Ibiza', 'Spain'),
  ('528 Ibiza', 38.9086, 1.4355, 'Ibiza', 'Spain'),
  -- Barcelona
  ('INPUT Barcelona', 41.3730, 2.1530, 'Barcelona', 'Spain'),
  ('Primavera Sound Barcelona', 41.4100, 2.2200, 'Barcelona', 'Spain'),
  -- New York venues
  ('Brooklyn Mirage', 40.7128, -73.9311, 'New York', 'USA'),
  ('Output Brooklyn', 40.7221, -73.9572, 'New York', 'USA'),
  ('Paradise Garage NYC', 40.7275, -74.0035, 'New York', 'USA'),
  ('Superior Ingredients NYC', 40.7150, -73.9980, 'New York', 'USA'),
  ('Raw Cuts NYC', 40.7128, -74.0060, 'New York', 'USA'),
  ('Raw Cuts NYC Pop Up', 40.7128, -74.0060, 'New York', 'USA'),
  ('NYC Pop Up', 40.7128, -74.0060, 'New York', 'USA'),
  ('Boiler Room NYC', 40.7128, -74.0060, 'New York', 'USA'),
  ('Hudson River Boat Party', 40.7580, -74.0000, 'New York', 'USA'),
  -- Los Angeles
  ('Sound Nightclub', 33.9849, -118.3292, 'Los Angeles', 'USA'),
  ('Yuma Tent', 33.6803, -116.2376, 'Indio', 'USA'),
  ('Yuma', 33.6803, -116.2376, 'Indio', 'USA'),
  ('DoLab Stage', 33.6803, -116.2376, 'Indio', 'USA'),
  -- Colorado
  ('Red Rocks Amphitheatre', 39.6654, -105.2057, 'Morrison', 'USA'),
  -- Brazil
  ('Time Warp Sao Paulo', -23.5505, -46.6333, 'Sao Paulo', 'Brazil'),
  -- Mexico
  ('Zamna Tulum', 20.2000, -87.4650, 'Tulum', 'Mexico'),
  ('Blue Parrot', 20.6313, -87.0769, 'Playa del Carmen', 'Mexico'),
  -- Belgium
  ('Tomorrowland Belgium', 51.0939, 4.3863, 'Boom', 'Belgium'),
  -- Romania
  ('Sunwaves Festival Mamaia', 44.2637, 28.6244, 'Mamaia', 'Romania'),
  ('Mamaia Beach', 44.2637, 28.6244, 'Mamaia', 'Romania'),
  -- Croatia
  ('The Garden Resort', 44.2340, 15.1630, 'Tisno', 'Croatia'),
  -- Italy
  ('Solid Grooves Venezia', 45.4408, 12.3155, 'Venice', 'Italy'),
  -- Radio/online (use London as default)
  ('BBC Radio 1', 51.5180, -0.1440, 'London', 'UK'),
  ('Resident Advisor', 51.5074, -0.1278, 'London', 'UK'),
  ('Boiler Room', 51.5074, -0.1278, 'London', 'UK'),
  ('Mixmag Lab', 51.5074, -0.1278, 'London', 'UK'),
  -- Misc
  ('Mayan Warrior', 40.7864, -119.2065, 'Black Rock', 'USA'),
  ('Colorado Charlie', 52.0792, 4.2887, 'The Hague', 'Netherlands'),
  ('Mint Warehouse', 53.7957, -1.5477, 'Leeds', 'UK'),
  ('AVA Festival', 54.5973, -5.9301, 'Belfast', 'UK'),
  ('Glastonbury Festival', 51.0040, -2.5854, 'Glastonbury', 'UK'),
  ('EDC Camp', 36.2710, -115.0073, 'Las Vegas', 'USA'),
  ('Metroplex', 42.3314, -83.0458, 'Detroit', 'USA'),
  ('Dirtybird Campout', 35.7500, -118.2500, 'Bakersfield', 'USA')
ON CONFLICT (venue_name) DO NOTHING;
