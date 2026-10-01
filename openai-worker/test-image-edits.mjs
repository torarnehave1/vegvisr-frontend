// /images/edits — the allowlist and the size rules.
//
// The allowlist is a security boundary: this worker fetches a URL a caller supplies, holding an
// OpenAI key. Without it the route is a request-forgery engine. The size rules come from
// OpenAI's own image guide (read 2026-10-01) and are checked here rather than left to the API,
// because the 400 would otherwise arrive after the caller has waited through every upload.
//
// The validators are pure, so they are extracted from the source and run without a Workers
// runtime — which is the only reason this file can exist at all.
//
// Run:  node test-image-edits.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync('/Volumes/T7/vegvisr-frontend/openai-worker/index.js', 'utf8');
const grab = (name) => {
  const i = src.indexOf(`function ${name}(`);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
};
const consts = src.slice(src.indexOf('const ALLOWED_IMAGE_HOSTS'), src.indexOf('function isAllowedImageUrl'));
const mod = consts + grab('isAllowedImageUrl') + '\n' + grab('validateEditSize') +
  '\nexport { isAllowedImageUrl, validateEditSize };';
const { isAllowedImageUrl, validateEditSize } = await import('data:text/javascript,' + encodeURIComponent(mod));

let fail = 0;
const ok = (name, cond, detail='') => { if (cond) console.log('ok   ' + name); else { fail++; console.error('FAIL ' + name + '  ' + detail); } };
const env = {};

// ── the allowlist is the security boundary, so it gets the most cases ──
ok('imgix is allowed',            isAllowedImageUrl('https://vegvisr.imgix.net/a.png', env).ok);
ok('a vegvisr subdomain is allowed', isAllowedImageUrl('https://photos.vegvisr.org/a.png', env).ok);
ok('a vegr.ai subdomain is allowed',  isAllowedImageUrl('https://x.vegr.ai/a.png', env).ok);
ok('an unrelated host is refused', !isAllowedImageUrl('https://evil.example/a.png', env).ok);
ok('http is refused even on an allowed host', !isAllowedImageUrl('http://vegvisr.imgix.net/a.png', env).ok);
ok('localhost is refused',        !isAllowedImageUrl('https://localhost/a.png', env).ok);
ok('a private IP is refused',     !isAllowedImageUrl('https://169.254.169.254/latest/meta-data/', env).ok);
ok('a lookalike suffix is refused', !isAllowedImageUrl('https://evilvegvisr.org/a.png', env).ok,
   JSON.stringify(isAllowedImageUrl('https://evilvegvisr.org/a.png', env)));
ok('a suffix in the PATH does not help', !isAllowedImageUrl('https://evil.example/.vegvisr.org/a.png', env).ok);
ok('EXTRA_IMAGE_HOSTS extends it', isAllowedImageUrl('https://cdn.nibi.no/a.png', { EXTRA_IMAGE_HOSTS: 'cdn.nibi.no' }).ok);
ok('garbage is refused',          !isAllowedImageUrl('not a url', env).ok);

// ── the size rules, from OpenAI's guide ──
ok('auto passes',                 validateEditSize('auto').ok);
ok('undefined becomes auto',      validateEditSize(undefined).size === 'auto');
ok('1024x1536 passes',            validateEditSize('1024x1536').ok);
ok('1024x1024 passes',            validateEditSize('1024x1024').ok);
ok('630 is refused (not /16)',    !validateEditSize('1120x630').ok);
ok('1020 is refused (not /16)',   !validateEditSize('1020x1024').ok);
ok('an edge above 3840 is refused', !validateEditSize('3856x1024').ok);
ok('a 4:1 ratio is refused',      !validateEditSize('4096x1024').ok);
ok('too few pixels refused',      !validateEditSize('512x512').ok);
ok('too many pixels refused',     !validateEditSize('3840x3840').ok);
ok('nonsense is refused',         !validateEditSize('big').ok);

console.log(fail === 0 ? '\nAll validator checks passed.' : `\n${fail} failed.`);
process.exit(fail ? 1 : 0);
