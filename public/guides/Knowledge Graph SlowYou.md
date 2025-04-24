**Instruksjonsdokument: Generering av Kunnskapsgraf i JSON-format med SlowYou-integrasjon**

**Formål:**
Dette dokumentet gir detaljerte instruksjoner for hvordan du genererer en kunnskapsgraf i JSON-format basert på samtaleanalyse mellom en mentor og en deltaker. Prosessen integrerer SlowYou’s bioenergetiske prinsipper for å fremme personlig vekst og selvbevissthet. JSON-strukturen skal være kompatibel med Vegvisr Knowledge Graph System, og den skal brukes til visualisering og redigering via GraphAdmin.vue og GraphViewer.vue.

---

### 1. **Oversikt:**

Målet er å analysere et samtaletranskript, trekke ut nøkkelinnsikter og generere en JSON-struktur som reflekterer samtalens temaer og prinsippene i SlowYou. Den genererte grafen vil inneholde noder og kanter, og vil være integrert med SlowYou-konsepter som Kroppens Visdom, Hjertets Sentralitet, og Grunning og Flyt.

---

### 2. **JSON-struktur:**

#### Øverste nivå-felter:

- **layout**: Angir presentasjonsstil for grafen. Mulige verdier:
  - `"landing"`: Handlingsfokusert.
  - `"blog"`: Narrativ flyt.
  - `"academic"`: Akademisk stil.
  - `"portfolio"`: Visuell showcase.
  - **default**: `"blog"`.

#### Noder:

Hver node inneholder følgende felter:

- **id**: En unik identifikator for noden (f.eks. "SlowYou_Header").
- **label**: Beskrivelse eller bildebanenavn (f.eks. "/images/SlowYou_Header.png").
- **color**: Farge i hex-kode eller CSS-navn (f.eks. "#4a90e2").
- **type**: Node-type (f.eks. fulltext, notes, info, quote, background).
- **info**: Innhold (f.eks. Markdown-tekst) eller null.
- **bibl**: Referanseliste i APA-format (f.eks. ["Håve, T. A. (2025). *Vegvisr.org Research Notes*"]).
- **imageWidth** og **imageHeight**: Bredde og høyde på eventuelle bilder.
- **visible**: Boolean for synlighet (true/false). Standard er true.

**Node-begrensninger:**

- **Unike ID-er**: Sørg for at ingen noder har duplikate ID-er.
- **bakgrunn**: Første node, med bildebanenavn og dimensjoner.
- **fulltext**: Andre node, med detaljert innhold og Pexels-bilde.
- **notes**: Kortfattet innhold (50-150 ord).
- **quote**: Kort, slagkraftig utsagn.
- **visible**: Sett til false for utkast, true for offentlig.

#### Kanter:

Hver kant kobler to noder:

- **id**: En unik identifikator (f.eks. "SlowYou_Header_to_SlowYou_Summary").
- **source**: ID for kilde-noden.
- **target**: ID for mål-noden.

**Edge-begrensninger:**

- Kilden og målet må matche eksisterende node-ID-er.
- ID-er skal være unike og avledet fra kilden og målet.

---

### 3. **SlowYou Integrasjon:**

SlowYou, utviklet av Tor Arne Håve, er en bioenergetisk tilnærming som fremmer selvbevissthet og personlig vekst. De viktigste prinsippene er:

- **Kroppens Visdom**: Bevissthet om kroppen.
- **Hjertets Sentralitet**: Hjerte-sentrert medfølelse.
- **Grunning og Flyt**: Grunning og bevegelse som opprettholder vitalitet.

#### SlowYou Øvelser:

- Stå og kjenn på deg selv.
- Dyp pusting.
- Gongspill for å frigjøre spenninger.

**Analyseprosess:**

1. **Sammendrag av samtalen**: Identifiser hovedtemaene (f.eks. enhet, eksterne forventninger) og koble dem til SlowYou-prinsipper.
2. **Viktige innsikter ("Gullkorn")**: Finn innsiktsfulle utsagn fra deltaker og mentor, og knytt dem til SlowYou-konsepter som selv-eierskap og Selvbevissthet.
3. **Deltakerens selvrefleksjon**: Fremhev øyeblikk med økt selvbevissthet og refleksjon.
4. **Temaer for videre utforskning**: Identifiser temaer som kan utdypes videre, og koble dem til SlowYou-praksiser.
5. **SlowYou-applikasjon**: Beskriv hvordan SlowYou-øvelser støtter deltakerens vekst, og skreddersy øvelsene til innsiktene i samtalen.

---

### 4. **Trinn for JSON-generering:**

1. **Tolk Input:**

   - Analyser transkriptet for temaer og innsikter.
   - Kartlegg temaene til SlowYou-prinsipper og øvelser.
   - Be om lengre transkripter ved behov for å få mer kontekst.

2. **Opprett Noder:**

   - Bakgrunnsnode: Første node, med bildebanenavn, dimensjoner og tittel.
   - Fulltekstnode: Andre node, med Pexels-bilde, tre kapitler og APA-referanser.
   - Ekstra noder: Sitat/noter for innsikter, refleksjoner og SlowYou-applikasjon.
   - Tildel unike ID-er, etiketter og farger.

3. **Opprett Kanter:**

   - Koble noder med ID-er som [source]to[target].
   - Sørg for at kilden og målet er gyldige og eksisterende node-ID-er.

4. **Saniter og Valider:**

   - Ekskluder unødvendige felter i kantene (kun ID, source, target).
   - Verifiser at alle noder har unike ID-er, og at stiene til bildene er gyldige.

5. **Generer Utdata:**
   - JSON-struktur med 2-space innrykk.
   - Meldingsutdata: Oppsummer layout, bilder, synlighet og eventuelle klargjøringer.

---

### 5. **Eksempel på JSON-utdata:**

Her er et eksempel på JSON-utdata basert på et transkript som diskuterer temaet selv-enhet og eksterne forventninger:

```json
{
  "layout": "blog",
  "nodes": [
    {
      "id": "SlowYou_Header",
      "label": "/images/SlowYou_Header.png",
      "color": "white",
      "type": "background",
      "info": "Header image for a knowledge graph exploring personal growth through SlowYou’s bioenergetic principles.",
      "bibl": [],
      "imageWidth": "750",
      "imageHeight": "500",
      "visible": true
    },
    {
      "id": "SlowYou_Summary",
      "label": "Fostering Self-Unity with SlowYou",
      "color": "#4a90e2",
      "type": "fulltext",
      "info": "![Header|width:100%;height:250px;object-fit: cover;object-position: center](https://images.pexels.com/photos/3184297/pexels-photo-3184297.jpeg)\n\n## Conversation Overview\nThe conversation explores self-unity, challenging 'vi' (we) as separation and advocating self-ownership. The Mentor critiques societal expectations ('du er sånn'), urging inner unity. The Participant responds enthusiastically ('Hmmm gir meg mye dette'), aligning with SlowYou’s _Kroppens Visdom_.",
      "bibl": [
        "Lowen, A. (1975). *Bioenergetics*. Penguin Books.",
        "Håve, T. A. (2025). Vegvisr.org Research Notes. Vegvisr.org."
      ],
      "imageWidth": "auto",
      "imageHeight": "auto",
      "visible": true
    }
  ],
  "edges": [
    {
      "id": "SlowYou_Header_to_SlowYou_Summary",
      "source": "SlowYou_Header",
      "target": "SlowYou_Summary"
    }
  ]
}
```

---

### 6. **Feilhåndtering og Skalering:**

- **Feilhåndtering**: For korte eller tvetydige transkripsjoner, tolk innholdet forsiktig og foreslå klargjøring (f.eks. "Gi et lengre transkript for rikere analyse").
- **Skalering**: For lengre transkripsjoner, legg til flere noder for undertemaer, eller bruk Interaksjonsmetode 8 for dynamisk ekstraksjon av konsepter.

---

### 7. **Avslutning:**

Dette dokumentet gir retningslinjer for hvordan du genererer en kunnskapsgraf i JSON-format, integrert med SlowYou’s bioenergetiske prinsipper. Gjennom denne prosessen kan du effektivt visualisere samtaler og utforske viktige temaer for personlig vekst og selvbevissthet.
