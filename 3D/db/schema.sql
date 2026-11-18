

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL CHECK (length(full_name) BETWEEN 2 AND 100),
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) <= 254),
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','owner','customer')),
  phone         TEXT    CHECK (phone IS NULL OR length(phone) <= 20),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS amenities (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  icon TEXT
);

-- 1 : N  (users -> venues), (categories -> venues)
CREATE TABLE IF NOT EXISTS venues (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id             INTEGER NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
  category_id          INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name                 TEXT    NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  slug                 TEXT    NOT NULL UNIQUE,
  description          TEXT    CHECK (description IS NULL OR length(description) <= 2000),
  city                 TEXT    NOT NULL CHECK (length(city) BETWEEN 2 AND 60),
  capacity             INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
  price_per_hour_cents INTEGER NOT NULL CHECK (price_per_hour_cents >= 0),
  is_published         INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- M : N  (venues <-> amenities)
CREATE TABLE IF NOT EXISTS venue_amenities (
  venue_id   INTEGER NOT NULL REFERENCES venues(id)    ON DELETE CASCADE,
  amenity_id INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS venue_images (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id  INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  file_path TEXT    NOT NULL,
  alt_text  TEXT,
  is_main   INTEGER NOT NULL DEFAULT 0 CHECK (is_main IN (0,1))
);


CREATE TABLE IF NOT EXISTS bookings (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id             INTEGER NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  customer_id          INTEGER NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  start_time           TEXT    NOT NULL,
  end_time             TEXT    NOT NULL,
  guests               INTEGER NOT NULL CHECK (guests >= 1),
  price_snapshot_cents INTEGER NOT NULL CHECK (price_snapshot_cents >= 0),
  service_fee_cents    INTEGER NOT NULL CHECK (service_fee_cents >= 0),
  total_price_cents    INTEGER NOT NULL CHECK (total_price_cents >= 0),
  status               TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','confirmed','rejected','cancelled','completed')),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id   INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  start_time TEXT    NOT NULL,
  end_time   TEXT    NOT NULL,
  reason     TEXT,
  CHECK (end_time > start_time)
);


CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  venue_id    INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT    CHECK (comment IS NULL OR length(comment) <= 1000),
  is_hidden   INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venues_owner     ON venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_venues_city      ON venues(city);
CREATE INDEX IF NOT EXISTS idx_bookings_venue   ON bookings(venue_id, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_cust    ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_venue    ON reviews(venue_id);
