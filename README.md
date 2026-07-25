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

```
                    RTMP :1935              REST + Socket.io :4000
OBS/Handy ────publish────▶  ┌──────────┐  ◀──────────────────▶  Browser
                             │  server  │
Browser  ◀───HLS :8000────  │          │
  (Video)                    └──────────┘
                                   │
                             SQLite (Nutzer, Stream-Keys,
                             Chatverlauf, Live-Status)
```

- **server/** - Node.js/Express-Backend: Authentifizierung (JWT), REST-API
  fuer Kanaele, Live-Chat per Socket.io, sowie ein RTMP-Server
  ([node-media-server](https://github.com/illuspas/Node-Media-Server)), der
  eingehende Streams per ffmpeg zu HLS umwandelt. Daten liegen in einer
  SQLite-Datei.
- **web/** - React/Vite-Frontend: Startseite mit Kanalliste, Kanal-Seite mit
  Video-Player ([hls.js](https://github.com/video-dev/hls.js)) und Chat,
  sowie ein Dashboard mit Stream-Key-Verwaltung.

Der Stream-Key ist **privat** (wie ein Passwort fuers Publizieren) und wird
getrennt vom oeffentlichen Kanalnamen gehandhabt: Er taucht nirgends in der
Wiedergabe-URL auf, die Zuschauer sehen nur deinen Benutzernamen.

## Schnellstart mit Docker

Das ist der empfohlene Weg - startet Backend (inkl. ffmpeg) und Frontend in
zwei Containern.

```bash
cp .env.example .env
# .env oeffnen und mindestens JWT_SECRET aendern

docker compose up --build
```

Danach erreichbar unter:

- Web-App: http://localhost:5173
- API: http://localhost:4000
- RTMP-Ingest: `rtmp://localhost:1935/live`

Greifst du von einem anderen Geraet im selben Netzwerk zu (z.B. um vom Handy
zu streamen), nutze einfach die LAN-IP deines Servers statt `localhost` -
sowohl fuer die Web-App als auch fuer die RTMP-URL im Dashboard. Das
Frontend leitet API- und Medien-URLs automatisch vom aufgerufenen Hostnamen
ab, ein Rebuild ist dafuer nicht noetig.

Fuer einen Produktivbetrieb hinter einer eigenen Domain: `VITE_API_URL` und
`VITE_MEDIA_URL` in `.env` setzen (siehe Kommentare dort) und neu bauen.

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

| Variable              | Bedeutung                                             |
| ---------------------- | ------------------------------------------------------ |
| `JWT_SECRET`           | Geheimer Schluessel fuer Login-Tokens - unbedingt aendern |
| `RTMP_PORT`            | Port fuer eingehende RTMP-Streams (Standard: 1935)     |
| `MEDIA_HTTP_PORT`      | Port fuer die HLS-Auslieferung (Standard: 8000)        |
| `API_PORT`             | Port fuer REST-API + Chat (Standard: 4000)             |
| `FFMPEG_PATH`          | Pfad zur ffmpeg-Binary                                 |
| `CORS_ORIGIN`          | Erlaubte Frontend-Origin                               |
| `PUBLIC_HOST`          | Nur fuer die Anzeige der RTMP-URL im Dashboard         |

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
  src/
    components/      VideoPlayer (hls.js), ChatBox, StreamCard, Navbar
    context/         Auth-Context (Login/Registrierung/Token)
    pages/           Home, Login, Register, Dashboard, Channel
    lib/             API-Client, Socket.io-Client, URL-Konfiguration
```

## Hinweis zum node-media-server-Patch

`server/patches/node-media-server+2.7.4.patch` behebt einen Absturz in der
verwendeten Version von `node-media-server`: Der eingebaute HLS-Transcode-
Server referenziert beim Start eine nicht definierte Variable und wirft eine
`ReferenceError`, sobald `trans`/HLS aktiviert ist. Der Patch wird per
[patch-package](https://github.com/ds300/patch-package) automatisch bei
jedem `npm install` angewendet (siehe `postinstall`-Skript) - keine manuelle
Aktion noetig.
