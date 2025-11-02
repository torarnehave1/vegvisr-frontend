import { alignDiarizationWithTextAdvanced, formatAlignedSegmentsAsMarkdown } from './src/utils/alignDiarizationWithText.js'

// Your FULL transcript
const fullTranscript = `Så tenker jeg: Hvor kommer tankene fra? Det har vært en slik undring for meg, og jeg kunne tenkt meg å prate litt med deg om det. For du virker veldig rolig, og det ser ut til at du har full kontroll på tanker og innstillinger. Og tankene dine. Hvordan skal jeg slippe unna influensen? Ja, det er jo mange interessante betraktninger du kommer med.

Det første du kanskje kunne begynne med er å forklare hva et perspektiv er. Prøv å forstå hva perspektiv er, fordi det tyder på at et menneske kan ta et perspektiv. Jeg kan se at det er viktig å forstå dette begrepet. Kan du si hva et perspektiv er? Vi kunne snakke litt om det, så vi kan se om det er noe vi kan bli kjent med nå, som et begrep.

Hvis vi begynner med perspektivbegrepet, tror jeg det er en god grunn for å komme nærmere det vi skal snakke om etterpå, og det har med tankefrihet å gjøre. Så når jeg lytter til deg, kan jeg ha to vidt forskjellige perspektiver samtidig. Jeg kan bli irritert, frustrert eller stresset. Jeg tenker på Turid, hun er sånn og sånn og sånn.

Jeg håper vi kan utforske dette videre og se hvordan vi kan jobbe med å forstå og håndtere våre tanker og perspektiver, kanskje gjennom en form for somatic therapy eller lignende teknikk, som for eksempel trauma-release eller andre metoder som kan hjelpe oss å få bedre kontroll over våre tanker og følelser. Skjønner du? Det er én måte jeg har et perspektiv på. Og hva er det perspektivet der? Jo, det perspektivet der er at jeg tar ikke noe innover meg, at dette skjer i meg. Det er kun Turid som holder på å tulle og ordne og styre. Det andre perspektivet er at det Turid snakker om, det kan jeg kjenne beveger seg i meg. Men det er inne i meg det beveger seg. Og jeg kan ha følelse av det. Jeg kan få tanker og følelser. Da har jeg tatt perspektiv nummer én, at jeg ser på deg utenfor meg. Du eksisterer bare utenfor meg og irriterer meg, og du skjønner ingenting. Alt sånt. Jeg skulle vært litt sånn slem med deg, da. Så det er dømt deg. Et dømmende, fordømmende perspektiv der ute. Og så anerkjenner jeg ikke at det er det som jeg sier. Da projiserer jeg alt ut. Det er ytrestyrte perspektiver. Når jeg tar det inn, kjenner inn i meg, så anerkjenner jeg at det er i meg. Så det er alt det du snakker om, det er ikke der ute lenger. Det er kun min opplevelse, alle mine tanker, alle mine følelser. Det er mitt. Det handlet ikke om meg, men om deg. Bare om meg. Bare om meg og mitt. Så da kan ikke Turid bli til noe utenfor meg som forstyrrer meg, frustrerer meg eller gjør meg irritert. Men er ikke det snakk om hvilke tanker du får i forhold til det jeg ser, da? Nei, nå er jeg helt ekstrem, nå prøver jeg å polarisere. Jeg snakker kun om perspektiver. Jeg snakker kun om perspektiver. Det ene perspektivet lar seg overhodet ikke påvirke av det der ute, men er intakt i sin egen affeksjon. Håndterer det i seg selv. Man kan godt bli like irritert. Men når du sier det der, så får jeg en assosiasjon til mannen min, som har irritert meg. Da er du i det første perspektivet. Ja, ikke sant? Jeg lurer på om jeg holder på å endre noe av det perspektivet. Tror du å endre perspektiv? Du forteller meg litt om det, at det er noe annet som prøver å skje. Er du litt nysgjerrig nå, så kan du komme til et tredje perspektiv? Ja, det vil jeg gjerne høre. Og tredje perspektivet handler ikke om at jeg ser på følelser og tanker som noe objektivt sant. Nei, det er en dypere tilstand. Der er du bare et øyeblikks vesen. Der er du ikke lenger en person. Verken Turid som person eller Tor Arne som person finnes. Hverken utsiden eller innsiden finnes. Det er bare ren skapelse. Det er det som jeg kaller den menneskelige kjerne eller kjernekropp. Er det sinnet? Både kropp og sinn. Jeg kaller det den menneskelige kjerne, fordi det er som et eget univers som bare beveger seg. Det er ingen tilknytninger som er varige, ingen perspektiver som er varige. Ingenting får en slik kvalitet av sannhet.`

// Sample of your diarization segments (first 20)
const sampleSegments = [
  { speaker: 'SPEAKER_01', start: 0.48, end: 1.08 },
  { speaker: 'SPEAKER_01', start: 1.5, end: 3.15 },
  { speaker: 'SPEAKER_00', start: 5.21, end: 5.49 },
  { speaker: 'SPEAKER_01', start: 6.13, end: 8.25 },
  { speaker: 'SPEAKER_01', start: 9.09, end: 11.11 },
  { speaker: 'SPEAKER_00', start: 11.83, end: 14.27 },
  { speaker: 'SPEAKER_00', start: 11.83, end: 11.83 },
  { speaker: 'SPEAKER_01', start: 11.83, end: 11.83 },
  { speaker: 'SPEAKER_00', start: 11.83, end: 11.83 },
  { speaker: 'SPEAKER_01', start: 16.21, end: 21.45 },
  { speaker: 'SPEAKER_01', start: 23.39, end: 24.47 },
  { speaker: 'SPEAKER_01', start: 24.93, end: 24.93 },
  { speaker: 'SPEAKER_01', start: 27.05, end: 27.37 },
  { speaker: 'SPEAKER_00', start: 29.39, end: 30.73 },
  { speaker: 'SPEAKER_00', start: 31.25, end: 32.51 },
  { speaker: 'SPEAKER_00', start: 34.21, end: 34.21 },
  { speaker: 'SPEAKER_00', start: 36.41, end: 36.41 },
  { speaker: 'SPEAKER_00', start: 38.43, end: 40.55 },
  { speaker: 'SPEAKER_00', start: 41.75, end: 45.97 },
  { speaker: 'SPEAKER_00', start: 48.49, end: 51.77 }
]

const speakerLabels = {
  'SPEAKER_00': 'Mentor',
  'SPEAKER_01': 'Deltager'
}

console.log('=== FULL TRANSCRIPT ALIGNMENT TEST ===\n')
console.log(`Transcript length: ${fullTranscript.length} characters`)
console.log(`Word count: ${fullTranscript.split(/\s+/).length} words`)
console.log(`Segments: ${sampleSegments.length}\n`)

// Test alignment
const aligned = alignDiarizationWithTextAdvanced(sampleSegments, fullTranscript, speakerLabels)

console.log(`Aligned segments created: ${aligned.length}\n`)

// Show first 10 aligned segments
console.log('First 10 aligned segments:\n')
aligned.slice(0, 10).forEach((seg, idx) => {
  const mins = Math.floor(seg.start / 60)
  const secs = Math.floor(seg.start) % 60
  const timeLabel = `${mins}:${secs.toString().padStart(2, '0')}`
  console.log(`${idx + 1}. [${timeLabel}] ${seg.speakerLabel}: "${seg.text.substring(0, 80)}${seg.text.length > 80 ? '...' : ''}"`)
})

console.log('\n=== Formatted Markdown (first 300 chars) ===\n')
const markdown = formatAlignedSegmentsAsMarkdown(aligned)
console.log(markdown.substring(0, 500) + '...\n')

// Statistics
const segmentsWithText = aligned.filter(s => s.text && s.text.trim().length > 0)
const segmentsEmpty = aligned.filter(s => !s.text || s.text.trim().length === 0)

console.log('=== Statistics ===')
console.log(`Segments with text: ${segmentsWithText.length}`)
console.log(`Empty segments: ${segmentsEmpty.length}`)
console.log(`Coverage: ${((segmentsWithText.length / aligned.length) * 100).toFixed(1)}%`)
