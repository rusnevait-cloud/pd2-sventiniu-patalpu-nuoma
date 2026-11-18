const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
require('./db'); // inicializuoja schemą

const { locals, csrfProtection } = require('./middleware/common');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1);

app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

let secret = process.env.SESSION_SECRET;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[įspėjimas] SESSION_SECRET nenustatytas – sugeneruotas laikinas (sesijos dings po perkrovimo).');
}

app.use(session({
  name: 'vb.sid',
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                 // JS negali pasiekti slapuko
    sameSite: 'lax',                // papildoma apsauga nuo CSRF
    secure: isProd,                 // produkcijoje – tik per HTTPS
    maxAge: 1000 * 60 * 60 * 2      // 2 val.
  }
}));


app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`));
  next();
});

app.use(locals);
app.use(csrfProtection);

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/venues'));
app.use('/owner/venues', require('./routes/owner'));
app.use('/admin', require('./routes/admin'));

app.use((req, res, next) => {
  const e = new Error('Puslapis nerastas.');
  e.status = 404;
  next(e);
});


app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(`[klaida] ${req.method} ${req.path}:`, err.stack || err.message);
  const messages = { 400: 'Neteisinga užklausa.', 403: 'Neturite teisės pasiekti šio puslapio.', 404: 'Puslapis nerastas.' };
  res.status(status).render('error', {
    title: `Klaida ${status}`,
    status,
    message: status >= 500 ? 'Įvyko serverio klaida. Bandykite vėliau.' : (err.expose ? err.message : messages[status] || 'Klaida.')
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VenueBook veikia: http://localhost:${port}`));
