# Spiele-Wunschliste

Gemeinsame Spiele-Wunschliste für zwei Personen: Spiele über Steam suchen und
vorschlagen, gegenseitig zustimmen, nach Tags filtern/sortieren, ein
Zufallsspiel auswürfeln und gemeinsam als durchgespielt markieren.

## Features

- Login mit zwei fest hinterlegten Accounts (kein öffentliches Registrieren)
- Spielsuche über die kostenlose, öffentliche Steam-Storefront-API (kein API-Key nötig)
- Neue Spiele müssen von **beiden** Personen bestätigt werden, bevor sie auf der Liste erscheinen
- Glocken-Icon oben links zeigt offene Anfragen (neue Spiele & "durchgespielt"-Markierungen)
- Kachel-Ansicht mit Titel + Vorschaubild, Detailansicht mit Trailer, Beschreibung, Tags und Steam-Link
- Suche, Tag-Filter und Sortierung (Titel, Release-Datum, neueste zuerst)
- Zufallsgenerator für das nächste Spiel
- "Durchgespielt"-Markierung erfordert ebenfalls die Zustimmung beider Personen

## Setup

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `.env.local.example` zu `.env.local` kopieren und ausfüllen:

   ```bash
   cp .env.local.example .env.local
   ```

   - `SESSION_SECRET`: langer Zufallsstring, z.B. erzeugt mit
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `AUTH_USER_1_ID` / `AUTH_USER_2_ID`: frei wählbare Benutzernamen (keine echten Namen nötig)
   - Passwort-Hash erzeugen (base64-kodiert, wegen `$`-Zeichen in bcrypt-Hashes):

     ```bash
     node scripts/hash-password.mjs "DeinPasswort"
     ```

     Den ausgegebenen Wert in `AUTH_USER_1_PASSWORD_HASH_B64` bzw.
     `AUTH_USER_2_PASSWORD_HASH_B64` eintragen.

3. Lokal starten:

   ```bash
   npm run dev
   ```

   Läuft dann unter [http://localhost:3000](http://localhost:3000).

## Datenbank

Lokal reicht die Standardeinstellung `DATABASE_URL=file:local.db` (eine
einfache SQLite-Datei, wird nicht committed).

Für den produktiven Betrieb im Internet empfiehlt sich
[Turso](https://turso.tech) (SQLite-kompatibel, kostenloser Tarif reicht
locker für 2 Nutzer):

```bash
DATABASE_URL=libsql://<dein-db-name>.turso.io
DATABASE_AUTH_TOKEN=<dein-turso-token>
```

## Deployment (z.B. Vercel)

1. Projekt zu einem eigenen (privaten) Git-Repository pushen.
2. Bei [Vercel](https://vercel.com) importieren.
3. Die Werte aus `.env.local` als Umgebungsvariablen im Vercel-Projekt
   hinterlegen (Settings → Environment Variables).
4. Deployen. Die Steam-Storefront-API ist öffentlich und kostenlos, es wird
   kein zusätzlicher Key benötigt.

## Hinweis zu Passwörtern

Die Zugangsdaten werden nirgendwo im Code hinterlegt, sondern ausschließlich
lokal in `.env.local` bzw. als Umgebungsvariablen beim Hoster – diese Datei
wird nie eingecheckt.
