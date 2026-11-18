// /audio and /gpt-transcribe — the whisper-1 → gpt-transcribe migration (whisper-1 shuts down
// 26 Feb 2027). Runs the real worker in Node with OpenAI faked out, and checks what the worker
// SENDS to OpenAI and what it RETURNS to callers.
//
// Run:  node openai-worker/test-audio.mjs   (from the repo root, or anywhere)
import worker from './index.js';

let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log('ok   ' + name);
  else { fail++; console.error('FAIL ' + name + '  ' + detail); }
};

// Fake OpenAI: remember the outgoing form, answer like the real model would.
let sent = null;
globalThis.fetch = async (url, init) => {
  sent = { url, form: init.body };
  const model = init.body.get('model');
  const body = model === 'whisper-1'
    ? JSON.stringify({ text: 'hei fra whisper' })
    : JSON.stringify({ text: 'hei fra gpt', languages: [{ code: 'no' }] });
  return new Response(body, { status: 200 });
};

const call = async (path, fields, env = {}) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'voice.webm', { type: 'audio/webm' }));
  for (const [k, v] of fields) form.append(k, v);
  const res = await worker.fetch(new Request('https://openai.vegvisr.org' + path, { method: 'POST', body: form }),
    { OPENAI_API_KEY: 'test-key', ...env });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, text, json };
};

// ── whisper-1 stays exactly as before ──
{
  const r = await call('/audio', [['model', 'whisper-1'], ['language', 'no'], ['temperature', '0']]);
  ok('whisper-1: 200', r.status === 200, r.text);
  ok('whisper-1: model sent unchanged', sent.form.get('model') === 'whisper-1');
  ok('whisper-1: language sent as language', sent.form.get('language') === 'no');
  ok('whisper-1: response_format still sent', sent.form.get('response_format') === 'json');
  ok('whisper-1: temperature still sent', sent.form.get('temperature') === '0');
  ok('whisper-1: response passed through', r.json && r.json.text === 'hei fra whisper' && !('model' in r.json));
}
{
  const r = await call('/audio', []);
  ok('no model → whisper-1 is still the default', sent.form.get('model') === 'whisper-1' && r.status === 200);
}

// ── gpt-transcribe, chosen by the caller ──
{
  const r = await call('/audio', [['model', 'gpt-transcribe'], ['language', 'no'], ['temperature', '0'], ['prompt', 'Samtale om VEGR.AI']]);
  ok('gpt-transcribe: 200', r.status === 200, r.text);
  ok('gpt-transcribe: language → languages[]', JSON.stringify(sent.form.getAll('languages[]')) === '["no"]');
  ok('gpt-transcribe: no singular language sent', sent.form.get('language') === null);
  ok('gpt-transcribe: no response_format sent', sent.form.get('response_format') === null);
  ok('gpt-transcribe: no temperature sent', sent.form.get('temperature') === null);
  ok('gpt-transcribe: prompt still sent', sent.form.get('prompt') === 'Samtale om VEGR.AI');
  ok('gpt-transcribe: callers still get text', r.json.text === 'hei fra gpt');
  ok('gpt-transcribe: language filled from languages[0]', r.json.language === 'no', r.text);
  ok('gpt-transcribe: says which model answered', r.json.model === 'gpt-transcribe');
}
{
  await call('/gpt-transcribe', [['languages[]', 'no'], ['languages[]', 'en'], ['keywords[]', 'VEGR.AI'], ['keywords[]', 'bio<energetikk>\n']]);
  ok('/gpt-transcribe forces the model', sent.form.get('model') === 'gpt-transcribe');
  ok('/gpt-transcribe: several languages kept', JSON.stringify(sent.form.getAll('languages[]')) === '["no","en"]');
  const kws = sent.form.getAll('keywords[]');
  ok('/gpt-transcribe: keywords sent', kws[0] === 'VEGR.AI');
  ok('/gpt-transcribe: < > and line breaks removed from keywords', !/[<>\r\n]/.test(kws.join('')), JSON.stringify(kws));
}
{
  await call('/gpt-transcribe', [['keywords', 'VEGR.AI, Enkel endring']]);
  ok('comma-separated keywords split', JSON.stringify(sent.form.getAll('keywords[]')) === '["VEGR.AI","Enkel endring"]',
     JSON.stringify(sent.form.getAll('keywords[]')));
}
{
  const r = await call('/gpt-transcribe', [['response_format', 'text']]);
  ok('gpt-transcribe text format → plain text', r.status === 200 && r.text === 'hei fra gpt', r.text);
}
{
  sent = null;
  const r = await call('/gpt-transcribe', [['response_format', 'srt']]);
  ok('gpt-transcribe refuses srt with a clear 400', r.status === 400 && /whisper-1/.test(r.json.error), r.text);
  ok('…without calling OpenAI', sent === null);
}

// ── the switch: TRANSCRIBE_WHISPER1_AS moves whisper-1 callers over ──
{
  const env = { TRANSCRIBE_WHISPER1_AS: 'gpt-transcribe' };
  const r = await call('/audio', [['model', 'whisper-1'], ['language', 'no']], env);
  ok('switch on: whisper-1 request goes to gpt-transcribe', sent.form.get('model') === 'gpt-transcribe');
  ok('switch on: caller still gets text + language', r.json.text === 'hei fra gpt' && r.json.language === 'no');
  await call('/audio', [['model', 'whisper-1'], ['response_format', 'srt']], env);
  ok('switch on: srt requests stay on whisper-1', sent.form.get('model') === 'whisper-1');
}

// ── /live-transcribe (gpt-live-transcribe) ──
{
  const res = await worker.fetch(new Request('https://openai.vegvisr.org/live-transcribe'), { OPENAI_API_KEY: 'k' });
  ok('/live-transcribe without a WebSocket upgrade → 426', res.status === 426);
}
{
  // The session settings builder is pure; take it out of the source and run it.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
  const grab = (name) => {
    const i = src.indexOf(`function ${name}(`);
    let depth = 0;
    for (let k = src.indexOf('{', src.indexOf(')', i)); k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
    }
  };
  const consts = src.slice(src.indexOf("const LIVE_MODEL"), src.indexOf('async function liveUser'));
  const mod = consts + grab('liveSessionUpdate') + '\nexport { liveSessionUpdate };';
  const { liveSessionUpdate } = await import('data:text/javascript,' + encodeURIComponent(mod));

  const s = liveSessionUpdate({ languages: ['no', 'EN', 'bad code!'], keywords: ['VEGR.AI', 'bio<x>\n', ''], prompt: ' Samtale ', delay: 'low' });
  const t = s.session.audio.input.transcription;
  ok('live: session.update of type transcription', s.type === 'session.update' && s.session.type === 'transcription');
  ok('live: 24 kHz PCM, no server pause detection', s.session.audio.input.format.rate === 24000 && s.session.audio.input.turn_detection === null);
  ok('live: model gpt-live-transcribe', t.model === 'gpt-live-transcribe');
  ok('live: languages cleaned (bad code dropped, lower case)', JSON.stringify(t.languages) === '["no","en"]', JSON.stringify(t.languages));
  ok('live: keywords cleaned of < > and line breaks', JSON.stringify(t.keywords) === '["VEGR.AI","bio x"]', JSON.stringify(t.keywords));
  ok('live: prompt trimmed, delay kept', t.prompt === 'Samtale' && t.delay === 'low');
  const bare = liveSessionUpdate({ delay: 'turbo' }).session.audio.input.transcription;
  ok('live: nothing extra sent when nothing is given (and an unknown delay is dropped)', JSON.stringify(bare) === '{"model":"gpt-live-transcribe"}');
}

if (fail) { console.error(`\n${fail} failed`); process.exit(1); }
console.log('\nall passed');
