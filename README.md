# SleetNow 🌙

Eine kleine Web-App zum Einschlafen. Sie läuft im Browser auf Handy und Desktop, lässt sich als App installieren (PWA) und funktioniert offline.

## Funktionen

- **Satire-Kachel „Xi-Rede (APEC)“**: eine echte, 28 Minuten lange Grundsatzrede zum Einschlafen. Als Hintergrund dient eine gezeichnete Karikatur des schlafenden Trump.
- **Einschlafklänge**: Regen, Meer, Wind, Kamin, rosa, braunes und weißes Rauschen sowie ein tiefer Ton. Die Klänge lassen sich frei mischen, jeder hat eine eigene Lautstärke. Alle Klänge werden live mit der Web Audio API erzeugt, Audiodateien gibt es keine.
- **Sleep-Timer**: 15 bis 90 Minuten. Zum Ende hin werden die Klänge sanft ausgeblendet (bis zu 3 Minuten).
- **Nachtmodus**: schwarzer Bildschirm mit einer schwach roten Uhr. Der Bildschirm bleibt dabei an (Wake Lock).
- **Atemübungen**: 4-7-8, Box-Atmung (4-4-4-4) und ruhiges Atmen (4-6), mit animiertem Atemkreis.
- **Schlafrechner**: berechnet Aufwach- oder Schlafenszeiten anhand von 90-Minuten-Schlafzyklen, plus ca. 15 Minuten zum Einschlafen.

Lautstärken, Atemmuster und Aufstehzeit werden lokal im Browser gespeichert.

## Starten

Es gibt keinen Build-Schritt. Einfach einen beliebigen statischen Webserver im Projektordner starten:

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Für die Installation als App auf dem Handy muss die Seite über HTTPS ausgeliefert werden, z. B. über GitHub Pages.

## Hinweise

- Browser erlauben Ton erst nach einem Tipp. Die Klänge starten deshalb erst, wenn man auf eine Kachel tippt.
- Auf iOS kann der Ton stoppen, wenn der Bildschirm gesperrt wird. Der Nachtmodus hält den Bildschirm an und umgeht das.

## Quellen der Medien

- `media/xi-apec-2015.mp3`: Xi Jinping, Grundsatzrede beim APEC CEO Summit in Manila am 18.11.2015. Philippine Government / Radio Television Malacañang, **gemeinfrei**, über [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:China_President_Xi_Jinping_-_Keynote_Speech_-_APEC_Business_Forum_-_Manila,_Philippines_-18_November_2015.webm). Nur die Tonspur, auf die Rede selbst gekürzt (Moderation entfernt).
- `media/trump-schlaeft.svg`: eigene Zeichnung für SleetNow, eine satirische Karikatur und kein Foto.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Oberfläche |
| `style.css` | Gestaltung |
| `app.js` | Klangerzeugung, Timer, Atemübungen, Schlafrechner |
| `sw.js` | Service Worker für Offline-Nutzung |
| `manifest.webmanifest`, `icons/` | App-Installation |
