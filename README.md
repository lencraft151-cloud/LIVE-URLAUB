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

### Warum GitHub Pages hier nicht reicht

Das ist die haeufigste Fehlannahme, deshalb vorweg klargestellt:
**GitHub Pages kann diese App nicht betreiben.** Pages liefert
ausschliesslich fertige Dateien aus und fuehrt keinen Code auf dem Server
aus. Es fehlt damit alles, was das Streaming ausmacht:

| Gebraucht wird             | GitHub Pages |
| -------------------------- | ------------ |
| Dauerhaft laufender Prozess | nein         |
| RTMP auf Port 1935 (TCP)   | nein         |
| WebSocket fuer den Chat     | nein         |
| Datenbank / Dateispeicher   | nein         |
| ffmpeg fuer HLS             | nein         |

Dasselbe gilt fuer Vercel, Netlify und Cloudflare Pages: Sie koennen kein
rohes TCP und damit kein RTMP.

**Was GitHub dagegen sehr gut kann und hier auch uebernimmt:** die Images
automatisch bauen, testen und in der GitHub Container Registry (GHCR)
bereitstellen - siehe [Automatischer Build ueber GitHub](#automatischer-build-ueber-github).
Das Ausfuehren selbst braucht aber einen echten Server.

### Was fuer einen Hoster brauchst du?

Geeignet sind:

- Ein eigener kleiner Server / VPS (Hetzner, Netcup, DigitalOcean, ...) -
  ab ca. 4-5 EUR/Monat, guenstigste und flexibelste Variante
- [Fly.io](https://fly.io) - kann rohes TCP, siehe `fly.toml`
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) - dauerhaft
  kostenlose VM, reicht fuer kleine Streams

Auf allen dreien laeuft dieselbe Anleitung unten.

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

## Automatischer Build ueber GitHub

Im Repository liegen zwei GitHub-Actions-Workflows:

- **`.github/workflows/ci.yml`** - prueft bei jedem Push und Pull Request,
  ob das Frontend lintet und baut, ob der Server wirklich startet
  (Health-Check, Registrierung, RTMP-Port) und ob die Compose-Dateien
  gueltig sind.
- **`.github/workflows/docker.yml`** - baut beide Images und veroeffentlicht
  sie in der GitHub Container Registry:
  - `ghcr.io/lencraft151-cloud/live-urlaub-server`
  - `ghcr.io/lencraft151-cloud/live-urlaub-web`

Beides laeuft ohne Einrichtung: Die Workflows nutzen den automatisch
bereitgestellten `GITHUB_TOKEN`, es sind **keine Secrets zu hinterlegen**.

> Die Pakete sind nach dem ersten erfolgreichen Lauf zunaechst privat. Wer
> sie ohne Login ziehen koennen moechte, stellt sie einmalig unter
> *Repository → Packages → Package settings* auf *public*.

### Deploy mit den fertigen Images (ein Befehl)

Damit muss auf dem Server weder gebaut noch der Quellcode ausgecheckt
werden - es reichen Docker, die Datei `docker-compose.deploy.yml` und eine
`.env`:

```bash
# .env mit JWT_SECRET und DOMAIN anlegen (siehe oben), dann:
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

Aktualisieren geht anschliessend ohne Rebuild - GitHub hat das neue Image
bereits gebaut:

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

Ueber `IMAGE_TAG` in der `.env` laesst sich eine bestimmte Version waehlen
(`latest`, ein Branch-Name oder ein Git-Tag wie `v1.0.0`).

**Noch keine Domain?** Dann statt `DOMAIN` einfach

```ini
SITE_ADDRESS=:80
PUBLIC_HOST=<deine-Server-IP>
```

setzen - die App laeuft dann ueber `http://<Server-IP>` **ohne HTTPS**. Das
ist zum Ausprobieren in Ordnung; fuer den Dauerbetrieb solltest du eine
Domain eintragen, damit die Passwoerter nicht unverschluesselt uebertragen
werden.

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
docker-compose.yml         lokales Setup (HTTP, baut selbst)
docker-compose.prod.yml    Override fuer Domain + automatisches HTTPS
docker-compose.deploy.yml  Deploy mit fertigen Images aus der GHCR
fly.toml                   Alternative: Deploy auf Fly.io
.github/workflows/
  ci.yml                   Lint, Build und Start-Check bei jedem Push
  docker.yml               baut die Images und pusht sie nach GHCR
```

## Hinweis zum node-media-server-Patch

`server/patches/node-media-server+2.7.4.patch` behebt einen Absturz in der
verwendeten Version von `node-media-server`: Der eingebaute HLS-Transcode-
Server referenziert beim Start eine nicht definierte Variable und wirft eine
`ReferenceError`, sobald `trans`/HLS aktiviert ist. Der Patch wird per
[patch-package](https://github.com/ds300/patch-package) automatisch bei
jedem `npm install` angewendet (siehe `postinstall`-Skript) - keine manuelle
Aktion noetig.
