-- Migration: 20260523000002_crew_data_and_billing.sql
-- 1. Add billing columns to crew_trips
-- 2. Seed missing drivers
-- 3. Seed vehicles from Vehicles.csv
-- 4. Seed 208 trips from Task.csv

-- ============================================================
-- 1. ADD BILLING COLUMNS TO crew_trips
-- ============================================================

ALTER TABLE public.crew_trips
  ADD COLUMN IF NOT EXISTS external_id      text UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_status   text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS invoice_ref      text,
  ADD COLUMN IF NOT EXISTS invoice_amount   numeric(12,2);

-- ============================================================
-- 2. SEED DRIVERS
-- ============================================================

-- Missing drivers found in Task.csv but not in Drivers.csv
INSERT INTO public.crew_drivers (full_name, email, status) VALUES
  ('Taufeeq',           'taufeeq@jlsyachts.com',  'active'),
  ('Jovian Gonzaga',    'j.gonzaga@jlsyachts.com', 'active'),
  ('Rambachan Mahato',  'r.mahato@jlsyachts.com',  'active')
ON CONFLICT (email) DO NOTHING;

-- All 17 drivers from Drivers.csv (safe re-seed)
INSERT INTO public.crew_drivers (full_name, email, phone, status) VALUES
  ('External Admin Peeters',      'externaladmin@jlsyachts.com', null,            'active'),
  ('Ali Rizwan',                  'ali.r@jlsyachts.com',         null,            'active'),
  ('Imran Ul Haq',                'imran@jlsyachts.com',         null,            'active'),
  ('Joel De Leon Mallari',        'joel@jlsyachts.com',          null,            'active'),
  ('Luzviminda Datuin Santiago',  'lucy@jlsyachts.com',          null,            'active'),
  ('Pramod Kumar',                'pramod@jlsyachts.com',        null,            'active'),
  ('Ramjatan Mahato',             'ram@jlsyachts.com',           null,            'active'),
  ('Sathish Somappa',             'sathish@jlsyachts.com',       null,            'active'),
  ('Sharath Kumar Sherigara',     'sharath@jlsyachts.com',       null,            'active'),
  ('William Praveen D Souza',     'william.ds@jlsyachts.com',    null,            'active'),
  ('Muhammad Faisal',             'm.faisal@jlsyachts.com',      null,            'active'),
  ('Waheed Murad',                'w.murad@jlsyachts.com',       null,            'active'),
  ('Rambachan Mahato',            'r.mahato@jlsyachts.com',      null,            'active'),
  ('Jon Lopez',                   'j.lopez@jlsyachts.com',       null,            'active'),
  ('Mudaseer Mohamed',            'logistics@jlsyachts.com',     null,            'active'),
  ('Alex Bondoc',                 'alex@jlsyachts.com',          '+971506525172', 'active'),
  ('Faisal',                      null,                          null,            'active')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 3. SEED VEHICLES
-- ============================================================

INSERT INTO public.crew_vehicles (make, model, registration, mileage, status, notes) VALUES
  ('Mitsubishi', 'L200',    'N20351', 658741, 'active', 'SUV | Engine: 2.0L | Driver: Joel'),
  ('Hyundai',    'H-1',     'U34746', 409046, 'active', 'Van | Driver: Sharath'),
  ('Toyota',     'Hiace',   'X56383', 5000,   'active', 'Van | Driver: Joel'),
  ('Hyundai',    'H-1',     'S57107', null,   'active', 'Van'),
  ('Hyundai',    'H-1',     'N35369', null,   'active', 'Van'),
  ('Toyota',     'Yaris',   'U55706', null,   'active', 'Coupe'),
  ('Nissan',     'Tiida',   'T40976', null,   'active', 'Coupe'),
  ('Nissan',     'Armada',  'R59041', null,   'active', 'Van'),
  ('Toyota',     'Hiace',   'W15356', null,   'active', 'Van'),
  ('Ford',       'F150',    'J99137', null,   'active', 'Pickup'),
  ('Volkswagen', 'Jetta',   'K78124', 250150, 'active', 'Sedan | Driver: Faisal'),
  ('Ford',       'F150',    'P42413', null,   'active', 'Pickup'),
  ('Hyundai',    'H-1',     'Y51971', null,   'active', 'Van'),
  ('Nissan',     'Tiida',   'D64328', null,   'active', 'Coupe'),
  ('Nissan',     'Urvan',   'M71081', null,   'active', 'Van'),
  ('Ram',        'Ram',     'Z61308', null,   'active', 'Pickup'),
  ('Hyundai',    'H1',      'Z69885', null,   'active', 'Van')
ON CONFLICT (registration) DO NOTHING;

-- ============================================================
-- 4. SEED TRIPS FROM Task.csv (208 rows)
-- ============================================================

INSERT INTO public.crew_trips (
  external_id,
  trip_type,
  pickup_datetime,
  driver_id,
  yacht_id,
  passenger_name,
  pickup_address,
  dropoff_address,
  status,
  notes,
  billing_status
)
WITH trip_data(ext_id, trip_type, dt, driver_email, yacht_name, req_by, pickup, dropoff, csv_status, notes) AS (
  VALUES
  -- Row 2 (ID=35)
  ('35', 'arrival_transport',      '6/19/2024', 'pramod@jlsyachts.com',    'Ultra G',       'Matt Cowpe - Captain',            'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK90 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 3 (ID=36)
  ('36', 'delivery_collection',    '6/21/2024', 'w.murad@jlsyachts.com',   'Titan',         'Yacht Titan',                     'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect the parcels from the office then deliver to the yacht'),
  -- Row 4 (ID=37)
  ('37', 'departure_transport',    '6/21/2024', 'pramod@jlsyachts.com',    'Madame Gu',     'Captain Emmanuel',                'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK21 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 5 (ID=38)
  ('38', 'crew_pickup',            '6/21/2024', 'sharath@jlsyachts.com',   '',              'Maddie',                          'Dubai T3',                                   'Premier Inn Silicon Oasis',             'Complete', 'Dubai T3 - Premier Inn Silicon Oasis'),
  -- Row 6 (ID=39)
  ('39', 'delivery_collection',    '6/25/2024', 'sharath@jlsyachts.com',   'Plvs Vltra',   'Plvs Vltra Yacht',                'Office',                                     'Boat Port Rashid',                      'Complete', 'Collect the items from office'),
  -- Row 7 (ID=40)
  ('40', 'departure_transport',    '6/25/2024', 'sathish@jlsyachts.com',   'Plvs Vltra',   'Plvs Vltra Captain',              'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK33 | Sign Off | Boat - Sign Off Online Only - Dubai T3'),
  -- Row 8 (ID=41)
  ('41', 'arrival_transport',      '6/25/2024', 'w.murad@jlsyachts.com',   'Ocean Victory', '',                               'Dubai T1',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'TK760 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on Anchorage'),
  -- Row 9 (ID=42)
  ('42', 'arrival_transport',      '6/25/2024', 'w.murad@jlsyachts.com',   'Ocean Victory', 'Captain Ocean Victory',          'Dubai T1',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'TK760 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 10 (ID=43)
  ('43', 'arrival_transport',      '6/26/2024', 'w.murad@jlsyachts.com',   'Ocean Victory', 'Captain Ocean Victory',          'Dubai T1',                                   'Boat Umm Suqeim on Anchorage',          'Complete', 'LH630 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 11 (ID=44)
  ('44', 'departure_transport',    '6/26/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Ocean Victory Captain',          'Boat Umm Suqeim on anchorage',               'Dubai T1',                              'Complete', 'TK765 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T1'),
  -- Row 12 (ID=45)
  ('45', 'departure_transport',    '6/27/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain',                        'Boat Umm Suqeim on anchorage',               'Dubai T1',                              'Complete', 'TK765 | Sign Off | Boat Umm Suqeim on Anchorage - Sign Off Online - Dubai T1'),
  -- Row 13 (ID=46)
  ('46', 'delivery_collection',    '6/27/2024', 'sathish@jlsyachts.com',   'Hermitage',     '',                               'Office JLS Yachts Silicon',                  'Boat Port Rashid',                      'Complete', 'Collect the parcels from office then deliver to the yacht'),
  -- Row 14 (ID=47)
  ('47', 'crew_pickup',            '6/27/2024', 'w.murad@jlsyachts.com',   '',              '',                               'Bob House Silicon and Roy Burjuman Metro',   'Port Rashid',                           'Complete', 'Pick-up Bob then Roy then Port Rashid'),
  -- Row 15 (ID=48)
  ('48', 'crew_pickup',            '6/27/2024', 'pramod@jlsyachts.com',    '',              'Maddie',                         'Dubai T1',                                   'Leslie House Al Rigga',                 'Complete', 'XY0507 | Dubai T1 - Leslie House Al Rigga'),
  -- Row 16 (ID=53)
  ('53', 'seaport_crew_change',    '6/27/2024', 'imran@jlsyachts.com',     'Queen Alla',    'Captain Dennis',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 17 (ID=54)
  ('54', 'arrival_transport',      '6/27/2024', 'pramod@jlsyachts.com',    'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK449 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 18 (ID=55)
  ('55', 'delivery_collection',    '6/28/2024', 'pramod@jlsyachts.com',    'Galvas',        'Charles Warwick',                'Boat Al Jaddaf',                             'Office JLS Yachts Silicon',             'Complete', 'Sign Off | Collect oil sample from yacht then deliver to office'),
  -- Row 19 (ID=56)
  ('56', 'seaport_crew_change',    '6/28/2024', 'imran@jlsyachts.com',     'Queen Alla',    'Captain Dennis',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 20 (ID=57)
  ('57', 'crew_pickup',            '6/28/2024', 'sharath@jlsyachts.com',   '',              'Roy - Waypoint',                 'Burjuman metro',                             'Waypoint port rashid',                  'Complete', 'Sign Off | Burjuman metro - Waypoint port rashid'),
  -- Row 21 (ID=58)
  ('58', 'crew_pickup',            '6/28/2024', 'sharath@jlsyachts.com',   '',              'Bob - Training Dept',            'Silicon Bob House',                          'Training School Port Rashid',           'Complete', 'Sign Off | Silicon Bob House - Training School Port Rashid'),
  -- Row 22 (ID=59)
  ('59', 'seaport_crew_change',    '6/28/2024', 'sharath@jlsyachts.com',   'GENESIS',       'Annie - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 23 (ID=60)
  ('60', 'seaport_crew_change',    '6/28/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 24 (ID=61)
  ('61', 'seaport_crew_change',    '6/28/2024', 'imran@jlsyachts.com',     'BURKUT',        'Engin Saygili',                  '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only in DMC'),
  -- Row 25 (ID=62)
  ('62', 'departure_transport',    '6/28/2024', 'w.murad@jlsyachts.com',   'NIRVANA',       'Lee - Purser',                   'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'SA7155 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 26 (ID=63)
  ('63', 'departure_transport',    '6/28/2024', 'w.murad@jlsyachts.com',   'NIRVANA',       'Lee - Purser',                   'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'SA7155 | Sign Off | Boat - Sign Off Online - Dubai T3 (duplicate)'),
  -- Row 27 (ID=65)
  ('65', 'departure_transport',    '6/28/2024', 'sharath@jlsyachts.com',   'Queen Alla',    'Captain Denis',                  'Bot D-Marine Marsa Al Arab Marina',          'Dubai T1',                              'Complete', 'Sign Off | Boat - Sign Off Online - Dubai T1'),
  -- Row 28 (ID=66)
  ('66', 'departure_transport',    '6/28/2024', 'sharath@jlsyachts.com',   'Queen Alla',    'Captain Denis',                  'Boat D-Marin Marsa Al Arab Marina',          'Dubai T1',                              'Complete', 'Sign Off | Boat - Sign Off Online - Dubai T1'),
  -- Row 29 (ID=69)
  ('69', 'departure_transport',    '6/29/2024', 'ali.r@jlsyachts.com',     '02',            'test',                           'test',                                       'test',                                  'Complete', 'test | Sign Off | test'),
  -- Row 30 (ID=70)
  ('70', 'arrival_transport',      '7/8/2024',  'pramod@jlsyachts.com',    'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK449 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 31 (ID=71)
  ('71', 'departure_transport',    '7/9/2024',  'ali.r@jlsyachts.com',     'Z',             'Robert Weston - Captain',        'Boat Port Rashid',                           'Dubai T1',                              'Complete', 'BA108 | Sign Off | Boat - Sign Off Online - Dubai T1'),
  -- Row 32 (ID=72)
  ('72', 'delivery_collection',    '7/10/2024', 'sathish@jlsyachts.com',   'TITAN',         'Yacht Titan',                    'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 33 (ID=73)
  ('73', 'seaport_crew_change',    '7/10/2024', 'imran@jlsyachts.com',     'A',             'Andreea - purser',               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 34 (ID=74)
  ('74', 'arrival_transport',      '7/10/2024', 'w.murad@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T1',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'PR658 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 35 (ID=75)
  ('75', 'crew_pickup',            '7/10/2024', 'sharath@jlsyachts.com',   '',              'Maddie - Internal Request',      'Premier Inn Silicon Oasis',                  'Dubai T1',                              'Complete', 'VF144 | Premier Inn Silicon Oasis - Dubai T1'),
  -- Row 36 (ID=76)
  ('76', 'seaport_crew_change',    '7/10/2024', 'imran@jlsyachts.com',     'Indigo Star',   'Brunner - Captain',              '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 37 (ID=77)
  ('77', 'delivery_collection',    '7/11/2024', 'sathish@jlsyachts.com',   'A',             'Yacht - My A SF99',              'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 38 (ID=78)
  ('78', 'arrival_transport',      '7/11/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Ocean Victory - Captain',        'Dubai T1',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'BA107 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 39 (ID=79)
  ('79', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - Purser',                 '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 40 (ID=80)
  ('80', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 41 (ID=81)
  ('81', 'departure_transport',    '7/12/2024', 'ali.r@jlsyachts.com',     'OLMIDA',        'John Wisden - Captain',          'Boat Marsa Al Arab Marina',                  'Dubai T1',                              'Complete', 'VF144 | Sign Off | Boat Marsa Al Arab Marina - Sign Off Online - Dubai T1'),
  -- Row 42 (ID=82)
  ('82', 'crew_pickup',            '7/12/2024', 'ali.r@jlsyachts.com',     '',              'Bob - Training Dept',            'Office JLS Yachts Silicon Dubai',            'RAK Marina',                            'Complete', 'Office JLS Yachts Silicon Dubai - RAK Marina'),
  -- Row 43 (ID=83)
  ('83', 'crew_pickup',            '7/12/2024', 'w.murad@jlsyachts.com',   '',              'Christine Havinga',              'Office JLS Yachts Silicon Dubai',            'Dubai T1',                              'Complete', 'XY0502 | Office JLS Yachts Silicon Dubai - Dubai T1'),
  -- Row 44 (ID=84)
  ('84', 'delivery_collection',    '7/12/2024', 'w.murad@jlsyachts.com',   'TITAN',         'Titan Yacht',                    'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 45 (ID=85)
  ('85', 'delivery_collection',    '7/12/2024', 'w.murad@jlsyachts.com',   'Hermitage',     'Hermitage - Yacht',              'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 46 (ID=86)
  ('86', 'arrival_transport',      '7/12/2024', 'w.murad@jlsyachts.com',   'OLMIDA',        'John Wisden Captain',            'Dubai T3',                                   'Boat Marsa Al Arab Marina',             'Complete', 'FZ1746 | Sign On | Dubai T3 - Sign On Online - Boat Marsa Al Arab Marina'),
  -- Row 47 (ID=87)
  ('87', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'PLVS VLTRA',    'Purser - Tiffanny',              '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only from DMC'),
  -- Row 48 (ID=88)
  ('88', 'shorebased',             '7/12/2024', 'sharath@jlsyachts.com',   '',              'Captain of Julia',               'Boat D Marin Marsa Al Arab Marina',          '',                                      'Complete', 'Medical | Boat - Gargash Hospital - Boat (16:30 Appointment)'),
  -- Row 49 (ID=89)
  ('89', 'delivery_collection',    '7/12/2024', 'w.murad@jlsyachts.com',   'TITAN',         'Chief Engineer - Titan',         'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcel from office then deliver to yacht'),
  -- Row 50 (ID=90)
  ('90', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'PLVS VLTRA',    'Captain Simon Truelove',         '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only from DMC'),
  -- Row 51 (ID=91)
  ('91', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'OLMIDA',        '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 52 (ID=92)
  ('92', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'BURKUT',        '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only from DMC'),
  -- Row 53 (ID=93)
  ('93', 'seaport_crew_change',    '7/12/2024', 'imran@jlsyachts.com',     'GENESIS',       '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 54 (ID=94)
  ('94', 'crew_pickup',            '7/13/2024', 'sathish@jlsyachts.com',   '',              'Roy Salanga',                    'Burjuman Metro',                             'Waypoint Port Rashid',                  'Complete', 'Transfer from Burjuman Metro to Waypoint at Port Rashid'),
  -- Row 55 (ID=95)
  ('95', 'seaport_crew_change',    '7/13/2024', 'imran@jlsyachts.com',     'OLMIDA',        'Capt. John Wisden',              '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online only'),
  -- Row 56 (ID=96)
  ('96', 'shorebased',             '7/13/2024', 'sathish@jlsyachts.com',   'JULIA',         'Captain of Julia',               'Boat D Marin Marsa Al Arab Marina',          '',                                      'Complete', 'Medical | Boat - Gargash Hospital - Boat (17:30 Appointment)'),
  -- Row 57 (ID=97)
  ('97', 'crew_pickup',            '7/13/2024', 'w.murad@jlsyachts.com',   '',              'Roy Salanga',                    'Waypoint Port Rashid',                       'Burjuman Metro',                        'Complete', 'Transfer from Waypoint Port Rashid - Burjuman Metro'),
  -- Row 58 (ID=98)
  ('98', 'departure_transport',    '7/13/2024', 'ali.r@jlsyachts.com',     'ULTRA G',       'Capt. Matt Green',               'Boat Port Rashid (W19)',                     'Dubai T1',                              'Complete', 'PC741 | Sign Off | Boat - Sign Off Online - Dubai T1'),
  -- Row 59 (ID=99)
  ('99', 'seaport_crew_change',    '7/13/2024', 'imran@jlsyachts.com',     'A',             'Purser',                         '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 60 (ID=100)
  ('100', 'arrival_transport',     '7/13/2024', 'sharath@jlsyachts.com',   'JULIA',         'Captain of Julia',               'Dubai T3',                                   'Boat D Marin Marsa Al Arab Marina',     'Complete', 'FZ1784 | Sign On | DXB T3 - Sign On Online - Boat D Marin Marsa Al Arab Marina'),
  -- Row 61 (ID=101)
  ('101', 'arrival_transport',     '7/13/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Purser - Lee',                   'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK776 | Sign On | Dubai T3 - Sign On Online - Boat Port Rashid'),
  -- Row 62 (ID=102)
  ('102', 'departure_transport',   '7/13/2024', 'sathish@jlsyachts.com',   'NIRVANA',       'Purser',                         'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK125 | Boat - Sign Off Online - Dubai T3'),
  -- Row 63 (ID=103)
  ('103', 'seaport_crew_change',   '7/15/2024', 'imran@jlsyachts.com',     'A',             'Purser',                         '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 64 (ID=104)
  ('104', 'seaport_crew_change',   '7/15/2024', 'imran@jlsyachts.com',     'TITAN',         'Purser',                         '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 65 (ID=105)
  ('105', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'GENESIS',       'Annie - Purser',                 '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 66 (ID=106)
  ('106', 'delivery_collection',   '7/16/2024', 'ali.r@jlsyachts.com',     'Galvas',        '',                               'Waypoint Port Rashid',                       'Boat Al Jaddaf Near Petrol Station',    'Complete', 'Collect parts from Waypoint then deliver to yacht'),
  -- Row 67 (ID=107)
  ('107', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'Alfaisal',      '',                               '',                                           '',                                      'Complete', 'Sign On | Sign On Online'),
  -- Row 68 (ID=108)
  ('108', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'Alfaisal',      '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 69 (ID=109)
  ('109', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'Quantum Blue',  'Captain Luka',                   '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 70 (ID=110)
  ('110', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'Quantum Blue',  '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 71 (ID=111)
  ('111', 'delivery_collection',   '7/16/2024', 'sathish@jlsyachts.com',   'NIRVANA',       '',                               'Waypoint Port Rashid',                       'Boat Port Rashid',                      'Complete', 'Collect pump part from Waypoint then deliver to yacht'),
  -- Row 72 (ID=112)
  ('112', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'GENESIS',       'Purser - Lee',                   '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 73 (ID=113)
  ('113', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'TITAN',         '',                               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 74 (ID=114)
  ('114', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'TITAN',         '',                               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 75 (ID=115)
  ('115', 'arrival_transport',     '7/16/2024', 'w.murad@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim Anchorage',             'Complete', 'EK2221 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim Anchorage'),
  -- Row 76 (ID=116)
  ('116', 'arrival_transport',     '7/16/2024', 'ali.r@jlsyachts.com',     'JULIA',         '',                               'Dubai T3',                                   'Boat D Marin Marsa Al Arab Marina',     'Complete', 'EK148 | Sign On | Dubai T3 - Sign On Online - Boat D Marin Marsa Al Arab Marina'),
  -- Row 77 (ID=117)
  ('117', 'departure_transport',   '7/16/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK334 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 78 (ID=118)
  ('118', 'delivery_collection',   '7/16/2024', 'w.murad@jlsyachts.com',   'Hermitage',     '',                               'Office JLS Yachts Silicon Dubai',            '',                                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 79 (ID=119)
  ('119', 'delivery_collection',   '7/16/2024', 'w.murad@jlsyachts.com',   'TITAN',         '',                               'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 80 (ID=120)
  ('120', 'seaport_crew_change',   '7/16/2024', 'imran@jlsyachts.com',     'BURKUT',        'Chief engineer - Marco',         '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only from DMC'),
  -- Row 81 (ID=121)
  ('121', 'arrival_transport',     '7/16/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim on Anchorage',          'Complete', 'EK338 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on Anchorage'),
  -- Row 82 (ID=122)
  ('122', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'Quantum Blue',  'Captain - Quantum Blue',         '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 83 (ID=123)
  ('123', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'Quantum Blue',  'Captain - Quantum Blue',         '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 84 (ID=124)
  ('124', 'arrival_transport',     '7/18/2024', 'sharath@jlsyachts.com',   'Z',             'Ken Robinson',                   'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK0028 | Boat - Dubai T3 - Boat (Charge to captain only)'),
  -- Row 85 (ID=125)
  ('125', 'arrival_transport',     '7/18/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim on Anchorage',          'Complete', 'EK338 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on Anchorage'),
  -- Row 86 (ID=126)
  ('126', 'departure_transport',   '7/18/2024', 'sharath@jlsyachts.com',   'NIRVANA',       'Lee - Purser',                   'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK017 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 87 (ID=127)
  ('127', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'PLVS VLTRA',    'Tiffany - purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only in DMC'),
  -- Row 88 (ID=128)
  ('128', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'PLVS VLTRA',    'Tiffany - Purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only in DMC'),
  -- Row 89 (ID=129)
  ('129', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'HAWA',          '',                               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only in DMC'),
  -- Row 90 (ID=130)
  ('130', 'seaport_crew_change',   '7/18/2024', 'imran@jlsyachts.com',     'HAWA',          '',                               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only in DMC'),
  -- Row 91 (ID=131)
  ('131', 'departure_transport',   '7/18/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', '',                               'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK336 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 92 (ID=132)
  ('132', 'seaport_crew_change',   '7/22/2024', 'imran@jlsyachts.com',     'NIRVANA',       'Lee - Purser',                   '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 93 (ID=133)
  ('133', 'departure_transport',   '7/22/2024', 'sharath@jlsyachts.com',   'Madame Gu',     'Captain Emmanuel',               'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK332 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 94 (ID=134)
  ('134', 'departure_transport',   '7/22/2024', 'w.murad@jlsyachts.com',   'OLMIDA',        '',                               'Boat D-Marin Marsa Al Arab Marina',          'Dubai T3',                              'Complete', 'FZ1789 | Sign Off | Boat D-Marin Marsa Al Arab Marina - Sign Off Online - Dubai T3'),
  -- Row 95 (ID=135)
  ('135', 'arrival_transport',     '7/22/2024', 'ali.r@jlsyachts.com',     'JULIA',         '',                               'Boat D Marin Marsa Al Arab Marina',          'Boat D Marin Marsa Al Arab Marina',     'Complete', 'TK762 | Sign On | Dubai T1 - Sign On Online - Boat D Marin Marsa Al Arab Marina'),
  -- Row 96 (ID=136)
  ('136', 'crew_pickup',           '7/22/2024', 'sharath@jlsyachts.com',   '',              'Captain Steve',                  'Captain Steve Hotel Radisson Blu Silicon Oasis', 'Dubai T3',                          'Complete', 'EK448 | Captain Steve Hotel - Dubai T3'),
  -- Row 97 (ID=137)
  ('137', 'seaport_crew_change',   '7/22/2024', 'imran@jlsyachts.com',     'Quantum Blue',  'Captain - Luka',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 98 (ID=138)
  ('138', 'seaport_crew_change',   '7/22/2024', 'imran@jlsyachts.com',     'PLVS VLTRA',    'Tiffany - Purser',               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only from DMC'),
  -- Row 99 (ID=139)
  ('139', 'seaport_crew_change',   '7/22/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 100 (ID=140)
  ('140', 'seaport_crew_change',   '7/22/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 101 (ID=141)
  ('141', 'departure_transport',   '7/22/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Lee - purser',                   'Boat Port Rashid',                           'Dubai T2',                              'Complete', 'FZ627 | Sign Off | Boat - Sign Off Online - Dubai T2'),
  -- Row 102 (ID=142)
  ('142', 'departure_transport',   '7/22/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', '',                               'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'TK765 | Boat Umm Suqeim on anchorage - Dubai T3'),
  -- Row 103 (ID=143)
  ('143', 'departure_transport',   '7/22/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain',                        'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK027 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 104 (ID=144)
  ('144', 'arrival_transport',     '7/22/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'EK048 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 105 (ID=145)
  ('145', 'shorebased',            '7/22/2024', 'sharath@jlsyachts.com',   '',              'Captain Ken - My Z',             'Anwa By Omniyat',                            '',                                      'Complete', 'Medical | Anwa By Omniyat - International modern hospital - Anwa By Omniyat'),
  -- Row 106 (ID=146)
  ('146', 'arrival_transport',     '7/22/2024', 'imran@jlsyachts.com',     'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'EK044 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 107 (ID=147)
  ('147', 'arrival_transport',     '7/22/2024', 'imran@jlsyachts.com',     'Ocean Victory', '',                               'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'EK2013 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 108 (ID=148)
  ('148', 'arrival_transport',     '7/22/2024', 'ali.r@jlsyachts.com',     'Z',             'Captain Ken',                    'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK771 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 109 (ID=149)
  ('149', 'departure_transport',   '7/22/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Captain - Ocean Victory',        'Boat Umm Suqeim on anchorage',               'Dubai T1',                              'Complete', 'BA108 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T1'),
  -- Row 110 (ID=150)
  ('150', 'departure_transport',   '7/22/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', 'Captain - Ocean Victory',        'Boat Umm Suqeim on anchorage',               'Dubai T1',                              'Complete', 'TK765 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T1'),
  -- Row 111 (ID=151)
  ('151', 'arrival_transport',     '7/22/2024', 'sharath@jlsyachts.com',   'HAWA',          'Kim',                            'Sharjah International Airport',              'Boat Port Rashid',                      'Complete', 'G9113 | Sign On | Sharjah International Airport - Sign On Online - Boat Port Rashid'),
  -- Row 112 (ID=152)
  ('152', 'arrival_transport',     '7/24/2024', 'ali.r@jlsyachts.com',     'MASHA',         'Valeria',                        'Al Makhtoum Dubai Airport',                  'Boat Dubai Harbour',                    'Complete', 'DP991 | Sign On | Al Makhtoum Dubai Airport - Sign On Online - Boat'),
  -- Row 113 (ID=153)
  ('153', 'seaport_crew_change',   '7/24/2024', 'imran@jlsyachts.com',     'Galvas',        'Chief Ollie',                    '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 114 (ID=154)
  ('154', 'seaport_crew_change',   '7/24/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 115 (ID=155)
  ('155', 'departure_transport',   '7/24/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', 'Captain - Ocean Victory',        'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK2351 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 116 (ID=156)
  ('156', 'seaport_crew_change',   '7/24/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 117 (ID=157)
  ('157', 'seaport_crew_change',   '7/24/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 118 (ID=158)
  ('158', 'seaport_crew_change',   '7/24/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - Purser',                 '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 119 (ID=159)
  ('159', 'delivery_collection',   '7/25/2024', 'sathish@jlsyachts.com',   'TITAN',         'Titan Yacht',                    'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 120 (ID=160)
  ('160', 'delivery_collection',   '7/25/2024', 'sathish@jlsyachts.com',   'Sansara',       'Sansara Yacht',                  'Office JLS Yachts Silicon Dubai',            '',                                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 121 (ID=161)
  ('161', 'delivery_collection',   '7/25/2024', 'pramod@jlsyachts.com',    'Ocean Victory', 'Captain Ocean Victory',          'Office JLS Yachts Silicon Dubai',            'Boat Umm Suqeim on anchorage',          'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 122 (ID=162)
  ('162', 'seaport_crew_change',   '7/25/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 123 (ID=163)
  ('163', 'seaport_crew_change',   '7/25/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 124 (ID=164)
  ('164', 'seaport_crew_change',   '7/25/2024', 'imran@jlsyachts.com',     'GENESIS',       'Annie - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 125 (ID=165)
  ('165', 'delivery_collection',   '7/26/2024', 'pramod@jlsyachts.com',    'TITAN',         'Titan - Yacht',                  'Office JLS Yachts Silicon Dubai',            '',                                      'Complete', 'Collect parcels from office then deliver to yacht'),
  -- Row 126 (ID=166)
  ('166', 'seaport_crew_change',   '7/26/2024', 'imran@jlsyachts.com',     'TITAN',         'Gabby - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 127 (ID=167)
  ('167', 'arrival_transport',     '7/26/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', 'Ocean Victory - Captain',        'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'EK2154 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 128 (ID=168)
  ('168', 'departure_transport',   '7/26/2024', 'sharath@jlsyachts.com',   'Ocean Victory', 'Ocean Victory - Captain',        'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK2244 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 129 (ID=169)
  ('169', 'seaport_crew_change',   '7/26/2024', 'imran@jlsyachts.com',     'A',             'Andreea - Purser',               '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 130 (ID=170)
  ('170', 'seaport_crew_change',   '7/26/2024', 'imran@jlsyachts.com',     'GENESIS',       'Annie - Purser',                 '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 131 (ID=171)
  ('171', 'arrival_transport',     '7/26/2024', 'sharath@jlsyachts.com',   'Madame Gu',     'Captain Emmanuel',               'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK88 | Sign On | Dubai T3 - Sign On Online - Boat Port Rashid'),
  -- Row 132 (ID=172)
  ('172', 'departure_transport',   '7/26/2024', 'pramod@jlsyachts.com',    'OLMIDA',        'Captain Lukas Welmans',           'Boat D Marin Marsa Al Arab Marina',          'Sharjah International Airport',         'Complete', 'G9950 | Sign Off | Boat D Marin Marsa Al Arab Marina - Sign Off Online - Sharjah International Airport'),
  -- Row 133 (ID=173)
  ('173', 'crew_pickup',           '7/30/2024', 'ali.r@jlsyachts.com',     '',              'Captain Mike',                   'Captain Mike House Cedar Villas Silicon',    'Dubai T3',                              'Complete', 'EK0185 | Captain Mike House - Dubai T3'),
  -- Row 134 (ID=174)
  ('174', 'crew_pickup',           '8/11/2024', 'imran@jlsyachts.com',     '',              'Captain Mike',                   'Dubai T3',                                   'Captain Mike House Villa',              'Complete', 'EK0188 | Dubai T3 - Captain Mike House Villa'),
  -- Row 135 (ID=175)
  ('175', 'crew_pickup',           '8/11/2024', 'ali.r@jlsyachts.com',     '',              'Captain Mike',                   'Dubai T3',                                   'Captain Mike House Villa Silicon',      'Complete', 'EK0188 | Dubai T3 - Captain Mike House Villa Silicon'),
  -- Row 136 (ID=176)
  ('176', 'arrival_transport',     '8/12/2024', 'sharath@jlsyachts.com',   'GENESIS',       'Karen Tiggelaar',                'Dubai T3',                                   'Crowne Plaza Dubai Marina',             'Complete', 'EK146 | Dubai T3 - Crowne Plaza Dubai Marina (No need Sign On - not crew)'),
  -- Row 137 (ID=178)
  ('178', 'arrival_transport',     '8/20/2024', 'imran@jlsyachts.com',     '',              'Nicholas Wymer (Training Dept)', 'Dubai T3',                                   'Premier Inn Silicon Oasis',             'Complete', 'EK20 | Dubai T3 - Premier Inn Silicon Oasis'),
  -- Row 138 (ID=179)
  ('179', 'departure_transport',   '8/20/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Lee - Purser',                   'Boat Port Rashid',                           'Dubai T3',                              'Complete', 'EK127 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 139 (ID=180)
  ('180', 'arrival_transport',     '8/19/2024', 'pramod@jlsyachts.com',    'OLMIDA',        'Olmida - Captain',               'Dubai T2',                                   'Boat D-Marin Marsa Al Arab Marina',     'Complete', 'OV247 | Sign On | Dubai T2 - Sign On Online - Boat'),
  -- Row 140 (ID=181)
  ('181', 'arrival_transport',     '8/22/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'EK019 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 141 (ID=182)
  ('182', 'crew_pickup',           '8/28/2024', 'pramod@jlsyachts.com',    '',              'Captain Mike',                   'Captain Mike House Villa in Silicon Oasis',  'Dubai T2',                              'Complete', 'EK0161 | Captain Mike House Villa - Dubai T2'),
  -- Row 142 (ID=183)
  ('183', 'delivery_collection',   '8/29/2024', 'ali.r@jlsyachts.com',     'Galvas',        'Boat Galvas',                    'Boat Dubai Harbour',                         'Office JLS Yachts Silicon Oasis',       'Complete', 'Collect oil samples from yacht then bring to office for shipment'),
  -- Row 143 (ID=184)
  ('184', 'seaport_crew_change',   '8/29/2024', 'm.faisal@jlsyachts.com',  'TITAN',         'Purser - Gabby',                 '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 144 (ID=185)
  ('185', 'arrival_transport',     '9/16/2024', 'joel@jlsyachts.com',      'Madame Gu',     'Captain Nicholas',               'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Complete', 'EK28 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 145 (ID=186)
  ('186', 'crew_pickup',           '9/16/2024', 'joel@jlsyachts.com',      '',              'Keith',                          'Keith House in Silicon',                     'Dubai T3',                              'Complete', 'Keith Departure'),
  -- Row 146 (ID=187)
  ('187', 'departure_transport',   '9/16/2024', 'ali.r@jlsyachts.com',     'Ocean Victory', 'Captain Nicholas',               'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Complete', 'EK2012 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 147 (ID=188)
  ('188', 'departure_transport',   '9/16/2024', 'joel@jlsyachts.com',      'OLMIDA',        'Captain - Olmida',               'Villa 54 Alvorada 2 Arabian Ranches Dubai',  'Dubai T3',                              'Complete', 'FZ41 | Sign Off | Villa Alvorada - Sign Off Online - Dubai T3'),
  -- Row 148 (ID=189)
  ('189', 'arrival_transport',     '9/16/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   '',                                      'Complete', 'EK766 | Sign On | Dubai T3 - Sign On Online Only - Boat'),
  -- Row 149 (ID=190)
  ('190', 'departure_transport',   '9/17/2024', 'pramod@jlsyachts.com',    'Ocean Victory', 'Captain Nicholas',               'Boat Umm Suqeim on anchorage',               'Dubai T1',                              'Complete', 'PC741 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T1'),
  -- Row 150 (ID=191)
  ('191', 'seaport_crew_change',   '9/17/2024', 'm.faisal@jlsyachts.com',  'NAVETTA 42',    'Longelo Lusares',                '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 151 (ID=192)
  ('192', 'seaport_crew_change',   '9/17/2024', 'm.faisal@jlsyachts.com',  'NAVETTA 42',    'Longelo Lusares',                '',                                           '',                                      'Complete', 'Sign On | Sign On Online Only'),
  -- Row 152 (ID=193)
  ('193', 'shorebased',            '9/17/2024', 'ali.r@jlsyachts.com',     '',              'Ken',                            'Boat Port Rashid',                           '',                                      'Complete', 'Medical | Boat - Mediclinic City Hospital Oud Metha Dubai - Boat (14:30 appointment)'),
  -- Row 153 (ID=194)
  ('194', 'crew_pickup',           '9/19/2024', 'pramod@jlsyachts.com',    '',              'Captain Steve',                  'Dubai T3',                                   'Captain Steve Hotel Radisson Silicon',  'Complete', 'Dubai T3 - Captain Steve Hotel Radisson Silicon'),
  -- Row 154 (ID=195)
  ('195', 'arrival_transport',     '9/19/2024', 'ali.r@jlsyachts.com',     'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   'Boat Port Rashid',                      'Complete', 'SA7156 and EK182 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 155 (ID=196)
  ('196', 'seaport_crew_change',   '9/19/2024', 'm.faisal@jlsyachts.com',  'TITAN',         'Selina - Purser',                '',                                           '',                                      'Complete', 'Sign Off | Sign Off Online Only'),
  -- Row 156 (ID=201)
  ('201', 'departure_transport',   '11/25/2024', 'pramod@jlsyachts.com',   'TITAN',         'Purser Gabby',                   'Boat Dubai Harbour',                         'Dubai T3',                              'Start',    'EK185 | Sign Off | Boat Dubai Harbour - Sign Off Online - Dubai T3'),
  -- Row 157 (ID=205)
  ('205', 'crew_pickup',           '11/25/2024', 'sharath@jlsyachts.com',  '',              'Cherry',                         'Cherry''s house in Mankhool',                'Sofitel Downtown Dubai',                'Start',    'Mankhool - Sofitel Downtown Dubai'),
  -- Row 158 (ID=218)
  ('218', 'seaport_crew_change',   '11/25/2024', 'ali.r@jlsyachts.com',   'Voice',         'Alexander',                      '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 159 (ID=351)
  ('351', 'seaport_crew_change',   '11/25/2024', 'ali.r@jlsyachts.com',   'Voice',         'Alexander',                      '',                                           '',                                      'Start',    'Sign On Online Only'),
  -- Row 160 (ID=352)
  ('352', 'arrival_transport',     '11/25/2024', 'ali.r@jlsyachts.com',   'NIRVANA',       'Lee Purser',                     'Dubai T3',                                   'Boat Port Rashid',                      'Start',    'QR1006 | Dubai T3 - Sign On Online - Boat Port Rashid'),
  -- Row 161 (ID=353)
  ('353', 'departure_transport',   '11/25/2024', 'sharath@jlsyachts.com', 'TRIPLE SEVEN',  'Captain',                        'Boat Port Rashid Coastal Berth 11',          'Dubai T3',                              'Start',    'EK3 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 162 (ID=354)
  ('354', 'departure_transport',   '11/25/2024', 'taufeeq@jlsyachts.com', 'Ocean Victory', 'Captain Ocean Victory',          'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Start',    'KL428 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 163 (ID=355)
  ('355', 'arrival_transport',     '11/25/2024', 'taufeeq@jlsyachts.com', 'Ocean Victory', 'Captain',                        'Dubai T1',                                   'Boat Umm Suqeim on anchorage',          'Start',    'EK2245 | Sign On | Dubai T1 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 164 (ID=356)
  ('356', 'seaport_crew_change',   '11/26/2024', 'ali.r@jlsyachts.com',   'ULTRA G',       'Jack Irwin',                     '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 165 (ID=358)
  ('358', 'seaport_crew_change',   '11/27/2024', 'm.faisal@jlsyachts.com','MASHA',         'Faisal',                         '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 166 (ID=359)
  ('359', 'delivery_collection',   '11/27/2024', 'taufeeq@jlsyachts.com', 'Z',             'April',                          'JLS Warehouse in DIP',                       'Supplier in Jebel Ali',                 'Start',    'Collect fenders from JLS warehouse then deliver to supplier in Jebel Ali'),
  -- Row 167 (ID=360)
  ('360', 'arrival_transport',     '11/27/2024', 'ali.r@jlsyachts.com',   'TRIPLE SEVEN',  'Captain',                        'Dubai T3',                                   'Boat Port Rashid',                      'Start',    'EK124 | Sign On | Dubai T3 - Sign On Online - Boat'),
  -- Row 168 (ID=361)
  ('361', 'delivery_collection',   '11/27/2024', 'taufeeq@jlsyachts.com', 'TRIPLE SEVEN',  'Cris',                           'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Start',    'Collect simcard from office then deliver to yacht'),
  -- Row 169 (ID=362)
  ('362', 'seaport_crew_change',   '11/27/2024', 'sharath@jlsyachts.com', 'Galvas',        'Captain',                        '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 170 (ID=363)
  ('363', 'crew_pickup',           '11/27/2024', 'sathish@jlsyachts.com', '',              'Staff',                          'Burjuman metro Station',                     'Silicon Office',                        'Start',    'Burjuman metro - Silicon Office'),
  -- Row 171 (ID=364)
  ('364', 'shorebased',            '11/27/2024', 'ali.r@jlsyachts.com',   '',              'Purser',                         'Boat Port Rashid',                           '',                                      'Start',    'Medical | Boat Port Rashid - Mediclinic Hospital'),
  -- Row 172 (ID=365)
  ('365', 'shorebased',            '11/27/2024', 'ali.r@jlsyachts.com',   'AQUILA',        'Purser',                         'Boat Port Rashid',                           '',                                      'Start',    'Medical | Boat - Mediclinic Hospital - Boat (Test)'),
  -- Row 173 (ID=366)
  ('366', 'arrival_transport',     '11/27/2024', 'taufeeq@jlsyachts.com', 'Ocean Victory', 'Captain - Ocean Victory',        'Dubai T3',                                   'Boat Umm Suqeim on anchorage',          'Start',    'EK2245 | Sign On | Dubai T3 - Sign On Online - Boat Umm Suqeim on anchorage'),
  -- Row 174 (ID=367)
  ('367', 'arrival_transport',     '11/27/2024', 'pramod@jlsyachts.com',  'IDOL',          'Yacht - Idol',                   'Dubai T3',                                   'Boat Marsa Al Arab Marina',             'Start',    'EK369 | Sign On | Dubai T3 - Sign On Online - Boat Marsa Al Arab Marina'),
  -- Row 175 (ID=368)
  ('368', 'arrival_transport',     '11/27/2024', 'ali.r@jlsyachts.com',   'TRIPLE SEVEN',  'Yacht Triple Seven',             'Dubai T3',                                   'Boat Port Rashid',                      'Start',    'EK776 | Sign On | Dubai T3 - Sign On Online - Boat Port Rashid'),
  -- Row 176 (ID=369)
  ('369', 'seaport_crew_change',   '11/27/2024', 'sharath@jlsyachts.com', 'Galvas',        'Yacht - Galvas',                 '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 177 (ID=370)
  ('370', 'seaport_crew_change',   '11/27/2024', 'sharath@jlsyachts.com', 'Galvas',        'Yacht - Galvas',                 '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 178 (ID=371)
  ('371', 'seaport_crew_change',   '11/27/2024', 'ali.r@jlsyachts.com',   'Quantum Blue',  'Chief Ivan',                     '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 179 (ID=372)
  ('372', 'seaport_crew_change',   '11/27/2024', 'ali.r@jlsyachts.com',   'Quantum Blue',  'Chief Ivan',                     '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 180 (ID=373)
  ('373', 'seaport_crew_change',   '11/27/2024', 'pramod@jlsyachts.com',  'BURKUT',        'Chief Sinsina',                  '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 181 (ID=374)
  ('374', 'delivery_collection',   '11/27/2024', 'sathish@jlsyachts.com', 'PLVS VLTRA',    'Yacht - Plvs Vltra',             'Office JLS Yachts Silicon Dubai',            'Boat DMC Drydocks',                     'Start',    'Collect simcard from silicon office then deliver to yacht'),
  -- Row 182 (ID=375)
  ('375', 'departure_transport',   '11/28/2024', 'j.gonzaga@jlsyachts.com','IDOL',         'Chief Alex',                     'Boat D Marin Marsa Al Arab Marina',          'Dubai T3',                              'Start',    'Sign Off | Boat D Marin Marsa Al Arab Marina - Sign Off Online - Dubai T3'),
  -- Row 183 (ID=376)
  ('376', 'departure_transport',   '11/28/2024', 'pramod@jlsyachts.com',  'Ocean Victory', 'Captain - Ocean Victory',        'Boat Umm Suqeim on anchorage',               'Dubai T3',                              'Start',    'EK2244 | Sign Off | Boat Umm Suqeim on anchorage - Sign Off Online - Dubai T3'),
  -- Row 184 (ID=377)
  ('377', 'seaport_crew_change',   '11/28/2024', 'ali.r@jlsyachts.com',   'A',             'Andreea - Purser',               '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 185 (ID=378)
  ('378', 'departure_transport',   '11/28/2024', 'pramod@jlsyachts.com',  'TRIPLE SEVEN',  'Captain Wayne',                  'Boat Port Rashid',                           'Dubai T3',                              'Start',    'EK047 | Sign Off | Boat - Sign Off Online - Dubai T3'),
  -- Row 186 (ID=379)
  ('379', 'departure_transport',   '11/28/2024', 'j.gonzaga@jlsyachts.com','IDOL',         'Chief Alex',                     'Boat D Marin Marsa Al Arab Marina',          'Dubai T3',                              'Start',    'Sign Off | Boat D Marin Marsa Al Arab Marina - Sign Off Online - Dubai T3'),
  -- Row 187 (ID=380)
  ('380', 'delivery_collection',   '11/28/2024', 'joel@jlsyachts.com',    'PACIFIC X',     'Yacht Pacific',                  'Office JLS Yachts Silicon Dubai',            'Boat Yas Marina Abudhabi',              'Start',    'Collect parcels from office then deliver to yacht'),
  -- Row 188 (ID=381)
  ('381', 'arrival_transport',     '12/13/2024', 'pramod@jlsyachts.com',  'IDOL',          'Idol - Captain',                 'Dubai T3',                                   'Boat Marsa Al Arab Marina',             'Start',    'EK060 | Sign On | Dubai T3 - Sign On Online - Boat Marsa Al Arab Marina'),
  -- Row 189 (ID=382)
  ('382', 'arrival_transport',     '12/13/2024', 'sharath@jlsyachts.com', 'NORD',          'Nord - Hotel Manager Tom',        'Abudhabi International Airport',             'Boat Mina Zayed Abudhabi',              'Start',    'EY844 | Sign On | Abudhabi International Airport - Boat'),
  -- Row 190 (ID=383)
  ('383', 'crew_pickup',           '12/16/2024', 'ali.r@jlsyachts.com',   '',              'Astrid Engelbrecht',             'Premier Inn Dubai Silicon Oasis',            'Dubai T3',                              'Start',    'SA7159 | Premier Inn Dubai Silicon Oasis - Dubai T3'),
  -- Row 191 (ID=384)
  ('384', 'crew_pickup',           '12/16/2024', 'taufeeq@jlsyachts.com', '',              'JLS STAFF',                      'Burjuman Metro',                             'Office JLS Yachts Silicon Dubai',       'Start',    'Burjuman - Office JLS Yachts Silicon'),
  -- Row 192 (ID=385)
  ('385', 'crew_pickup',           '12/16/2024', 'j.gonzaga@jlsyachts.com','',             'JLS STAFF',                      'Business Bay Metro',                         'Office JLS Yachts Silicon Dubai',       'Start',    'Business Bay - Office JLS Yachts Silicon'),
  -- Row 193 (ID=386)
  ('386', 'seaport_crew_change',   '12/16/2024', 'ali.r@jlsyachts.com',   'Quantum Blue',  'Chief Ivan Skracic',             '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 194 (ID=387)
  ('387', 'seaport_crew_change',   '12/16/2024', 'ali.r@jlsyachts.com',   'Galvas',        'Chief Richard Dinham',           '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 195 (ID=388)
  ('388', 'crew_pickup',           '12/17/2024', 'j.gonzaga@jlsyachts.com','',             'Captain Mike and Ms. Hilary',    'Office Silicon',                             'Al Tamimi DIFC',                        'Start',    'Office Silicon - Al Tamimi DIFC - Office Silicon'),
  -- Row 196 (ID=389)
  ('389', 'crew_pickup',           '12/19/2024', 'sharath@jlsyachts.com', '',              'Christine Havinga',              'Radisson Blu Hotel Silicon',                 'Dubai T1',                              'Start',    'SV0589 | Radisson Blu Hotel Silicon - Dubai T1'),
  -- Row 197 (ID=390)
  ('390', 'crew_pickup',           '12/20/2024', 'ali.r@jlsyachts.com',   '',              'Captain Mike',                   'Captain Mike Cedre Villa',                   'Dubai T3',                              'Start',    'FZ1787 | Captain Mike Cedre Villa - Dubai T3'),
  -- Row 198 (ID=391)
  ('391', 'crew_pickup',           '12/20/2024', 'ali.r@jlsyachts.com',   '',              'Captain Mike',                   'Captain Mike House Cedre Villas Silicon',    'Dubai T3',                              'Start',    'FZ1787 | Captain Mike House Cedre Villas Silicon - Dubai T3'),
  -- Row 199 (ID=392)
  ('392', 'arrival_transport',     '2/4/2025',  'ali.r@jlsyachts.com',    'NIRVANA',       'Lee - Purser',                   'Dubai T3',                                   'Boat Port Rashid',                      'Start',    'EK126 | Sign On | Dubai T3 - Sign On Online - Boat Port Rashid'),
  -- Row 200 (ID=393)
  ('393', 'departure_transport',   '2/4/2025',  'ali.r@jlsyachts.com',    'NIRVANA',       'Lee - Purser',                   'Boat Port Rashid',                           'Dubai T3',                              'Start',    'EK163 | Sign Off | Boat Port Rashid - Sign Off Online - Dubai T3'),
  -- Row 201 (ID=394)
  ('394', 'delivery_collection',   '2/4/2025',  'joel@jlsyachts.com',     'Vector',        'Vector',                         'Boat Yas Marina Abudhabi',                   'Sharjah',                               'Start',    'Pickup 6 panels from yacht then deliver to Sharjah'),
  -- Row 202 (ID=395)
  ('395', 'seaport_crew_change',   '2/4/2025',  'sharath@jlsyachts.com',  'BURKUT',        'Chief Engin',                    '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 203 (ID=396)
  ('396', 'seaport_crew_change',   '2/4/2025',  'ali.r@jlsyachts.com',    'Indigo Star',   'Chief Ollie',                    '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 204 (ID=397)
  ('397', 'seaport_crew_change',   '2/4/2025',  'sharath@jlsyachts.com',  'Galvas',        'Chief Ollie',                    '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 205 (ID=398)
  ('398', 'seaport_crew_change',   '2/4/2025',  'sharath@jlsyachts.com',  'AHS',           'AHS',                            '',                                           '',                                      'Start',    'Sign On | Sign On Online Only'),
  -- Row 206 (ID=399)
  ('399', 'seaport_crew_change',   '2/4/2025',  'sharath@jlsyachts.com',  'BURKUT',        'Chief Engin Saygili',            '',                                           '',                                      'Start',    'Sign Off | Sign Off Online Only'),
  -- Row 207 (ID=400)
  ('400', 'seaport_crew_change',   '2/4/2025',  'sharath@jlsyachts.com',  'Voice',         'Voice',                          '',                                           '',                                      'Start',    'Sign On Online Only'),
  -- Row 208 (ID=401)
  ('401', 'delivery_collection',   '2/4/2025',  'taufeeq@jlsyachts.com',  'TRIPLE SEVEN',  'Triple 7',                       'Office JLS Yachts Silicon Dubai',            'Boat Port Rashid',                      'Start',    'Collect parcel from office then deliver to yacht')
)
SELECT
  t.ext_id,
  t.trip_type,
  to_timestamp(t.dt, 'MM/DD/YYYY')::timestamptz,
  (SELECT id FROM public.crew_drivers WHERE email = NULLIF(t.driver_email, '') LIMIT 1),
  CASE WHEN t.yacht_name = '' THEN NULL
       ELSE (SELECT id FROM public.yachts WHERE vessel_name ILIKE t.yacht_name LIMIT 1)
  END,
  NULLIF(t.req_by, ''),
  NULLIF(t.pickup, ''),
  NULLIF(t.dropoff, ''),
  CASE t.csv_status WHEN 'Complete' THEN 'completed' WHEN 'Start' THEN 'in_progress' ELSE 'pending' END,
  NULLIF(t.notes, ''),
  CASE t.trip_type WHEN 'seaport_crew_change' THEN 'not_billable' ELSE 'pending_review' END
FROM trip_data t
ON CONFLICT (external_id) DO NOTHING;
