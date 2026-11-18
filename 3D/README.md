# VenueBook – preliminari versija (DB + autentifikavimas + pirmasis CRUD)

Stack: Node.js, Express, SQLite (better-sqlite3), EJS, bcryptjs, express-session.

## Paleidimas
    npm install
    npm run seed        # sukuria data.sqlite su pradiniais duomenimis
    npm start           # http://localhost:3000

Testiniai naudotojai (slaptažodis `Slaptazodis123!`):
`admin@venuebook.lt`, `owner@venuebook.lt`, `tomas@ausra.lt` (savininkai), `customer@venuebook.lt`.
Pasirinktinai: `SESSION_SECRET=...`, `NODE_ENV=production` (įjungia `secure` slapuką).

## Kas jau įgyvendinta
| Reikalavimas | Kur |
|---|---|
| 9 susietos lentelės, PK/FK, CHECK, UNIQUE, NOT NULL | `db/schema.sql` |
| 1:N ryšiai | users→venues, categories→venues, venues→bookings, bookings→reviews |
| M:N ryšys | venues↔amenities (`venue_amenities`) |
| Pagrindinis CRUD (venues) | `routes/owner.js`, `/owner/venues` |
| Registracija / prisijungimas / atsijungimas | `routes/auth.js` |
| bcrypt (cost 12), sesijos ID regeneravimas, httpOnly+sameSite slapukas | `routes/auth.js`, `server.js` |
| Rolės (owner/customer/admin) + savininko taisyklė | `requireRole`, `loadOwnVenue` |
| CSRF žetonai visose POST formose | `middleware/common.js` |
| Parametrizuotos užklausos (SQL injection) | visur `?` parametrai |
| XSS: išvesties koduotė | EJS `<%= %>` |
| Serverio validacija, klaidos prie laukų, įvesties išsaugojimas | `validate()` |
| Post/Redirect/Get, flash pranešimai | visi POST keliai |
| Šalinimas su patvirtinimo puslapiu | `/owner/venues/:id/delete` |
| Select/checkbox vietoje FK ID įvedimo | `venue-form.ejs` |
| Kombinuotas filtras (4 kriterijai, venues+categories+reviews) | `/venues` |
| Skaičiavimas: vidutinis įvertinimas | `/venues` (AVG iš `reviews`, paslėpti neįtraukti) |

## Nuorodų vientisumo taisyklės
- `bookings.venue_id`, `venues.owner_id`, `venues.category_id` → **RESTRICT**: negalima ištrinti erdvės, turinčios rezervacijų (išsaugoma istorija); aplikacija rodo suprantamą pranešimą.
- `venue_amenities`, `venue_images`, `availability_blocks` → **CASCADE**: priklauso tik erdvei, be jos neturi prasmės.
- `PRAGMA foreign_keys = ON` įjungiama `db/index.js` (SQLite pagal nutylėjimą jų netikrina).

## Sąmoninga denormalizacija
`bookings.price_snapshot_cents`, `service_fee_cents`, `total_price_cents` – kad vėlesnis kainos pakeitimas nepakeistų jau sudarytos rezervacijos sumos.
Pinigai saugomi centais (INTEGER), kad nebūtų slankiojo kablelio klaidų.

## Dar neįgyvendinta (kitiems etapams)
Rezervacijos forma ir savininko patvirtinimas, atsiliepimai, užimtumo blokavimai, admin skydelis (erdvių patvirtinimas –
kol kas naujos erdvės lieka `is_published=0`), spausdinamoji ataskaita, temos/rodinio slapukas, ER diagrama,
nuotraukų įkėlimas, pastovi sesijų saugykla (dabar MemoryStore), bandymų limitas prisijungimui.

## Pastaba dėl dokumento duomenų
Dokumente atsiliepimas Nr. 3 rodė neegzistuojančią rezervaciją Nr. 5 ir naudotoją Nr. 7; `db/seed.js` pridėta rezervacija Nr. 5 (klientas 4), kad FK būtų teisingi.
