const crypto = require('crypto');
const db = require('../db');

const eur = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

// Bendri kintamieji šablonams + vienkartiniai (flash) pranešimai
function locals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.eur = eur;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

// CSRF: kiekvienai sesijai atsitiktinis žetonas, tikrinamas visose ne-GET užklausose
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const real = Buffer.from(req.session.csrfToken);
  if (sent.length !== real.length || !crypto.timingSafeEqual(sent, real)) {
    const e = new Error('Neteisingas arba pasibaigęs CSRF žetonas. Atnaujinkite puslapį ir bandykite dar kartą.');
    e.status = 403;
    e.expose = true;
    return next(e);
  }
  next();
}

function requireLogin(req, res, next) {
  const sess = req.session.user;
  const row = sess && db.prepare('SELECT id, full_name, role, is_active FROM users WHERE id = ?').get(sess.id);
  if (!row || !row.is_active) {
    return req.session.regenerate(() => {
      req.session.flash = { type: 'error', text: 'Norėdami tęsti, prisijunkite.' };
      res.redirect('/login');
    });
  }
  req.user = row;
  next();
}

// Autorizavimas pagal rolę (serverio pusėje)
function requireRole(...roles) {
  return [requireLogin, (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const e = new Error('Neturite teisės pasiekti šio puslapio.');
      e.status = 403;
      return next(e);
    }
    next();
  }];
}

module.exports = { locals, csrfProtection, requireLogin, requireRole };
