// Vieša dalis: pradžia, erdvių katalogas su kombinuotu filtru, erdvės detalės
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('home', { title: 'VenueBook' });
});

const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => '\\' + m);

router.get('/venues', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const city = String(req.query.city || '').trim().slice(0, 60);
  const category = /^\d+$/.test(req.query.category || '') ? Number(req.query.category) : null;
  const minCap = /^\d{1,5}$/.test(req.query.min_capacity || '') ? Number(req.query.min_capacity) : null;

  const where = ['v.is_published = 1'];
  const params = [];
  if (q)        { where.push("v.name LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q)}%`); }
  if (city)     { where.push('v.city = ?');                params.push(city); }
  if (category) { where.push('v.category_id = ?');          params.push(category); }
  if (minCap)   { where.push('v.capacity >= ?');            params.push(minCap); }

  
  const venues = db.prepare(`
    SELECT v.id, v.name, v.city, v.capacity, v.price_per_hour_cents,
           c.name AS category_name, r.avg_rating, COALESCE(r.review_count, 0) AS review_count
      FROM venues v
      JOIN categories c ON c.id = v.category_id
      LEFT JOIN (SELECT venue_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                   FROM reviews WHERE is_hidden = 0 GROUP BY venue_id) r ON r.venue_id = v.id
     WHERE ${where.join(' AND ')}
     ORDER BY v.name`).all(...params);

  res.render('venues', {
    title: 'Erdvės',
    venues,
    categories: db.prepare('SELECT id, name FROM categories ORDER BY name').all(),
    cities: db.prepare('SELECT DISTINCT city FROM venues WHERE is_published = 1 ORDER BY city').all().map((r) => r.city),
    filters: { q, city, category: category || '', min_capacity: minCap || '' }
  });
});

router.get('/venues/:id(\\d+)', (req, res, next) => {
  const venue = db.prepare(`
    SELECT v.*, c.name AS category_name, u.full_name AS owner_name
      FROM venues v JOIN categories c ON c.id = v.category_id JOIN users u ON u.id = v.owner_id
     WHERE v.id = ?`).get(req.params.id);

  // Nepublikuotą erdvę mato tik jos savininkas
  const me = req.session.user;
  if (!venue || (!venue.is_published && !(me && me.id === venue.owner_id))) {
    const e = new Error('Erdvė nerasta.'); e.status = 404; return next(e);
  }

  res.render('venue-detail', {
    title: venue.name,
    venue,
    amenities: db.prepare('SELECT a.name FROM amenities a JOIN venue_amenities va ON va.amenity_id = a.id WHERE va.venue_id = ? ORDER BY a.name').all(venue.id),
    reviews: db.prepare(`SELECT r.rating, r.comment, u.full_name FROM reviews r JOIN users u ON u.id = r.customer_id
                          WHERE r.venue_id = ? AND r.is_hidden = 0 ORDER BY r.created_at DESC`).all(venue.id)
  });
});

module.exports = router;
