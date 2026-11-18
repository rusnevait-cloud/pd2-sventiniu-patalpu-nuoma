// Savininko erdvių CRUD
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/common');
const router = express.Router();

router.use(requireRole('owner', 'admin')); // autentifikavimas + rolės patikra
router.use((req, res, next) => { res.locals.backUrl = req.user.role === 'admin' ? '/admin/venues' : '/owner/venues'; next(); });

const TR = { ą:'a', č:'c', ę:'e', ė:'e', į:'i', š:'s', ų:'u', ū:'u', ž:'z' };
function slugify(s) {
  return s.toLowerCase().replace(/[ąčęėįšųūž]/g, (c) => TR[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'erdve';
}
function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base, i = 2;
  while (db.prepare('SELECT 1 FROM venues WHERE slug = ?').get(slug)) slug = `${base}-${i++}`;
  return slug;
}

const lookups = () => ({
  categories: db.prepare('SELECT id, name FROM categories ORDER BY name').all(),
  amenities: db.prepare('SELECT id, name FROM amenities ORDER BY name').all()
});

// Serverio pusės validacija; grąžina { errors, clean }
function validate(body) {
  const errors = {};
  const v = {
    name: String(body.name || '').trim(),
    city: String(body.city || '').trim(),
    description: String(body.description || '').trim(),
    capacity: String(body.capacity || '').trim(),
    price: String(body.price || '').trim().replace(',', '.'),
    category_id: String(body.category_id || ''),
    amenities: [].concat(body.amenities || []).map(String)
  };

  if (v.name.length < 3 || v.name.length > 120) errors.name = 'Pavadinimas turi būti 3–120 simbolių.';
  if (v.city.length < 2 || v.city.length > 60) errors.city = 'Miestas turi būti 2–60 simbolių.';
  if (v.description.length > 2000) errors.description = 'Aprašymas negali viršyti 2000 simbolių.';
  if (!/^\d{1,5}$/.test(v.capacity) || +v.capacity < 1 || +v.capacity > 10000) errors.capacity = 'Talpa: sveikas skaičius nuo 1 iki 10000.';
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(v.price) || +v.price > 10000) errors.price = 'Kaina: skaičius nuo 0 iki 10000 (iki 2 skaitmenų po kablelio).';
  if (!/^\d+$/.test(v.category_id) || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(v.category_id)) errors.category_id = 'Pasirinkite kategoriją iš sąrašo.';
  const ids = [...new Set(v.amenities)];
  if (!ids.every((id) => /^\d+$/.test(id) && db.prepare('SELECT 1 FROM amenities WHERE id = ?').get(id))) errors.amenities = 'Pasirinktas neegzistuojantis patogumas.';

  return { errors, values: v, amenityIds: ids.map(Number) };
}

// Savininko taisyklė: erdvė turi egzistuoti IR priklausyti prisijungusiam naudotojui
function loadOwnVenue(req, res, next) {
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) { const e = new Error('Erdvė nerasta.'); e.status = 404; return next(e); }
  if (req.user.role !== 'admin' && venue.owner_id !== req.user.id) { const e = new Error('Tai ne jūsų erdvė.'); e.status = 403; e.expose = true; return next(e); }
  req.venue = venue;
  next();
}

// READ 
router.get('/', (req, res) => {
  const venues = db.prepare(`
    SELECT v.id, v.name, v.city, v.capacity, v.price_per_hour_cents, v.is_published, c.name AS category_name,
           (SELECT COUNT(*) FROM bookings b WHERE b.venue_id = v.id) AS booking_count
      FROM venues v JOIN categories c ON c.id = v.category_id
     WHERE v.owner_id = ? ORDER BY v.name`).all(req.user.id);
  res.render('owner/venues', { title: 'Mano erdvės', venues });
});

// CREATE
router.get('/new', (req, res) => {
  res.render('owner/venue-form', {
    title: 'Nauja erdvė', action: '/owner/venues', errors: {}, ...lookups(),
    values: { name: '', city: '', description: '', capacity: '', price: '', category_id: '', amenities: [] }
  });
});

router.post('/', (req, res) => {
  const { errors, values, amenityIds } = validate(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).render('owner/venue-form', { title: 'Nauja erdvė', action: '/owner/venues', errors, values, ...lookups() });
  }
  const cents = Math.round(parseFloat(values.price) * 100);
  const create = db.transaction(() => {
    const info = db.prepare(`INSERT INTO venues (owner_id, category_id, name, slug, description, city, capacity, price_per_hour_cents, is_published)
                             VALUES (?,?,?,?,?,?,?,?,0)`) // nauja erdvė laukia administratoriaus patvirtinimo
      .run(req.user.id, +values.category_id, values.name, uniqueSlug(values.name), values.description || null, values.city, +values.capacity, cents);
    const link = db.prepare('INSERT INTO venue_amenities (venue_id, amenity_id) VALUES (?,?)');
    amenityIds.forEach((a) => link.run(info.lastInsertRowid, a));
  });
  create();
  req.session.flash = { type: 'ok', text: 'Erdvė sukurta. Ji bus matoma kataloge po administratoriaus patvirtinimo.' };
  res.redirect(res.locals.backUrl); // PRG
});

// UPDATE
router.get('/:id(\\d+)/edit', loadOwnVenue, (req, res) => {
  const v = req.venue;
  res.render('owner/venue-form', {
    title: 'Redaguoti erdvę', action: `/owner/venues/${v.id}`, errors: {}, ...lookups(),
    values: {
      name: v.name, city: v.city, description: v.description || '', capacity: String(v.capacity),
      price: (v.price_per_hour_cents / 100).toFixed(2), category_id: String(v.category_id),
      amenities: db.prepare('SELECT amenity_id FROM venue_amenities WHERE venue_id = ?').all(v.id).map((r) => String(r.amenity_id))
    }
  });
});

router.post('/:id(\\d+)', loadOwnVenue, (req, res) => {
  const { errors, values, amenityIds } = validate(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).render('owner/venue-form', { title: 'Redaguoti erdvę', action: `/owner/venues/${req.venue.id}`, errors, values, ...lookups() });
  }
  const cents = Math.round(parseFloat(values.price) * 100);
  db.transaction(() => {
    db.prepare(`UPDATE venues SET category_id=?, name=?, description=?, city=?, capacity=?, price_per_hour_cents=? WHERE id=? AND owner_id=?`)
      .run(+values.category_id, values.name, values.description || null, values.city, +values.capacity, cents, req.venue.id, req.venue.owner_id);
    db.prepare('DELETE FROM venue_amenities WHERE venue_id = ?').run(req.venue.id);
    const link = db.prepare('INSERT INTO venue_amenities (venue_id, amenity_id) VALUES (?,?)');
    amenityIds.forEach((a) => link.run(req.venue.id, a));
  })();
  req.session.flash = { type: 'ok', text: 'Erdvės duomenys atnaujinti.' };
  res.redirect(res.locals.backUrl); // PRG
});

// DELETE
router.get('/:id(\\d+)/delete', loadOwnVenue, (req, res) => {
  const bookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE venue_id = ?').get(req.venue.id).n;
  res.render('owner/venue-delete', { title: 'Šalinti erdvę', venue: req.venue, bookings });
});

router.post('/:id(\\d+)/delete', loadOwnVenue, (req, res) => {
  if (req.body.confirm !== 'yes') {
    req.session.flash = { type: 'error', text: 'Šalinimas nepatvirtintas.' };
    return res.redirect(`/owner/venues/${req.venue.id}/delete`);
  }

  const n = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE venue_id = ?').get(req.venue.id).n;
  if (n > 0) {
    req.session.flash = { type: 'error', text: `Erdvės pašalinti negalima: ji turi ${n} rezervacij(ų). Galite ją paslėpti arba redaguoti.` };
    return res.redirect(res.locals.backUrl);
  }
  db.prepare('DELETE FROM venues WHERE id = ? AND owner_id = ?').run(req.venue.id, req.venue.owner_id);
  req.session.flash = { type: 'ok', text: `Erdvė „${req.venue.name}“ pašalinta.` };
  res.redirect(res.locals.backUrl);
});

module.exports = router;
