const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ]{6,20}$/;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

router.get('/register', (req, res) => {
  res.render('register', { title: 'Registracija', errors: {}, values: {} });
});

router.post('/register', async (req, res, next) => {
  try {
    const values = {
      full_name: String(req.body.full_name || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      phone: String(req.body.phone || '').trim(),
      role: String(req.body.role || 'customer')
    };
    const password = String(req.body.password || '');
    const confirm = String(req.body.password_confirm || '');
    const errors = {};

    if (values.full_name.length < 2 || values.full_name.length > 100) errors.full_name = 'Vardas turi būti 2–100 simbolių.';
    if (!EMAIL_RE.test(values.email) || values.email.length > 254) errors.email = 'Įveskite teisingą el. pašto adresą.';
    if (values.phone && !PHONE_RE.test(values.phone)) errors.phone = 'Telefonas: 6–20 skaitmenų, galimas + ir tarpai.';
    if (!['customer', 'owner'].includes(values.role)) errors.role = 'Pasirinkite rolę iš sąrašo.'; // admin per formą sukurti NEGALIMA
    if (password.length < 10 || password.length > 128) errors.password = 'Slaptažodis turi būti 10–128 simbolių.';
    if (password !== confirm) errors.password_confirm = 'Slaptažodžiai nesutampa.';
    if (!errors.email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(values.email)) {
      errors.email = 'Šis el. paštas jau užregistruotas.';
    }

    if (Object.keys(errors).length) {
      return res.status(400).render('register', { title: 'Registracija', errors, values });
    }

    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (full_name, email, password_hash, role, phone) VALUES (?,?,?,?,?)')
      .run(values.full_name, values.email, hash, values.role, values.phone || null);

    req.session.flash = { type: 'ok', text: 'Registracija sėkminga. Dabar galite prisijungti.' };
    res.redirect('/login'); // PRG
  } catch (err) {
    next(err);
  }
});

router.get('/login', (req, res) => {
  res.render('login', { title: 'Prisijungimas', error: null, email: '' });
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = ?').get(email);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !ok || !user.is_active) {
      return res.status(401).render('login', { title: 'Prisijungimas', error: 'Neteisingas el. paštas arba slaptažodis.', email });
    }

    // Naujas sesijos ID po prisijungimo (apsauga nuo session fixation)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, name: user.full_name, role: user.role };
      req.session.flash = { type: 'ok', text: `Sveiki, ${user.full_name}!` };
      res.redirect(user.role === 'owner' ? '/owner/venues' : user.role === 'admin' ? '/admin' : '/');
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('vb.sid');
    res.redirect('/');
  });
});

module.exports = router;
