
// Visų seed naudotojų slaptažodis: Slaptazodis123!
const bcrypt = require('bcryptjs');
const db = require('./index');

if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('Duomenų bazėje jau yra duomenų. Naudokite "npm run reset", jei norite pradėti iš naujo.');
  process.exit(0);
}

const hash = bcrypt.hashSync('Slaptazodis123!', 12);
const cents = (eur) => Math.round(eur * 100);

const run = db.transaction(() => {
  const u = db.prepare('INSERT INTO users (id, full_name, email, password_hash, role, phone, is_active) VALUES (?,?,?,?,?,?,?)');
  u.run(1, 'Admin test',       'admin@venue.lt',    hash, 'admin',    '+37060000001', 1);
  u.run(2, 'Rasa Kazlauskienė', 'owner@venue.lt',    hash, 'owner',    '+37060000002', 1);
  u.run(3, 'Tomas Petrauskas',  'tomas@venue.lt',        hash, 'owner',    '+37060000003', 1);
  u.run(4, 'Jonas Jonaitis',    'customer@venue.lt', hash, 'customer', '+37060000004', 1);
  u.run(5, 'Ieva Stankutė',     'ieva@venue.lt',        hash, 'customer', '+37060000005', 1);
  u.run(6, 'Mantas Vaitkus',    'mantas@venue.lt',      hash, 'customer', '+37060000006', 1);

  const c = db.prepare('INSERT INTO categories (id, name, description) VALUES (?,?,?)');
  c.run(1, 'Vestuvės',       'Salės ir dvarai vestuvėms');
  c.run(2, 'Konferencijos',  'Konferencijų centrai ir susitikimų salės');
  c.run(3, 'Gimtadieniai',   'Mažesnės erdvės privatiems renginiams');
  c.run(4, 'Koncertai',      'Klubai ir scenos su garso įranga');

  const a = db.prepare('INSERT INTO amenities (id, name, icon) VALUES (?,?,?)');
  [[1,'Wi-Fi','wifi'],[2,'Parkavimas','car'],[3,'Virtuvė','utensils'],
   [4,'Scena','mic'],[5,'Garso sistema','speaker'],[6,'Projektorius','projector']].forEach(r => a.run(...r));

  const v = db.prepare(`INSERT INTO venues (id, owner_id, category_id, name, slug, city, capacity, price_per_hour_cents, is_published, description)
                        VALUES (?,?,?,?,?,?,?,?,1,?)`);
  v.run(1, 2, 1, 'Rotušės salė',                  'rotuses-sale',                'Kaunas',   150, cents(90),  'Erdvi salė vestuvėms ir šventėms senamiestyje.');
  v.run(2, 2, 3, 'Nemuno terasa',                 'nemuno-terasa',               'Kaunas',   60,  cents(55),  'Terasa prie Nemuno privatiems renginiams.');
  v.run(3, 3, 2, 'Konferencijų centras „Aušra“',  'konferenciju-centras-ausra',  'Vilnius',  200, cents(120), 'Modernus konferencijų centras.');
  v.run(4, 3, 4, 'Klubas „Garsas“',               'klubas-garsas',               'Vilnius',  300, cents(150), 'Klubas su scena ir profesionalia garso įranga.');
  v.run(5, 3, 3, 'Kiemelis „Žolė“',               'kiemelis-zole',               'Klaipėda', 40,  cents(45),  'Jaukus kiemelis gimtadieniams.');
  v.run(6, 2, 1, 'Dvaro svetainė „Pažaislis“',    'dvaro-svetaine-pazaislis',    'Kaunas',   100, cents(110), 'Dvaro svetainė vestuvėms.');

  const va = db.prepare('INSERT INTO venue_amenities (venue_id, amenity_id) VALUES (?,?)');
  [[1,1],[1,2],[1,3],[2,1],[2,3]].forEach(r => va.run(...r));

  const img = db.prepare('INSERT INTO venue_images (venue_id, file_path, alt_text, is_main) VALUES (?,?,?,?)');
  img.run(1, '/seed-images/rotuses-sale.jpg',   'Rotušės salė paruošta vestuvėms', 1);
  img.run(1, '/seed-images/rotuses-sale-2.jpg', 'Salės scena ir stalai', 0);
  img.run(2, '/seed-images/nemuno-terasa.jpg',  'Terasa prie Nemuno', 1);
  img.run(3, '/seed-images/ausra.jpg',          'Konferencijų salė', 1);
  img.run(4, '/seed-images/garsas.jpg',         'Klubo scena', 1);

  // total = valandos * kaina + 5 % aptarnavimo mokestis
  const b = db.prepare(`INSERT INTO bookings (id, venue_id, customer_id, start_time, end_time, guests,
                         price_snapshot_cents, service_fee_cents, total_price_cents, status) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  b.run(1, 1, 4, '2026-12-05 14:00', '2026-12-05 18:00', 80,  9000,  1800, 37800,  'pending');
  b.run(2, 3, 5, '2026-11-20 09:00', '2026-11-20 17:00', 120, 12000, 4800, 100800, 'confirmed');
  b.run(3, 5, 6, '2026-09-10 15:00', '2026-09-10 20:00', 30,  4500,  1125, 23625,  'completed');
  b.run(4, 2, 4, '2026-08-15 18:00', '2026-08-15 23:00', 50,  5500,  1375, 28875,  'completed');
  b.run(5, 6, 4, '2026-07-01 12:00', '2026-07-01 16:00', 70,  11000, 2200, 46200,  'completed');

  const bl = db.prepare('INSERT INTO availability_blocks (venue_id, start_time, end_time, reason) VALUES (?,?,?,?)');
  bl.run(1, '2026-12-12 00:00', '2026-12-14 00:00', 'Remontas');
  bl.run(6, '2026-11-24 08:00', '2026-11-24 18:00', 'Privatus renginys');

  const r = db.prepare('INSERT INTO reviews (booking_id, venue_id, customer_id, rating, comment, is_hidden) VALUES (?,?,?,?,?,?)');
  r.run(3, 5, 6, 5, 'Jauku, tvarkinga, puikus šeimininkas.', 0);
  r.run(4, 2, 4, 4, 'Graži terasa, tik trūko daugiau šviesos vakare.', 1);
  r.run(5, 6, 4, 5, 'Nuostabi vieta vestuvėms, viskas pavyko.', 0);
});

run();
console.log('. Prisijungimai (slaptažodis Slaptazodis123!): admin@venuebook.lt, owner@venuebook.lt, customer@venuebook.lt');
