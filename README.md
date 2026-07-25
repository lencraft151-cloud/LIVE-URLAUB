# LIVE-URLAUB

Eine selbst gehostete Live-Streaming-Plattform: Du streamst per RTMP (z.B. mit
OBS oder einer Kamera-App auf dem Handy) auf deinen eigenen Server, Zuschauer
schauen den Stream im Browser und chatten in Echtzeit mit dir. Jeder
registrierte Nutzer bekommt einen eigenen Kanal und kann selbst live gehen -
es ist also keine Ein-Personen-Plattform, sondern jeder kann streamen.

## Features

- **RTMP-Ingest**: Stream von OBS, einer Kamera-App (z.B. Larix Broadcaster)
  oder ffmpeg auf den eigenen Server, wie bei Twitch/YouTube Live.
- **Wiedergabe im Browser per HLS**: Kein Plugin noetig, laeuft in jedem
  modernen Browser (inkl. Safari/iOS nativ).
- **Live-Chat**: Echtzeit-Chat per Socket.io, mit Verlauf und Zuschauerzahl,
  pro Kanal.
- **Online/Offline-Status**: Die Startseite zeigt live, wer gerade streamt -
  ganz ohne Neuladen der Seite.
- **Mehrbenutzerfaehig**: Jeder Account bekommt einen eigenen, geheimen
  Stream-Key zum Publizieren sowie eine oeffentliche Kanal-Seite.

## Architektur

Alles Web-basierte laeuft ueber **einen einzigen Origin**. Ein Reverse Proxy
(Caddy) verteilt die Anfragen intern:

```
                              ┌──────── web (Caddy) ────────┐
Browser ──HTTPS :443─────────▶│  /            → SPA          │
                              │  /api/*       → server:4000  │
                              │  /socket.io/* → server:4000  │
                              │  /live/*      → server:8000  │
                              └──────────────┬───────────────┘
                                             │ (internes Docker-Netz)
                                       ┌─────┴──────┐
OBS/Handy ──RTMP :1935──────publish───▶│   server   │
                                       └─────┬──────┘
                                             │
                                 SQLite (Nutzer, Stream-Keys,
                                 Chatverlauf, Live-Status)
```

Warum ein Reverse Proxy? Wuerde der Browser API und Video direkt auf
`:4000`/`:8000` ansprechen, blockiert er diese Anfragen auf einer
HTTPS-Seite als Mixed Content - die App waere online unbenutzbar. Ueber einen
gemeinsamen Origin entfaellt das Problem, und CORS wird gar nicht erst
gebraucht. Die Ports 4000 und 8000 sind deshalb **nicht** nach aussen
veroeffentlicht.

RTMP (Port 1935) laeuft bewusst daran vorbei: Es ist kein HTTP-Protokoll und
kann nicht durch einen HTTP-Proxy geleitet werden.

- **server/** - Node.js/Express-Backend: Authentifizierung (JWT), REST-API
  fuer Kanaele, Live-Chat per Socket.io, sowie ein RTMP-Server
  ([node-media-server](https://github.com/illuspas/Node-Media-Server)), der
  eingehende Streams per ffmpeg zu HLS umwandelt. Daten liegen in einer
  SQLite-Datei.
- **web/** - React/Vite-Frontend (Startseite, Kanal-Seite mit
  [hls.js](https://github.com/video-dev/hls.js)-Player und Chat, Dashboard),
  ausgeliefert von Caddy, der zugleich als Reverse Proxy und
  HTTPS-Terminierung dient.

Der Stream-Key ist **privat** (wie ein Passwort fuers Publizieren) und wird
getrennt vom oeffentlichen Kanalnamen gehandhabt: Er taucht nirgends in der
Wiedergabe-URL auf, die Zuschauer sehen nur deinen Benutzernamen.

## Schnellstart mit Docker

Das ist der empfohlene Weg - startet Backend (inkl. ffmpeg) und Frontend in
zwei Containern.

```bash
cp .env.example .env

# JWT_SECRET erzeugen und in die .env eintragen:
openssl rand -hex 32

docker compose up --build
```

Danach erreichbar unter:

- Web-App: http://localhost:5173
- RTMP-Ingest: `rtmp://localhost:1935/live`

Ohne gesetztes `JWT_SECRET` startet der Stack bewusst nicht - sonst koennte
jeder, der den Standardwert kennt, fremde Logins faelschen.

Greifst du von einem anderen Geraet im selben Netzwerk zu (z.B. um vom Handy
zu streamen), nutze einfach die LAN-IP deines Servers statt `localhost` und
setze `PUBLIC_HOST` auf diese IP, damit das Dashboard die richtige
RTMP-Adresse anzeigt.

## Oeffentlich hosten (mit HTTPS)

### Was fuer einen Hoster brauchst du?

Wichtig vorweg: **Vercel, Netlify und Cloudflare Pages funktionieren hier
nicht.** Diese Dienste koennen nur HTTP/Serverless - die App braucht aber
einen dauerhaft laufenden Prozess und rohes TCP auf Port 1935 fuer RTMP.

Geeignet sind:

- Ein eigener kleiner Server / VPS (Hetzner, DigitalOcean, Netcup, ...) -
  guenstigste und flexibelste Variante, unten beschrieben
- [Fly.io](https://fly.io) - kann rohes TCP, siehe `fly.toml`

Fuer fluessiges Streaming sollte der Server genug Upload-Bandbreite haben:
Jeder Zuschauer zieht ungefaehr die Bitrate deines Streams (z.B. 3 Mbit/s
→ 10 Zuschauer ≈ 30 Mbit/s Upload).

### Deploy auf einem eigenen Server

Voraussetzungen: eine Domain und ein Server mit Docker, auf den ein
DNS-A-Record zeigt.

**1. DNS setzen** - A-Record von z.B. `stream.deine-domain.de` auf die
Server-IP.

**2. Firewall oeffnen** - Port 80 und 443 (Web + Zertifikat) sowie 1935
(RTMP):

```bash
sudo ufw allow 80,443,1935/tcp
```

**3. Projekt holen und konfigurieren:**

```bash
git clone <dieses-repo> && cd LIVE-URLAUB
cp .env.example .env
```

In der `.env` setzen:

```ini
JWT_SECRET=<Ausgabe von: openssl rand -hex 32>
DOMAIN=stream.deine-domain.de
PUBLIC_HOST=stream.deine-domain.de
```

**4. Starten:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy holt beim ersten Start automatisch ein Let's-Encrypt-Zertifikat und
leitet HTTP dauerhaft auf HTTPS um - es ist **keine manuelle
Zertifikatskonfiguration noetig**. Danach ist die Seite unter
`https://stream.deine-domain.de` erreichbar.

Logs und Status:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

Zum Aktualisieren spaeter: `git pull`, dann denselben `up -d --build`-Befehl.
Die Datenbank und die Zertifikate liegen in Docker-Volumes und bleiben
dabei erhalten.

### Sicherheitshinweise fuer den oeffentlichen Betrieb

- **Stream-Key**: RTMP ist unverschluesselt, der Key geht also im Klartext
  ueber die Leitung. Fuer den Hausgebrauch in Ordnung; wer das nicht moechte,
  streamt ueber ein VPN oder setzt einen RTMPS-faehigen Proxy davor. Bei
  Verdacht laesst sich der Key im Dashboard jederzeit neu erzeugen.
- **Offene Registrierung**: Aktuell kann sich jeder anlegen, der die Seite
  erreicht. Fuer einen privaten Kreis solltest du die Registrierung
  einschraenken (z.B. Route `/api/auth/register` deaktivieren, nachdem alle
  Konten angelegt sind).
- **Backups**: Die Nutzerdaten liegen im Volume `live-urlaub_server_data`.

## Live gehen

1. Registrieren und im **Dashboard** auf "Anzeigen" klicken, um Server-URL
   und Stream-Key zu sehen.
2. In OBS Studio: Einstellungen → Stream → Dienst "Benutzerdefiniert" →
   Server-URL und Stream-Key eintragen → "Stream starten".
   Auf dem Handy funktioniert das genauso mit einer RTMP-App wie
   [Larix Broadcaster](https://softvelum.com/larix/) (iOS/Android).
3. Der Kanal geht automatisch live, sobald der erste Videoframe ankommt -
   ohne Aktion auf der Webseite noetig. Zuschauer sehen das live per
   Chat/Statusanzeige, ganz ohne Neuladen.

## Lokale Entwicklung ohne Docker

Voraussetzungen: Node.js 20+, `ffmpeg` im PATH (fuer die RTMP→HLS-Umwandlung).

```bash
# Backend
cd server
cp .env.example .env
npm install
npm run dev        # http://localhost:4000, RTMP auf :1935, HLS auf :8000

# Frontend (neues Terminal)
cd web
npm install
npm run dev         # http://localhost:5173
```

## Umgebungsvariablen (Backend)

Siehe `server/.env.example` fuer alle Optionen, u.a.:

| Variable          | Bedeutung                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `JWT_SECRET`      | **Pflicht.** Schluessel fuer Login-Tokens (`openssl rand -hex 32`) |
| `DOMAIN`          | Domain fuer den HTTPS-Betrieb (aktiviert Let's Encrypt)          |
| `PUBLIC_HOST`     | Wird im Dashboard als RTMP-Serveradresse angezeigt               |
| `WEB_PORT`        | Port der Web-App im lokalen Setup (Standard: 5173)               |
| `RTMP_PORT`       | Port fuer eingehende RTMP-Streams (Standard: 1935)               |
| `MEDIA_HTTP_PORT` | Interner Port fuer die HLS-Auslieferung (Standard: 8000)         |
| `API_PORT`        | Interner Port fuer REST-API + Chat (Standard: 4000)              |
| `FFMPEG_PATH`     | Pfad zur ffmpeg-Binary                                           |

## Projektstruktur

```
server/
  src/
    auth/           JWT + Passwort-Hashing
    db/             SQLite-Zugriff (Nutzer, Chatnachrichten)
    media/           RTMP/HLS-Server + Publish-Authentifizierung
    middleware/      Auth-Middleware fuer die REST-API
    routes/          /api/auth, /api/channels
    sockets/         Live-Chat per Socket.io
  patches/           Fix fuer einen Absturz-Bug in node-media-server@2.7.4
web/
  Caddyfile          Reverse Proxy + Auto-HTTPS + SPA-Auslieferung
  src/
    components/      VideoPlayer (hls.js), ChatBox, StreamCard, Navbar
    context/         Auth-Context (Login/Registrierung/Token)
    pages/           Home, Login, Register, Dashboard, Channel
    lib/             API-Client, Socket.io-Client, URL-Konfiguration
docker-compose.yml       lokales Setup (HTTP)
docker-compose.prod.yml  Override fuer Domain + automatisches HTTPS
fly.toml                 Alternative: Deploy auf Fly.io
```

## Hinweis zum node-media-server-Patch

`server/patches/node-media-server+2.7.4.patch` behebt einen Absturz in der
verwendeten Version von `node-media-server`: Der eingebaute HLS-Transcode-
Server referenziert beim Start eine nicht definierte Variable und wirft eine
`ReferenceError`, sobald `trans`/HLS aktiviert ist. Der Patch wird per
[patch-package](https://github.com/ds300/patch-package) automatisch bei
jedem `npm install` angewendet (siehe `postinstall`-Skript) - keine manuelle
Aktion noetig.
