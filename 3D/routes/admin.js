// Administratorius (support): naudotojai, visos erdvės, erdvių patvirtinimas
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/common');
const router = express.Router();

router.use(requireRole('admin'));

const count = (sql) => db.prepare(sql).get().n;

router.get('/', (req, res) => {
  res.render('admin/index', {
    title: 'Administravimas',
    stats: {
      users: count('SELECT COUNT(*) AS n FROM users'),
      venues: count('SELECT COUNT(*) AS n FROM venues'),
      pending: count('SELECT COUNT(*) AS n FROM venues WHERE is_published = 0'),
      bookings: count('SELECT COUNT(*) AS n FROM bookings')
    }
  });
});

// ---------- Naudotojai ----------
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.created_at,
           (SELECT COUNT(*) FROM venues   WHERE owner_id    = u.id) AS venue_count,
           (SELECT COUNT(*) FROM bookings WHERE customer_id = u.id) AS booking_count
      FROM users u ORDER BY u.id`).all();
  res.render('admin/users', { title: 'Naudotojai', users });
});

function loadUser(req, res, next) {
  const u = db.prepare('SELECT id, full_name, email, role, is_active FROM users WHERE id = ?').get(req.params.id);
  if (!u) { const e = new Error('Naudotojas nerastas.'); e.status = 404; return next(e); }
  req.target = u;
  next();
}

router.post('/users/:id(\\d+)/toggle-active', loadUser, (req, res) => {
  if (req.target.id === req.user.id) {
    req.session.flash = { type: 'error', text: 'Savo paskyros deaktyvuoti negalima.' };
    return res.redirect('/admin/users');
  }
  db.prepare('UPDATE users SET is_active = 1 - is_active WHERE id = ?').run(req.target.id);
  req.session.flash = { type: 'ok', text: `Naudotojo ${req.target.email} paskyra ${req.target.is_active ? 'deaktyvuota' : 'aktyvuota'}.` };
  res.redirect('/admin/users');
});

router.get('/users/:id(\\d+)/delete', loadUser, (req, res) => {
  res.render('admin/user-delete', {
    title: 'Šalinti naudotoją',
    target: req.target,
    venues: db.prepare('SELECT COUNT(*) AS n FROM venues WHERE owner_id = ?').get(req.target.id).n,
    bookings: db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE customer_id = ?').get(req.target.id).n
  });
});

router.post('/users/:id(\\d+)/delete', loadUser, (req, res) => {
  if (req.body.confirm !== 'yes') {
    req.session.flash = { type: 'error', text: 'Šalinimas nepatvirtintas.' };
    return res.redirect('/admin/users');
  }
  if (req.target.id === req.user.id) {
    req.session.flash = { type: 'error', text: 'Savo paskyros pašalinti negalima.' };
    return res.redirect('/admin/users');
  }
  // Nuorodų vientisumas: naudotojai, turintys erdvių ar rezervacijų, nešalinami (RESTRICT) – siūloma deaktyvuoti.
  const venues = db.prepare('SELECT COUNT(*) AS n FROM venues WHERE owner_id = ?').get(req.target.id).n;
  const bookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE customer_id = ?').get(req.target.id).n;
  if (venues > 0 || bookings > 0) {
    req.session.flash = { type: 'error', text: `Naudotojo pašalinti negalima: turi ${venues} erdvių ir ${bookings} rezervacijų. Vietoje to deaktyvuokite paskyrą.` };
    return res.redirect('/admin/users');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.target.id);
  req.session.flash = { type: 'ok', text: `Naudotojas ${req.target.email} pašalintas.` };
  res.redirect('/admin/users');
});

// Visos erdvės + patvirtinimas
router.get('/venues', (req, res) => {
  const venues = db.prepare(`
    SELECT v.id, v.name, v.city, v.is_published, c.name AS category_name, u.full_name AS owner_name,
           (SELECT COUNT(*) FROM bookings b WHERE b.venue_id = v.id) AS booking_count
      FROM venues v JOIN categories c ON c.id = v.category_id JOIN users u ON u.id = v.owner_id
     ORDER BY v.is_published, v.name`).all(); // nepatvirtintos – viršuje
  res.render('admin/venues', { title: 'Visos erdvės', venues });
});

router.post('/venues/:id(\\d+)/publish', (req, res, next) => {
  const v = db.prepare('SELECT id, name, is_published FROM venues WHERE id = ?').get(req.params.id);
  if (!v) { const e = new Error('Erdvė nerasta.'); e.status = 404; return next(e); }
  const next_state = req.body.publish === '1' ? 1 : 0;
  db.prepare('UPDATE venues SET is_published = ? WHERE id = ?').run(next_state, v.id);
  req.session.flash = { type: 'ok', text: `Erdvė „${v.name}“ ${next_state ? 'patvirtinta ir matoma kataloge' : 'paslėpta nuo katalogo'}.` };
  res.redirect('/admin/venues');
});

module.exports = router;
