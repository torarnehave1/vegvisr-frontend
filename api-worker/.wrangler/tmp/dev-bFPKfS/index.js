var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
__name(_getDefaults, "_getDefaults");
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
__name(changeDefaults, "changeDefaults");
var noopTest = { exec: /* @__PURE__ */ __name(() => null, "exec") };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: /* @__PURE__ */ __name((name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    }, "replace"),
    getRegex: /* @__PURE__ */ __name(() => {
      return new RegExp(source, opt);
    }, "getRegex")
  };
  return obj;
}
__name(edit, "edit");
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: /* @__PURE__ */ __name((bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`), "listItemRegex"),
  nextBulletRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), "nextBulletRegex"),
  hrRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), "hrRegex"),
  fencesBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`), "fencesBeginRegex"),
  headingBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`), "headingBeginRegex"),
  htmlBeginRegex: /* @__PURE__ */ __name((indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i"), "htmlBeginRegex")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape$1 = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape: escape$1,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = /* @__PURE__ */ __name((ch) => escapeReplacements[ch], "getEscapeReplacement");
function escape2(html2, encode2) {
  if (encode2) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
__name(escape2, "escape");
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
__name(cleanUrl, "cleanUrl");
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str2) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str2[curr] === "\\")
      escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count)
        cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
__name(splitCells, "splitCells");
function rtrim(str2, c, invert) {
  const l = str2.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str2.charAt(l - suffLen - 1);
    if (currChar === c && true) {
      suffLen++;
    } else {
      break;
    }
  }
  return str2.slice(0, l - suffLen);
}
__name(rtrim, "rtrim");
function findClosingBracket(str2, b) {
  if (str2.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str2.length; i++) {
    if (str2[i] === "\\") {
      i++;
    } else if (str2[i] === b[0]) {
      level++;
    } else if (str2[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  return -1;
}
__name(findClosingBracket, "findClosingBracket");
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  if (cap[0].charAt(0) !== "!") {
    lexer2.state.inLink = true;
    const token = {
      type: "link",
      raw,
      href,
      title,
      text,
      tokens: lexer2.inlineTokens(text)
    };
    lexer2.state.inLink = false;
    return token;
  }
  return {
    type: "image",
    raw,
    href,
    title,
    text
  };
}
__name(outputLink, "outputLink");
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
__name(indentCodeCompensation, "indentCodeCompensation");
var _Tokenizer = class {
  static {
    __name(this, "_Tokenizer");
  }
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match)
      return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric))
      return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim)
          continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0)
          continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  static {
    __name(this, "_Lexer");
  }
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  static {
    __name(this, "_Renderer");
  }
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body)
      body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text }) {
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  static {
    __name(this, "_TextRenderer");
  }
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  static {
    __name(this, "_Parser");
  }
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  static {
    __name(this, "_Hooks");
  }
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  static {
    __name(this, "Marked");
  }
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse = /* @__PURE__ */ __name((src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    }, "parse");
    return parse;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
__name(marked, "marked");
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// ../node_modules/openai/internal/qs/formats.mjs
var default_format = "RFC3986";
var formatters = {
  RFC1738: /* @__PURE__ */ __name((v) => String(v).replace(/%20/g, "+"), "RFC1738"),
  RFC3986: /* @__PURE__ */ __name((v) => String(v), "RFC3986")
};
var RFC1738 = "RFC1738";

// ../node_modules/openai/internal/qs/utils.mjs
var is_array = Array.isArray;
var hex_table = (() => {
  const array = [];
  for (let i = 0; i < 256; ++i) {
    array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
  }
  return array;
})();
var limit = 1024;
var encode = /* @__PURE__ */ __name((str2, _defaultEncoder, charset, _kind, format) => {
  if (str2.length === 0) {
    return str2;
  }
  let string = str2;
  if (typeof str2 === "symbol") {
    string = Symbol.prototype.toString.call(str2);
  } else if (typeof str2 !== "string") {
    string = String(str2);
  }
  if (charset === "iso-8859-1") {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
      return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
    });
  }
  let out = "";
  for (let j = 0; j < string.length; j += limit) {
    const segment = string.length >= limit ? string.slice(j, j + limit) : string;
    const arr = [];
    for (let i = 0; i < segment.length; ++i) {
      let c = segment.charCodeAt(i);
      if (c === 45 || // -
      c === 46 || // .
      c === 95 || // _
      c === 126 || // ~
      c >= 48 && c <= 57 || // 0-9
      c >= 65 && c <= 90 || // a-z
      c >= 97 && c <= 122 || // A-Z
      format === RFC1738 && (c === 40 || c === 41)) {
        arr[arr.length] = segment.charAt(i);
        continue;
      }
      if (c < 128) {
        arr[arr.length] = hex_table[c];
        continue;
      }
      if (c < 2048) {
        arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
        continue;
      }
      if (c < 55296 || c >= 57344) {
        arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
        continue;
      }
      i += 1;
      c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
      arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
    }
    out += arr.join("");
  }
  return out;
}, "encode");
function is_buffer(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
__name(is_buffer, "is_buffer");
function maybe_map(val, fn) {
  if (is_array(val)) {
    const mapped = [];
    for (let i = 0; i < val.length; i += 1) {
      mapped.push(fn(val[i]));
    }
    return mapped;
  }
  return fn(val);
}
__name(maybe_map, "maybe_map");

// ../node_modules/openai/internal/qs/stringify.mjs
var has = Object.prototype.hasOwnProperty;
var array_prefix_generators = {
  brackets(prefix) {
    return String(prefix) + "[]";
  },
  comma: "comma",
  indices(prefix, key) {
    return String(prefix) + "[" + key + "]";
  },
  repeat(prefix) {
    return String(prefix);
  }
};
var is_array2 = Array.isArray;
var push = Array.prototype.push;
var push_to_array = /* @__PURE__ */ __name(function(arr, value_or_array) {
  push.apply(arr, is_array2(value_or_array) ? value_or_array : [value_or_array]);
}, "push_to_array");
var to_ISO = Date.prototype.toISOString;
var defaults = {
  addQueryPrefix: false,
  allowDots: false,
  allowEmptyArrays: false,
  arrayFormat: "indices",
  charset: "utf-8",
  charsetSentinel: false,
  delimiter: "&",
  encode: true,
  encodeDotInKeys: false,
  encoder: encode,
  encodeValuesOnly: false,
  format: default_format,
  formatter: formatters[default_format],
  /** @deprecated */
  indices: false,
  serializeDate(date) {
    return to_ISO.call(date);
  },
  skipNulls: false,
  strictNullHandling: false
};
function is_non_nullish_primitive(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
__name(is_non_nullish_primitive, "is_non_nullish_primitive");
var sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
  let obj = object;
  let tmp_sc = sideChannel;
  let step = 0;
  let find_flag = false;
  while ((tmp_sc = tmp_sc.get(sentinel)) !== void 0 && !find_flag) {
    const pos = tmp_sc.get(object);
    step += 1;
    if (typeof pos !== "undefined") {
      if (pos === step) {
        throw new RangeError("Cyclic object value");
      } else {
        find_flag = true;
      }
    }
    if (typeof tmp_sc.get(sentinel) === "undefined") {
      step = 0;
    }
  }
  if (typeof filter === "function") {
    obj = filter(prefix, obj);
  } else if (obj instanceof Date) {
    obj = serializeDate?.(obj);
  } else if (generateArrayPrefix === "comma" && is_array2(obj)) {
    obj = maybe_map(obj, function(value) {
      if (value instanceof Date) {
        return serializeDate?.(value);
      }
      return value;
    });
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder && !encodeValuesOnly ? (
        // @ts-expect-error
        encoder(prefix, defaults.encoder, charset, "key", format)
      ) : prefix;
    }
    obj = "";
  }
  if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
    if (encoder) {
      const key_value = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format);
      return [
        formatter?.(key_value) + "=" + // @ts-expect-error
        formatter?.(encoder(obj, defaults.encoder, charset, "value", format))
      ];
    }
    return [formatter?.(prefix) + "=" + formatter?.(String(obj))];
  }
  const values = [];
  if (typeof obj === "undefined") {
    return values;
  }
  let obj_keys;
  if (generateArrayPrefix === "comma" && is_array2(obj)) {
    if (encodeValuesOnly && encoder) {
      obj = maybe_map(obj, encoder);
    }
    obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
  } else if (is_array2(filter)) {
    obj_keys = filter;
  } else {
    const keys = Object.keys(obj);
    obj_keys = sort ? keys.sort(sort) : keys;
  }
  const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
  const adjusted_prefix = commaRoundTrip && is_array2(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
  if (allowEmptyArrays && is_array2(obj) && obj.length === 0) {
    return adjusted_prefix + "[]";
  }
  for (let j = 0; j < obj_keys.length; ++j) {
    const key = obj_keys[j];
    const value = (
      // @ts-ignore
      typeof key === "object" && typeof key.value !== "undefined" ? key.value : obj[key]
    );
    if (skipNulls && value === null) {
      continue;
    }
    const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
    const key_prefix = is_array2(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix : adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
    sideChannel.set(object, step);
    const valueSideChannel = /* @__PURE__ */ new WeakMap();
    valueSideChannel.set(sentinel, sideChannel);
    push_to_array(values, inner_stringify(
      value,
      key_prefix,
      generateArrayPrefix,
      commaRoundTrip,
      allowEmptyArrays,
      strictNullHandling,
      skipNulls,
      encodeDotInKeys,
      // @ts-ignore
      generateArrayPrefix === "comma" && encodeValuesOnly && is_array2(obj) ? null : encoder,
      filter,
      sort,
      allowDots,
      serializeDate,
      format,
      formatter,
      encodeValuesOnly,
      charset,
      valueSideChannel
    ));
  }
  return values;
}
__name(inner_stringify, "inner_stringify");
function normalize_stringify_options(opts = defaults) {
  if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  }
  if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  }
  if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
    throw new TypeError("Encoder has to be a function.");
  }
  const charset = opts.charset || defaults.charset;
  if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  }
  let format = default_format;
  if (typeof opts.format !== "undefined") {
    if (!has.call(formatters, opts.format)) {
      throw new TypeError("Unknown format option provided.");
    }
    format = opts.format;
  }
  const formatter = formatters[format];
  let filter = defaults.filter;
  if (typeof opts.filter === "function" || is_array2(opts.filter)) {
    filter = opts.filter;
  }
  let arrayFormat;
  if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
    arrayFormat = opts.arrayFormat;
  } else if ("indices" in opts) {
    arrayFormat = opts.indices ? "indices" : "repeat";
  } else {
    arrayFormat = defaults.arrayFormat;
  }
  if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  }
  const allowDots = typeof opts.allowDots === "undefined" ? !!opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
    // @ts-ignore
    allowDots,
    allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
    arrayFormat,
    charset,
    charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
    commaRoundTrip: !!opts.commaRoundTrip,
    delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
    encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
    encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter,
    format,
    formatter,
    serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
    // @ts-ignore
    sort: typeof opts.sort === "function" ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
  };
}
__name(normalize_stringify_options, "normalize_stringify_options");
function stringify(object, opts = {}) {
  let obj = object;
  const options2 = normalize_stringify_options(opts);
  let obj_keys;
  let filter;
  if (typeof options2.filter === "function") {
    filter = options2.filter;
    obj = filter("", obj);
  } else if (is_array2(options2.filter)) {
    filter = options2.filter;
    obj_keys = filter;
  }
  const keys = [];
  if (typeof obj !== "object" || obj === null) {
    return "";
  }
  const generateArrayPrefix = array_prefix_generators[options2.arrayFormat];
  const commaRoundTrip = generateArrayPrefix === "comma" && options2.commaRoundTrip;
  if (!obj_keys) {
    obj_keys = Object.keys(obj);
  }
  if (options2.sort) {
    obj_keys.sort(options2.sort);
  }
  const sideChannel = /* @__PURE__ */ new WeakMap();
  for (let i = 0; i < obj_keys.length; ++i) {
    const key = obj_keys[i];
    if (options2.skipNulls && obj[key] === null) {
      continue;
    }
    push_to_array(keys, inner_stringify(
      obj[key],
      key,
      // @ts-expect-error
      generateArrayPrefix,
      commaRoundTrip,
      options2.allowEmptyArrays,
      options2.strictNullHandling,
      options2.skipNulls,
      options2.encodeDotInKeys,
      options2.encode ? options2.encoder : null,
      options2.filter,
      options2.sort,
      options2.allowDots,
      options2.serializeDate,
      options2.format,
      options2.formatter,
      options2.encodeValuesOnly,
      options2.charset,
      sideChannel
    ));
  }
  const joined = keys.join(options2.delimiter);
  let prefix = options2.addQueryPrefix === true ? "?" : "";
  if (options2.charsetSentinel) {
    if (options2.charset === "iso-8859-1") {
      prefix += "utf8=%26%2310003%3B&";
    } else {
      prefix += "utf8=%E2%9C%93&";
    }
  }
  return joined.length > 0 ? prefix + joined : "";
}
__name(stringify, "stringify");

// ../node_modules/openai/version.mjs
var VERSION = "4.87.3";

// ../node_modules/openai/_shims/registry.mjs
var auto = false;
var kind = void 0;
var fetch2 = void 0;
var Request2 = void 0;
var Response2 = void 0;
var Headers2 = void 0;
var FormData2 = void 0;
var Blob2 = void 0;
var File2 = void 0;
var ReadableStream2 = void 0;
var getMultipartRequestOptions = void 0;
var getDefaultAgent = void 0;
var fileFromPath = void 0;
var isFsReadStream = void 0;
function setShims(shims, options2 = { auto: false }) {
  if (auto) {
    throw new Error(`you must \`import 'openai/shims/${shims.kind}'\` before importing anything else from openai`);
  }
  if (kind) {
    throw new Error(`can't \`import 'openai/shims/${shims.kind}'\` after \`import 'openai/shims/${kind}'\``);
  }
  auto = options2.auto;
  kind = shims.kind;
  fetch2 = shims.fetch;
  Request2 = shims.Request;
  Response2 = shims.Response;
  Headers2 = shims.Headers;
  FormData2 = shims.FormData;
  Blob2 = shims.Blob;
  File2 = shims.File;
  ReadableStream2 = shims.ReadableStream;
  getMultipartRequestOptions = shims.getMultipartRequestOptions;
  getDefaultAgent = shims.getDefaultAgent;
  fileFromPath = shims.fileFromPath;
  isFsReadStream = shims.isFsReadStream;
}
__name(setShims, "setShims");

// ../node_modules/openai/_shims/MultipartBody.mjs
var MultipartBody = class {
  static {
    __name(this, "MultipartBody");
  }
  constructor(body) {
    this.body = body;
  }
  get [Symbol.toStringTag]() {
    return "MultipartBody";
  }
};

// ../node_modules/openai/_shims/web-runtime.mjs
function getRuntime({ manuallyImported } = {}) {
  const recommendation = manuallyImported ? `You may need to use polyfills` : `Add one of these imports before your first \`import \u2026 from 'openai'\`:
- \`import 'openai/shims/node'\` (if you're running on Node)
- \`import 'openai/shims/web'\` (otherwise)
`;
  let _fetch, _Request, _Response, _Headers;
  try {
    _fetch = fetch;
    _Request = Request;
    _Response = Response;
    _Headers = Headers;
  } catch (error) {
    throw new Error(`this environment is missing the following Web Fetch API type: ${error.message}. ${recommendation}`);
  }
  return {
    kind: "web",
    fetch: _fetch,
    Request: _Request,
    Response: _Response,
    Headers: _Headers,
    FormData: (
      // @ts-ignore
      typeof FormData !== "undefined" ? FormData : class FormData {
        static {
          __name(this, "FormData");
        }
        // @ts-ignore
        constructor() {
          throw new Error(`file uploads aren't supported in this environment yet as 'FormData' is undefined. ${recommendation}`);
        }
      }
    ),
    Blob: typeof Blob !== "undefined" ? Blob : class Blob {
      static {
        __name(this, "Blob");
      }
      constructor() {
        throw new Error(`file uploads aren't supported in this environment yet as 'Blob' is undefined. ${recommendation}`);
      }
    },
    File: (
      // @ts-ignore
      typeof File !== "undefined" ? File : class File {
        static {
          __name(this, "File");
        }
        // @ts-ignore
        constructor() {
          throw new Error(`file uploads aren't supported in this environment yet as 'File' is undefined. ${recommendation}`);
        }
      }
    ),
    ReadableStream: (
      // @ts-ignore
      typeof ReadableStream !== "undefined" ? ReadableStream : class ReadableStream {
        static {
          __name(this, "ReadableStream");
        }
        // @ts-ignore
        constructor() {
          throw new Error(`streaming isn't supported in this environment yet as 'ReadableStream' is undefined. ${recommendation}`);
        }
      }
    ),
    getMultipartRequestOptions: /* @__PURE__ */ __name(async (form, opts) => ({
      ...opts,
      body: new MultipartBody(form)
    }), "getMultipartRequestOptions"),
    getDefaultAgent: /* @__PURE__ */ __name((url) => void 0, "getDefaultAgent"),
    fileFromPath: /* @__PURE__ */ __name(() => {
      throw new Error("The `fileFromPath` function is only supported in Node. See the README for more details: https://www.github.com/openai/openai-node#file-uploads");
    }, "fileFromPath"),
    isFsReadStream: /* @__PURE__ */ __name((value) => false, "isFsReadStream")
  };
}
__name(getRuntime, "getRuntime");

// ../node_modules/openai/_shims/index.mjs
if (!kind) setShims(getRuntime(), { auto: true });

// ../node_modules/openai/error.mjs
var OpenAIError = class extends Error {
  static {
    __name(this, "OpenAIError");
  }
};
var APIError = class _APIError extends OpenAIError {
  static {
    __name(this, "APIError");
  }
  constructor(status, error, message, headers) {
    super(`${_APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.request_id = headers?.["x-request-id"];
    this.error = error;
    const data = error;
    this.code = data?.["code"];
    this.param = data?.["param"];
    this.type = data?.["type"];
  }
  static makeMessage(status, error, message) {
    const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
    if (status && msg) {
      return `${status} ${msg}`;
    }
    if (status) {
      return `${status} status code (no body)`;
    }
    if (msg) {
      return msg;
    }
    return "(no status code or body)";
  }
  static generate(status, errorResponse, message, headers) {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }
    const error = errorResponse?.["error"];
    if (status === 400) {
      return new BadRequestError(status, error, message, headers);
    }
    if (status === 401) {
      return new AuthenticationError(status, error, message, headers);
    }
    if (status === 403) {
      return new PermissionDeniedError(status, error, message, headers);
    }
    if (status === 404) {
      return new NotFoundError(status, error, message, headers);
    }
    if (status === 409) {
      return new ConflictError(status, error, message, headers);
    }
    if (status === 422) {
      return new UnprocessableEntityError(status, error, message, headers);
    }
    if (status === 429) {
      return new RateLimitError(status, error, message, headers);
    }
    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }
    return new _APIError(status, error, message, headers);
  }
};
var APIUserAbortError = class extends APIError {
  static {
    __name(this, "APIUserAbortError");
  }
  constructor({ message } = {}) {
    super(void 0, void 0, message || "Request was aborted.", void 0);
  }
};
var APIConnectionError = class extends APIError {
  static {
    __name(this, "APIConnectionError");
  }
  constructor({ message, cause }) {
    super(void 0, void 0, message || "Connection error.", void 0);
    if (cause)
      this.cause = cause;
  }
};
var APIConnectionTimeoutError = class extends APIConnectionError {
  static {
    __name(this, "APIConnectionTimeoutError");
  }
  constructor({ message } = {}) {
    super({ message: message ?? "Request timed out." });
  }
};
var BadRequestError = class extends APIError {
  static {
    __name(this, "BadRequestError");
  }
};
var AuthenticationError = class extends APIError {
  static {
    __name(this, "AuthenticationError");
  }
};
var PermissionDeniedError = class extends APIError {
  static {
    __name(this, "PermissionDeniedError");
  }
};
var NotFoundError = class extends APIError {
  static {
    __name(this, "NotFoundError");
  }
};
var ConflictError = class extends APIError {
  static {
    __name(this, "ConflictError");
  }
};
var UnprocessableEntityError = class extends APIError {
  static {
    __name(this, "UnprocessableEntityError");
  }
};
var RateLimitError = class extends APIError {
  static {
    __name(this, "RateLimitError");
  }
};
var InternalServerError = class extends APIError {
  static {
    __name(this, "InternalServerError");
  }
};
var LengthFinishReasonError = class extends OpenAIError {
  static {
    __name(this, "LengthFinishReasonError");
  }
  constructor() {
    super(`Could not parse response content as the length limit was reached`);
  }
};
var ContentFilterFinishReasonError = class extends OpenAIError {
  static {
    __name(this, "ContentFilterFinishReasonError");
  }
  constructor() {
    super(`Could not parse response content as the request was rejected by the content filter`);
  }
};

// ../node_modules/openai/internal/decoders/line.mjs
var __classPrivateFieldSet = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _LineDecoder_carriageReturnIndex;
var LineDecoder = class {
  static {
    __name(this, "LineDecoder");
  }
  constructor() {
    _LineDecoder_carriageReturnIndex.set(this, void 0);
    this.buffer = new Uint8Array();
    __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
  }
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    let newData = new Uint8Array(this.buffer.length + binaryChunk.length);
    newData.set(this.buffer);
    newData.set(binaryChunk, this.buffer.length);
    this.buffer = newData;
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(this.buffer, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
      if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
        continue;
      }
      if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null && (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
        lines.push(this.decodeText(this.buffer.slice(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
        this.buffer = this.buffer.slice(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"));
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        continue;
      }
      const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
      const line = this.decodeText(this.buffer.slice(0, endIndex));
      lines.push(line);
      this.buffer = this.buffer.slice(patternIndex.index);
      __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    return lines;
  }
  decodeText(bytes) {
    if (bytes == null)
      return "";
    if (typeof bytes === "string")
      return bytes;
    if (typeof Buffer !== "undefined") {
      if (bytes instanceof Buffer) {
        return bytes.toString();
      }
      if (bytes instanceof Uint8Array) {
        return Buffer.from(bytes).toString();
      }
      throw new OpenAIError(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`);
    }
    if (typeof TextDecoder !== "undefined") {
      if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
        this.textDecoder ?? (this.textDecoder = new TextDecoder("utf8"));
        return this.textDecoder.decode(bytes);
      }
      throw new OpenAIError(`Unexpected: received non-Uint8Array/ArrayBuffer (${bytes.constructor.name}) in a web platform. Please report this error.`);
    }
    throw new OpenAIError(`Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.`);
  }
  flush() {
    if (!this.buffer.length) {
      return [];
    }
    return this.decode("\n");
  }
};
_LineDecoder_carriageReturnIndex = /* @__PURE__ */ new WeakMap();
LineDecoder.NEWLINE_CHARS = /* @__PURE__ */ new Set(["\n", "\r"]);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function findNewlineIndex(buffer, startIndex) {
  const newline2 = 10;
  const carriage = 13;
  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    if (buffer[i] === newline2) {
      return { preceding: i, index: i + 1, carriage: false };
    }
    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }
  return null;
}
__name(findNewlineIndex, "findNewlineIndex");
function findDoubleNewlineIndex(buffer) {
  const newline2 = 10;
  const carriage = 13;
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === newline2 && buffer[i + 1] === newline2) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === carriage) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === newline2 && i + 3 < buffer.length && buffer[i + 2] === carriage && buffer[i + 3] === newline2) {
      return i + 4;
    }
  }
  return -1;
}
__name(findDoubleNewlineIndex, "findDoubleNewlineIndex");

// ../node_modules/openai/internal/stream-utils.mjs
function ReadableStreamToAsyncIterable(stream) {
  if (stream[Symbol.asyncIterator])
    return stream;
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done)
          reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
__name(ReadableStreamToAsyncIterable, "ReadableStreamToAsyncIterable");

// ../node_modules/openai/streaming.mjs
var Stream = class _Stream {
  static {
    __name(this, "Stream");
  }
  constructor(iterator, controller) {
    this.iterator = iterator;
    this.controller = controller;
  }
  static fromSSEResponse(response, controller) {
    let consumed = false;
    async function* iterator() {
      if (consumed) {
        throw new Error("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (done)
            continue;
          if (sse.data.startsWith("[DONE]")) {
            done = true;
            continue;
          }
          if (sse.event === null || sse.event.startsWith("response.")) {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              console.error(`Could not parse message into JSON:`, sse.data);
              console.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (data && data.error) {
              throw new APIError(void 0, data.error, void 0, void 0);
            }
            yield data;
          } else {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              console.error(`Could not parse message into JSON:`, sse.data);
              console.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (sse.event == "error") {
              throw new APIError(void 0, data.error, data.message, void 0);
            }
            yield { event: sse.event, data };
          }
        }
        done = true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError")
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    __name(iterator, "iterator");
    return new _Stream(iterator, controller);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(readableStream, controller) {
    let consumed = false;
    async function* iterLines() {
      const lineDecoder = new LineDecoder();
      const iter = ReadableStreamToAsyncIterable(readableStream);
      for await (const chunk of iter) {
        for (const line of lineDecoder.decode(chunk)) {
          yield line;
        }
      }
      for (const line of lineDecoder.flush()) {
        yield line;
      }
    }
    __name(iterLines, "iterLines");
    async function* iterator() {
      if (consumed) {
        throw new Error("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const line of iterLines()) {
          if (done)
            continue;
          if (line)
            yield JSON.parse(line);
        }
        done = true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError")
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    __name(iterator, "iterator");
    return new _Stream(iterator, controller);
  }
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const left = [];
    const right = [];
    const iterator = this.iterator();
    const teeIterator = /* @__PURE__ */ __name((queue) => {
      return {
        next: /* @__PURE__ */ __name(() => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift();
        }, "next")
      };
    }, "teeIterator");
    return [
      new _Stream(() => teeIterator(left), this.controller),
      new _Stream(() => teeIterator(right), this.controller)
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const self = this;
    let iter;
    const encoder = new TextEncoder();
    return new ReadableStream2({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl) {
        try {
          const { value, done } = await iter.next();
          if (done)
            return ctrl.close();
          const bytes = encoder.encode(JSON.stringify(value) + "\n");
          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      }
    });
  }
};
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    throw new OpenAIError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder();
  const lineDecoder = new LineDecoder();
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse)
        yield sse;
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse)
      yield sse;
  }
}
__name(_iterSSEMessages, "_iterSSEMessages");
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array();
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    let newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }
  if (data.length > 0) {
    yield data;
  }
}
__name(iterSSEChunks, "iterSSEChunks");
var SSEDecoder = class {
  static {
    __name(this, "SSEDecoder");
  }
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length)
        return null;
      const sse = {
        event: this.event,
        data: this.data.join("\n"),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldname, _, value] = partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
};
function partition(str2, delimiter) {
  const index = str2.indexOf(delimiter);
  if (index !== -1) {
    return [str2.substring(0, index), delimiter, str2.substring(index + delimiter.length)];
  }
  return [str2, "", ""];
}
__name(partition, "partition");

// ../node_modules/openai/uploads.mjs
var isResponseLike = /* @__PURE__ */ __name((value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function", "isResponseLike");
var isFileLike = /* @__PURE__ */ __name((value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value), "isFileLike");
var isBlobLike = /* @__PURE__ */ __name((value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function", "isBlobLike");
var isUploadable = /* @__PURE__ */ __name((value) => {
  return isFileLike(value) || isResponseLike(value) || isFsReadStream(value);
}, "isUploadable");
async function toFile(value, name, options2) {
  value = await value;
  if (isFileLike(value)) {
    return value;
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop() ?? "unknown_file");
    const data = isBlobLike(blob) ? [await blob.arrayBuffer()] : [blob];
    return new File2(data, name, options2);
  }
  const bits = await getBytes(value);
  name || (name = getName(value) ?? "unknown_file");
  if (!options2?.type) {
    const type = bits[0]?.type;
    if (typeof type === "string") {
      options2 = { ...options2, type };
    }
  }
  return new File2(bits, name, options2);
}
__name(toFile, "toFile");
async function getBytes(value) {
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
  value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(await value.arrayBuffer());
  } else if (isAsyncIterableIterator(value)) {
    for await (const chunk of value) {
      parts.push(chunk);
    }
  } else {
    throw new Error(`Unexpected data type: ${typeof value}; constructor: ${value?.constructor?.name}; props: ${propsForError(value)}`);
  }
  return parts;
}
__name(getBytes, "getBytes");
function propsForError(value) {
  const props = Object.getOwnPropertyNames(value);
  return `[${props.map((p) => `"${p}"`).join(", ")}]`;
}
__name(propsForError, "propsForError");
function getName(value) {
  return getStringFromMaybeBuffer(value.name) || getStringFromMaybeBuffer(value.filename) || // For fs.ReadStream
  getStringFromMaybeBuffer(value.path)?.split(/[\\/]/).pop();
}
__name(getName, "getName");
var getStringFromMaybeBuffer = /* @__PURE__ */ __name((x) => {
  if (typeof x === "string")
    return x;
  if (typeof Buffer !== "undefined" && x instanceof Buffer)
    return String(x);
  return void 0;
}, "getStringFromMaybeBuffer");
var isAsyncIterableIterator = /* @__PURE__ */ __name((value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function", "isAsyncIterableIterator");
var isMultipartBody = /* @__PURE__ */ __name((body) => body && typeof body === "object" && body.body && body[Symbol.toStringTag] === "MultipartBody", "isMultipartBody");
var multipartFormRequestOptions = /* @__PURE__ */ __name(async (opts) => {
  const form = await createForm(opts.body);
  return getMultipartRequestOptions(form, opts);
}, "multipartFormRequestOptions");
var createForm = /* @__PURE__ */ __name(async (body) => {
  const form = new FormData2();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
  return form;
}, "createForm");
var addFormValue = /* @__PURE__ */ __name(async (form, key, value) => {
  if (value === void 0)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (isUploadable(value)) {
    const file = await toFile(value);
    form.append(key, file);
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
}, "addFormValue");

// ../node_modules/openai/core.mjs
var __classPrivateFieldSet2 = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet2 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractPage_client;
async function defaultParseResponse(props) {
  const { response } = props;
  if (props.options.stream) {
    debug("response", response.status, response.url, response.headers, response.body);
    if (props.options.__streamClass) {
      return props.options.__streamClass.fromSSEResponse(response, props.controller);
    }
    return Stream.fromSSEResponse(response, props.controller);
  }
  if (response.status === 204) {
    return null;
  }
  if (props.options.__binaryResponse) {
    return response;
  }
  const contentType = response.headers.get("content-type");
  const mediaType = contentType?.split(";")[0]?.trim();
  const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
  if (isJSON) {
    const json = await response.json();
    debug("response", response.status, response.url, response.headers, json);
    return _addRequestID(json, response);
  }
  const text = await response.text();
  debug("response", response.status, response.url, response.headers, text);
  return text;
}
__name(defaultParseResponse, "defaultParseResponse");
function _addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("x-request-id"),
    enumerable: false
  });
}
__name(_addRequestID, "_addRequestID");
var APIPromise = class _APIPromise extends Promise {
  static {
    __name(this, "APIPromise");
  }
  constructor(responsePromise, parseResponse2 = defaultParseResponse) {
    super((resolve) => {
      resolve(null);
    });
    this.responsePromise = responsePromise;
    this.parseResponse = parseResponse2;
  }
  _thenUnwrap(transform) {
    return new _APIPromise(this.responsePromise, async (props) => _addRequestID(transform(await this.parseResponse(props), props), props.response));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` if you can,
   * or add one of these imports before your first `import … from 'openai'`:
   * - `import 'openai/shims/node'` (if you're running on Node)
   * - `import 'openai/shims/web'` (otherwise)
   */
  asResponse() {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the X-Request-ID header which is useful for debugging requests and reporting
   * issues to OpenAI.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` if you can,
   * or add one of these imports before your first `import … from 'openai'`:
   * - `import 'openai/shims/node'` (if you're running on Node)
   * - `import 'openai/shims/web'` (otherwise)
   */
  async withResponse() {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response, request_id: response.headers.get("x-request-id") };
  }
  parse() {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then(this.parseResponse);
    }
    return this.parsedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.parse().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.parse().catch(onrejected);
  }
  finally(onfinally) {
    return this.parse().finally(onfinally);
  }
};
var APIClient = class {
  static {
    __name(this, "APIClient");
  }
  constructor({
    baseURL,
    maxRetries = 2,
    timeout = 6e5,
    // 10 minutes
    httpAgent,
    fetch: overriddenFetch
  }) {
    this.baseURL = baseURL;
    this.maxRetries = validatePositiveInteger("maxRetries", maxRetries);
    this.timeout = validatePositiveInteger("timeout", timeout);
    this.httpAgent = httpAgent;
    this.fetch = overriddenFetch ?? fetch2;
  }
  authHeaders(opts) {
    return {};
  }
  /**
   * Override this to add your own default headers, for example:
   *
   *  {
   *    ...super.defaultHeaders(),
   *    Authorization: 'Bearer 123',
   *  }
   */
  defaultHeaders(opts) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": this.getUserAgent(),
      ...getPlatformHeaders(),
      ...this.authHeaders(opts)
    };
  }
  /**
   * Override this to add your own headers validation:
   */
  validateHeaders(headers, customHeaders) {
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  get(path, opts) {
    return this.methodRequest("get", path, opts);
  }
  post(path, opts) {
    return this.methodRequest("post", path, opts);
  }
  patch(path, opts) {
    return this.methodRequest("patch", path, opts);
  }
  put(path, opts) {
    return this.methodRequest("put", path, opts);
  }
  delete(path, opts) {
    return this.methodRequest("delete", path, opts);
  }
  methodRequest(method, path, opts) {
    return this.request(Promise.resolve(opts).then(async (opts2) => {
      const body = opts2 && isBlobLike(opts2?.body) ? new DataView(await opts2.body.arrayBuffer()) : opts2?.body instanceof DataView ? opts2.body : opts2?.body instanceof ArrayBuffer ? new DataView(opts2.body) : opts2 && ArrayBuffer.isView(opts2?.body) ? new DataView(opts2.body.buffer) : opts2?.body;
      return { method, path, ...opts2, body };
    }));
  }
  getAPIList(path, Page2, opts) {
    return this.requestAPIList(Page2, { method: "get", path, ...opts });
  }
  calculateContentLength(body) {
    if (typeof body === "string") {
      if (typeof Buffer !== "undefined") {
        return Buffer.byteLength(body, "utf8").toString();
      }
      if (typeof TextEncoder !== "undefined") {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(body);
        return encoded.length.toString();
      }
    } else if (ArrayBuffer.isView(body)) {
      return body.byteLength.toString();
    }
    return null;
  }
  buildRequest(options2, { retryCount = 0 } = {}) {
    options2 = { ...options2 };
    const { method, path, query, headers = {} } = options2;
    const body = ArrayBuffer.isView(options2.body) || options2.__binaryRequest && typeof options2.body === "string" ? options2.body : isMultipartBody(options2.body) ? options2.body.body : options2.body ? JSON.stringify(options2.body, null, 2) : null;
    const contentLength = this.calculateContentLength(body);
    const url = this.buildURL(path, query);
    if ("timeout" in options2)
      validatePositiveInteger("timeout", options2.timeout);
    options2.timeout = options2.timeout ?? this.timeout;
    const httpAgent = options2.httpAgent ?? this.httpAgent ?? getDefaultAgent(url);
    const minAgentTimeout = options2.timeout + 1e3;
    if (typeof httpAgent?.options?.timeout === "number" && minAgentTimeout > (httpAgent.options.timeout ?? 0)) {
      httpAgent.options.timeout = minAgentTimeout;
    }
    if (this.idempotencyHeader && method !== "get") {
      if (!options2.idempotencyKey)
        options2.idempotencyKey = this.defaultIdempotencyKey();
      headers[this.idempotencyHeader] = options2.idempotencyKey;
    }
    const reqHeaders = this.buildHeaders({ options: options2, headers, contentLength, retryCount });
    const req = {
      method,
      ...body && { body },
      headers: reqHeaders,
      ...httpAgent && { agent: httpAgent },
      // @ts-ignore node-fetch uses a custom AbortSignal type that is
      // not compatible with standard web types
      signal: options2.signal ?? null
    };
    return { req, url, timeout: options2.timeout };
  }
  buildHeaders({ options: options2, headers, contentLength, retryCount }) {
    const reqHeaders = {};
    if (contentLength) {
      reqHeaders["content-length"] = contentLength;
    }
    const defaultHeaders = this.defaultHeaders(options2);
    applyHeadersMut(reqHeaders, defaultHeaders);
    applyHeadersMut(reqHeaders, headers);
    if (isMultipartBody(options2.body) && kind !== "node") {
      delete reqHeaders["content-type"];
    }
    if (getHeader(defaultHeaders, "x-stainless-retry-count") === void 0 && getHeader(headers, "x-stainless-retry-count") === void 0) {
      reqHeaders["x-stainless-retry-count"] = String(retryCount);
    }
    if (getHeader(defaultHeaders, "x-stainless-timeout") === void 0 && getHeader(headers, "x-stainless-timeout") === void 0 && options2.timeout) {
      reqHeaders["x-stainless-timeout"] = String(options2.timeout);
    }
    this.validateHeaders(reqHeaders, headers);
    return reqHeaders;
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(options2) {
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(request, { url, options: options2 }) {
  }
  parseHeaders(headers) {
    return !headers ? {} : Symbol.iterator in headers ? Object.fromEntries(Array.from(headers).map((header) => [...header])) : { ...headers };
  }
  makeStatusError(status, error, message, headers) {
    return APIError.generate(status, error, message, headers);
  }
  request(options2, remainingRetries = null) {
    return new APIPromise(this.makeRequest(options2, remainingRetries));
  }
  async makeRequest(optionsInput, retriesRemaining) {
    const options2 = await optionsInput;
    const maxRetries = options2.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options2);
    const { req, url, timeout } = this.buildRequest(options2, { retryCount: maxRetries - retriesRemaining });
    await this.prepareRequest(req, { url, options: options2 });
    debug("request", url, options2, req.headers);
    if (options2.signal?.aborted) {
      throw new APIUserAbortError();
    }
    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    if (response instanceof Error) {
      if (options2.signal?.aborted) {
        throw new APIUserAbortError();
      }
      if (retriesRemaining) {
        return this.retryRequest(options2, retriesRemaining);
      }
      if (response.name === "AbortError") {
        throw new APIConnectionTimeoutError();
      }
      throw new APIConnectionError({ cause: response });
    }
    const responseHeaders = createResponseHeaders(response.headers);
    if (!response.ok) {
      if (retriesRemaining && this.shouldRetry(response)) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        debug(`response (error; ${retryMessage2})`, response.status, url, responseHeaders);
        return this.retryRequest(options2, retriesRemaining, responseHeaders);
      }
      const errText = await response.text().catch((e) => castToError(e).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? void 0 : errText;
      const retryMessage = retriesRemaining ? `(error; no more retries left)` : `(error; not retryable)`;
      debug(`response (error; ${retryMessage})`, response.status, url, responseHeaders, errMessage);
      const err = this.makeStatusError(response.status, errJSON, errMessage, responseHeaders);
      throw err;
    }
    return { response, options: options2, controller };
  }
  requestAPIList(Page2, options2) {
    const request = this.makeRequest(options2, null);
    return new PagePromise(this, request, Page2);
  }
  buildURL(path, query) {
    const url = isAbsoluteURL(path) ? new URL(path) : new URL(this.baseURL + (this.baseURL.endsWith("/") && path.startsWith("/") ? path.slice(1) : path));
    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  stringifyQuery(query) {
    return Object.entries(query).filter(([_, value]) => typeof value !== "undefined").map(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
      if (value === null) {
        return `${encodeURIComponent(key)}=`;
      }
      throw new OpenAIError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  async fetchWithTimeout(url, init, ms, controller) {
    const { signal, ...options2 } = init || {};
    if (signal)
      signal.addEventListener("abort", () => controller.abort());
    const timeout = setTimeout(() => controller.abort(), ms);
    const fetchOptions = {
      signal: controller.signal,
      ...options2
    };
    if (fetchOptions.method) {
      fetchOptions.method = fetchOptions.method.toUpperCase();
    }
    return (
      // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
      this.fetch.call(void 0, url, fetchOptions).finally(() => {
        clearTimeout(timeout);
      })
    );
  }
  shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options2, retriesRemaining, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.["retry-after-ms"];
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.["retry-after"];
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1e3;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1e3)) {
      const maxRetries = options2.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options2, retriesRemaining - 1);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1e3;
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
};
var AbstractPage = class {
  static {
    __name(this, "AbstractPage");
  }
  constructor(client, response, body, options2) {
    _AbstractPage_client.set(this, void 0);
    __classPrivateFieldSet2(this, _AbstractPage_client, client, "f");
    this.options = options2;
    this.response = response;
    this.body = body;
  }
  hasNextPage() {
    const items = this.getPaginatedItems();
    if (!items.length)
      return false;
    return this.nextPageInfo() != null;
  }
  async getNextPage() {
    const nextInfo = this.nextPageInfo();
    if (!nextInfo) {
      throw new OpenAIError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    }
    const nextOptions = { ...this.options };
    if ("params" in nextInfo && typeof nextOptions.query === "object") {
      nextOptions.query = { ...nextOptions.query, ...nextInfo.params };
    } else if ("url" in nextInfo) {
      const params = [...Object.entries(nextOptions.query || {}), ...nextInfo.url.searchParams.entries()];
      for (const [key, value] of params) {
        nextInfo.url.searchParams.set(key, value);
      }
      nextOptions.query = void 0;
      nextOptions.path = nextInfo.url.toString();
    }
    return await __classPrivateFieldGet2(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
  }
  async *iterPages() {
    let page = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }
  async *[(_AbstractPage_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    for await (const page of this.iterPages()) {
      for (const item of page.getPaginatedItems()) {
        yield item;
      }
    }
  }
};
var PagePromise = class extends APIPromise {
  static {
    __name(this, "PagePromise");
  }
  constructor(client, request, Page2) {
    super(request, async (props) => new Page2(client, props.response, await defaultParseResponse(props), props.options));
  }
  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const page = await this;
    for await (const item of page) {
      yield item;
    }
  }
};
var createResponseHeaders = /* @__PURE__ */ __name((headers) => {
  return new Proxy(Object.fromEntries(
    // @ts-ignore
    headers.entries()
  ), {
    get(target, name) {
      const key = name.toString();
      return target[key.toLowerCase()] || target[key];
    }
  });
}, "createResponseHeaders");
var requestOptionsKeys = {
  method: true,
  path: true,
  query: true,
  body: true,
  headers: true,
  maxRetries: true,
  stream: true,
  timeout: true,
  httpAgent: true,
  signal: true,
  idempotencyKey: true,
  __metadata: true,
  __binaryRequest: true,
  __binaryResponse: true,
  __streamClass: true
};
var isRequestOptions = /* @__PURE__ */ __name((obj) => {
  return typeof obj === "object" && obj !== null && !isEmptyObj(obj) && Object.keys(obj).every((k) => hasOwn(requestOptionsKeys, k));
}, "isRequestOptions");
var getPlatformProperties = /* @__PURE__ */ __name(() => {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": process.version
    };
  }
  if (Object.prototype.toString.call(typeof process !== "undefined" ? process : 0) === "[object process]") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(process.platform),
      "X-Stainless-Arch": normalizeArch(process.arch),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": process.version
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
}, "getPlatformProperties");
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec("Cloudflare-Workers");
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
__name(getBrowserInfo, "getBrowserInfo");
var normalizeArch = /* @__PURE__ */ __name((arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
}, "normalizeArch");
var normalizePlatform = /* @__PURE__ */ __name((platform) => {
  platform = platform.toLowerCase();
  if (platform.includes("ios"))
    return "iOS";
  if (platform === "android")
    return "Android";
  if (platform === "darwin")
    return "MacOS";
  if (platform === "win32")
    return "Windows";
  if (platform === "freebsd")
    return "FreeBSD";
  if (platform === "openbsd")
    return "OpenBSD";
  if (platform === "linux")
    return "Linux";
  if (platform)
    return `Other:${platform}`;
  return "Unknown";
}, "normalizePlatform");
var _platformHeaders;
var getPlatformHeaders = /* @__PURE__ */ __name(() => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
}, "getPlatformHeaders");
var safeJSON = /* @__PURE__ */ __name((text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return void 0;
  }
}, "safeJSON");
var startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
var isAbsoluteURL = /* @__PURE__ */ __name((url) => {
  return startsWithSchemeRegexp.test(url);
}, "isAbsoluteURL");
var sleep = /* @__PURE__ */ __name((ms) => new Promise((resolve) => setTimeout(resolve, ms)), "sleep");
var validatePositiveInteger = /* @__PURE__ */ __name((name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new OpenAIError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new OpenAIError(`${name} must be a positive integer`);
  }
  return n;
}, "validatePositiveInteger");
var castToError = /* @__PURE__ */ __name((err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      return new Error(JSON.stringify(err));
    } catch {
    }
  }
  return new Error(err);
}, "castToError");
var readEnv = /* @__PURE__ */ __name((env) => {
  if (typeof process !== "undefined") {
    return process.env?.[env]?.trim() ?? void 0;
  }
  if (typeof Deno !== "undefined") {
    return Deno.env?.get?.(env)?.trim();
  }
  return void 0;
}, "readEnv");
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
__name(isEmptyObj, "isEmptyObj");
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
__name(hasOwn, "hasOwn");
function applyHeadersMut(targetHeaders, newHeaders) {
  for (const k in newHeaders) {
    if (!hasOwn(newHeaders, k))
      continue;
    const lowerKey = k.toLowerCase();
    if (!lowerKey)
      continue;
    const val = newHeaders[k];
    if (val === null) {
      delete targetHeaders[lowerKey];
    } else if (val !== void 0) {
      targetHeaders[lowerKey] = val;
    }
  }
}
__name(applyHeadersMut, "applyHeadersMut");
var SENSITIVE_HEADERS = /* @__PURE__ */ new Set(["authorization", "api-key"]);
function debug(action, ...args) {
  if (typeof process !== "undefined" && process?.env?.["DEBUG"] === "true") {
    const modifiedArgs = args.map((arg) => {
      if (!arg) {
        return arg;
      }
      if (arg["headers"]) {
        const modifiedArg2 = { ...arg, headers: { ...arg["headers"] } };
        for (const header in arg["headers"]) {
          if (SENSITIVE_HEADERS.has(header.toLowerCase())) {
            modifiedArg2["headers"][header] = "REDACTED";
          }
        }
        return modifiedArg2;
      }
      let modifiedArg = null;
      for (const header in arg) {
        if (SENSITIVE_HEADERS.has(header.toLowerCase())) {
          modifiedArg ?? (modifiedArg = { ...arg });
          modifiedArg[header] = "REDACTED";
        }
      }
      return modifiedArg ?? arg;
    });
    console.log(`OpenAI:DEBUG:${action}`, ...modifiedArgs);
  }
}
__name(debug, "debug");
var uuid4 = /* @__PURE__ */ __name(() => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}, "uuid4");
var isRunningInBrowser = /* @__PURE__ */ __name(() => {
  return (
    // @ts-ignore
    typeof window !== "undefined" && // @ts-ignore
    typeof window.document !== "undefined" && // @ts-ignore
    typeof navigator !== "undefined"
  );
}, "isRunningInBrowser");
var isHeadersProtocol = /* @__PURE__ */ __name((headers) => {
  return typeof headers?.get === "function";
}, "isHeadersProtocol");
var getHeader = /* @__PURE__ */ __name((headers, header) => {
  const lowerCasedHeader = header.toLowerCase();
  if (isHeadersProtocol(headers)) {
    const intercapsHeader = header[0]?.toUpperCase() + header.substring(1).replace(/([^\w])(\w)/g, (_m, g1, g2) => g1 + g2.toUpperCase());
    for (const key of [header, lowerCasedHeader, header.toUpperCase(), intercapsHeader]) {
      const value = headers.get(key);
      if (value) {
        return value;
      }
    }
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerCasedHeader) {
      if (Array.isArray(value)) {
        if (value.length <= 1)
          return value[0];
        console.warn(`Received ${value.length} entries for the ${header} header, using the first entry.`);
        return value[0];
      }
      return value;
    }
  }
  return void 0;
}, "getHeader");
function isObj(obj) {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}
__name(isObj, "isObj");

// ../node_modules/openai/pagination.mjs
var Page = class extends AbstractPage {
  static {
    __name(this, "Page");
  }
  constructor(client, response, body, options2) {
    super(client, response, body, options2);
    this.data = body.data || [];
    this.object = body.object;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  // @deprecated Please use `nextPageInfo()` instead
  /**
   * This page represents a response that isn't actually paginated at the API level
   * so there will never be any next page params.
   */
  nextPageParams() {
    return null;
  }
  nextPageInfo() {
    return null;
  }
};
var CursorPage = class extends AbstractPage {
  static {
    __name(this, "CursorPage");
  }
  constructor(client, response, body, options2) {
    super(client, response, body, options2);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams() {
    const info = this.nextPageInfo();
    if (!info)
      return null;
    if ("params" in info)
      return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length)
      return null;
    return params;
  }
  nextPageInfo() {
    const data = this.getPaginatedItems();
    if (!data.length) {
      return null;
    }
    const id = data[data.length - 1]?.id;
    if (!id) {
      return null;
    }
    return { params: { after: id } };
  }
};

// ../node_modules/openai/resource.mjs
var APIResource = class {
  static {
    __name(this, "APIResource");
  }
  constructor(client) {
    this._client = client;
  }
};

// ../node_modules/openai/resources/chat/completions/messages.mjs
var Messages = class extends APIResource {
  static {
    __name(this, "Messages");
  }
  list(completionId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(completionId, {}, query);
    }
    return this._client.getAPIList(`/chat/completions/${completionId}/messages`, ChatCompletionStoreMessagesPage, { query, ...options2 });
  }
};

// ../node_modules/openai/resources/chat/completions/completions.mjs
var Completions = class extends APIResource {
  static {
    __name(this, "Completions");
  }
  constructor() {
    super(...arguments);
    this.messages = new Messages(this._client);
  }
  create(body, options2) {
    return this._client.post("/chat/completions", { body, ...options2, stream: body.stream ?? false });
  }
  /**
   * Get a stored chat completion. Only Chat Completions that have been created with
   * the `store` parameter set to `true` will be returned.
   */
  retrieve(completionId, options2) {
    return this._client.get(`/chat/completions/${completionId}`, options2);
  }
  /**
   * Modify a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be modified. Currently, the only
   * supported modification is to update the `metadata` field.
   */
  update(completionId, body, options2) {
    return this._client.post(`/chat/completions/${completionId}`, { body, ...options2 });
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/chat/completions", ChatCompletionsPage, { query, ...options2 });
  }
  /**
   * Delete a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be deleted.
   */
  del(completionId, options2) {
    return this._client.delete(`/chat/completions/${completionId}`, options2);
  }
};
var ChatCompletionsPage = class extends CursorPage {
  static {
    __name(this, "ChatCompletionsPage");
  }
};
var ChatCompletionStoreMessagesPage = class extends CursorPage {
  static {
    __name(this, "ChatCompletionStoreMessagesPage");
  }
};
Completions.ChatCompletionsPage = ChatCompletionsPage;
Completions.Messages = Messages;

// ../node_modules/openai/resources/chat/chat.mjs
var Chat = class extends APIResource {
  static {
    __name(this, "Chat");
  }
  constructor() {
    super(...arguments);
    this.completions = new Completions(this._client);
  }
};
Chat.Completions = Completions;
Chat.ChatCompletionsPage = ChatCompletionsPage;

// ../node_modules/openai/resources/audio/speech.mjs
var Speech = class extends APIResource {
  static {
    __name(this, "Speech");
  }
  /**
   * Generates audio from the input text.
   */
  create(body, options2) {
    return this._client.post("/audio/speech", {
      body,
      ...options2,
      headers: { Accept: "application/octet-stream", ...options2?.headers },
      __binaryResponse: true
    });
  }
};

// ../node_modules/openai/resources/audio/transcriptions.mjs
var Transcriptions = class extends APIResource {
  static {
    __name(this, "Transcriptions");
  }
  create(body, options2) {
    return this._client.post("/audio/transcriptions", multipartFormRequestOptions({ body, ...options2, __metadata: { model: body.model } }));
  }
};

// ../node_modules/openai/resources/audio/translations.mjs
var Translations = class extends APIResource {
  static {
    __name(this, "Translations");
  }
  create(body, options2) {
    return this._client.post("/audio/translations", multipartFormRequestOptions({ body, ...options2, __metadata: { model: body.model } }));
  }
};

// ../node_modules/openai/resources/audio/audio.mjs
var Audio = class extends APIResource {
  static {
    __name(this, "Audio");
  }
  constructor() {
    super(...arguments);
    this.transcriptions = new Transcriptions(this._client);
    this.translations = new Translations(this._client);
    this.speech = new Speech(this._client);
  }
};
Audio.Transcriptions = Transcriptions;
Audio.Translations = Translations;
Audio.Speech = Speech;

// ../node_modules/openai/resources/batches.mjs
var Batches = class extends APIResource {
  static {
    __name(this, "Batches");
  }
  /**
   * Creates and executes a batch from an uploaded file of requests
   */
  create(body, options2) {
    return this._client.post("/batches", { body, ...options2 });
  }
  /**
   * Retrieves a batch.
   */
  retrieve(batchId, options2) {
    return this._client.get(`/batches/${batchId}`, options2);
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/batches", BatchesPage, { query, ...options2 });
  }
  /**
   * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
   * 10 minutes, before changing to `cancelled`, where it will have partial results
   * (if any) available in the output file.
   */
  cancel(batchId, options2) {
    return this._client.post(`/batches/${batchId}/cancel`, options2);
  }
};
var BatchesPage = class extends CursorPage {
  static {
    __name(this, "BatchesPage");
  }
};
Batches.BatchesPage = BatchesPage;

// ../node_modules/openai/resources/beta/assistants.mjs
var Assistants = class extends APIResource {
  static {
    __name(this, "Assistants");
  }
  /**
   * Create an assistant with a model and instructions.
   */
  create(body, options2) {
    return this._client.post("/assistants", {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieves an assistant.
   */
  retrieve(assistantId, options2) {
    return this._client.get(`/assistants/${assistantId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Modifies an assistant.
   */
  update(assistantId, body, options2) {
    return this._client.post(`/assistants/${assistantId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/assistants", AssistantsPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Delete an assistant.
   */
  del(assistantId, options2) {
    return this._client.delete(`/assistants/${assistantId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
};
var AssistantsPage = class extends CursorPage {
  static {
    __name(this, "AssistantsPage");
  }
};
Assistants.AssistantsPage = AssistantsPage;

// ../node_modules/openai/lib/RunnableFunction.mjs
function isRunnableFunctionWithParse(fn) {
  return typeof fn.parse === "function";
}
__name(isRunnableFunctionWithParse, "isRunnableFunctionWithParse");

// ../node_modules/openai/lib/chatCompletionUtils.mjs
var isAssistantMessage = /* @__PURE__ */ __name((message) => {
  return message?.role === "assistant";
}, "isAssistantMessage");
var isFunctionMessage = /* @__PURE__ */ __name((message) => {
  return message?.role === "function";
}, "isFunctionMessage");
var isToolMessage = /* @__PURE__ */ __name((message) => {
  return message?.role === "tool";
}, "isToolMessage");

// ../node_modules/openai/lib/EventStream.mjs
var __classPrivateFieldSet3 = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet3 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _EventStream_instances;
var _EventStream_connectedPromise;
var _EventStream_resolveConnectedPromise;
var _EventStream_rejectConnectedPromise;
var _EventStream_endPromise;
var _EventStream_resolveEndPromise;
var _EventStream_rejectEndPromise;
var _EventStream_listeners;
var _EventStream_ended;
var _EventStream_errored;
var _EventStream_aborted;
var _EventStream_catchingPromiseCreated;
var _EventStream_handleError;
var EventStream = class {
  static {
    __name(this, "EventStream");
  }
  constructor() {
    _EventStream_instances.add(this);
    this.controller = new AbortController();
    _EventStream_connectedPromise.set(this, void 0);
    _EventStream_resolveConnectedPromise.set(this, () => {
    });
    _EventStream_rejectConnectedPromise.set(this, () => {
    });
    _EventStream_endPromise.set(this, void 0);
    _EventStream_resolveEndPromise.set(this, () => {
    });
    _EventStream_rejectEndPromise.set(this, () => {
    });
    _EventStream_listeners.set(this, {});
    _EventStream_ended.set(this, false);
    _EventStream_errored.set(this, false);
    _EventStream_aborted.set(this, false);
    _EventStream_catchingPromiseCreated.set(this, false);
    __classPrivateFieldSet3(this, _EventStream_connectedPromise, new Promise((resolve, reject) => {
      __classPrivateFieldSet3(this, _EventStream_resolveConnectedPromise, resolve, "f");
      __classPrivateFieldSet3(this, _EventStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet3(this, _EventStream_endPromise, new Promise((resolve, reject) => {
      __classPrivateFieldSet3(this, _EventStream_resolveEndPromise, resolve, "f");
      __classPrivateFieldSet3(this, _EventStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet3(this, _EventStream_connectedPromise, "f").catch(() => {
    });
    __classPrivateFieldGet3(this, _EventStream_endPromise, "f").catch(() => {
    });
  }
  _run(executor) {
    setTimeout(() => {
      executor().then(() => {
        this._emitFinal();
        this._emit("end");
      }, __classPrivateFieldGet3(this, _EventStream_instances, "m", _EventStream_handleError).bind(this));
    }, 0);
  }
  _connected() {
    if (this.ended)
      return;
    __classPrivateFieldGet3(this, _EventStream_resolveConnectedPromise, "f").call(this);
    this._emit("connect");
  }
  get ended() {
    return __classPrivateFieldGet3(this, _EventStream_ended, "f");
  }
  get errored() {
    return __classPrivateFieldGet3(this, _EventStream_errored, "f");
  }
  get aborted() {
    return __classPrivateFieldGet3(this, _EventStream_aborted, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  on(event, listener) {
    const listeners = __classPrivateFieldGet3(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet3(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener });
    return this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  off(event, listener) {
    const listeners = __classPrivateFieldGet3(this, _EventStream_listeners, "f")[event];
    if (!listeners)
      return this;
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index >= 0)
      listeners.splice(index, 1);
    return this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  once(event, listener) {
    const listeners = __classPrivateFieldGet3(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet3(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * @returns a Promise that resolves the next time given event is triggered,
   * or rejects if an error is emitted.  (If you request the 'error' event,
   * returns a promise that resolves with the error).
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(event) {
    return new Promise((resolve, reject) => {
      __classPrivateFieldSet3(this, _EventStream_catchingPromiseCreated, true, "f");
      if (event !== "error")
        this.once("error", reject);
      this.once(event, resolve);
    });
  }
  async done() {
    __classPrivateFieldSet3(this, _EventStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet3(this, _EventStream_endPromise, "f");
  }
  _emit(event, ...args) {
    if (__classPrivateFieldGet3(this, _EventStream_ended, "f")) {
      return;
    }
    if (event === "end") {
      __classPrivateFieldSet3(this, _EventStream_ended, true, "f");
      __classPrivateFieldGet3(this, _EventStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet3(this, _EventStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet3(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      listeners.forEach(({ listener }) => listener(...args));
    }
    if (event === "abort") {
      const error = args[0];
      if (!__classPrivateFieldGet3(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet3(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet3(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error = args[0];
      if (!__classPrivateFieldGet3(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet3(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet3(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
    }
  }
  _emitFinal() {
  }
};
_EventStream_connectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_endPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_listeners = /* @__PURE__ */ new WeakMap(), _EventStream_ended = /* @__PURE__ */ new WeakMap(), _EventStream_errored = /* @__PURE__ */ new WeakMap(), _EventStream_aborted = /* @__PURE__ */ new WeakMap(), _EventStream_catchingPromiseCreated = /* @__PURE__ */ new WeakMap(), _EventStream_instances = /* @__PURE__ */ new WeakSet(), _EventStream_handleError = /* @__PURE__ */ __name(function _EventStream_handleError2(error) {
  __classPrivateFieldSet3(this, _EventStream_errored, true, "f");
  if (error instanceof Error && error.name === "AbortError") {
    error = new APIUserAbortError();
  }
  if (error instanceof APIUserAbortError) {
    __classPrivateFieldSet3(this, _EventStream_aborted, true, "f");
    return this._emit("abort", error);
  }
  if (error instanceof OpenAIError) {
    return this._emit("error", error);
  }
  if (error instanceof Error) {
    const openAIError = new OpenAIError(error.message);
    openAIError.cause = error;
    return this._emit("error", openAIError);
  }
  return this._emit("error", new OpenAIError(String(error)));
}, "_EventStream_handleError");

// ../node_modules/openai/lib/parser.mjs
function isAutoParsableResponseFormat(response_format) {
  return response_format?.["$brand"] === "auto-parseable-response-format";
}
__name(isAutoParsableResponseFormat, "isAutoParsableResponseFormat");
function isAutoParsableTool(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
__name(isAutoParsableTool, "isAutoParsableTool");
function maybeParseChatCompletion(completion, params) {
  if (!params || !hasAutoParseableInput(params)) {
    return {
      ...completion,
      choices: completion.choices.map((choice) => ({
        ...choice,
        message: {
          ...choice.message,
          parsed: null,
          ...choice.message.tool_calls ? {
            tool_calls: choice.message.tool_calls
          } : void 0
        }
      }))
    };
  }
  return parseChatCompletion(completion, params);
}
__name(maybeParseChatCompletion, "maybeParseChatCompletion");
function parseChatCompletion(completion, params) {
  const choices = completion.choices.map((choice) => {
    if (choice.finish_reason === "length") {
      throw new LengthFinishReasonError();
    }
    if (choice.finish_reason === "content_filter") {
      throw new ContentFilterFinishReasonError();
    }
    return {
      ...choice,
      message: {
        ...choice.message,
        ...choice.message.tool_calls ? {
          tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? void 0
        } : void 0,
        parsed: choice.message.content && !choice.message.refusal ? parseResponseFormat(params, choice.message.content) : null
      }
    };
  });
  return { ...completion, choices };
}
__name(parseChatCompletion, "parseChatCompletion");
function parseResponseFormat(params, content) {
  if (params.response_format?.type !== "json_schema") {
    return null;
  }
  if (params.response_format?.type === "json_schema") {
    if ("$parseRaw" in params.response_format) {
      const response_format = params.response_format;
      return response_format.$parseRaw(content);
    }
    return JSON.parse(content);
  }
  return null;
}
__name(parseResponseFormat, "parseResponseFormat");
function parseToolCall(params, toolCall) {
  const inputTool = params.tools?.find((inputTool2) => inputTool2.function?.name === toolCall.function.name);
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.function.arguments) : inputTool?.function.strict ? JSON.parse(toolCall.function.arguments) : null
    }
  };
}
__name(parseToolCall, "parseToolCall");
function shouldParseToolCall(params, toolCall) {
  if (!params) {
    return false;
  }
  const inputTool = params.tools?.find((inputTool2) => inputTool2.function?.name === toolCall.function.name);
  return isAutoParsableTool(inputTool) || inputTool?.function.strict || false;
}
__name(shouldParseToolCall, "shouldParseToolCall");
function hasAutoParseableInput(params) {
  if (isAutoParsableResponseFormat(params.response_format)) {
    return true;
  }
  return params.tools?.some((t) => isAutoParsableTool(t) || t.type === "function" && t.function.strict === true) ?? false;
}
__name(hasAutoParseableInput, "hasAutoParseableInput");
function validateInputTools(tools) {
  for (const tool of tools ?? []) {
    if (tool.type !== "function") {
      throw new OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
    }
    if (tool.function.strict !== true) {
      throw new OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
    }
  }
}
__name(validateInputTools, "validateInputTools");

// ../node_modules/openai/lib/AbstractChatCompletionRunner.mjs
var __classPrivateFieldGet4 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractChatCompletionRunner_instances;
var _AbstractChatCompletionRunner_getFinalContent;
var _AbstractChatCompletionRunner_getFinalMessage;
var _AbstractChatCompletionRunner_getFinalFunctionCall;
var _AbstractChatCompletionRunner_getFinalFunctionCallResult;
var _AbstractChatCompletionRunner_calculateTotalUsage;
var _AbstractChatCompletionRunner_validateParams;
var _AbstractChatCompletionRunner_stringifyFunctionCallResult;
var DEFAULT_MAX_CHAT_COMPLETIONS = 10;
var AbstractChatCompletionRunner = class extends EventStream {
  static {
    __name(this, "AbstractChatCompletionRunner");
  }
  constructor() {
    super(...arguments);
    _AbstractChatCompletionRunner_instances.add(this);
    this._chatCompletions = [];
    this.messages = [];
  }
  _addChatCompletion(chatCompletion) {
    this._chatCompletions.push(chatCompletion);
    this._emit("chatCompletion", chatCompletion);
    const message = chatCompletion.choices[0]?.message;
    if (message)
      this._addMessage(message);
    return chatCompletion;
  }
  _addMessage(message, emit = true) {
    if (!("content" in message))
      message.content = null;
    this.messages.push(message);
    if (emit) {
      this._emit("message", message);
      if ((isFunctionMessage(message) || isToolMessage(message)) && message.content) {
        this._emit("functionCallResult", message.content);
      } else if (isAssistantMessage(message) && message.function_call) {
        this._emit("functionCall", message.function_call);
      } else if (isAssistantMessage(message) && message.tool_calls) {
        for (const tool_call of message.tool_calls) {
          if (tool_call.type === "function") {
            this._emit("functionCall", tool_call.function);
          }
        }
      }
    }
  }
  /**
   * @returns a promise that resolves with the final ChatCompletion, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
   */
  async finalChatCompletion() {
    await this.done();
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (!completion)
      throw new OpenAIError("stream ended without producing a ChatCompletion");
    return completion;
  }
  /**
   * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalContent() {
    await this.done();
    return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
   * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalMessage() {
    await this.done();
    return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
  }
  /**
   * @returns a promise that resolves with the content of the final FunctionCall, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalFunctionCall() {
    await this.done();
    return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
  }
  async finalFunctionCallResult() {
    await this.done();
    return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
  }
  async totalUsage() {
    await this.done();
    return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
  }
  allChatCompletions() {
    return [...this._chatCompletions];
  }
  _emitFinal() {
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (completion)
      this._emit("finalChatCompletion", completion);
    const finalMessage = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    if (finalMessage)
      this._emit("finalMessage", finalMessage);
    const finalContent = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    if (finalContent)
      this._emit("finalContent", finalContent);
    const finalFunctionCall = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
    if (finalFunctionCall)
      this._emit("finalFunctionCall", finalFunctionCall);
    const finalFunctionCallResult = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
    if (finalFunctionCallResult != null)
      this._emit("finalFunctionCallResult", finalFunctionCallResult);
    if (this._chatCompletions.some((c) => c.usage)) {
      this._emit("totalUsage", __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
    }
  }
  async _createChatCompletion(client, params, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
    const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options2, signal: this.controller.signal });
    this._connected();
    return this._addChatCompletion(parseChatCompletion(chatCompletion, params));
  }
  async _runChatCompletion(client, params, options2) {
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    return await this._createChatCompletion(client, params, options2);
  }
  async _runFunctions(client, params, options2) {
    const role = "function";
    const { function_call = "auto", stream, ...restParams } = params;
    const singleFunctionToCall = typeof function_call !== "string" && function_call?.name;
    const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options2 || {};
    const functionsByName = {};
    for (const f of params.functions) {
      functionsByName[f.name || f.function.name] = f;
    }
    const functions = params.functions.map((f) => ({
      name: f.name || f.function.name,
      parameters: f.parameters,
      description: f.description
    }));
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    for (let i = 0; i < maxChatCompletions; ++i) {
      const chatCompletion = await this._createChatCompletion(client, {
        ...restParams,
        function_call,
        functions,
        messages: [...this.messages]
      }, options2);
      const message = chatCompletion.choices[0]?.message;
      if (!message) {
        throw new OpenAIError(`missing message in ChatCompletion response`);
      }
      if (!message.function_call)
        return;
      const { name, arguments: args } = message.function_call;
      const fn = functionsByName[name];
      if (!fn) {
        const content2 = `Invalid function_call: ${JSON.stringify(name)}. Available options are: ${functions.map((f) => JSON.stringify(f.name)).join(", ")}. Please try again`;
        this._addMessage({ role, name, content: content2 });
        continue;
      } else if (singleFunctionToCall && singleFunctionToCall !== name) {
        const content2 = `Invalid function_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
        this._addMessage({ role, name, content: content2 });
        continue;
      }
      let parsed;
      try {
        parsed = isRunnableFunctionWithParse(fn) ? await fn.parse(args) : args;
      } catch (error) {
        this._addMessage({
          role,
          name,
          content: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
      const rawContent = await fn.function(parsed, this);
      const content = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
      this._addMessage({ role, name, content });
      if (singleFunctionToCall)
        return;
    }
  }
  async _runTools(client, params, options2) {
    const role = "tool";
    const { tool_choice = "auto", stream, ...restParams } = params;
    const singleFunctionToCall = typeof tool_choice !== "string" && tool_choice?.function?.name;
    const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options2 || {};
    const inputTools = params.tools.map((tool) => {
      if (isAutoParsableTool(tool)) {
        if (!tool.$callback) {
          throw new OpenAIError("Tool given to `.runTools()` that does not have an associated function");
        }
        return {
          type: "function",
          function: {
            function: tool.$callback,
            name: tool.function.name,
            description: tool.function.description || "",
            parameters: tool.function.parameters,
            parse: tool.$parseRaw,
            strict: true
          }
        };
      }
      return tool;
    });
    const functionsByName = {};
    for (const f of inputTools) {
      if (f.type === "function") {
        functionsByName[f.function.name || f.function.function.name] = f.function;
      }
    }
    const tools = "tools" in params ? inputTools.map((t) => t.type === "function" ? {
      type: "function",
      function: {
        name: t.function.name || t.function.function.name,
        parameters: t.function.parameters,
        description: t.function.description,
        strict: t.function.strict
      }
    } : t) : void 0;
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    for (let i = 0; i < maxChatCompletions; ++i) {
      const chatCompletion = await this._createChatCompletion(client, {
        ...restParams,
        tool_choice,
        tools,
        messages: [...this.messages]
      }, options2);
      const message = chatCompletion.choices[0]?.message;
      if (!message) {
        throw new OpenAIError(`missing message in ChatCompletion response`);
      }
      if (!message.tool_calls?.length) {
        return;
      }
      for (const tool_call of message.tool_calls) {
        if (tool_call.type !== "function")
          continue;
        const tool_call_id = tool_call.id;
        const { name, arguments: args } = tool_call.function;
        const fn = functionsByName[name];
        if (!fn) {
          const content2 = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName).map((name2) => JSON.stringify(name2)).join(", ")}. Please try again`;
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        } else if (singleFunctionToCall && singleFunctionToCall !== name) {
          const content2 = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        }
        let parsed;
        try {
          parsed = isRunnableFunctionWithParse(fn) ? await fn.parse(args) : args;
        } catch (error) {
          const content2 = error instanceof Error ? error.message : String(error);
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        }
        const rawContent = await fn.function(parsed, this);
        const content = __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
        this._addMessage({ role, tool_call_id, content });
        if (singleFunctionToCall) {
          return;
        }
      }
    }
    return;
  }
};
_AbstractChatCompletionRunner_instances = /* @__PURE__ */ new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_getFinalContent2() {
  return __classPrivateFieldGet4(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, "_AbstractChatCompletionRunner_getFinalContent"), _AbstractChatCompletionRunner_getFinalMessage = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_getFinalMessage2() {
  let i = this.messages.length;
  while (i-- > 0) {
    const message = this.messages[i];
    if (isAssistantMessage(message)) {
      const { function_call, ...rest } = message;
      const ret = {
        ...rest,
        content: message.content ?? null,
        refusal: message.refusal ?? null
      };
      if (function_call) {
        ret.function_call = function_call;
      }
      return ret;
    }
  }
  throw new OpenAIError("stream ended without producing a ChatCompletionMessage with role=assistant");
}, "_AbstractChatCompletionRunner_getFinalMessage"), _AbstractChatCompletionRunner_getFinalFunctionCall = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_getFinalFunctionCall2() {
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isAssistantMessage(message) && message?.function_call) {
      return message.function_call;
    }
    if (isAssistantMessage(message) && message?.tool_calls?.length) {
      return message.tool_calls.at(-1)?.function;
    }
  }
  return;
}, "_AbstractChatCompletionRunner_getFinalFunctionCall"), _AbstractChatCompletionRunner_getFinalFunctionCallResult = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_getFinalFunctionCallResult2() {
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isFunctionMessage(message) && message.content != null) {
      return message.content;
    }
    if (isToolMessage(message) && message.content != null && typeof message.content === "string" && this.messages.some((x) => x.role === "assistant" && x.tool_calls?.some((y) => y.type === "function" && y.id === message.tool_call_id))) {
      return message.content;
    }
  }
  return;
}, "_AbstractChatCompletionRunner_getFinalFunctionCallResult"), _AbstractChatCompletionRunner_calculateTotalUsage = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_calculateTotalUsage2() {
  const total = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  };
  for (const { usage } of this._chatCompletions) {
    if (usage) {
      total.completion_tokens += usage.completion_tokens;
      total.prompt_tokens += usage.prompt_tokens;
      total.total_tokens += usage.total_tokens;
    }
  }
  return total;
}, "_AbstractChatCompletionRunner_calculateTotalUsage"), _AbstractChatCompletionRunner_validateParams = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_validateParams2(params) {
  if (params.n != null && params.n > 1) {
    throw new OpenAIError("ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.");
  }
}, "_AbstractChatCompletionRunner_validateParams"), _AbstractChatCompletionRunner_stringifyFunctionCallResult = /* @__PURE__ */ __name(function _AbstractChatCompletionRunner_stringifyFunctionCallResult2(rawContent) {
  return typeof rawContent === "string" ? rawContent : rawContent === void 0 ? "undefined" : JSON.stringify(rawContent);
}, "_AbstractChatCompletionRunner_stringifyFunctionCallResult");

// ../node_modules/openai/lib/ChatCompletionRunner.mjs
var ChatCompletionRunner = class _ChatCompletionRunner extends AbstractChatCompletionRunner {
  static {
    __name(this, "ChatCompletionRunner");
  }
  /** @deprecated - please use `runTools` instead. */
  static runFunctions(client, params, options2) {
    const runner = new _ChatCompletionRunner();
    const opts = {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "runFunctions" }
    };
    runner._run(() => runner._runFunctions(client, params, opts));
    return runner;
  }
  static runTools(client, params, options2) {
    const runner = new _ChatCompletionRunner();
    const opts = {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    runner._run(() => runner._runTools(client, params, opts));
    return runner;
  }
  _addMessage(message, emit = true) {
    super._addMessage(message, emit);
    if (isAssistantMessage(message) && message.content) {
      this._emit("content", message.content);
    }
  }
};

// ../node_modules/openai/_vendor/partial-json-parser/parser.mjs
var STR = 1;
var NUM = 2;
var ARR = 4;
var OBJ = 8;
var NULL = 16;
var BOOL = 32;
var NAN = 64;
var INFINITY = 128;
var MINUS_INFINITY = 256;
var INF = INFINITY | MINUS_INFINITY;
var SPECIAL = NULL | BOOL | INF | NAN;
var ATOM = STR | NUM | SPECIAL;
var COLLECTION = ARR | OBJ;
var ALL = ATOM | COLLECTION;
var Allow = {
  STR,
  NUM,
  ARR,
  OBJ,
  NULL,
  BOOL,
  NAN,
  INFINITY,
  MINUS_INFINITY,
  INF,
  SPECIAL,
  ATOM,
  COLLECTION,
  ALL
};
var PartialJSON = class extends Error {
  static {
    __name(this, "PartialJSON");
  }
};
var MalformedJSON = class extends Error {
  static {
    __name(this, "MalformedJSON");
  }
};
function parseJSON(jsonString, allowPartial = Allow.ALL) {
  if (typeof jsonString !== "string") {
    throw new TypeError(`expecting str, got ${typeof jsonString}`);
  }
  if (!jsonString.trim()) {
    throw new Error(`${jsonString} is empty`);
  }
  return _parseJSON(jsonString.trim(), allowPartial);
}
__name(parseJSON, "parseJSON");
var _parseJSON = /* @__PURE__ */ __name((jsonString, allow) => {
  const length = jsonString.length;
  let index = 0;
  const markPartialJSON = /* @__PURE__ */ __name((msg) => {
    throw new PartialJSON(`${msg} at position ${index}`);
  }, "markPartialJSON");
  const throwMalformedError = /* @__PURE__ */ __name((msg) => {
    throw new MalformedJSON(`${msg} at position ${index}`);
  }, "throwMalformedError");
  const parseAny = /* @__PURE__ */ __name(() => {
    skipBlank();
    if (index >= length)
      markPartialJSON("Unexpected end of input");
    if (jsonString[index] === '"')
      return parseStr();
    if (jsonString[index] === "{")
      return parseObj();
    if (jsonString[index] === "[")
      return parseArr();
    if (jsonString.substring(index, index + 4) === "null" || Allow.NULL & allow && length - index < 4 && "null".startsWith(jsonString.substring(index))) {
      index += 4;
      return null;
    }
    if (jsonString.substring(index, index + 4) === "true" || Allow.BOOL & allow && length - index < 4 && "true".startsWith(jsonString.substring(index))) {
      index += 4;
      return true;
    }
    if (jsonString.substring(index, index + 5) === "false" || Allow.BOOL & allow && length - index < 5 && "false".startsWith(jsonString.substring(index))) {
      index += 5;
      return false;
    }
    if (jsonString.substring(index, index + 8) === "Infinity" || Allow.INFINITY & allow && length - index < 8 && "Infinity".startsWith(jsonString.substring(index))) {
      index += 8;
      return Infinity;
    }
    if (jsonString.substring(index, index + 9) === "-Infinity" || Allow.MINUS_INFINITY & allow && 1 < length - index && length - index < 9 && "-Infinity".startsWith(jsonString.substring(index))) {
      index += 9;
      return -Infinity;
    }
    if (jsonString.substring(index, index + 3) === "NaN" || Allow.NAN & allow && length - index < 3 && "NaN".startsWith(jsonString.substring(index))) {
      index += 3;
      return NaN;
    }
    return parseNum();
  }, "parseAny");
  const parseStr = /* @__PURE__ */ __name(() => {
    const start = index;
    let escape3 = false;
    index++;
    while (index < length && (jsonString[index] !== '"' || escape3 && jsonString[index - 1] === "\\")) {
      escape3 = jsonString[index] === "\\" ? !escape3 : false;
      index++;
    }
    if (jsonString.charAt(index) == '"') {
      try {
        return JSON.parse(jsonString.substring(start, ++index - Number(escape3)));
      } catch (e) {
        throwMalformedError(String(e));
      }
    } else if (Allow.STR & allow) {
      try {
        return JSON.parse(jsonString.substring(start, index - Number(escape3)) + '"');
      } catch (e) {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"');
      }
    }
    markPartialJSON("Unterminated string literal");
  }, "parseStr");
  const parseObj = /* @__PURE__ */ __name(() => {
    index++;
    skipBlank();
    const obj = {};
    try {
      while (jsonString[index] !== "}") {
        skipBlank();
        if (index >= length && Allow.OBJ & allow)
          return obj;
        const key = parseStr();
        skipBlank();
        index++;
        try {
          const value = parseAny();
          Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
        } catch (e) {
          if (Allow.OBJ & allow)
            return obj;
          else
            throw e;
        }
        skipBlank();
        if (jsonString[index] === ",")
          index++;
      }
    } catch (e) {
      if (Allow.OBJ & allow)
        return obj;
      else
        markPartialJSON("Expected '}' at end of object");
    }
    index++;
    return obj;
  }, "parseObj");
  const parseArr = /* @__PURE__ */ __name(() => {
    index++;
    const arr = [];
    try {
      while (jsonString[index] !== "]") {
        arr.push(parseAny());
        skipBlank();
        if (jsonString[index] === ",") {
          index++;
        }
      }
    } catch (e) {
      if (Allow.ARR & allow) {
        return arr;
      }
      markPartialJSON("Expected ']' at end of array");
    }
    index++;
    return arr;
  }, "parseArr");
  const parseNum = /* @__PURE__ */ __name(() => {
    if (index === 0) {
      if (jsonString === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        if (Allow.NUM & allow) {
          try {
            if ("." === jsonString[jsonString.length - 1])
              return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf(".")));
            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf("e")));
          } catch (e2) {
          }
        }
        throwMalformedError(String(e));
      }
    }
    const start = index;
    if (jsonString[index] === "-")
      index++;
    while (jsonString[index] && !",]}".includes(jsonString[index]))
      index++;
    if (index == length && !(Allow.NUM & allow))
      markPartialJSON("Unterminated number literal");
    try {
      return JSON.parse(jsonString.substring(start, index));
    } catch (e) {
      if (jsonString.substring(start, index) === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("e")));
      } catch (e2) {
        throwMalformedError(String(e2));
      }
    }
  }, "parseNum");
  const skipBlank = /* @__PURE__ */ __name(() => {
    while (index < length && " \n\r	".includes(jsonString[index])) {
      index++;
    }
  }, "skipBlank");
  return parseAny();
}, "_parseJSON");
var partialParse = /* @__PURE__ */ __name((input) => parseJSON(input, Allow.ALL ^ Allow.NUM), "partialParse");

// ../node_modules/openai/lib/ChatCompletionStream.mjs
var __classPrivateFieldSet4 = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet5 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ChatCompletionStream_instances;
var _ChatCompletionStream_params;
var _ChatCompletionStream_choiceEventStates;
var _ChatCompletionStream_currentChatCompletionSnapshot;
var _ChatCompletionStream_beginRequest;
var _ChatCompletionStream_getChoiceEventState;
var _ChatCompletionStream_addChunk;
var _ChatCompletionStream_emitToolCallDoneEvent;
var _ChatCompletionStream_emitContentDoneEvents;
var _ChatCompletionStream_endRequest;
var _ChatCompletionStream_getAutoParseableResponseFormat;
var _ChatCompletionStream_accumulateChatCompletion;
var ChatCompletionStream = class _ChatCompletionStream extends AbstractChatCompletionRunner {
  static {
    __name(this, "ChatCompletionStream");
  }
  constructor(params) {
    super();
    _ChatCompletionStream_instances.add(this);
    _ChatCompletionStream_params.set(this, void 0);
    _ChatCompletionStream_choiceEventStates.set(this, void 0);
    _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
    __classPrivateFieldSet4(this, _ChatCompletionStream_params, params, "f");
    __classPrivateFieldSet4(this, _ChatCompletionStream_choiceEventStates, [], "f");
  }
  get currentChatCompletionSnapshot() {
    return __classPrivateFieldGet5(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(stream) {
    const runner = new _ChatCompletionStream(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  static createChatCompletion(client, params, options2) {
    const runner = new _ChatCompletionStream(params);
    runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options2, headers: { ...options2?.headers, "X-Stainless-Helper-Method": "stream" } }));
    return runner;
  }
  async _createChatCompletion(client, params, options2) {
    super._createChatCompletion;
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    const stream = await client.chat.completions.create({ ...params, stream: true }, { ...options2, signal: this.controller.signal });
    this._connected();
    for await (const chunk of stream) {
      __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addChatCompletion(__classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
  }
  async _fromReadableStream(readableStream, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    this._connected();
    const stream = Stream.fromReadableStream(readableStream, this.controller);
    let chatId;
    for await (const chunk of stream) {
      if (chatId && chatId !== chunk.id) {
        this._addChatCompletion(__classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
      }
      __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
      chatId = chunk.id;
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addChatCompletion(__classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
  }
  [(_ChatCompletionStream_params = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_choiceEventStates = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_currentChatCompletionSnapshot = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_instances = /* @__PURE__ */ new WeakSet(), _ChatCompletionStream_beginRequest = /* @__PURE__ */ __name(function _ChatCompletionStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet4(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
  }, "_ChatCompletionStream_beginRequest"), _ChatCompletionStream_getChoiceEventState = /* @__PURE__ */ __name(function _ChatCompletionStream_getChoiceEventState2(choice) {
    let state = __classPrivateFieldGet5(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
    if (state) {
      return state;
    }
    state = {
      content_done: false,
      refusal_done: false,
      logprobs_content_done: false,
      logprobs_refusal_done: false,
      done_tool_calls: /* @__PURE__ */ new Set(),
      current_tool_call_index: null
    };
    __classPrivateFieldGet5(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
    return state;
  }, "_ChatCompletionStream_getChoiceEventState"), _ChatCompletionStream_addChunk = /* @__PURE__ */ __name(function _ChatCompletionStream_addChunk2(chunk) {
    if (this.ended)
      return;
    const completion = __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
    this._emit("chunk", chunk, completion);
    for (const choice of chunk.choices) {
      const choiceSnapshot = completion.choices[choice.index];
      if (choice.delta.content != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.content) {
        this._emit("content", choice.delta.content, choiceSnapshot.message.content);
        this._emit("content.delta", {
          delta: choice.delta.content,
          snapshot: choiceSnapshot.message.content,
          parsed: choiceSnapshot.message.parsed
        });
      }
      if (choice.delta.refusal != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.refusal) {
        this._emit("refusal.delta", {
          delta: choice.delta.refusal,
          snapshot: choiceSnapshot.message.refusal
        });
      }
      if (choice.logprobs?.content != null && choiceSnapshot.message?.role === "assistant") {
        this._emit("logprobs.content.delta", {
          content: choice.logprobs?.content,
          snapshot: choiceSnapshot.logprobs?.content ?? []
        });
      }
      if (choice.logprobs?.refusal != null && choiceSnapshot.message?.role === "assistant") {
        this._emit("logprobs.refusal.delta", {
          refusal: choice.logprobs?.refusal,
          snapshot: choiceSnapshot.logprobs?.refusal ?? []
        });
      }
      const state = __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
      if (choiceSnapshot.finish_reason) {
        __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
        if (state.current_tool_call_index != null) {
          __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
        }
      }
      for (const toolCall of choice.delta.tool_calls ?? []) {
        if (state.current_tool_call_index !== toolCall.index) {
          __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
          if (state.current_tool_call_index != null) {
            __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
          }
        }
        state.current_tool_call_index = toolCall.index;
      }
      for (const toolCallDelta of choice.delta.tool_calls ?? []) {
        const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallDelta.index];
        if (!toolCallSnapshot?.type) {
          continue;
        }
        if (toolCallSnapshot?.type === "function") {
          this._emit("tool_calls.function.arguments.delta", {
            name: toolCallSnapshot.function?.name,
            index: toolCallDelta.index,
            arguments: toolCallSnapshot.function.arguments,
            parsed_arguments: toolCallSnapshot.function.parsed_arguments,
            arguments_delta: toolCallDelta.function?.arguments ?? ""
          });
        } else {
          assertNever(toolCallSnapshot?.type);
        }
      }
    }
  }, "_ChatCompletionStream_addChunk"), _ChatCompletionStream_emitToolCallDoneEvent = /* @__PURE__ */ __name(function _ChatCompletionStream_emitToolCallDoneEvent2(choiceSnapshot, toolCallIndex) {
    const state = __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (state.done_tool_calls.has(toolCallIndex)) {
      return;
    }
    const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallIndex];
    if (!toolCallSnapshot) {
      throw new Error("no tool call snapshot");
    }
    if (!toolCallSnapshot.type) {
      throw new Error("tool call snapshot missing `type`");
    }
    if (toolCallSnapshot.type === "function") {
      const inputTool = __classPrivateFieldGet5(this, _ChatCompletionStream_params, "f")?.tools?.find((tool) => tool.type === "function" && tool.function.name === toolCallSnapshot.function.name);
      this._emit("tool_calls.function.arguments.done", {
        name: toolCallSnapshot.function.name,
        index: toolCallIndex,
        arguments: toolCallSnapshot.function.arguments,
        parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCallSnapshot.function.arguments) : inputTool?.function.strict ? JSON.parse(toolCallSnapshot.function.arguments) : null
      });
    } else {
      assertNever(toolCallSnapshot.type);
    }
  }, "_ChatCompletionStream_emitToolCallDoneEvent"), _ChatCompletionStream_emitContentDoneEvents = /* @__PURE__ */ __name(function _ChatCompletionStream_emitContentDoneEvents2(choiceSnapshot) {
    const state = __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (choiceSnapshot.message.content && !state.content_done) {
      state.content_done = true;
      const responseFormat = __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this);
      this._emit("content.done", {
        content: choiceSnapshot.message.content,
        parsed: responseFormat ? responseFormat.$parseRaw(choiceSnapshot.message.content) : null
      });
    }
    if (choiceSnapshot.message.refusal && !state.refusal_done) {
      state.refusal_done = true;
      this._emit("refusal.done", { refusal: choiceSnapshot.message.refusal });
    }
    if (choiceSnapshot.logprobs?.content && !state.logprobs_content_done) {
      state.logprobs_content_done = true;
      this._emit("logprobs.content.done", { content: choiceSnapshot.logprobs.content });
    }
    if (choiceSnapshot.logprobs?.refusal && !state.logprobs_refusal_done) {
      state.logprobs_refusal_done = true;
      this._emit("logprobs.refusal.done", { refusal: choiceSnapshot.logprobs.refusal });
    }
  }, "_ChatCompletionStream_emitContentDoneEvents"), _ChatCompletionStream_endRequest = /* @__PURE__ */ __name(function _ChatCompletionStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet5(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any chunks`);
    }
    __classPrivateFieldSet4(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
    __classPrivateFieldSet4(this, _ChatCompletionStream_choiceEventStates, [], "f");
    return finalizeChatCompletion(snapshot, __classPrivateFieldGet5(this, _ChatCompletionStream_params, "f"));
  }, "_ChatCompletionStream_endRequest"), _ChatCompletionStream_getAutoParseableResponseFormat = /* @__PURE__ */ __name(function _ChatCompletionStream_getAutoParseableResponseFormat2() {
    const responseFormat = __classPrivateFieldGet5(this, _ChatCompletionStream_params, "f")?.response_format;
    if (isAutoParsableResponseFormat(responseFormat)) {
      return responseFormat;
    }
    return null;
  }, "_ChatCompletionStream_getAutoParseableResponseFormat"), _ChatCompletionStream_accumulateChatCompletion = /* @__PURE__ */ __name(function _ChatCompletionStream_accumulateChatCompletion2(chunk) {
    var _a2, _b, _c, _d;
    let snapshot = __classPrivateFieldGet5(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    const { choices, ...rest } = chunk;
    if (!snapshot) {
      snapshot = __classPrivateFieldSet4(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
        ...rest,
        choices: []
      }, "f");
    } else {
      Object.assign(snapshot, rest);
    }
    for (const { delta, finish_reason, index, logprobs = null, ...other2 } of chunk.choices) {
      let choice = snapshot.choices[index];
      if (!choice) {
        choice = snapshot.choices[index] = { finish_reason, index, message: {}, logprobs, ...other2 };
      }
      if (logprobs) {
        if (!choice.logprobs) {
          choice.logprobs = Object.assign({}, logprobs);
        } else {
          const { content: content2, refusal: refusal2, ...rest3 } = logprobs;
          assertIsEmpty(rest3);
          Object.assign(choice.logprobs, rest3);
          if (content2) {
            (_a2 = choice.logprobs).content ?? (_a2.content = []);
            choice.logprobs.content.push(...content2);
          }
          if (refusal2) {
            (_b = choice.logprobs).refusal ?? (_b.refusal = []);
            choice.logprobs.refusal.push(...refusal2);
          }
        }
      }
      if (finish_reason) {
        choice.finish_reason = finish_reason;
        if (__classPrivateFieldGet5(this, _ChatCompletionStream_params, "f") && hasAutoParseableInput(__classPrivateFieldGet5(this, _ChatCompletionStream_params, "f"))) {
          if (finish_reason === "length") {
            throw new LengthFinishReasonError();
          }
          if (finish_reason === "content_filter") {
            throw new ContentFilterFinishReasonError();
          }
        }
      }
      Object.assign(choice, other2);
      if (!delta)
        continue;
      const { content, refusal, function_call, role, tool_calls, ...rest2 } = delta;
      assertIsEmpty(rest2);
      Object.assign(choice.message, rest2);
      if (refusal) {
        choice.message.refusal = (choice.message.refusal || "") + refusal;
      }
      if (role)
        choice.message.role = role;
      if (function_call) {
        if (!choice.message.function_call) {
          choice.message.function_call = function_call;
        } else {
          if (function_call.name)
            choice.message.function_call.name = function_call.name;
          if (function_call.arguments) {
            (_c = choice.message.function_call).arguments ?? (_c.arguments = "");
            choice.message.function_call.arguments += function_call.arguments;
          }
        }
      }
      if (content) {
        choice.message.content = (choice.message.content || "") + content;
        if (!choice.message.refusal && __classPrivateFieldGet5(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this)) {
          choice.message.parsed = partialParse(choice.message.content);
        }
      }
      if (tool_calls) {
        if (!choice.message.tool_calls)
          choice.message.tool_calls = [];
        for (const { index: index2, id, type, function: fn, ...rest3 } of tool_calls) {
          const tool_call = (_d = choice.message.tool_calls)[index2] ?? (_d[index2] = {});
          Object.assign(tool_call, rest3);
          if (id)
            tool_call.id = id;
          if (type)
            tool_call.type = type;
          if (fn)
            tool_call.function ?? (tool_call.function = { name: fn.name ?? "", arguments: "" });
          if (fn?.name)
            tool_call.function.name = fn.name;
          if (fn?.arguments) {
            tool_call.function.arguments += fn.arguments;
            if (shouldParseToolCall(__classPrivateFieldGet5(this, _ChatCompletionStream_params, "f"), tool_call)) {
              tool_call.function.parsed_arguments = partialParse(tool_call.function.arguments);
            }
          }
        }
      }
    }
    return snapshot;
  }, "_ChatCompletionStream_accumulateChatCompletion"), Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("chunk", (chunk) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(chunk);
      } else {
        pushQueue.push(chunk);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: /* @__PURE__ */ __name(async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      }, "next"),
      return: /* @__PURE__ */ __name(async () => {
        this.abort();
        return { value: void 0, done: true };
      }, "return")
    };
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
};
function finalizeChatCompletion(snapshot, params) {
  const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
  const completion = {
    ...rest,
    id,
    choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
      if (!finish_reason) {
        throw new OpenAIError(`missing finish_reason for choice ${index}`);
      }
      const { content = null, function_call, tool_calls, ...messageRest } = message;
      const role = message.role;
      if (!role) {
        throw new OpenAIError(`missing role for choice ${index}`);
      }
      if (function_call) {
        const { arguments: args, name } = function_call;
        if (args == null) {
          throw new OpenAIError(`missing function_call.arguments for choice ${index}`);
        }
        if (!name) {
          throw new OpenAIError(`missing function_call.name for choice ${index}`);
        }
        return {
          ...choiceRest,
          message: {
            content,
            function_call: { arguments: args, name },
            role,
            refusal: message.refusal ?? null
          },
          finish_reason,
          index,
          logprobs
        };
      }
      if (tool_calls) {
        return {
          ...choiceRest,
          index,
          finish_reason,
          logprobs,
          message: {
            ...messageRest,
            role,
            content,
            refusal: message.refusal ?? null,
            tool_calls: tool_calls.map((tool_call, i) => {
              const { function: fn, type, id: id2, ...toolRest } = tool_call;
              const { arguments: args, name, ...fnRest } = fn || {};
              if (id2 == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].id
${str(snapshot)}`);
              }
              if (type == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].type
${str(snapshot)}`);
              }
              if (name == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name
${str(snapshot)}`);
              }
              if (args == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments
${str(snapshot)}`);
              }
              return { ...toolRest, id: id2, type, function: { ...fnRest, name, arguments: args } };
            })
          }
        };
      }
      return {
        ...choiceRest,
        message: { ...messageRest, content, role, refusal: message.refusal ?? null },
        finish_reason,
        index,
        logprobs
      };
    }),
    created,
    model,
    object: "chat.completion",
    ...system_fingerprint ? { system_fingerprint } : {}
  };
  return maybeParseChatCompletion(completion, params);
}
__name(finalizeChatCompletion, "finalizeChatCompletion");
function str(x) {
  return JSON.stringify(x);
}
__name(str, "str");
function assertIsEmpty(obj) {
  return;
}
__name(assertIsEmpty, "assertIsEmpty");
function assertNever(_x) {
}
__name(assertNever, "assertNever");

// ../node_modules/openai/lib/ChatCompletionStreamingRunner.mjs
var ChatCompletionStreamingRunner = class _ChatCompletionStreamingRunner extends ChatCompletionStream {
  static {
    __name(this, "ChatCompletionStreamingRunner");
  }
  static fromReadableStream(stream) {
    const runner = new _ChatCompletionStreamingRunner(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  /** @deprecated - please use `runTools` instead. */
  static runFunctions(client, params, options2) {
    const runner = new _ChatCompletionStreamingRunner(null);
    const opts = {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "runFunctions" }
    };
    runner._run(() => runner._runFunctions(client, params, opts));
    return runner;
  }
  static runTools(client, params, options2) {
    const runner = new _ChatCompletionStreamingRunner(
      // @ts-expect-error TODO these types are incompatible
      params
    );
    const opts = {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    runner._run(() => runner._runTools(client, params, opts));
    return runner;
  }
};

// ../node_modules/openai/resources/beta/chat/completions.mjs
var Completions2 = class extends APIResource {
  static {
    __name(this, "Completions");
  }
  parse(body, options2) {
    validateInputTools(body.tools);
    return this._client.chat.completions.create(body, {
      ...options2,
      headers: {
        ...options2?.headers,
        "X-Stainless-Helper-Method": "beta.chat.completions.parse"
      }
    })._thenUnwrap((completion) => parseChatCompletion(completion, body));
  }
  runFunctions(body, options2) {
    if (body.stream) {
      return ChatCompletionStreamingRunner.runFunctions(this._client, body, options2);
    }
    return ChatCompletionRunner.runFunctions(this._client, body, options2);
  }
  runTools(body, options2) {
    if (body.stream) {
      return ChatCompletionStreamingRunner.runTools(this._client, body, options2);
    }
    return ChatCompletionRunner.runTools(this._client, body, options2);
  }
  /**
   * Creates a chat completion stream
   */
  stream(body, options2) {
    return ChatCompletionStream.createChatCompletion(this._client, body, options2);
  }
};

// ../node_modules/openai/resources/beta/chat/chat.mjs
var Chat2 = class extends APIResource {
  static {
    __name(this, "Chat");
  }
  constructor() {
    super(...arguments);
    this.completions = new Completions2(this._client);
  }
};
(function(Chat3) {
  Chat3.Completions = Completions2;
})(Chat2 || (Chat2 = {}));

// ../node_modules/openai/resources/beta/realtime/sessions.mjs
var Sessions = class extends APIResource {
  static {
    __name(this, "Sessions");
  }
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API. Can be configured with the same session parameters as the
   * `session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   */
  create(body, options2) {
    return this._client.post("/realtime/sessions", {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
};

// ../node_modules/openai/resources/beta/realtime/realtime.mjs
var Realtime = class extends APIResource {
  static {
    __name(this, "Realtime");
  }
  constructor() {
    super(...arguments);
    this.sessions = new Sessions(this._client);
  }
};
Realtime.Sessions = Sessions;

// ../node_modules/openai/lib/AssistantStream.mjs
var __classPrivateFieldGet6 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet5 = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _AssistantStream_instances;
var _AssistantStream_events;
var _AssistantStream_runStepSnapshots;
var _AssistantStream_messageSnapshots;
var _AssistantStream_messageSnapshot;
var _AssistantStream_finalRun;
var _AssistantStream_currentContentIndex;
var _AssistantStream_currentContent;
var _AssistantStream_currentToolCallIndex;
var _AssistantStream_currentToolCall;
var _AssistantStream_currentEvent;
var _AssistantStream_currentRunSnapshot;
var _AssistantStream_currentRunStepSnapshot;
var _AssistantStream_addEvent;
var _AssistantStream_endRequest;
var _AssistantStream_handleMessage;
var _AssistantStream_handleRunStep;
var _AssistantStream_handleEvent;
var _AssistantStream_accumulateRunStep;
var _AssistantStream_accumulateMessage;
var _AssistantStream_accumulateContent;
var _AssistantStream_handleRun;
var AssistantStream = class _AssistantStream extends EventStream {
  static {
    __name(this, "AssistantStream");
  }
  constructor() {
    super(...arguments);
    _AssistantStream_instances.add(this);
    _AssistantStream_events.set(this, []);
    _AssistantStream_runStepSnapshots.set(this, {});
    _AssistantStream_messageSnapshots.set(this, {});
    _AssistantStream_messageSnapshot.set(this, void 0);
    _AssistantStream_finalRun.set(this, void 0);
    _AssistantStream_currentContentIndex.set(this, void 0);
    _AssistantStream_currentContent.set(this, void 0);
    _AssistantStream_currentToolCallIndex.set(this, void 0);
    _AssistantStream_currentToolCall.set(this, void 0);
    _AssistantStream_currentEvent.set(this, void 0);
    _AssistantStream_currentRunSnapshot.set(this, void 0);
    _AssistantStream_currentRunStepSnapshot.set(this, void 0);
  }
  [(_AssistantStream_events = /* @__PURE__ */ new WeakMap(), _AssistantStream_runStepSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_finalRun = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContentIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCallIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCall = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentEvent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunStepSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_instances = /* @__PURE__ */ new WeakSet(), Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("event", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: /* @__PURE__ */ __name(async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      }, "next"),
      return: /* @__PURE__ */ __name(async () => {
        this.abort();
        return { value: void 0, done: true };
      }, "return")
    };
  }
  static fromReadableStream(stream) {
    const runner = new _AssistantStream();
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  async _fromReadableStream(readableStream, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    this._connected();
    const stream = Stream.fromReadableStream(readableStream, this.controller);
    for await (const event of stream) {
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
  static createToolAssistantStream(threadId, runId, runs, params, options2) {
    const runner = new _AssistantStream();
    runner._run(() => runner._runToolAssistantStream(threadId, runId, runs, params, {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  async _createToolAssistantStream(run, threadId, runId, params, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await run.submitToolOutputs(threadId, runId, body, {
      ...options2,
      signal: this.controller.signal
    });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  static createThreadAssistantStream(params, thread, options2) {
    const runner = new _AssistantStream();
    runner._run(() => runner._threadAssistantStream(params, thread, {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  static createAssistantStream(threadId, runs, params, options2) {
    const runner = new _AssistantStream();
    runner._run(() => runner._runAssistantStream(threadId, runs, params, {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  currentEvent() {
    return __classPrivateFieldGet6(this, _AssistantStream_currentEvent, "f");
  }
  currentRun() {
    return __classPrivateFieldGet6(this, _AssistantStream_currentRunSnapshot, "f");
  }
  currentMessageSnapshot() {
    return __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f");
  }
  currentRunStepSnapshot() {
    return __classPrivateFieldGet6(this, _AssistantStream_currentRunStepSnapshot, "f");
  }
  async finalRunSteps() {
    await this.done();
    return Object.values(__classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f"));
  }
  async finalMessages() {
    await this.done();
    return Object.values(__classPrivateFieldGet6(this, _AssistantStream_messageSnapshots, "f"));
  }
  async finalRun() {
    await this.done();
    if (!__classPrivateFieldGet6(this, _AssistantStream_finalRun, "f"))
      throw Error("Final run was not received.");
    return __classPrivateFieldGet6(this, _AssistantStream_finalRun, "f");
  }
  async _createThreadAssistantStream(thread, params, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await thread.createAndRun(body, { ...options2, signal: this.controller.signal });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  async _createAssistantStream(run, threadId, params, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await run.create(threadId, body, { ...options2, signal: this.controller.signal });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  static accumulateDelta(acc, delta) {
    for (const [key, deltaValue] of Object.entries(delta)) {
      if (!acc.hasOwnProperty(key)) {
        acc[key] = deltaValue;
        continue;
      }
      let accValue = acc[key];
      if (accValue === null || accValue === void 0) {
        acc[key] = deltaValue;
        continue;
      }
      if (key === "index" || key === "type") {
        acc[key] = deltaValue;
        continue;
      }
      if (typeof accValue === "string" && typeof deltaValue === "string") {
        accValue += deltaValue;
      } else if (typeof accValue === "number" && typeof deltaValue === "number") {
        accValue += deltaValue;
      } else if (isObj(accValue) && isObj(deltaValue)) {
        accValue = this.accumulateDelta(accValue, deltaValue);
      } else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
        if (accValue.every((x) => typeof x === "string" || typeof x === "number")) {
          accValue.push(...deltaValue);
          continue;
        }
        for (const deltaEntry of deltaValue) {
          if (!isObj(deltaEntry)) {
            throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
          }
          const index = deltaEntry["index"];
          if (index == null) {
            console.error(deltaEntry);
            throw new Error("Expected array delta entry to have an `index` property");
          }
          if (typeof index !== "number") {
            throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
          }
          const accEntry = accValue[index];
          if (accEntry == null) {
            accValue.push(deltaEntry);
          } else {
            accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
          }
        }
        continue;
      } else {
        throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
      }
      acc[key] = accValue;
    }
    return acc;
  }
  _addRun(run) {
    return run;
  }
  async _threadAssistantStream(params, thread, options2) {
    return await this._createThreadAssistantStream(thread, params, options2);
  }
  async _runAssistantStream(threadId, runs, params, options2) {
    return await this._createAssistantStream(runs, threadId, params, options2);
  }
  async _runToolAssistantStream(threadId, runId, runs, params, options2) {
    return await this._createToolAssistantStream(runs, threadId, runId, params, options2);
  }
};
_AssistantStream_addEvent = /* @__PURE__ */ __name(function _AssistantStream_addEvent2(event) {
  if (this.ended)
    return;
  __classPrivateFieldSet5(this, _AssistantStream_currentEvent, event, "f");
  __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
  switch (event.event) {
    case "thread.created":
      break;
    case "thread.run.created":
    case "thread.run.queued":
    case "thread.run.in_progress":
    case "thread.run.requires_action":
    case "thread.run.completed":
    case "thread.run.incomplete":
    case "thread.run.failed":
    case "thread.run.cancelling":
    case "thread.run.cancelled":
    case "thread.run.expired":
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
      break;
    case "thread.run.step.created":
    case "thread.run.step.in_progress":
    case "thread.run.step.delta":
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
      break;
    case "thread.message.created":
    case "thread.message.in_progress":
    case "thread.message.delta":
    case "thread.message.completed":
    case "thread.message.incomplete":
      __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
      break;
    case "error":
      throw new Error("Encountered an error event in event processing - errors should be processed earlier");
    default:
      assertNever2(event);
  }
}, "_AssistantStream_addEvent"), _AssistantStream_endRequest = /* @__PURE__ */ __name(function _AssistantStream_endRequest2() {
  if (this.ended) {
    throw new OpenAIError(`stream has ended, this shouldn't happen`);
  }
  if (!__classPrivateFieldGet6(this, _AssistantStream_finalRun, "f"))
    throw Error("Final run has not been received");
  return __classPrivateFieldGet6(this, _AssistantStream_finalRun, "f");
}, "_AssistantStream_endRequest"), _AssistantStream_handleMessage = /* @__PURE__ */ __name(function _AssistantStream_handleMessage2(event) {
  const [accumulatedMessage, newContent] = __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f"));
  __classPrivateFieldSet5(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
  __classPrivateFieldGet6(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
  for (const content of newContent) {
    const snapshotContent = accumulatedMessage.content[content.index];
    if (snapshotContent?.type == "text") {
      this._emit("textCreated", snapshotContent.text);
    }
  }
  switch (event.event) {
    case "thread.message.created":
      this._emit("messageCreated", event.data);
      break;
    case "thread.message.in_progress":
      break;
    case "thread.message.delta":
      this._emit("messageDelta", event.data.delta, accumulatedMessage);
      if (event.data.delta.content) {
        for (const content of event.data.delta.content) {
          if (content.type == "text" && content.text) {
            let textDelta = content.text;
            let snapshot = accumulatedMessage.content[content.index];
            if (snapshot && snapshot.type == "text") {
              this._emit("textDelta", textDelta, snapshot.text);
            } else {
              throw Error("The snapshot associated with this text delta is not text or missing");
            }
          }
          if (content.index != __classPrivateFieldGet6(this, _AssistantStream_currentContentIndex, "f")) {
            if (__classPrivateFieldGet6(this, _AssistantStream_currentContent, "f")) {
              switch (__classPrivateFieldGet6(this, _AssistantStream_currentContent, "f").type) {
                case "text":
                  this._emit("textDone", __classPrivateFieldGet6(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f"));
                  break;
                case "image_file":
                  this._emit("imageFileDone", __classPrivateFieldGet6(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f"));
                  break;
              }
            }
            __classPrivateFieldSet5(this, _AssistantStream_currentContentIndex, content.index, "f");
          }
          __classPrivateFieldSet5(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
        }
      }
      break;
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (__classPrivateFieldGet6(this, _AssistantStream_currentContentIndex, "f") !== void 0) {
        const currentContent = event.data.content[__classPrivateFieldGet6(this, _AssistantStream_currentContentIndex, "f")];
        if (currentContent) {
          switch (currentContent.type) {
            case "image_file":
              this._emit("imageFileDone", currentContent.image_file, __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f"));
              break;
            case "text":
              this._emit("textDone", currentContent.text, __classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f"));
              break;
          }
        }
      }
      if (__classPrivateFieldGet6(this, _AssistantStream_messageSnapshot, "f")) {
        this._emit("messageDone", event.data);
      }
      __classPrivateFieldSet5(this, _AssistantStream_messageSnapshot, void 0, "f");
  }
}, "_AssistantStream_handleMessage"), _AssistantStream_handleRunStep = /* @__PURE__ */ __name(function _AssistantStream_handleRunStep2(event) {
  const accumulatedRunStep = __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
  __classPrivateFieldSet5(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
  switch (event.event) {
    case "thread.run.step.created":
      this._emit("runStepCreated", event.data);
      break;
    case "thread.run.step.delta":
      const delta = event.data.delta;
      if (delta.step_details && delta.step_details.type == "tool_calls" && delta.step_details.tool_calls && accumulatedRunStep.step_details.type == "tool_calls") {
        for (const toolCall of delta.step_details.tool_calls) {
          if (toolCall.index == __classPrivateFieldGet6(this, _AssistantStream_currentToolCallIndex, "f")) {
            this._emit("toolCallDelta", toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
          } else {
            if (__classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f")) {
              this._emit("toolCallDone", __classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f"));
            }
            __classPrivateFieldSet5(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
            __classPrivateFieldSet5(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
            if (__classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f"))
              this._emit("toolCallCreated", __classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f"));
          }
        }
      }
      this._emit("runStepDelta", event.data.delta, accumulatedRunStep);
      break;
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
      __classPrivateFieldSet5(this, _AssistantStream_currentRunStepSnapshot, void 0, "f");
      const details = event.data.step_details;
      if (details.type == "tool_calls") {
        if (__classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f")) {
          this._emit("toolCallDone", __classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f"));
          __classPrivateFieldSet5(this, _AssistantStream_currentToolCall, void 0, "f");
        }
      }
      this._emit("runStepDone", event.data, accumulatedRunStep);
      break;
    case "thread.run.step.in_progress":
      break;
  }
}, "_AssistantStream_handleRunStep"), _AssistantStream_handleEvent = /* @__PURE__ */ __name(function _AssistantStream_handleEvent2(event) {
  __classPrivateFieldGet6(this, _AssistantStream_events, "f").push(event);
  this._emit("event", event);
}, "_AssistantStream_handleEvent"), _AssistantStream_accumulateRunStep = /* @__PURE__ */ __name(function _AssistantStream_accumulateRunStep2(event) {
  switch (event.event) {
    case "thread.run.step.created":
      __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      return event.data;
    case "thread.run.step.delta":
      let snapshot = __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
      if (!snapshot) {
        throw Error("Received a RunStepDelta before creation of a snapshot");
      }
      let data = event.data;
      if (data.delta) {
        const accumulated = AssistantStream.accumulateDelta(snapshot, data.delta);
        __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
      }
      return __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
    case "thread.run.step.in_progress":
      __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      break;
  }
  if (__classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id])
    return __classPrivateFieldGet6(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
  throw new Error("No snapshot available");
}, "_AssistantStream_accumulateRunStep"), _AssistantStream_accumulateMessage = /* @__PURE__ */ __name(function _AssistantStream_accumulateMessage2(event, snapshot) {
  let newContent = [];
  switch (event.event) {
    case "thread.message.created":
      return [event.data, newContent];
    case "thread.message.delta":
      if (!snapshot) {
        throw Error("Received a delta with no existing snapshot (there should be one from message creation)");
      }
      let data = event.data;
      if (data.delta.content) {
        for (const contentElement of data.delta.content) {
          if (contentElement.index in snapshot.content) {
            let currentContent = snapshot.content[contentElement.index];
            snapshot.content[contentElement.index] = __classPrivateFieldGet6(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
          } else {
            snapshot.content[contentElement.index] = contentElement;
            newContent.push(contentElement);
          }
        }
      }
      return [snapshot, newContent];
    case "thread.message.in_progress":
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (snapshot) {
        return [snapshot, newContent];
      } else {
        throw Error("Received thread message event with no existing snapshot");
      }
  }
  throw Error("Tried to accumulate a non-message event");
}, "_AssistantStream_accumulateMessage"), _AssistantStream_accumulateContent = /* @__PURE__ */ __name(function _AssistantStream_accumulateContent2(contentElement, currentContent) {
  return AssistantStream.accumulateDelta(currentContent, contentElement);
}, "_AssistantStream_accumulateContent"), _AssistantStream_handleRun = /* @__PURE__ */ __name(function _AssistantStream_handleRun2(event) {
  __classPrivateFieldSet5(this, _AssistantStream_currentRunSnapshot, event.data, "f");
  switch (event.event) {
    case "thread.run.created":
      break;
    case "thread.run.queued":
      break;
    case "thread.run.in_progress":
      break;
    case "thread.run.requires_action":
    case "thread.run.cancelled":
    case "thread.run.failed":
    case "thread.run.completed":
    case "thread.run.expired":
      __classPrivateFieldSet5(this, _AssistantStream_finalRun, event.data, "f");
      if (__classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f")) {
        this._emit("toolCallDone", __classPrivateFieldGet6(this, _AssistantStream_currentToolCall, "f"));
        __classPrivateFieldSet5(this, _AssistantStream_currentToolCall, void 0, "f");
      }
      break;
    case "thread.run.cancelling":
      break;
  }
}, "_AssistantStream_handleRun");
function assertNever2(_x) {
}
__name(assertNever2, "assertNever");

// ../node_modules/openai/resources/beta/threads/messages.mjs
var Messages2 = class extends APIResource {
  static {
    __name(this, "Messages");
  }
  /**
   * Create a message.
   */
  create(threadId, body, options2) {
    return this._client.post(`/threads/${threadId}/messages`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieve a message.
   */
  retrieve(threadId, messageId, options2) {
    return this._client.get(`/threads/${threadId}/messages/${messageId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Modifies a message.
   */
  update(threadId, messageId, body, options2) {
    return this._client.post(`/threads/${threadId}/messages/${messageId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(threadId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(threadId, {}, query);
    }
    return this._client.getAPIList(`/threads/${threadId}/messages`, MessagesPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Deletes a message.
   */
  del(threadId, messageId, options2) {
    return this._client.delete(`/threads/${threadId}/messages/${messageId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
};
var MessagesPage = class extends CursorPage {
  static {
    __name(this, "MessagesPage");
  }
};
Messages2.MessagesPage = MessagesPage;

// ../node_modules/openai/resources/beta/threads/runs/steps.mjs
var Steps = class extends APIResource {
  static {
    __name(this, "Steps");
  }
  retrieve(threadId, runId, stepId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.retrieve(threadId, runId, stepId, {}, query);
    }
    return this._client.get(`/threads/${threadId}/runs/${runId}/steps/${stepId}`, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(threadId, runId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(threadId, runId, {}, query);
    }
    return this._client.getAPIList(`/threads/${threadId}/runs/${runId}/steps`, RunStepsPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
};
var RunStepsPage = class extends CursorPage {
  static {
    __name(this, "RunStepsPage");
  }
};
Steps.RunStepsPage = RunStepsPage;

// ../node_modules/openai/resources/beta/threads/runs/runs.mjs
var Runs = class extends APIResource {
  static {
    __name(this, "Runs");
  }
  constructor() {
    super(...arguments);
    this.steps = new Steps(this._client);
  }
  create(threadId, params, options2) {
    const { include, ...body } = params;
    return this._client.post(`/threads/${threadId}/runs`, {
      query: { include },
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers },
      stream: params.stream ?? false
    });
  }
  /**
   * Retrieves a run.
   */
  retrieve(threadId, runId, options2) {
    return this._client.get(`/threads/${threadId}/runs/${runId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Modifies a run.
   */
  update(threadId, runId, body, options2) {
    return this._client.post(`/threads/${threadId}/runs/${runId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(threadId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(threadId, {}, query);
    }
    return this._client.getAPIList(`/threads/${threadId}/runs`, RunsPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Cancels a run that is `in_progress`.
   */
  cancel(threadId, runId, options2) {
    return this._client.post(`/threads/${threadId}/runs/${runId}/cancel`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * A helper to create a run an poll for a terminal state. More information on Run
   * lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndPoll(threadId, body, options2) {
    const run = await this.create(threadId, body, options2);
    return await this.poll(threadId, run.id, options2);
  }
  /**
   * Create a Run stream
   *
   * @deprecated use `stream` instead
   */
  createAndStream(threadId, body, options2) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options2);
  }
  /**
   * A helper to poll a run status until it reaches a terminal state. More
   * information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async poll(threadId, runId, options2) {
    const headers = { ...options2?.headers, "X-Stainless-Poll-Helper": "true" };
    if (options2?.pollIntervalMs) {
      headers["X-Stainless-Custom-Poll-Interval"] = options2.pollIntervalMs.toString();
    }
    while (true) {
      const { data: run, response } = await this.retrieve(threadId, runId, {
        ...options2,
        headers: { ...options2?.headers, ...headers }
      }).withResponse();
      switch (run.status) {
        //If we are in any sort of intermediate state we poll
        case "queued":
        case "in_progress":
        case "cancelling":
          let sleepInterval = 5e3;
          if (options2?.pollIntervalMs) {
            sleepInterval = options2.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        //We return the run in any terminal state.
        case "requires_action":
        case "incomplete":
        case "cancelled":
        case "completed":
        case "failed":
        case "expired":
          return run;
      }
    }
  }
  /**
   * Create a Run stream
   */
  stream(threadId, body, options2) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options2);
  }
  submitToolOutputs(threadId, runId, body, options2) {
    return this._client.post(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers },
      stream: body.stream ?? false
    });
  }
  /**
   * A helper to submit a tool output to a run and poll for a terminal run state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async submitToolOutputsAndPoll(threadId, runId, body, options2) {
    const run = await this.submitToolOutputs(threadId, runId, body, options2);
    return await this.poll(threadId, run.id, options2);
  }
  /**
   * Submit the tool outputs from a previous run and stream the run to a terminal
   * state. More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  submitToolOutputsStream(threadId, runId, body, options2) {
    return AssistantStream.createToolAssistantStream(threadId, runId, this._client.beta.threads.runs, body, options2);
  }
};
var RunsPage = class extends CursorPage {
  static {
    __name(this, "RunsPage");
  }
};
Runs.RunsPage = RunsPage;
Runs.Steps = Steps;
Runs.RunStepsPage = RunStepsPage;

// ../node_modules/openai/resources/beta/threads/threads.mjs
var Threads = class extends APIResource {
  static {
    __name(this, "Threads");
  }
  constructor() {
    super(...arguments);
    this.runs = new Runs(this._client);
    this.messages = new Messages2(this._client);
  }
  create(body = {}, options2) {
    if (isRequestOptions(body)) {
      return this.create({}, body);
    }
    return this._client.post("/threads", {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieves a thread.
   */
  retrieve(threadId, options2) {
    return this._client.get(`/threads/${threadId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Modifies a thread.
   */
  update(threadId, body, options2) {
    return this._client.post(`/threads/${threadId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Delete a thread.
   */
  del(threadId, options2) {
    return this._client.delete(`/threads/${threadId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  createAndRun(body, options2) {
    return this._client.post("/threads/runs", {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers },
      stream: body.stream ?? false
    });
  }
  /**
   * A helper to create a thread, start a run and then poll for a terminal state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndRunPoll(body, options2) {
    const run = await this.createAndRun(body, options2);
    return await this.runs.poll(run.thread_id, run.id, options2);
  }
  /**
   * Create a thread and stream the run back
   */
  createAndRunStream(body, options2) {
    return AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options2);
  }
};
Threads.Runs = Runs;
Threads.RunsPage = RunsPage;
Threads.Messages = Messages2;
Threads.MessagesPage = MessagesPage;

// ../node_modules/openai/resources/beta/beta.mjs
var Beta = class extends APIResource {
  static {
    __name(this, "Beta");
  }
  constructor() {
    super(...arguments);
    this.realtime = new Realtime(this._client);
    this.chat = new Chat2(this._client);
    this.assistants = new Assistants(this._client);
    this.threads = new Threads(this._client);
  }
};
Beta.Realtime = Realtime;
Beta.Assistants = Assistants;
Beta.AssistantsPage = AssistantsPage;
Beta.Threads = Threads;

// ../node_modules/openai/resources/completions.mjs
var Completions3 = class extends APIResource {
  static {
    __name(this, "Completions");
  }
  create(body, options2) {
    return this._client.post("/completions", { body, ...options2, stream: body.stream ?? false });
  }
};

// ../node_modules/openai/resources/embeddings.mjs
var Embeddings = class extends APIResource {
  static {
    __name(this, "Embeddings");
  }
  /**
   * Creates an embedding vector representing the input text.
   */
  create(body, options2) {
    return this._client.post("/embeddings", { body, ...options2 });
  }
};

// ../node_modules/openai/resources/files.mjs
var Files = class extends APIResource {
  static {
    __name(this, "Files");
  }
  /**
   * Upload a file that can be used across various endpoints. Individual files can be
   * up to 512 MB, and the size of all files uploaded by one organization can be up
   * to 100 GB.
   *
   * The Assistants API supports files up to 2 million tokens and of specific file
   * types. See the
   * [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools) for
   * details.
   *
   * The Fine-tuning API only supports `.jsonl` files. The input also has certain
   * required formats for fine-tuning
   * [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input) or
   * [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
   * models.
   *
   * The Batch API only supports `.jsonl` files up to 200 MB in size. The input also
   * has a specific required
   * [format](https://platform.openai.com/docs/api-reference/batch/request-input).
   *
   * Please [contact us](https://help.openai.com/) if you need to increase these
   * storage limits.
   */
  create(body, options2) {
    return this._client.post("/files", multipartFormRequestOptions({ body, ...options2 }));
  }
  /**
   * Returns information about a specific file.
   */
  retrieve(fileId, options2) {
    return this._client.get(`/files/${fileId}`, options2);
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/files", FileObjectsPage, { query, ...options2 });
  }
  /**
   * Delete a file.
   */
  del(fileId, options2) {
    return this._client.delete(`/files/${fileId}`, options2);
  }
  /**
   * Returns the contents of the specified file.
   */
  content(fileId, options2) {
    return this._client.get(`/files/${fileId}/content`, {
      ...options2,
      headers: { Accept: "application/binary", ...options2?.headers },
      __binaryResponse: true
    });
  }
  /**
   * Returns the contents of the specified file.
   *
   * @deprecated The `.content()` method should be used instead
   */
  retrieveContent(fileId, options2) {
    return this._client.get(`/files/${fileId}/content`, options2);
  }
  /**
   * Waits for the given file to be processed, default timeout is 30 mins.
   */
  async waitForProcessing(id, { pollInterval = 5e3, maxWait = 30 * 60 * 1e3 } = {}) {
    const TERMINAL_STATES = /* @__PURE__ */ new Set(["processed", "error", "deleted"]);
    const start = Date.now();
    let file = await this.retrieve(id);
    while (!file.status || !TERMINAL_STATES.has(file.status)) {
      await sleep(pollInterval);
      file = await this.retrieve(id);
      if (Date.now() - start > maxWait) {
        throw new APIConnectionTimeoutError({
          message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`
        });
      }
    }
    return file;
  }
};
var FileObjectsPage = class extends CursorPage {
  static {
    __name(this, "FileObjectsPage");
  }
};
Files.FileObjectsPage = FileObjectsPage;

// ../node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs
var Checkpoints = class extends APIResource {
  static {
    __name(this, "Checkpoints");
  }
  list(fineTuningJobId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(fineTuningJobId, {}, query);
    }
    return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/checkpoints`, FineTuningJobCheckpointsPage, { query, ...options2 });
  }
};
var FineTuningJobCheckpointsPage = class extends CursorPage {
  static {
    __name(this, "FineTuningJobCheckpointsPage");
  }
};
Checkpoints.FineTuningJobCheckpointsPage = FineTuningJobCheckpointsPage;

// ../node_modules/openai/resources/fine-tuning/jobs/jobs.mjs
var Jobs = class extends APIResource {
  static {
    __name(this, "Jobs");
  }
  constructor() {
    super(...arguments);
    this.checkpoints = new Checkpoints(this._client);
  }
  /**
   * Creates a fine-tuning job which begins the process of creating a new model from
   * a given dataset.
   *
   * Response includes details of the enqueued job including job status and the name
   * of the fine-tuned models once complete.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
   */
  create(body, options2) {
    return this._client.post("/fine_tuning/jobs", { body, ...options2 });
  }
  /**
   * Get info about a fine-tuning job.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
   */
  retrieve(fineTuningJobId, options2) {
    return this._client.get(`/fine_tuning/jobs/${fineTuningJobId}`, options2);
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/fine_tuning/jobs", FineTuningJobsPage, { query, ...options2 });
  }
  /**
   * Immediately cancel a fine-tune job.
   */
  cancel(fineTuningJobId, options2) {
    return this._client.post(`/fine_tuning/jobs/${fineTuningJobId}/cancel`, options2);
  }
  listEvents(fineTuningJobId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.listEvents(fineTuningJobId, {}, query);
    }
    return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/events`, FineTuningJobEventsPage, {
      query,
      ...options2
    });
  }
};
var FineTuningJobsPage = class extends CursorPage {
  static {
    __name(this, "FineTuningJobsPage");
  }
};
var FineTuningJobEventsPage = class extends CursorPage {
  static {
    __name(this, "FineTuningJobEventsPage");
  }
};
Jobs.FineTuningJobsPage = FineTuningJobsPage;
Jobs.FineTuningJobEventsPage = FineTuningJobEventsPage;
Jobs.Checkpoints = Checkpoints;
Jobs.FineTuningJobCheckpointsPage = FineTuningJobCheckpointsPage;

// ../node_modules/openai/resources/fine-tuning/fine-tuning.mjs
var FineTuning = class extends APIResource {
  static {
    __name(this, "FineTuning");
  }
  constructor() {
    super(...arguments);
    this.jobs = new Jobs(this._client);
  }
};
FineTuning.Jobs = Jobs;
FineTuning.FineTuningJobsPage = FineTuningJobsPage;
FineTuning.FineTuningJobEventsPage = FineTuningJobEventsPage;

// ../node_modules/openai/resources/images.mjs
var Images = class extends APIResource {
  static {
    __name(this, "Images");
  }
  /**
   * Creates a variation of a given image.
   */
  createVariation(body, options2) {
    return this._client.post("/images/variations", multipartFormRequestOptions({ body, ...options2 }));
  }
  /**
   * Creates an edited or extended image given an original image and a prompt.
   */
  edit(body, options2) {
    return this._client.post("/images/edits", multipartFormRequestOptions({ body, ...options2 }));
  }
  /**
   * Creates an image given a prompt.
   */
  generate(body, options2) {
    return this._client.post("/images/generations", { body, ...options2 });
  }
};

// ../node_modules/openai/resources/models.mjs
var Models = class extends APIResource {
  static {
    __name(this, "Models");
  }
  /**
   * Retrieves a model instance, providing basic information about the model such as
   * the owner and permissioning.
   */
  retrieve(model, options2) {
    return this._client.get(`/models/${model}`, options2);
  }
  /**
   * Lists the currently available models, and provides basic information about each
   * one such as the owner and availability.
   */
  list(options2) {
    return this._client.getAPIList("/models", ModelsPage, options2);
  }
  /**
   * Delete a fine-tuned model. You must have the Owner role in your organization to
   * delete a model.
   */
  del(model, options2) {
    return this._client.delete(`/models/${model}`, options2);
  }
};
var ModelsPage = class extends Page {
  static {
    __name(this, "ModelsPage");
  }
};
Models.ModelsPage = ModelsPage;

// ../node_modules/openai/resources/moderations.mjs
var Moderations = class extends APIResource {
  static {
    __name(this, "Moderations");
  }
  /**
   * Classifies if text and/or image inputs are potentially harmful. Learn more in
   * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
   */
  create(body, options2) {
    return this._client.post("/moderations", { body, ...options2 });
  }
};

// ../node_modules/openai/lib/ResponsesParser.mjs
function maybeParseResponse(response, params) {
  if (!params || !hasAutoParseableInput2(params)) {
    return {
      ...response,
      output_parsed: null,
      output: response.output.map((item) => {
        if (item.type === "function_call") {
          return {
            ...item,
            parsed_arguments: null
          };
        }
        if (item.type === "message") {
          return {
            ...item,
            content: item.content.map((content) => ({
              ...content,
              parsed: null
            }))
          };
        } else {
          return item;
        }
      })
    };
  }
  return parseResponse(response, params);
}
__name(maybeParseResponse, "maybeParseResponse");
function parseResponse(response, params) {
  const output = response.output.map((item) => {
    if (item.type === "function_call") {
      return {
        ...item,
        parsed_arguments: parseToolCall2(params, item)
      };
    }
    if (item.type === "message") {
      const content = item.content.map((content2) => {
        if (content2.type === "output_text") {
          return {
            ...content2,
            parsed: parseTextFormat(params, content2.text)
          };
        }
        return content2;
      });
      return {
        ...item,
        content
      };
    }
    return item;
  });
  const parsed = Object.assign({}, response, { output });
  if (!Object.getOwnPropertyDescriptor(response, "output_text")) {
    addOutputText(parsed);
  }
  Object.defineProperty(parsed, "output_parsed", {
    enumerable: true,
    get() {
      for (const output2 of parsed.output) {
        if (output2.type !== "message") {
          continue;
        }
        for (const content of output2.content) {
          if (content.type === "output_text" && content.parsed !== null) {
            return content.parsed;
          }
        }
      }
      return null;
    }
  });
  return parsed;
}
__name(parseResponse, "parseResponse");
function parseTextFormat(params, content) {
  if (params.text?.format?.type !== "json_schema") {
    return null;
  }
  if ("$parseRaw" in params.text?.format) {
    const text_format = params.text?.format;
    return text_format.$parseRaw(content);
  }
  return JSON.parse(content);
}
__name(parseTextFormat, "parseTextFormat");
function hasAutoParseableInput2(params) {
  if (isAutoParsableResponseFormat(params.text?.format)) {
    return true;
  }
  return false;
}
__name(hasAutoParseableInput2, "hasAutoParseableInput");
function isAutoParsableTool2(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
__name(isAutoParsableTool2, "isAutoParsableTool");
function getInputToolByName(input_tools, name) {
  return input_tools.find((tool) => tool.type === "function" && tool.name === name);
}
__name(getInputToolByName, "getInputToolByName");
function parseToolCall2(params, toolCall) {
  const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
  return {
    ...toolCall,
    ...toolCall,
    parsed_arguments: isAutoParsableTool2(inputTool) ? inputTool.$parseRaw(toolCall.arguments) : inputTool?.strict ? JSON.parse(toolCall.arguments) : null
  };
}
__name(parseToolCall2, "parseToolCall");
function addOutputText(rsp) {
  const texts = [];
  for (const output of rsp.output) {
    if (output.type !== "message") {
      continue;
    }
    for (const content of output.content) {
      if (content.type === "output_text") {
        texts.push(content.text);
      }
    }
  }
  rsp.output_text = texts.join("");
}
__name(addOutputText, "addOutputText");

// ../node_modules/openai/resources/responses/input-items.mjs
var InputItems = class extends APIResource {
  static {
    __name(this, "InputItems");
  }
  list(responseId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(responseId, {}, query);
    }
    return this._client.getAPIList(`/responses/${responseId}/input_items`, ResponseItemListDataPage, {
      query,
      ...options2
    });
  }
};
var ResponseItemListDataPage = class extends CursorPage {
  static {
    __name(this, "ResponseItemListDataPage");
  }
};
InputItems.ResponseItemListDataPage = ResponseItemListDataPage;

// ../node_modules/openai/lib/responses/ResponseStream.mjs
var __classPrivateFieldSet6 = function(receiver, state, value, kind2, f) {
  if (kind2 === "m") throw new TypeError("Private method is not writable");
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind2 === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet7 = function(receiver, state, kind2, f) {
  if (kind2 === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind2 === "m" ? f : kind2 === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ResponseStream_instances;
var _ResponseStream_params;
var _ResponseStream_currentResponseSnapshot;
var _ResponseStream_finalResponse;
var _ResponseStream_beginRequest;
var _ResponseStream_addEvent;
var _ResponseStream_endRequest;
var _ResponseStream_accumulateResponse;
var ResponseStream = class _ResponseStream extends EventStream {
  static {
    __name(this, "ResponseStream");
  }
  constructor(params) {
    super();
    _ResponseStream_instances.add(this);
    _ResponseStream_params.set(this, void 0);
    _ResponseStream_currentResponseSnapshot.set(this, void 0);
    _ResponseStream_finalResponse.set(this, void 0);
    __classPrivateFieldSet6(this, _ResponseStream_params, params, "f");
  }
  static createResponse(client, params, options2) {
    const runner = new _ResponseStream(params);
    runner._run(() => runner._createResponse(client, params, {
      ...options2,
      headers: { ...options2?.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  async _createResponse(client, params, options2) {
    const signal = options2?.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet7(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
    const stream = await client.responses.create({ ...params, stream: true }, { ...options2, signal: this.controller.signal });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet7(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event);
    }
    if (stream.controller.signal?.aborted) {
      throw new APIUserAbortError();
    }
    return __classPrivateFieldGet7(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
  }
  [(_ResponseStream_params = /* @__PURE__ */ new WeakMap(), _ResponseStream_currentResponseSnapshot = /* @__PURE__ */ new WeakMap(), _ResponseStream_finalResponse = /* @__PURE__ */ new WeakMap(), _ResponseStream_instances = /* @__PURE__ */ new WeakSet(), _ResponseStream_beginRequest = /* @__PURE__ */ __name(function _ResponseStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet6(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
  }, "_ResponseStream_beginRequest"), _ResponseStream_addEvent = /* @__PURE__ */ __name(function _ResponseStream_addEvent2(event) {
    if (this.ended)
      return;
    const response = __classPrivateFieldGet7(this, _ResponseStream_instances, "m", _ResponseStream_accumulateResponse).call(this, event);
    this._emit("event", event);
    switch (event.type) {
      case "response.output_text.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          const content = output.content[event.content_index];
          if (!content) {
            throw new OpenAIError(`missing content at index ${event.content_index}`);
          }
          if (content.type !== "output_text") {
            throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
          }
          this._emit("response.output_text.delta", {
            ...event,
            snapshot: content.text
          });
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "function_call") {
          this._emit("response.function_call_arguments.delta", {
            ...event,
            snapshot: output.arguments
          });
        }
        break;
      }
      default:
        this._emit(event.type, event);
        break;
    }
  }, "_ResponseStream_addEvent"), _ResponseStream_endRequest = /* @__PURE__ */ __name(function _ResponseStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet7(this, _ResponseStream_currentResponseSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any events`);
    }
    __classPrivateFieldSet6(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
    const parsedResponse = finalizeResponse(snapshot, __classPrivateFieldGet7(this, _ResponseStream_params, "f"));
    __classPrivateFieldSet6(this, _ResponseStream_finalResponse, parsedResponse, "f");
    return parsedResponse;
  }, "_ResponseStream_endRequest"), _ResponseStream_accumulateResponse = /* @__PURE__ */ __name(function _ResponseStream_accumulateResponse2(event) {
    let snapshot = __classPrivateFieldGet7(this, _ResponseStream_currentResponseSnapshot, "f");
    if (!snapshot) {
      if (event.type !== "response.created") {
        throw new OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
      }
      snapshot = __classPrivateFieldSet6(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
      return snapshot;
    }
    switch (event.type) {
      case "response.output_item.added": {
        snapshot.output.push(event.item);
        break;
      }
      case "response.content_part.added": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          output.content.push(event.part);
        }
        break;
      }
      case "response.output_text.delta": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          const content = output.content[event.content_index];
          if (!content) {
            throw new OpenAIError(`missing content at index ${event.content_index}`);
          }
          if (content.type !== "output_text") {
            throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
          }
          content.text += event.delta;
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "function_call") {
          output.arguments += event.delta;
        }
        break;
      }
      case "response.completed": {
        __classPrivateFieldSet6(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
        break;
      }
    }
    return snapshot;
  }, "_ResponseStream_accumulateResponse"), Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("event", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: /* @__PURE__ */ __name(async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((event2) => event2 ? { value: event2, done: false } : { value: void 0, done: true });
        }
        const event = pushQueue.shift();
        return { value: event, done: false };
      }, "next"),
      return: /* @__PURE__ */ __name(async () => {
        this.abort();
        return { value: void 0, done: true };
      }, "return")
    };
  }
  /**
   * @returns a promise that resolves with the final Response, or rejects
   * if an error occurred or the stream ended prematurely without producing a REsponse.
   */
  async finalResponse() {
    await this.done();
    const response = __classPrivateFieldGet7(this, _ResponseStream_finalResponse, "f");
    if (!response)
      throw new OpenAIError("stream ended without producing a ChatCompletion");
    return response;
  }
};
function finalizeResponse(snapshot, params) {
  return maybeParseResponse(snapshot, params);
}
__name(finalizeResponse, "finalizeResponse");

// ../node_modules/openai/resources/responses/responses.mjs
var Responses = class extends APIResource {
  static {
    __name(this, "Responses");
  }
  constructor() {
    super(...arguments);
    this.inputItems = new InputItems(this._client);
  }
  create(body, options2) {
    return this._client.post("/responses", { body, ...options2, stream: body.stream ?? false })._thenUnwrap((rsp) => {
      if ("object" in rsp && rsp.object === "response") {
        addOutputText(rsp);
      }
      return rsp;
    });
  }
  retrieve(responseId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.retrieve(responseId, {}, query);
    }
    return this._client.get(`/responses/${responseId}`, { query, ...options2 });
  }
  /**
   * Deletes a model response with the given ID.
   */
  del(responseId, options2) {
    return this._client.delete(`/responses/${responseId}`, {
      ...options2,
      headers: { Accept: "*/*", ...options2?.headers }
    });
  }
  parse(body, options2) {
    return this._client.responses.create(body, options2)._thenUnwrap((response) => parseResponse(response, body));
  }
  /**
   * Creates a chat completion stream
   */
  stream(body, options2) {
    return ResponseStream.createResponse(this._client, body, options2);
  }
};
Responses.InputItems = InputItems;
Responses.ResponseItemListDataPage = ResponseItemListDataPage;

// ../node_modules/openai/resources/uploads/parts.mjs
var Parts = class extends APIResource {
  static {
    __name(this, "Parts");
  }
  /**
   * Adds a
   * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
   * A Part represents a chunk of bytes from the file you are trying to upload.
   *
   * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
   * maximum of 8 GB.
   *
   * It is possible to add multiple Parts in parallel. You can decide the intended
   * order of the Parts when you
   * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
   */
  create(uploadId, body, options2) {
    return this._client.post(`/uploads/${uploadId}/parts`, multipartFormRequestOptions({ body, ...options2 }));
  }
};

// ../node_modules/openai/resources/uploads/uploads.mjs
var Uploads = class extends APIResource {
  static {
    __name(this, "Uploads");
  }
  constructor() {
    super(...arguments);
    this.parts = new Parts(this._client);
  }
  /**
   * Creates an intermediate
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
   * that you can add
   * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
   * Currently, an Upload can accept at most 8 GB in total and expires after an hour
   * after you create it.
   *
   * Once you complete the Upload, we will create a
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * contains all the parts you uploaded. This File is usable in the rest of our
   * platform as a regular File object.
   *
   * For certain `purpose` values, the correct `mime_type` must be specified. Please
   * refer to documentation for the
   * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
   *
   * For guidance on the proper filename extensions for each purpose, please follow
   * the documentation on
   * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
   */
  create(body, options2) {
    return this._client.post("/uploads", { body, ...options2 });
  }
  /**
   * Cancels the Upload. No Parts may be added after an Upload is cancelled.
   */
  cancel(uploadId, options2) {
    return this._client.post(`/uploads/${uploadId}/cancel`, options2);
  }
  /**
   * Completes the
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
   *
   * Within the returned Upload object, there is a nested
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * is ready to use in the rest of the platform.
   *
   * You can specify the order of the Parts by passing in an ordered list of the Part
   * IDs.
   *
   * The number of bytes uploaded upon completion must match the number of bytes
   * initially specified when creating the Upload object. No Parts may be added after
   * an Upload is completed.
   */
  complete(uploadId, body, options2) {
    return this._client.post(`/uploads/${uploadId}/complete`, { body, ...options2 });
  }
};
Uploads.Parts = Parts;

// ../node_modules/openai/lib/Util.mjs
var allSettledWithThrow = /* @__PURE__ */ __name(async (promises) => {
  const results = await Promise.allSettled(promises);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const result of rejected) {
      console.error(result.reason);
    }
    throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
  }
  const values = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      values.push(result.value);
    }
  }
  return values;
}, "allSettledWithThrow");

// ../node_modules/openai/resources/vector-stores/files.mjs
var Files2 = class extends APIResource {
  static {
    __name(this, "Files");
  }
  /**
   * Create a vector store file by attaching a
   * [File](https://platform.openai.com/docs/api-reference/files) to a
   * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
   */
  create(vectorStoreId, body, options2) {
    return this._client.post(`/vector_stores/${vectorStoreId}/files`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieves a vector store file.
   */
  retrieve(vectorStoreId, fileId, options2) {
    return this._client.get(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Update attributes on a vector store file.
   */
  update(vectorStoreId, fileId, body, options2) {
    return this._client.post(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(vectorStoreId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list(vectorStoreId, {}, query);
    }
    return this._client.getAPIList(`/vector_stores/${vectorStoreId}/files`, VectorStoreFilesPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Delete a vector store file. This will remove the file from the vector store but
   * the file itself will not be deleted. To delete the file, use the
   * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
   * endpoint.
   */
  del(vectorStoreId, fileId, options2) {
    return this._client.delete(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Attach a file to the given vector store and wait for it to be processed.
   */
  async createAndPoll(vectorStoreId, body, options2) {
    const file = await this.create(vectorStoreId, body, options2);
    return await this.poll(vectorStoreId, file.id, options2);
  }
  /**
   * Wait for the vector store file to finish processing.
   *
   * Note: this will return even if the file failed to process, you need to check
   * file.last_error and file.status to handle these cases
   */
  async poll(vectorStoreId, fileId, options2) {
    const headers = { ...options2?.headers, "X-Stainless-Poll-Helper": "true" };
    if (options2?.pollIntervalMs) {
      headers["X-Stainless-Custom-Poll-Interval"] = options2.pollIntervalMs.toString();
    }
    while (true) {
      const fileResponse = await this.retrieve(vectorStoreId, fileId, {
        ...options2,
        headers
      }).withResponse();
      const file = fileResponse.data;
      switch (file.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options2?.pollIntervalMs) {
            sleepInterval = options2.pollIntervalMs;
          } else {
            const headerInterval = fileResponse.response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "completed":
          return file;
      }
    }
  }
  /**
   * Upload a file to the `files` API and then attach it to the given vector store.
   *
   * Note the file will be asynchronously processed (you can use the alternative
   * polling helper method to wait for processing to complete).
   */
  async upload(vectorStoreId, file, options2) {
    const fileInfo = await this._client.files.create({ file, purpose: "assistants" }, options2);
    return this.create(vectorStoreId, { file_id: fileInfo.id }, options2);
  }
  /**
   * Add a file to a vector store and poll until processing is complete.
   */
  async uploadAndPoll(vectorStoreId, file, options2) {
    const fileInfo = await this.upload(vectorStoreId, file, options2);
    return await this.poll(vectorStoreId, fileInfo.id, options2);
  }
  /**
   * Retrieve the parsed contents of a vector store file.
   */
  content(vectorStoreId, fileId, options2) {
    return this._client.getAPIList(`/vector_stores/${vectorStoreId}/files/${fileId}/content`, FileContentResponsesPage, { ...options2, headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers } });
  }
};
var VectorStoreFilesPage = class extends CursorPage {
  static {
    __name(this, "VectorStoreFilesPage");
  }
};
var FileContentResponsesPage = class extends Page {
  static {
    __name(this, "FileContentResponsesPage");
  }
};
Files2.VectorStoreFilesPage = VectorStoreFilesPage;
Files2.FileContentResponsesPage = FileContentResponsesPage;

// ../node_modules/openai/resources/vector-stores/file-batches.mjs
var FileBatches = class extends APIResource {
  static {
    __name(this, "FileBatches");
  }
  /**
   * Create a vector store file batch.
   */
  create(vectorStoreId, body, options2) {
    return this._client.post(`/vector_stores/${vectorStoreId}/file_batches`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieves a vector store file batch.
   */
  retrieve(vectorStoreId, batchId, options2) {
    return this._client.get(`/vector_stores/${vectorStoreId}/file_batches/${batchId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Cancel a vector store file batch. This attempts to cancel the processing of
   * files in this batch as soon as possible.
   */
  cancel(vectorStoreId, batchId, options2) {
    return this._client.post(`/vector_stores/${vectorStoreId}/file_batches/${batchId}/cancel`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Create a vector store batch and poll until all files have been processed.
   */
  async createAndPoll(vectorStoreId, body, options2) {
    const batch = await this.create(vectorStoreId, body);
    return await this.poll(vectorStoreId, batch.id, options2);
  }
  listFiles(vectorStoreId, batchId, query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.listFiles(vectorStoreId, batchId, {}, query);
    }
    return this._client.getAPIList(`/vector_stores/${vectorStoreId}/file_batches/${batchId}/files`, VectorStoreFilesPage, { query, ...options2, headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers } });
  }
  /**
   * Wait for the given file batch to be processed.
   *
   * Note: this will return even if one of the files failed to process, you need to
   * check batch.file_counts.failed_count to handle this case.
   */
  async poll(vectorStoreId, batchId, options2) {
    const headers = { ...options2?.headers, "X-Stainless-Poll-Helper": "true" };
    if (options2?.pollIntervalMs) {
      headers["X-Stainless-Custom-Poll-Interval"] = options2.pollIntervalMs.toString();
    }
    while (true) {
      const { data: batch, response } = await this.retrieve(vectorStoreId, batchId, {
        ...options2,
        headers
      }).withResponse();
      switch (batch.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options2?.pollIntervalMs) {
            sleepInterval = options2.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "cancelled":
        case "completed":
          return batch;
      }
    }
  }
  /**
   * Uploads the given files concurrently and then creates a vector store file batch.
   *
   * The concurrency limit is configurable using the `maxConcurrency` parameter.
   */
  async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options2) {
    if (files == null || files.length == 0) {
      throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
    }
    const configuredConcurrency = options2?.maxConcurrency ?? 5;
    const concurrencyLimit = Math.min(configuredConcurrency, files.length);
    const client = this._client;
    const fileIterator = files.values();
    const allFileIds = [...fileIds];
    async function processFiles(iterator) {
      for (let item of iterator) {
        const fileObj = await client.files.create({ file: item, purpose: "assistants" }, options2);
        allFileIds.push(fileObj.id);
      }
    }
    __name(processFiles, "processFiles");
    const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
    await allSettledWithThrow(workers);
    return await this.createAndPoll(vectorStoreId, {
      file_ids: allFileIds
    });
  }
};

// ../node_modules/openai/resources/vector-stores/vector-stores.mjs
var VectorStores = class extends APIResource {
  static {
    __name(this, "VectorStores");
  }
  constructor() {
    super(...arguments);
    this.files = new Files2(this._client);
    this.fileBatches = new FileBatches(this._client);
  }
  /**
   * Create a vector store.
   */
  create(body, options2) {
    return this._client.post("/vector_stores", {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Retrieves a vector store.
   */
  retrieve(vectorStoreId, options2) {
    return this._client.get(`/vector_stores/${vectorStoreId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Modifies a vector store.
   */
  update(vectorStoreId, body, options2) {
    return this._client.post(`/vector_stores/${vectorStoreId}`, {
      body,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  list(query = {}, options2) {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList("/vector_stores", VectorStoresPage, {
      query,
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Delete a vector store.
   */
  del(vectorStoreId, options2) {
    return this._client.delete(`/vector_stores/${vectorStoreId}`, {
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
  /**
   * Search a vector store for relevant chunks based on a query and file attributes
   * filter.
   */
  search(vectorStoreId, body, options2) {
    return this._client.getAPIList(`/vector_stores/${vectorStoreId}/search`, VectorStoreSearchResponsesPage, {
      body,
      method: "post",
      ...options2,
      headers: { "OpenAI-Beta": "assistants=v2", ...options2?.headers }
    });
  }
};
var VectorStoresPage = class extends CursorPage {
  static {
    __name(this, "VectorStoresPage");
  }
};
var VectorStoreSearchResponsesPage = class extends Page {
  static {
    __name(this, "VectorStoreSearchResponsesPage");
  }
};
VectorStores.VectorStoresPage = VectorStoresPage;
VectorStores.VectorStoreSearchResponsesPage = VectorStoreSearchResponsesPage;
VectorStores.Files = Files2;
VectorStores.VectorStoreFilesPage = VectorStoreFilesPage;
VectorStores.FileContentResponsesPage = FileContentResponsesPage;
VectorStores.FileBatches = FileBatches;

// ../node_modules/openai/index.mjs
var _a;
var OpenAI = class extends APIClient {
  static {
    __name(this, "OpenAI");
  }
  /**
   * API Client for interfacing with the OpenAI API.
   *
   * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
   * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
   * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
   * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL = readEnv("OPENAI_BASE_URL"), apiKey = readEnv("OPENAI_API_KEY"), organization = readEnv("OPENAI_ORG_ID") ?? null, project = readEnv("OPENAI_PROJECT_ID") ?? null, ...opts } = {}) {
    if (apiKey === void 0) {
      throw new OpenAIError("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).");
    }
    const options2 = {
      apiKey,
      organization,
      project,
      ...opts,
      baseURL: baseURL || `https://api.openai.com/v1`
    };
    if (!options2.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
    }
    super({
      baseURL: options2.baseURL,
      timeout: options2.timeout ?? 6e5,
      httpAgent: options2.httpAgent,
      maxRetries: options2.maxRetries,
      fetch: options2.fetch
    });
    this.completions = new Completions3(this);
    this.chat = new Chat(this);
    this.embeddings = new Embeddings(this);
    this.files = new Files(this);
    this.images = new Images(this);
    this.audio = new Audio(this);
    this.moderations = new Moderations(this);
    this.models = new Models(this);
    this.fineTuning = new FineTuning(this);
    this.vectorStores = new VectorStores(this);
    this.beta = new Beta(this);
    this.batches = new Batches(this);
    this.uploads = new Uploads(this);
    this.responses = new Responses(this);
    this._options = options2;
    this.apiKey = apiKey;
    this.organization = organization;
    this.project = project;
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  defaultHeaders(opts) {
    return {
      ...super.defaultHeaders(opts),
      "OpenAI-Organization": this.organization,
      "OpenAI-Project": this.project,
      ...this._options.defaultHeaders
    };
  }
  authHeaders(opts) {
    return { Authorization: `Bearer ${this.apiKey}` };
  }
  stringifyQuery(query) {
    return stringify(query, { arrayFormat: "brackets" });
  }
};
_a = OpenAI;
OpenAI.OpenAI = _a;
OpenAI.DEFAULT_TIMEOUT = 6e5;
OpenAI.OpenAIError = OpenAIError;
OpenAI.APIError = APIError;
OpenAI.APIConnectionError = APIConnectionError;
OpenAI.APIConnectionTimeoutError = APIConnectionTimeoutError;
OpenAI.APIUserAbortError = APIUserAbortError;
OpenAI.NotFoundError = NotFoundError;
OpenAI.ConflictError = ConflictError;
OpenAI.RateLimitError = RateLimitError;
OpenAI.BadRequestError = BadRequestError;
OpenAI.AuthenticationError = AuthenticationError;
OpenAI.InternalServerError = InternalServerError;
OpenAI.PermissionDeniedError = PermissionDeniedError;
OpenAI.UnprocessableEntityError = UnprocessableEntityError;
OpenAI.toFile = toFile;
OpenAI.fileFromPath = fileFromPath;
OpenAI.Completions = Completions3;
OpenAI.Chat = Chat;
OpenAI.ChatCompletionsPage = ChatCompletionsPage;
OpenAI.Embeddings = Embeddings;
OpenAI.Files = Files;
OpenAI.FileObjectsPage = FileObjectsPage;
OpenAI.Images = Images;
OpenAI.Audio = Audio;
OpenAI.Moderations = Moderations;
OpenAI.Models = Models;
OpenAI.ModelsPage = ModelsPage;
OpenAI.FineTuning = FineTuning;
OpenAI.VectorStores = VectorStores;
OpenAI.VectorStoresPage = VectorStoresPage;
OpenAI.VectorStoreSearchResponsesPage = VectorStoreSearchResponsesPage;
OpenAI.Beta = Beta;
OpenAI.Batches = Batches;
OpenAI.BatchesPage = BatchesPage;
OpenAI.Uploads = Uploads;
OpenAI.Responses = Responses;

// index.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-role, X-API-Token, x-user-email"
};
var DOMAIN_ZONE_MAPPING = {
  "norsegong.com": "e577205b812b49d012af046535369808",
  "xyzvibe.com": "602067f0cf860426a35860a8ab179a47",
  "vegvisr.org": "9178eccd3a7e3d71d8ae09defb09422a",
  // vegvisr.org zone ID
  "slowyou.training": "1417691852abd0e8220f60184b7f4eca"
  // vegvisr.org zone ID
};
var PROTECTED_SUBDOMAINS = {
  "vegvisr.org": [
    "api",
    // API Worker - CRITICAL
    "www",
    // Main website
    "admin",
    // Admin interface
    "mail",
    // Email services
    "blog",
    // Blog subdomain
    "knowledge",
    // Knowledge worker
    "auth",
    // Auth worker
    "brand",
    // Brand worker
    "dash",
    // Dashboard worker
    "dev",
    // Development
    "test",
    // Testing
    "staging",
    // Staging environment
    "cdn",
    // CDN
    "static"
    // Static assets
  ],
  "norsegong.com": ["www", "api", "mail", "admin", "blog", "cdn", "static"],
  "xyzvibe.com": ["www", "api", "mail", "admin", "blog", "cdn", "static"],
  "slowyou.training": ["www", "api", "mail", "admin", "blog", "cdn", "static"]
};
function isProtectedSubdomain(subdomain, rootDomain) {
  const protectedList = PROTECTED_SUBDOMAINS[rootDomain];
  return protectedList && protectedList.includes(subdomain.toLowerCase());
}
__name(isProtectedSubdomain, "isProtectedSubdomain");
function getZoneIdForDomain(domain) {
  const domainParts = domain.split(".");
  if (domainParts.length >= 2) {
    const rootDomain = domainParts.slice(-2).join(".");
    return DOMAIN_ZONE_MAPPING[rootDomain];
  }
  return null;
}
__name(getZoneIdForDomain, "getZoneIdForDomain");
var createResponse = /* @__PURE__ */ __name((body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...headers }
  });
}, "createResponse");
var createErrorResponse = /* @__PURE__ */ __name((message, status) => {
  console.error(message);
  return createResponse(JSON.stringify({ error: message }), status);
}, "createErrorResponse");
var handleCreateKnowledgeGraph = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject");
  if (!subject) {
    return createErrorResponse("Subject is missing in the prompt", 400);
  }
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: API key missing", 500);
  }
  const prompt = `
Generate a JSON string representing a knowledge graph compatible with Cytoscape, based on the subject: "${subject}". The output must be a valid JSON object with two main keys: "nodes" and "edges". Follow this structure exactly:

    - "nodes": An array of objects, EACH representing a concept related to "${subject}", with:
      - id: A unique string identifier (e.g., "node1")
      - label: A display name for the node relevant to the subject
      - color: A valid CSS color (e.g., "red", "redorange", use natural language)
      - type: Always "info"
      - info: A string with a brief description or null
      - bibl: An array of strings (can be empty)

    - "edges": An array of objects, EACH representing a relationship between concepts related to "${subject}", with:
      - id: A unique UUID string
      - source: The id of the source node
      - target: The id of the target node
      - label: A string describing the relationship or null
      - type: Always "info"
      - info: A string with relationship details or null

    Ensure the JSON is properly formatted, with no trailing commas, and is ready to be parsed by Cytoscape. Create at least 10 nodes and 5 edges relevant to "${subject}". Return only the JSON string, with no additional text or explanations.

`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      temperature: 1,
      max_tokens: 1e3,
      messages: [
        {
          role: "system",
          content: `You are a precise JSON generator for Cytoscape graphs and an expert in the subject mentioned in "${subject}", and keep the creation of the nodes specific to the subject. Return only valid JSON with no additional text.`
        },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  const graphData = data.choices[0].message.content.trim();
  console.log("Raw JSON response from OpenAI:", graphData);
  try {
    const parsedData = JSON.parse(graphData);
    const isValid = parsedData.nodes.every((node) => node.type === "info") && parsedData.edges.every((edge) => edge.type === "info");
    if (!isValid) {
      throw new Error("Invalid type field in graph data");
    }
    return createResponse(graphData);
  } catch {
    console.error("Error parsing JSON or validating graph data:");
    return createResponse(graphData, 200);
  }
}, "handleCreateKnowledgeGraph");
var handleSave = /* @__PURE__ */ __name(async (request, env) => {
  const { id, markdown, isVisible, email } = await request.json();
  if (!markdown || !email) {
    return createErrorResponse("Markdown content or email is missing", 400);
  }
  const newPrefix = isVisible ? "vis:" : "hid:";
  const blogId = id || crypto.randomUUID();
  const newKey = id && id.includes(`:${email}`) ? `${newPrefix}${id}` : `${newPrefix}${blogId}:${email}`;
  if (id) {
    await Promise.all([env.BINDING_NAME.delete(`vis:${id}`), env.BINDING_NAME.delete(`hid:${id}`)]);
  }
  await env.BINDING_NAME.put(newKey, markdown, { metadata: { encoding: "utf-8" } });
  const shareableLink = `https://api.vegvisr.org/view/${blogId}`;
  return createResponse(JSON.stringify({ link: shareableLink }));
}, "handleSave");
var handleView = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const raw = url.searchParams.get("raw") === "true";
  const keys = await env.BINDING_NAME.list();
  const matchingKey = keys.keys.find(
    (key) => key.name.includes(id) && (key.name.startsWith("vis:") || key.name.startsWith("hid:"))
  );
  if (!matchingKey) {
    return createErrorResponse("Not Found", 404);
  }
  const markdown = await env.BINDING_NAME.get(matchingKey.name);
  if (!markdown) {
    return createErrorResponse("Not Found", 404);
  }
  if (raw) {
    return createResponse(markdown, 200, { "Content-Type": "text/plain" });
  }
  const fullUrl = `https://api.vegvisr.org/view/${id}`;
  const htmlContent = marked.parse(markdown);
  const shareButton = `     <div style="text-align: center; margin-top: 20px;">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
\u0E40\u0E27\u0E49\u0E19\u0E27\u0E23\u0E23\u0E04Share on Facebook
      </a>
    </div>
  `;
  const finalHtml = `     <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>View Markdown</title>
      <style>
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      ${htmlContent}
      ${shareButton}
    </body>
    </html>
  `;
  return createResponse(finalHtml, 200, { "Content-Type": "text/html" });
}, "handleView");
var handleBlogPosts = /* @__PURE__ */ __name(async (request, env, showHidden = false) => {
  const url = new URL(request.url);
  const showHiddenParam = url.searchParams.get("hidden") === "true";
  const prefix = showHidden || showHiddenParam ? "hid:" : "vis:";
  const keys = await env.BINDING_NAME.list();
  const posts = [];
  for (const key of keys.keys) {
    if (!key.name.startsWith(prefix)) continue;
    const markdown = await env.BINDING_NAME.get(key.name);
    if (markdown) {
      const lines = markdown.split("\n");
      const titleLine = lines.find((line) => line.startsWith("#") && !line.includes("!["));
      const title = titleLine ? titleLine.replace(/^#\s*/, "") : "Untitled";
      const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/);
      const imageUrl = imageMatch ? imageMatch[1] : "https://via.placeholder.com/150";
      const abstractLine = lines.find(
        (line) => line.trim() && !line.startsWith("#") && !line.includes("![")
      );
      const abstract = abstractLine ? abstractLine.slice(0, 100) + "..." : "";
      posts.push({
        id: key.name.replace(/^(vis:|hid:)/, ""),
        title,
        snippet: lines.slice(1, 3).join(" "),
        abstract,
        image: imageUrl
      });
    }
  }
  return createResponse(JSON.stringify(posts));
}, "handleBlogPosts");
var handleBlogPostDelete = /* @__PURE__ */ __name(async (request, env) => {
  const id = request.url.split("/").pop();
  if (!id) {
    return createErrorResponse("Blog post ID is required", 400);
  }
  const keys = await env.BINDING_NAME.list();
  const matchingKey = keys.keys.find(
    (key) => key.name.includes(id) && (key.name.startsWith("vis:") || key.name.startsWith("hid:"))
  );
  if (!matchingKey) {
    return createErrorResponse("Not Found", 404);
  }
  await env.BINDING_NAME.delete(matchingKey.name);
  return createResponse("Blog post deleted successfully");
}, "handleBlogPostDelete");
var handleSnippetAdd = /* @__PURE__ */ __name(async (request, env) => {
  const { id, content } = await request.json();
  if (!id || !content) {
    return createErrorResponse("ID and content are required", 400);
  }
  await env.snippets.put(id, content);
  return createResponse("Snippet added successfully");
}, "handleSnippetAdd");
var handleSnippetGet = /* @__PURE__ */ __name(async (request, env) => {
  const id = request.url.split("/").pop();
  const snippet = await env.snippets.get(id);
  if (!snippet) {
    return createErrorResponse("Snippet not found", 404);
  }
  return createResponse(JSON.stringify({ id, content: snippet }));
}, "handleSnippetGet");
var handleSnippetDelete = /* @__PURE__ */ __name(async (request, env) => {
  const id = request.url.split("/").pop();
  await env.snippets.delete(id);
  return createResponse("Snippet deleted successfully");
}, "handleSnippetDelete");
var handleSnippetList = /* @__PURE__ */ __name(async (request, env) => {
  const keys = await env.snippets.list();
  return createResponse(JSON.stringify({ keys: keys.keys || [] }));
}, "handleSnippetList");
var handleUpload = /* @__PURE__ */ __name(async (request, env) => {
  const { MY_R2_BUCKET } = env;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file) {
    return createErrorResponse("Missing file", 400);
  }
  const fileExtension = file.name ? file.name.split(".").pop() : "";
  if (!fileExtension) {
    return createErrorResponse("Invalid file name or extension", 400);
  }
  const fileName = `${Date.now()}.${fileExtension}`;
  const contentType = fileExtension === "svg" ? "image/svg+xml" : file.type;
  await MY_R2_BUCKET.put(fileName, file.stream(), {
    httpMetadata: { contentType }
  });
  const fileUrl = `https://blog.vegvisr.org/${fileName}`;
  return createResponse(JSON.stringify({ url: fileUrl }));
}, "handleUpload");
var handleSearch = /* @__PURE__ */ __name(async (request, env) => {
  const query = new URL(request.url).searchParams.get("query")?.toLowerCase();
  if (!query) {
    return createErrorResponse("Search query is missing", 400);
  }
  const keys = await env.BINDING_NAME.list();
  const results = [];
  for (const key of keys.keys) {
    const markdown = await env.BINDING_NAME.get(key.name);
    if (markdown && markdown.toLowerCase().includes(query)) {
      const lines = markdown.split("\n");
      const titleLine = lines.find((line) => line.startsWith("#") && !line.includes("!["));
      const title = titleLine ? titleLine.replace(/^#\s\*/, "") : "Untitled";
      const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/);
      const imageUrl = imageMatch ? imageMatch[1] : "https://via.placeholder.com/150";
      const abstractLine = lines.find(
        (line) => line.trim() && !line.startsWith("#") && !line.includes("![")
      );
      const abstract = abstractLine ? abstractLine.slice(0, 100) + "..." : "";
      results.push({
        id: key.name.replace(/^(vis:|hid:)/, ""),
        title,
        snippet: lines.slice(1, 3).join(" "),
        abstract,
        image: imageUrl
      });
    }
  }
  return createResponse(JSON.stringify(results));
}, "handleSearch");
var handleToggleVisibility = /* @__PURE__ */ __name(async (request, env) => {
  const { id, isVisible } = await request.json();
  if (!id) {
    return createErrorResponse("Blog post ID is missing", 400);
  }
  const currentKey = isVisible ? `hid:${id}` : `vis:${id}`;
  const newKey = isVisible ? `vis:${id}` : `hid:${id}`;
  const markdown = await env.BINDING_NAME.get(currentKey);
  if (!markdown) {
    return createErrorResponse("Blog post not found or already in the desired state", 404);
  }
  await env.BINDING_NAME.delete(currentKey);
  await env.BINDING_NAME.put(newKey, markdown, { metadata: { encoding: "utf-8" } });
  return createResponse("Blog post visibility toggled successfully");
}, "handleToggleVisibility");
var handleGetImage = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const imageName = url.searchParams.get("name");
  if (!imageName) {
    return createErrorResponse("Image name is missing", 400);
  }
  const image = await env.MY_R2_BUCKET.get(imageName);
  if (!image) {
    return createErrorResponse("Image not found", 404);
  }
  const headers = {
    "Content-Type": image.httpMetadata?.contentType || "application/octet-stream",
    ...corsHeaders
  };
  return new Response(image.body, { status: 200, headers });
}, "handleGetImage");
var handleGetImageFromR2 = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const fileName = url.searchParams.get("name");
  if (!fileName) {
    return createErrorResponse("Image file name is missing", 400);
  }
  const image = await env.MY_R2_BUCKET.get(fileName);
  if (!image) {
    return createErrorResponse("Image not found", 404);
  }
  const headers = {
    "Content-Type": image.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "_",
    "Access-Control-Allow-Origin": "_",
    "X-Content-Type-Options": "nosniff"
  };
  return new Response(image.body, { status: 200, headers });
}, "handleGetImageFromR2");
var handleGetImageHeaders = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const fileName = url.searchParams.get("name");
  if (!fileName) {
    return createErrorResponse("Image file name is missing", 400);
  }
  const image = await env.MY_R2_BUCKET.get(fileName);
  if (!image) {
    return createErrorResponse("Image not found", 404);
  }
  const headers = {
    "Content-Type": image.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "_",
    "Access-Control-Allow-Origin": "_",
    "X-Content-Type-Options": "nosniff",
    "Last-Modified": image.httpMetadata?.lastModified || (/* @__PURE__ */ new Date()).toUTCString(),
    "Content-Length": image.size
    // Add content-length
  };
  return new Response(null, { status: 200, headers });
}, "handleGetImageHeaders");
var handleSummarize = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { text } = body;
  if (!text || typeof text !== "string") {
    return createErrorResponse("Text input is missing or invalid", 400);
  }
  const prompt = `     Summarize the following text into a concise paragraph suitable for a fulltext node:
    ${text}
  `;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: "You are a summarization assistant. Generate concise summaries."
        },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResponse(`OpenAI API error: ${response.status} - ${errorText}`, 500);
  }
  const data = await response.json();
  const summary = data.choices[0].message.content.trim();
  return createResponse(
    JSON.stringify({
      id: `fulltext_${Date.now()}`,
      label: "Summary",
      type: "fulltext",
      info: summary,
      color: "#f9f9f9"
    }),
    200
  );
}, "handleSummarize");
var handleGrokTest = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { prompt } = body;
  if (!prompt || typeof prompt !== "string") {
    return createErrorResponse("Prompt input is missing or invalid", 400);
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  try {
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 2e3,
      messages: [
        { role: "system", content: "You are a philosophical AI providing deep insights." },
        { role: "user", content: prompt }
      ]
    });
    const responseText = completion.choices[0].message.content.trim();
    if (!responseText) {
      return createErrorResponse("Empty summary response", 500);
    }
    const biblCompletion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: 'You are a scholarly AI. Return only 2-3 bibliographic references in APA format (e.g., "Author, A. A. (Year). Title of work. Publisher."), one per line, with no explanations, headings, or additional text.'
        },
        { role: "user", content: `Generate references for the topic: ${prompt}` }
      ]
    });
    const biblText = biblCompletion.choices[0].message.content.trim();
    const biblReferences = biblText.split("\n").filter((ref) => ref.trim()).map((ref) => ref.trim());
    return new Response(
      JSON.stringify({
        id: `fulltext_${Date.now()}`,
        label: "Summary",
        type: "fulltext",
        info: responseText,
        color: "#f9f9f9",
        bibl: biblReferences
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch {
    return createErrorResponse(`Grok API error:`, 500);
  }
}, "handleGrokTest");
var handleGeminiTest = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: Google Gemini API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { text, prompt } = body;
  const inputText = text || prompt;
  if (!inputText || typeof inputText !== "string") {
    return createErrorResponse("Text or prompt input is missing or invalid", 400);
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: inputText
                }
              ]
            }
          ]
        })
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      return createErrorResponse(`Gemini API error: ${response.status} - ${errorText}`, 500);
    }
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
    return createResponse(
      JSON.stringify({
        id: `gemini_${Date.now()}`,
        label: "Gemini Response",
        type: "fulltext",
        info: generatedText,
        color: "#e8f4fd",
        model: "gemini-2.0-flash",
        prompt: inputText
      })
    );
  } catch (error) {
    return createErrorResponse(`Gemini API error: ${error.message}`, 500);
  }
}, "handleGeminiTest");
var handleAIAction = /* @__PURE__ */ __name(async (request, env) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const {
    prompt,
    instructions,
    baseURL,
    model,
    temperature,
    max_tokens,
    apiProvider,
    response_format
  } = body;
  if (!prompt || !instructions || !baseURL || !model || !temperature || !max_tokens || !apiProvider || !response_format) {
    return createErrorResponse("Missing required parameters", 400);
  }
  let apiKey;
  switch (apiProvider.toLowerCase()) {
    case "xai":
      apiKey = env.XAI_API_KEY;
      break;
    case "openai":
      apiKey = env.OPENAI_API_KEY;
      break;
    case "google":
      apiKey = env.GOOGLE_API_KEY;
      break;
    default:
      return createErrorResponse("Unsupported API provider", 400);
  }
  if (!apiKey) {
    return createErrorResponse(`Internal Server Error: ${apiProvider} API key missing`, 500);
  }
  const client = new OpenAI({
    apiKey,
    baseURL
  });
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature,
      max_tokens,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: prompt }
      ]
    });
    const responseText = completion.choices[0].message.content;
    return createResponse(
      JSON.stringify({
        id: `node_${Date.now()}`,
        label: response_format.label || "Response",
        type: response_format.type || "fulltext",
        info: responseText,
        color: response_format.color || "#f9f9f9",
        ...response_format.additional_fields
      }),
      200
    );
  } catch {
    return createErrorResponse(`AI API error:`, 500);
  }
}, "handleAIAction");
var handleGetGoogleApiKey = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.GOOGLE_API_KEY;
  const url = new URL(request.url);
  const int_token = url.searchParams.get("key");
  if (!int_token || int_token !== env.INT_TOKEN) {
    return createErrorResponse({ int_token }, 401);
  }
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: Google API key missing", 500);
  }
  return createResponse(JSON.stringify({ apiKey }), 200);
}, "handleGetGoogleApiKey");
var handleUpdateKml = /* @__PURE__ */ __name(async (request, env) => {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (token !== env.INT_TOKEN) {
    return createErrorResponse("Unauthorized: Invalid token", 401);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const {
    id,
    name,
    description = "",
    longitude,
    latitude,
    altitude = 0,
    styleUrl,
    lookAt = {}
  } = body;
  if (!name || longitude === void 0 || latitude === void 0) {
    return createErrorResponse("Missing required marker fields", 400);
  }
  const kmlObject = await env.KLM_BUCKET.get("Vegvisr.org.kml");
  let kmlText = "";
  if (kmlObject) {
    kmlText = await kmlObject.text();
  } else {
    kmlText = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
  </Document>
</kml>`;
  }
  let lookAtBlock = "";
  if (Object.keys(lookAt).length > 0) {
    lookAtBlock = `
    <LookAt>
      <longitude>${lookAt.longitude ?? longitude}</longitude>
      <latitude>${lookAt.latitude ?? latitude}</latitude>
      <altitude>${lookAt.altitude ?? altitude}</altitude>
      <heading>${lookAt.heading ?? 0}</heading>
      <tilt>${lookAt.tilt ?? 0}</tilt>
      <gx:fovy>${lookAt.fovy ?? 35}</gx:fovy>
      <range>${lookAt.range ?? 1e3}</range>
      <altitudeMode>${lookAt.altitudeMode ?? "absolute"}</altitudeMode>
    </LookAt>`;
  }
  let styleUrlBlock = styleUrl ? `
    <styleUrl>${styleUrl}</styleUrl>` : "";
  let idAttr = id ? ` id="${id}"` : "";
  const placemark = `
  <Placemark${idAttr}>
    <name>${name}</name>
    <description>${description}</description>${lookAtBlock}${styleUrlBlock}
    <Point>
      <coordinates>${longitude},${latitude},${altitude}</coordinates>
    </Point>
  </Placemark>
`;
  kmlText = kmlText.replace(/<\/Document>/, `${placemark}
</Document>`);
  await env.KLM_BUCKET.put("Vegvisr.org.kml", kmlText, {
    httpMetadata: { contentType: "application/vnd.google-earth.kml+xml" }
  });
  return createResponse(JSON.stringify({ success: true, message: "KML updated" }));
}, "handleUpdateKml");
var handleSuggestTitle = /* @__PURE__ */ __name(async (request, env) => {
  console.log("Handling title suggestion request");
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    console.error("XAI API key missing");
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
    console.log("Request body:", JSON.stringify(body));
  } catch {
    console.error("Invalid JSON body:");
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { nodes, edges } = body;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error("Invalid graph data:", { nodes, edges });
    return createErrorResponse("Invalid graph data", 400);
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  try {
    const nodeContents = nodes.map((n) => n.info).filter((info) => info && typeof info === "string" && info.trim().length > 0).join("\n");
    const prompt = `Generate a concise, descriptive title (max 10 words) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The title should reflect the main theme or subject matter of the content, not the structure of the graph.
    Return only the title, no additional text or explanations.`;
    console.log("Sending prompt to Grok:", prompt);
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: "You are a title generator for knowledge graphs. Focus on the content and main themes, not the graph structure. Return only the title."
        },
        { role: "user", content: prompt }
      ]
    });
    const title = completion.choices[0].message.content.trim();
    console.log("Generated title:", title);
    return createResponse(JSON.stringify({ title }));
  } catch {
    console.error("Grok API error:");
    return createErrorResponse(`Grok API error:`, 500);
  }
}, "handleSuggestTitle");
var handleSuggestDescription = /* @__PURE__ */ __name(async (request, env) => {
  console.log("Handling description suggestion request");
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    console.error("XAI API key missing");
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
    console.log("Request body:", JSON.stringify(body));
  } catch {
    console.error("Invalid JSON body:");
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { nodes, edges } = body;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error("Invalid graph data:", { nodes, edges });
    return createErrorResponse("Invalid graph data", 400);
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  try {
    const nodeContents = nodes.map((n) => n.info).filter((info) => info && typeof info === "string" && info.trim().length > 0).join("\n");
    const prompt = `Generate a concise description (2-3 sentences) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The description should summarize the main themes, insights, and connections present in the content.
    Focus on the actual content and its meaning, not the graph structure.
    Return only the description, no additional text or explanations.`;
    console.log("Sending prompt to Grok:", prompt);
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: "You are a description generator for knowledge graphs. Focus on summarizing the content themes and insights, not the graph structure. Return only the description."
        },
        { role: "user", content: prompt }
      ]
    });
    const description = completion.choices[0].message.content.trim();
    console.log("Generated description:", description);
    return createResponse(JSON.stringify({ description }));
  } catch {
    console.error("Grok API error:");
    return createErrorResponse(`Grok API error:`, 500);
  }
}, "handleSuggestDescription");
var handleSuggestCategories = /* @__PURE__ */ __name(async (request, env) => {
  console.log("Handling categories suggestion request");
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    console.error("XAI API key missing");
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
    console.log("Request body:", JSON.stringify(body));
  } catch {
    console.error("Invalid JSON body:");
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { nodes, edges } = body;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error("Invalid graph data:", { nodes, edges });
    return createErrorResponse("Invalid graph data", 400);
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  try {
    const nodeContents = nodes.map((n) => n.info).filter((info) => info && typeof info === "string" && info.trim().length > 0).join("\n");
    const prompt = `Generate 3-5 relevant categories (as hashtags) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The categories should reflect the main themes, topics, or subject areas present in the content.
    Return only the categories as hashtags separated by spaces, no additional text or explanations.
    Example format: #Category1 #Category2 #Category3`;
    console.log("Sending prompt to Grok:", prompt);
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "You are a category generator for knowledge graphs. Focus on the content themes and topics, not the graph structure. Return only hashtag categories."
        },
        { role: "user", content: prompt }
      ]
    });
    const categories = completion.choices[0].message.content.trim();
    console.log("Generated categories:", categories);
    return createResponse(JSON.stringify({ categories }));
  } catch {
    console.error("Grok API error:");
    return createErrorResponse(`Grok API error:`, 500);
  }
}, "handleSuggestCategories");
var handleGrokIssueDescription = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { title, description, body: bodyText, labels, mode } = body;
  if (!mode || !["title_to_description", "description_to_title", "expand_description"].includes(mode)) {
    return createErrorResponse(
      "Invalid mode. Must be one of: title_to_description, description_to_title, expand_description",
      400
    );
  }
  const descriptionText = description || bodyText;
  if (mode === "title_to_description" && (!title || typeof title !== "string")) {
    return createErrorResponse("Title is required for title_to_description mode", 400);
  }
  if ((mode === "description_to_title" || mode === "expand_description") && (!descriptionText || typeof descriptionText !== "string")) {
    return createErrorResponse(
      "Description is required for description_to_title and expand_description modes",
      400
    );
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  try {
    let labelText = "";
    if (Array.isArray(labels) && labels.length > 0) {
      labelText = `Labels: ${labels.join(", ")}.`;
    }
    let prompt, systemContent, maxTokens;
    switch (mode) {
      case "title_to_description":
        prompt = `Generate a concise, clear, and helpful description for a GitHub issue, feature, or enhancement.
Title: ${title}
${labelText}
The description should explain the context, the problem or feature, and what a good solution or outcome would look like. Return only the description, no extra text.`;
        systemContent = "You are an expert at writing clear, concise, and actionable GitHub issue descriptions. Return only the description.";
        maxTokens = 500;
        break;
      case "description_to_title":
        prompt = `Generate a clear and concise title for a GitHub issue based on this description:
${descriptionText}
${labelText}
The title should be specific and descriptive. Return only the title, no extra text.`;
        systemContent = "You are an expert at writing clear and concise GitHub issue titles. Return only the title.";
        maxTokens = 50;
        break;
      case "expand_description":
        prompt = `Expand and enhance this GitHub issue description while maintaining its core message:
${descriptionText}
${labelText}

Please enhance the description by:
1. Adding more technical context and details
2. Including relevant background information
3. Structuring the content with clear sections
4. Adding specific examples or use cases
5. Clarifying any ambiguous points
6. Suggesting potential solutions or approaches

Maintain the original tone and intent while making the description more comprehensive and actionable. Return only the expanded description, no extra text.`;
        systemContent = "You are an expert at expanding and enhancing GitHub issue descriptions. Focus on adding value through technical details, context, and structure while maintaining the original message. Return only the expanded description.";
        maxTokens = 1e3;
        break;
    }
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt }
      ]
    });
    const result = completion.choices[0].message.content.trim();
    return createResponse(
      JSON.stringify(mode === "description_to_title" ? { title: result } : { description: result })
    );
  } catch {
    return createErrorResponse("Grok API error", 500);
  }
}, "handleGrokIssueDescription");
var handleGenerateMetaAreas = /* @__PURE__ */ __name(async (request, env) => {
  const userRole = request.headers.get("x-user-role") || "";
  if (userRole !== "Superadmin") {
    return createErrorResponse("Forbidden: Superadmin role required", 403);
  }
  console.log("Fetching all knowledge graphs...");
  const response = await fetch("https://knowledge.vegvisr.org/getknowgraphs");
  console.log("getknowgraphs response status:", response.status);
  if (!response.ok) {
    const text = await response.text();
    console.log("getknowgraphs response body:", text);
    return createErrorResponse("Failed to fetch graphs", 500);
  }
  const data = await response.json();
  if (!data.results) return createErrorResponse("No graphs found", 404);
  for (const graph of data.results) {
    const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`);
    if (!graphResponse.ok) continue;
    const graphData = await graphResponse.json();
    const meta = graphData.metadata?.metaArea;
    if (typeof meta === "string" && meta.trim().length > 0) {
      console.log(`Skipping graph ${graph.id} (already has metaArea: '${meta}')`);
      continue;
    }
    const prompt = `
Given the following knowledge graph content, generate a single, specific, community-relevant Meta Area tag (all capital letters, no spaces, no special characters) that best summarizes the main theme. 
- The tag should be a proper noun or a well-known field of study, tradition, technology, or cultural topic (e.g., NORSE MYTHOLOGY, AI GROK TECH, ETYMOLOGY, HERMETICISM, HINDUISM, CLOUD COMPUTING, ASTROLOGY, SYMBOLISM, PSYCHOLOGY, TECHNOLOGY, SHIVA, SHAKTI, NARASIMHA, etc.).
- Avoid generic words like FATE, SPIRITUALITY, MINDFULNESS, WISDOM, BREATH, AWAKENING, INTERDISCIPLINARY, TEST, TRANSFORMATION, SACREDNESS, PLAYGROUND, or similar.
- Only return the tag, in ALL CAPITAL LETTERS.

Content:
${graphData.metadata?.title || ""}
${graphData.metadata?.description || ""}
${graphData.metadata?.category || ""}
${graphData.nodes?.map((n) => n.label + " " + (n.info || "")).join(" ")}
`;
    let metaArea = "";
    try {
      const client = new OpenAI({
        apiKey: env.XAI_API_KEY,
        baseURL: "https://api.x.ai/v1"
      });
      const completion = await client.chat.completions.create({
        model: "grok-3-beta",
        temperature: 0.7,
        max_tokens: 20,
        messages: [
          {
            role: "system",
            content: "You are an expert at summarizing knowledge graphs. Return only a single, specific, community-relevant, ALL CAPS, proper-noun tag. Avoid generic words."
          },
          { role: "user", content: prompt }
        ]
      });
      metaArea = completion.choices[0].message.content.trim().split(/\s+/)[0].toUpperCase();
      const bannedTags = [
        "FATE",
        "SPIRITUALITY",
        "MINDFULNESS",
        "WISDOM",
        "BREATH",
        "AWAKENING",
        "INTERDISCIPLINARY",
        "TEST",
        "TRANSFORMATION",
        "SACREDNESS",
        "PLAYGROUND"
      ];
      if (bannedTags.includes(metaArea)) {
        console.log(
          `Banned metaArea '${metaArea}' generated for graph ${graph.id}, skipping update.`
        );
        continue;
      }
    } catch {
      continue;
    }
    await fetch("https://knowledge.vegvisr.org/updateknowgraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: graph.id,
        graphData: {
          ...graphData,
          metadata: {
            ...graphData.metadata,
            metaArea
          }
        }
      })
    });
  }
  return createResponse(JSON.stringify({ success: true }));
}, "handleGenerateMetaAreas");
var handleGrokAsk = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  let { context, question } = body;
  if (!context || typeof context !== "string") {
    return createErrorResponse("Context is required and must be a string", 400);
  }
  if (!question || typeof question !== "string" || !question.trim()) {
    return createErrorResponse("Question is required and must be a non-empty string", 400);
  }
  let plainContext = "";
  try {
    const html2 = marked.parse(context);
    plainContext = html2.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    plainContext = context;
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1"
  });
  const prompt = `Given the following context, answer the user's question in detail.

Context:
${plainContext}

Question: ${question}`;
  const systemContent = "You are an expert assistant. Use the provided context to answer the user's question in detail.";
  try {
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt }
      ]
    });
    const result = completion.choices[0].message.content.trim();
    return createResponse(JSON.stringify({ result }), 200);
  } catch {
    return createErrorResponse("Grok ask error", 500);
  }
}, "handleGrokAsk");
var handleGenerateHeaderImage = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: OpenAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  let { prompt } = body;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return createErrorResponse("Prompt is required and must be a non-empty string", 400);
  }
  prompt = prompt + ", horizontal, wide, landscape, header image";
  let imageUrl;
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        // Updated to supported size for horizontal images
        response_format: "url"
      })
    });
    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      return createErrorResponse("OpenAI error: " + err, 500);
    }
    const openaiData = await openaiRes.json();
    imageUrl = openaiData.data[0].url;
  } catch {
    return createErrorResponse("Failed to generate image", 500);
  }
  let imageBuffer;
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download image");
    imageBuffer = await imgRes.arrayBuffer();
  } catch {
    return createErrorResponse("Failed to download image", 500);
  }
  const imageId = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const fileName = `${imageId}.png`;
  try {
    await env.MY_R2_BUCKET.put(fileName, imageBuffer, {
      httpMetadata: { contentType: "image/png" }
    });
  } catch {
    return createErrorResponse("Failed to upload image to R2", 500);
  }
  const publicUrl = `https://vegvisr.imgix.net/${fileName}`;
  const markdown = `![Header|width: 100%; height: 200px; object-fit: cover; object-position: center](${publicUrl})`;
  return createResponse(JSON.stringify({ markdown, url: publicUrl }), 200);
}, "handleGenerateHeaderImage");
var handleGenerateImagePrompt = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: OpenAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { context } = body;
  if (!context || typeof context !== "string" || !context.trim()) {
    return createErrorResponse("Context is required and must be a non-empty string", 400);
  }
  const systemPrompt = `You are an expert at creating visually descriptive prompts for AI image generation. Your job is to turn a text context into a concise, creative, and visually rich prompt for DALL-E 3. Always make the image horizontal, wide, and suitable as a website header. Do not mention text, captions, or watermarks. Do not include people unless the context requires it. Focus on landscape, atmosphere, and mood.`;
  const userPrompt = `Context: ${context}

Generate a single, creative, visually descriptive prompt for DALL-E 3 to create a horizontal header image. Do not include any explanations or extra text.`;
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 100,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      return createErrorResponse("OpenAI error: " + err, 500);
    }
    const openaiData = await openaiRes.json();
    let prompt = openaiData.choices[0].message.content.trim();
    if (prompt.startsWith('"') && prompt.endsWith('"')) prompt = prompt.slice(1, -1);
    return createResponse(JSON.stringify({ prompt }), 200);
  } catch {
    return createErrorResponse("Failed to generate image prompt", 500);
  }
}, "handleGenerateImagePrompt");
var handleListR2Images = /* @__PURE__ */ __name(async (request, env) => {
  const list2 = await env.MY_R2_BUCKET.list();
  const images = list2.objects.filter((obj) => /\.(png|jpe?g|gif|webp)$/i.test(obj.key)).map((obj) => ({
    key: obj.key,
    url: `https://vegvisr.imgix.net/${obj.key}`
  }));
  return createResponse(JSON.stringify({ images }), 200);
}, "handleListR2Images");
var handleYouTubeSearch = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: YouTube API key missing", 500);
  }
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  if (!query) {
    return createErrorResponse('Search query parameter "q" is required', 400);
  }
  console.log("\u{1F50D} YouTube Search Request:", { query });
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "id,snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", "10");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("type", "video");
    console.log("\u{1F4E1} Calling YouTube API:", searchUrl.toString());
    const apiResponse = await fetch(searchUrl.toString());
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("\u274C YouTube API Error:", errorText);
      return createErrorResponse(
        `YouTube API error: ${apiResponse.status} - ${errorText}`,
        apiResponse.status
      );
    }
    const data = await apiResponse.json();
    console.log("\u2705 YouTube Search Results:", { count: data.items?.length || 0 });
    const videoIds = data.items.map((item) => item.id.videoId).join(",");
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();
    const detailsMap = {};
    if (detailsData.items) {
      for (const item of detailsData.items) {
        detailsMap[item.id] = item.snippet?.description || "";
      }
    }
    const results = data.items?.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: detailsMap[item.id.videoId] || item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails
    })) || [];
    return createResponse(
      JSON.stringify({
        success: true,
        query,
        results,
        totalResults: results.length
      })
    );
  } catch (error) {
    console.error("\u274C YouTube Search Error:", error);
    return createErrorResponse("Failed to search YouTube videos: " + error.message, 500);
  }
}, "handleYouTubeSearch");
var handleYouTubeTranscriptIO = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/").pop();
  if (!videoId) {
    return createErrorResponse("Video ID is required", 400);
  }
  const apiToken = env.YOUTUBE_TRANSCRIPT_IO_TOKEN;
  if (!apiToken) {
    return createErrorResponse(
      "Internal Server Error: YouTube Transcript IO API token missing",
      500
    );
  }
  console.log("\u{1F4FA} YouTube Transcript IO Request:", { videoId });
  try {
    const response = await fetch("https://www.youtube-transcript.io/api/transcripts", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ids: [videoId]
      })
    });
    console.log("\u{1F4E1} YouTube Transcript IO API Response Status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("\u274C YouTube Transcript IO API Error:", errorText);
      return createErrorResponse(
        `YouTube Transcript IO API error: ${response.status} - ${errorText}`,
        response.status
      );
    }
    const data = await response.json();
    console.log("\u2705 YouTube Transcript IO Results:", { videoId, hasData: !!data });
    return createResponse(
      JSON.stringify({
        success: true,
        videoId,
        transcript: data
      })
    );
  } catch (error) {
    console.error("\u274C YouTube Transcript IO Error:", error);
    return createErrorResponse("Failed to get YouTube transcript: " + error.message, 500);
  }
}, "handleYouTubeTranscriptIO");
var handleDownsubUrlTranscript = /* @__PURE__ */ __name(async (request, env) => {
  const apiToken = env.DOWNDUB_API_TOKEN;
  if (!apiToken) {
    return createErrorResponse("Internal Server Error: DOWNSUB API token missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { url } = body;
  if (!url) {
    return createErrorResponse("URL is required", 400);
  }
  console.log("\u{1F53D} DOWNSUB URL Request:", { url });
  try {
    const response = await fetch("https://api.downsub.com/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url
      })
    });
    console.log("\u{1F4E1} DOWNSUB API Response Status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("\u274C DOWNSUB API Error:", errorText);
      return createErrorResponse(
        `DOWNSUB API error: ${response.status} - ${errorText}`,
        response.status
      );
    }
    const data = await response.json();
    console.log("\u2705 DOWNSUB URL Results:", { url, hasData: !!data });
    return createResponse(
      JSON.stringify({
        success: true,
        originalUrl: url,
        transcript: data
      })
    );
  } catch (error) {
    console.error("\u274C DOWNSUB URL Error:", error);
    return createErrorResponse("Failed to get DOWNSUB transcript: " + error.message, 500);
  }
}, "handleDownsubUrlTranscript");
var handleDownsubTranscript = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/").pop();
  if (!videoId) {
    return createErrorResponse("Video ID is required", 400);
  }
  const apiToken = env.DOWNDUB_API_TOKEN;
  if (!apiToken) {
    return createErrorResponse("Internal Server Error: DOWNSUB API token missing", 500);
  }
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("\u{1F53D} DOWNSUB Request:", { videoId, youtubeUrl });
  try {
    const response = await fetch("https://api.downsub.com/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: youtubeUrl
      })
    });
    console.log("\u{1F4E1} DOWNSUB API Response Status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("\u274C DOWNSUB API Error:", errorText);
      return createErrorResponse(
        `DOWNSUB API error: ${response.status} - ${errorText}`,
        response.status
      );
    }
    const data = await response.json();
    console.log("\u2705 DOWNSUB Results:", { videoId, hasData: !!data });
    return createResponse(
      JSON.stringify({
        success: true,
        videoId,
        youtubeUrl,
        transcript: data
      })
    );
  } catch (error) {
    console.error("\u274C DOWNSUB Error:", error);
    return createErrorResponse("Failed to get DOWNSUB transcript: " + error.message, 500);
  }
}, "handleDownsubTranscript");
async function handleMystmkraProxy(request) {
  const apiToken = request.headers.get("X-API-Token");
  if (!apiToken) {
    return new Response(JSON.stringify({ error: "Missing API token" }), {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }
  try {
    const body = await request.json();
    const response = await fetch("https://mystmkra.io/dropbox/api/markdown/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": apiToken
      },
      body: JSON.stringify(body)
    });
    let result;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.log("Mystmkra.io raw response:", text);
      result = { error: "Mystmkra.io did not return JSON", status: response.status, raw: text };
    }
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to proxy request to Mystmkra.io" }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }
}
__name(handleMystmkraProxy, "handleMystmkraProxy");
var handleGPT4VisionImage = /* @__PURE__ */ __name(async (request, env) => {
  if (!env.OPENAI_API_KEY) {
    return createErrorResponse("OpenAI API key not configured", 500);
  }
  try {
    const body = await request.json();
    let { prompt, model = "dall-e-2", size = "1024x1024" } = body;
    console.log("=== GPT4 Vision Image Generation Request ===");
    console.log("Model from request body:", model);
    console.log("Size from request body:", size);
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Prompt preview:", prompt?.substring(0, 100) + "...");
    if (!prompt) {
      return createErrorResponse("Prompt is required", 400);
    }
    let quality = "auto";
    if (prompt.includes("|")) {
      const parts = prompt.split("|");
      const modelPart = parts.find((p) => p.startsWith("model:"));
      const sizePart = parts.find((p) => p.startsWith("size:"));
      const qualityPart = parts.find((p) => p.startsWith("quality:"));
      if (modelPart) {
        const promptModel = modelPart.replace("model:", "").trim();
        console.log("\u{1F50D} Model found in prompt:", promptModel);
        model = promptModel;
      }
      if (sizePart) {
        const promptSize = sizePart.replace("size:", "").trim();
        console.log("\u{1F50D} Size found in prompt:", promptSize);
        size = promptSize;
      }
      if (qualityPart) {
        const promptQuality = qualityPart.replace("quality:", "").trim();
        console.log("\u{1F50D} Quality found in prompt:", promptQuality);
        quality = promptQuality;
      }
    }
    if (quality === "auto") {
      if (model === "gpt-image-1") {
        quality = "auto";
      } else if (model === "dall-e-3") {
        quality = "standard";
      } else if (model === "dall-e-2") {
        quality = "standard";
      }
    }
    const qualityValidation = {
      "gpt-image-1": ["auto", "high", "medium", "low"],
      "dall-e-3": ["hd", "standard"],
      "dall-e-2": ["standard"]
    };
    if (!qualityValidation[model].includes(quality)) {
      console.error("\u274C Invalid quality for model:", {
        model,
        quality,
        valid: qualityValidation[model]
      });
      return createErrorResponse(
        `Invalid quality '${quality}' for model '${model}'. Valid options: ${qualityValidation[model].join(", ")}`,
        400
      );
    }
    console.log("\u{1F4CB} Final model to use:", model);
    console.log("\u{1F4CB} Final size to use:", size);
    console.log("\u{1F4CB} Final quality to use:", quality);
    const validModels = ["dall-e-2", "dall-e-3", "gpt-image-1"];
    if (!validModels.includes(model)) {
      console.error("\u274C Invalid model requested:", model);
      return createErrorResponse("Invalid model. Must be one of: " + validModels.join(", "), 400);
    }
    console.log("\u2705 Model validation passed for:", model);
    const validSizes = {
      "dall-e-2": ["256x256", "512x512", "1024x1024"],
      "dall-e-3": ["1024x1024", "1024x1792", "1792x1024"],
      "gpt-image-1": ["1024x1024", "1024x1536", "1536x1024", "auto"]
    };
    if (!validSizes[model].includes(size)) {
      return createErrorResponse(
        `Invalid size for model ${model}. Must be one of: ${validSizes[model].join(", ")}`,
        400
      );
    }
    const requestBody = {
      model,
      prompt,
      size,
      n: 1
    };
    if (model === "dall-e-3" || model === "gpt-image-1") {
      requestBody.quality = quality;
      console.log("\u{1F4CA} Including quality parameter:", quality);
    } else {
      console.log("\u{1F4CA} Omitting quality parameter for", model, "(not supported)");
    }
    if (model.startsWith("dall-e")) {
      requestBody.response_format = "url";
      console.log("\u{1F3A8} Using DALL-E model with URL response format");
    } else {
      console.log("\u{1F916} Using GPT-Image model with base64 response format");
    }
    console.log("\u{1F4E4} Request body:", JSON.stringify(requestBody, null, 2));
    console.log("\u{1F680} Calling OpenAI Image Generation API...");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    console.log("\u{1F4E5} OpenAI API Response Status:", response.status, response.statusText);
    if (!response.ok) {
      const error = await response.json();
      return createErrorResponse(
        error.error?.message || "Failed to generate image",
        response.status
      );
    }
    const data = await response.json();
    console.log("\u{1F4CA} API Response keys:", Object.keys(data));
    console.log("\u{1F4CA} Data array length:", data.data?.length || 0);
    if (data.data?.[0]) {
      console.log("\u{1F4CA} First data item keys:", Object.keys(data.data[0]));
    }
    let imageType = "header";
    let finalPrompt = prompt;
    if (prompt.includes("|")) {
      const parts = prompt.split("|");
      const promptPart = parts.find((p) => p.startsWith("prompt:"));
      const typePart = parts.find((p) => p.startsWith("type:"));
      if (promptPart) {
        finalPrompt = promptPart.replace("prompt:", "");
      }
      if (typePart) {
        imageType = typePart.replace("type:", "");
      }
    }
    if (model.startsWith("dall-e")) {
      console.log("\u{1F3A8} Processing DALL-E response (URL format)");
      const imageUrl = data.data[0].url;
      console.log("\u{1F517} Image URL received:", imageUrl?.substring(0, 50) + "...");
      return createResponse(
        JSON.stringify({
          id: `generated_image_${Date.now()}`,
          label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
          type: "fulltext",
          info: null,
          // Will be populated after approval
          color: "#e8f4fd",
          bibl: [`Generated using ${model} (${quality} quality) with prompt: "${finalPrompt}"`],
          imageWidth: "100%",
          imageHeight: "100%",
          metadata: {
            previewImageUrl: imageUrl,
            // Original OpenAI URL for preview
            originalPrompt: finalPrompt,
            imageType,
            model,
            size,
            quality,
            needsApproval: true
            // Flag indicating this image needs approval before saving
          }
        })
      );
    } else {
      console.log("\u{1F916} Processing GPT-Image response (base64 format)");
      const base64Data = data.data[0].b64_json;
      console.log("\u{1F4CF} Base64 data length:", base64Data?.length || 0);
      if (!base64Data) {
        console.error("\u274C No base64 image data received from API");
        return createErrorResponse("No image data received from API", 500);
      }
      const previewDataUrl = `data:image/png;base64,${base64Data}`;
      return createResponse(
        JSON.stringify({
          id: `generated_image_${Date.now()}`,
          label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
          type: "fulltext",
          info: null,
          // Will be populated after approval
          color: "#e8f4fd",
          bibl: [`Generated using ${model} (${quality} quality) with prompt: "${finalPrompt}"`],
          imageWidth: "100%",
          imageHeight: "100%",
          metadata: {
            previewImageUrl: previewDataUrl,
            // Base64 data URL for preview
            base64Data,
            // Store base64 data for later upload
            originalPrompt: finalPrompt,
            imageType,
            model,
            size,
            quality,
            needsApproval: true
            // Flag indicating this image needs approval before saving
          }
        })
      );
    }
  } catch (error) {
    console.error("Error in handleGPT4VisionImage:", error);
    return createErrorResponse("Failed to generate image", 500);
  }
}, "handleGPT4VisionImage");
var handleSaveApprovedImage = /* @__PURE__ */ __name(async (request, env) => {
  if (!env.MY_R2_BUCKET) {
    return createErrorResponse("R2 bucket not configured", 500);
  }
  try {
    const body = await request.json();
    const { imageData } = body;
    if (!imageData || !imageData.metadata) {
      return createErrorResponse("Invalid image data provided", 400);
    }
    const { previewImageUrl, base64Data, originalPrompt, imageType, model, size, quality } = imageData.metadata;
    console.log("=== Saving Approved AI Image ===");
    console.log("Model:", model);
    console.log("Image Type:", imageType);
    console.log("Size:", size);
    let imageBuffer;
    let contentType = "image/png";
    if (base64Data) {
      console.log("\u{1F504} Processing base64 image data...");
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      imageBuffer = bytes;
      console.log("\u2705 Base64 conversion complete, size:", bytes.length, "bytes");
    } else if (previewImageUrl && previewImageUrl.startsWith("http")) {
      console.log("\u2B07\uFE0F Downloading image from URL...");
      const response = await fetch(previewImageUrl);
      if (!response.ok) {
        throw new Error("Failed to download image from preview URL");
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = new Uint8Array(arrayBuffer);
      console.log("\u2705 Image download complete, size:", imageBuffer.length, "bytes");
    } else {
      throw new Error("No valid image source found");
    }
    const timestamp = Date.now();
    const filename = `ai-generated/${timestamp}-${Math.random().toString(36).substring(2, 15)}.png`;
    console.log("\u{1F4C1} Generated filename:", filename);
    console.log("\u2B06\uFE0F Uploading to R2 bucket...");
    await env.MY_R2_BUCKET.put(filename, imageBuffer, {
      httpMetadata: {
        contentType
      }
    });
    console.log("\u2705 R2 upload complete");
    const finalImageUrl = `https://vegvisr.imgix.net/${filename}`;
    let imageMarkdown = "";
    switch (imageType.toLowerCase()) {
      case "header":
        imageMarkdown = `![Header|width: 100%; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`;
        break;
      case "leftside":
        imageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`;
        break;
      case "rightside":
        imageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`;
        break;
      default:
        imageMarkdown = `![Generated Image|width: 300px; height: auto; object-fit: 'cover'](${finalImageUrl})`;
    }
    console.log("\u{1F389} Approved image saved successfully!");
    console.log("\u{1F4C4} Final image URL:", finalImageUrl);
    return createResponse(
      JSON.stringify({
        id: `approved_image_${Date.now()}`,
        label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
        type: "fulltext",
        info: imageMarkdown,
        color: "#e8f4fd",
        bibl: [`Generated using ${model} (${quality} quality) with prompt: "${originalPrompt}"`],
        imageWidth: "100%",
        imageHeight: "100%",
        metadata: {
          generatedImageUrl: finalImageUrl,
          originalPrompt,
          imageType,
          model,
          size,
          quality,
          approved: true,
          savedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      })
    );
  } catch (error) {
    console.error("Error in handleSaveApprovedImage:", error);
    return createErrorResponse("Failed to save approved image: " + error.message, 500);
  }
}, "handleSaveApprovedImage");
var handleProcessTranscript = /* @__PURE__ */ __name(async (request, env) => {
  try {
    console.log("=== handleProcessTranscript called ===");
    const body = await request.json();
    console.log("Request body keys:", Object.keys(body));
    const { transcript, sourceLanguage, targetLanguage } = body;
    if (!transcript) {
      console.error("Missing transcript text in request");
      return createErrorResponse("Missing transcript text", 400);
    }
    console.log("=== Processing Transcript ===");
    console.log("Transcript length:", transcript.length);
    console.log("Source language:", sourceLanguage);
    console.log("Target language:", targetLanguage);
    const apiKey = env.XAI_API_KEY;
    if (!apiKey) {
      console.error("Grok API key not found in environment");
      return createErrorResponse("Grok API key not configured", 500);
    }
    console.log("Grok API key found:", apiKey.substring(0, 10) + "...");
    const transcriptWords = transcript.split(/\s+/).length;
    console.log("Transcript word count:", transcriptWords);
    let prompt;
    let maxTokens = 12e3;
    if (transcriptWords > 3e3) {
      console.log("Large transcript detected, using comprehensive processing");
      maxTokens = 16e3;
      prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph. Create 8-15 detailed thematic sections as nodes.

SOURCE: ${sourceLanguage === "auto" ? "auto-detect" : sourceLanguage}
TARGET: Norwegian

RULES:
1. Translate EVERYTHING to Norwegian with high quality
2. Create nodes with structure: {"id": "del_X", "label": "DEL X: [Descriptive Title]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive content", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}
3. Split into logical thematic sections - be thorough, don't skip content
4. Use rich markdown formatting in "info" field with headers, lists, emphasis
5. Each node should contain substantial content (200-800 words)
6. Include key quotes, important details, and context
7. Create a comprehensive knowledge graph that captures the full essence

TRANSCRIPT (full content):
${transcript}

Return JSON: {"nodes": [...], "edges": []}`;
    } else {
      console.log("Standard transcript length, using detailed processing");
      prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph JSON.

SOURCE: ${sourceLanguage === "auto" ? "auto-detect" : sourceLanguage}
TARGET: Norwegian

Create nodes with this structure:
{"id": "del_X", "label": "DEL X: [Descriptive Title]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive Norwegian content", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}

Rules:
- Translate ALL content to Norwegian with exceptional quality
- Split into 6-12 comprehensive thematic sections
- Use rich markdown formatting in "info" field
- Preserve cultural context and nuanced meaning
- Each node should be substantial (150-600 words)
- Include important quotes, examples, and detailed explanations
- Don't summarize - be comprehensive and detailed

TRANSCRIPT:
${transcript}

Return only JSON: {"nodes": [...], "edges": []}`;
    }
    console.log("Calling Grok AI API...");
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content: "You are an expert Norwegian translator and knowledge graph creator specializing in comprehensive content generation. Transform content into detailed Norwegian knowledge graphs with substantial, well-structured content. Create thorough translations that preserve all important information, cultural context, and nuanced meaning. Always generate multiple detailed nodes with rich markdown formatting. Return only valid JSON in the specified format."
        },
        { role: "user", content: prompt }
      ]
    });
    console.log("Grok AI API response received successfully");
    const knowledgeGraphData = completion.choices[0].message.content.trim();
    console.log("Generated knowledge graph length:", knowledgeGraphData.length);
    try {
      const parsedGraph = JSON.parse(knowledgeGraphData);
      if (!parsedGraph.nodes || !Array.isArray(parsedGraph.nodes)) {
        throw new Error("Invalid knowledge graph structure: missing nodes array");
      }
      parsedGraph.nodes = parsedGraph.nodes.map((node) => ({
        ...node,
        id: node.id || `fulltext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        visible: true,
        path: null
      }));
      console.log("Successfully generated", parsedGraph.nodes.length, "nodes");
      return createResponse(
        JSON.stringify({
          knowledgeGraph: parsedGraph,
          stats: {
            totalNodes: parsedGraph.nodes.length,
            processingTime: Date.now(),
            sourceLanguage,
            targetLanguage,
            modelUsed: "grok-3-beta",
            transcriptWords
          }
        })
      );
    } catch (parseError) {
      console.error("Error parsing generated JSON:", parseError);
      console.log("Raw response:", knowledgeGraphData);
      return createResponse(
        JSON.stringify({
          knowledgeGraph: { nodes: [], edges: [] },
          error: "Failed to parse generated JSON",
          rawResponse: knowledgeGraphData
        }),
        500
      );
    }
  } catch (error) {
    console.error("Error in handleProcessTranscript:", error);
    return createErrorResponse(error.message || "Internal server error", 500);
  }
}, "handleProcessTranscript");
var handleAIGenerateNode = /* @__PURE__ */ __name(async (request, env) => {
  try {
    const { userRequest, graphId, username, contextType, contextData } = await request.json();
    console.log("=== AI Generate Node Debug ===");
    console.log("userRequest:", userRequest);
    console.log("graphId:", graphId);
    console.log("username:", username);
    console.log("contextType:", contextType);
    console.log("contextData:", JSON.stringify(contextData, null, 2));
    console.log("contextData type:", typeof contextData);
    console.log(
      "contextData length/size:",
      contextData ? Object.keys(contextData).length : "null/undefined"
    );
    console.log("===============================");
    if (!userRequest) {
      return createErrorResponse("Missing userRequest parameter", 400);
    }
    let templates;
    try {
      console.log("Attempting to fetch templates using KNOWLEDGE binding...");
      if (!env.KNOWLEDGE) {
        console.error("KNOWLEDGE binding is not available");
        throw new Error("KNOWLEDGE binding is not available");
      }
      const templatesResponse = await env.KNOWLEDGE.fetch(
        "https://knowledge.vegvisr.org/getAITemplates"
      );
      console.log("Templates response status:", templatesResponse.status);
      if (!templatesResponse.ok) {
        const errorText = await templatesResponse.text();
        console.error("Templates response error:", errorText);
        throw new Error(`Failed to fetch templates: ${templatesResponse.status} - ${errorText}`);
      }
      const templatesData = await templatesResponse.json();
      if (!templatesData.results || !Array.isArray(templatesData.results)) {
        throw new Error("Invalid templates data format - missing results array");
      }
      templates = templatesData.results;
      console.log("Successfully fetched templates:", templates);
    } catch (error) {
      console.error("Detailed error fetching templates:", error);
      return createErrorResponse(`Failed to fetch templates: ${error.message}`, 500);
    }
    let graphContext = "";
    if (graphId) {
      try {
        const graphResponse = await env.KNOWLEDGE.fetch(
          `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`
        );
        if (graphResponse.ok) {
          const graphData = await graphResponse.json();
          if (graphData?.nodes) {
            graphContext = graphData.nodes.filter((node2) => node2.visible !== false).map((node2) => `Node: ${node2.label}
Type: ${node2.type}
Info: ${node2.info || ""}`).join("\n\n");
          }
        }
      } catch (error) {
        console.error("Error fetching graph context:", error);
      }
    }
    let finalContext = "";
    if (contextType === "current" && contextData) {
      finalContext = `Current Node Context:
${JSON.stringify(contextData, null, 2)}`;
    } else if (contextType === "all" && contextData) {
      finalContext = `All Nodes Context:
${graphContext}`;
    }
    const prompt = `Given the following user request and available templates, generate an appropriate node.

User Request: ${userRequest}
${username ? `Username: @${username}` : ""}

Available Templates:
${templates.map(
      (t) => `Template: ${t.label}
Type: ${t.type}
Example Node: ${JSON.stringify(t.nodes, null, 2)}
AI Instructions: ${t.ai_instructions || "No specific instructions provided."}`
    ).join("\n")}

${finalContext ? `
Context for generation:
${finalContext}` : ""}

Based on the user's request, select the most appropriate template and generate content following its structure and instructions.
The generated content must strictly follow the AI Instructions of the selected template.
Return a JSON object with the following structure:
{
"template": "selected_template_id",
"content": "generated_content"
}`;
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1"
    });
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 1e3,
      messages: [
        {
          role: "system",
          content: "You are an expert at understanding user intent and generating appropriate content for knowledge graphs. You must strictly follow the AI Instructions provided in the template when generating content."
        },
        { role: "user", content: prompt }
      ]
    });
    const result = JSON.parse(completion.choices[0].message.content.trim());
    const selectedTemplate = templates.find((t) => t.id === result.template) || templates[0];
    const node = {
      id: crypto.randomUUID(),
      label: selectedTemplate.nodes.label,
      color: selectedTemplate.nodes.color,
      type: selectedTemplate.nodes.type,
      info: result.content,
      bibl: selectedTemplate.nodes.bibl || [],
      imageWidth: selectedTemplate.nodes.imageWidth,
      imageHeight: selectedTemplate.nodes.imageHeight,
      visible: true,
      path: selectedTemplate.nodes.path || ""
    };
    if (typeof node.info === "object" && node.info !== null) {
      const infoObj = node.info;
      node.info = infoObj.info || "";
      node.label = infoObj.label || node.label;
      node.color = infoObj.color || node.color;
      node.type = infoObj.type || node.type;
      node.bibl = infoObj.bibl || node.bibl;
      node.imageWidth = infoObj.imageWidth || node.imageWidth;
      node.imageHeight = infoObj.imageHeight || node.imageHeight;
      node.path = infoObj.path || node.path;
    }
    return createResponse(JSON.stringify({ node }));
  } catch (error) {
    console.error("Error in handleAIGenerateNode:", error);
    return createErrorResponse(error.message || "Internal server error", 500);
  }
}, "handleAIGenerateNode");
var handleGetStyleTemplates = /* @__PURE__ */ __name(async (request) => {
  const url = new URL(request.url);
  const nodeType = url.searchParams.get("nodeType");
  const allTemplates = [
    {
      id: "fulltext_complete_enhancer",
      name: "Complete FullText Enhancer",
      description: "Adds FANCY headers, SECTION blocks, QUOTE citations, WNOTE annotations, and contextual images",
      nodeTypes: ["fulltext", "title"],
      transformationRules: {
        addFancyHeaders: true,
        addSections: true,
        addQuotes: true,
        addWorkNotes: true,
        addHeaderImage: true,
        addSideImages: {
          leftside: true,
          rightside: true,
          contextual: true
        }
      },
      category: "comprehensive",
      isActive: true
    },
    {
      id: "visual_content_formatter",
      name: "Visual Content Formatter",
      description: "Focus on image positioning with leftside/rightside placement and WNOTE integration",
      nodeTypes: ["fulltext", "worknote"],
      transformationRules: {
        addHeaderImage: true,
        addSideImages: {
          leftside: true,
          rightside: true,
          contextual: true
        },
        addWorkNotes: true,
        addSections: true
      },
      category: "visual",
      isActive: true
    },
    {
      id: "work_note_enhancer",
      name: "Work Note Enhancer",
      description: "Specialized WNOTE formatting with contextual rightside images for technical content",
      nodeTypes: ["fulltext", "worknote"],
      transformationRules: {
        addWorkNotes: true,
        addSideImages: {
          rightside: true,
          contextual: true
        },
        addSections: true
      },
      category: "technical",
      isActive: true
    },
    {
      id: "header_sections_basic",
      name: "Header + Sections Basic",
      description: "Basic structure with FANCY headers and SECTION blocks",
      nodeTypes: ["fulltext", "title", "worknote"],
      transformationRules: {
        addFancyHeaders: true,
        addSections: true,
        addHeaderImage: true
      },
      category: "structure",
      isActive: true
    }
  ];
  const templates = nodeType ? allTemplates.filter((t) => t.nodeTypes.includes(nodeType) && t.isActive) : allTemplates.filter((t) => t.isActive);
  return createResponse(JSON.stringify({ templates }));
}, "handleGetStyleTemplates");
var handleApplyStyleTemplate = /* @__PURE__ */ __name(async (request, env) => {
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return createErrorResponse("Internal Server Error: XAI API key missing", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { nodeContent, templateId, nodeType, options: options2 = {}, colorTheme = null } = body;
  if (!nodeContent || !templateId || !nodeType) {
    return createErrorResponse(
      "Missing required parameters: nodeContent, templateId, nodeType",
      400
    );
  }
  console.log("=== Apply Style Template ===");
  console.log("Template ID:", templateId);
  console.log("Node Type:", nodeType);
  console.log("Content length:", nodeContent.length);
  console.log("Options:", JSON.stringify(options2));
  console.log("Color Theme:", colorTheme ? colorTheme.name : "Default");
  const templates = [
    {
      id: "fulltext_complete_enhancer",
      aiInstructions: `Transform this content into a rich, well-formatted fulltext node with comprehensive styling:

FORMATTING REQUIREMENTS:
1. Add a FANCY header at the top with styling: [FANCY | font-size: 3em; color: #2c3e50; background: linear-gradient(45deg, #f0f8ff, #e6f3ff); text-align: center; padding: 20px; border-radius: 10px]Your Title Here[END FANCY]

2. Structure content into SECTION blocks with different colors:
   [SECTION | background-color: 'lightyellow'; color: 'black'; padding: 15px; border-radius: 8px]
   Main content here
   [END SECTION]

3. Add relevant QUOTE blocks with citations:
   [QUOTE | Cited='Author Name']
   Relevant quote text
   [END QUOTE]

4. Include WNOTE annotations for important points:
   [WNOTE | Cited='Context/Source']
   Important note or annotation
   [END WNOTE]

5. Add contextual images (these will be replaced with real images):
   - Header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
   - Leftside images: ![Leftside-2|width: 200px; height: 200px; object-fit: 'cover'](LEFTSIDE_IMAGE_PLACEHOLDER)
   - Rightside images: ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)

Make the content comprehensive, well-structured, and visually appealing. Preserve the original meaning while enhancing presentation.`
    },
    {
      id: "visual_content_formatter",
      aiInstructions: `Transform this content focusing on visual layout with images and work notes:

VISUAL FORMATTING REQUIREMENTS:
1. Add a contextual header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
2. Structure content with strategic leftside and rightside image placement:
   ![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'](LEFTSIDE_IMAGE_PLACEHOLDER)
   ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)
3. Include WNOTE blocks for important annotations
4. Use SECTION blocks to organize content
5. Balance text and visual elements for optimal readability

Focus on creating a visually engaging layout that enhances comprehension.`
    },
    {
      id: "work_note_enhancer",
      aiInstructions: `Transform this content with focus on technical work notes and rightside documentation:

WORK NOTE FORMATTING:
1. Add WNOTE blocks for technical annotations and development notes
2. Include rightside images for diagrams, screenshots, or reference materials:
   ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)
3. Structure content in clear sections
4. Maintain technical accuracy while improving presentation

Perfect for technical documentation and development notes.`
    },
    {
      id: "header_sections_basic",
      aiInstructions: `Transform this content with basic structural improvements:

BASIC FORMATTING:
1. Add a FANCY header with attractive styling
2. Organize content into logical SECTION blocks
3. Include a relevant header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
4. Maintain clean, professional presentation

Focus on clear structure and readability.`
    }
  ];
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return createErrorResponse("Template not found", 404);
  }
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    let colorInstructions = "";
    if (colorTheme) {
      colorInstructions = `
COLOR THEME: "${colorTheme.name}"
Use these specific colors for formatting:
- Primary Color: ${colorTheme.primary}
- Secondary Color: ${colorTheme.secondary}
- Accent Color: ${colorTheme.accent}
- Background Color: ${colorTheme.background}
- Section Colors: ${colorTheme.sections.join(", ")}

Apply these colors to:
- FANCY headers: Use primary color and appropriate background
- SECTION blocks: Use the section colors (${colorTheme.sections.join(", ")}) rotating between them
- Overall theme: Create a harmonious color scheme using these colors
`;
    }
    const prompt = `${template.aiInstructions}

${colorInstructions}

ORIGINAL CONTENT TO TRANSFORM:
${nodeContent}

ADDITIONAL OPTIONS: ${JSON.stringify(options2)}

Return the transformed content with all the requested formatting applied. Use the placeholder URLs exactly as specified (HEADER_IMAGE_PLACEHOLDER, LEFTSIDE_IMAGE_PLACEHOLDER, RIGHTSIDE_IMAGE_PLACEHOLDER) - these will be replaced with real contextual images. Apply the color theme consistently throughout all formatting elements. Preserve the core meaning while enhancing the presentation with the specified markdown formatting patterns.`;
    console.log("Sending prompt to Grok:", prompt);
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 3e3,
      messages: [
        {
          role: "system",
          content: "You are an expert content formatter specializing in rich markdown formatting for knowledge graphs. Apply the requested formatting patterns precisely while preserving content meaning and enhancing readability."
        },
        { role: "user", content: prompt }
      ]
    });
    let formattedContent = completion.choices[0].message.content.trim();
    if (env.PEXELS_API_KEY) {
      console.log("=== Replacing Placeholder Images with Pexels Images ===");
      formattedContent = await replacePlaceholderImages(formattedContent, nodeContent, env);
    } else {
      console.log("Pexels API key not available, using placeholder URLs");
      formattedContent = formattedContent.replace(/HEADER_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/contextual-header.png").replace(/LEFTSIDE_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/leftside-image.png").replace(/RIGHTSIDE_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/rightside-image.png");
    }
    console.log("=== Template Applied Successfully ===");
    console.log("Formatted content length:", formattedContent.length);
    return createResponse(
      JSON.stringify({
        formattedContent,
        templateUsed: templateId,
        success: true
      })
    );
  } catch (error) {
    console.error("Error applying style template:", error);
    return createErrorResponse("Failed to apply style template: " + error.message, 500);
  }
}, "handleApplyStyleTemplate");
var searchPexelsImages = /* @__PURE__ */ __name(async (query, env, count = 1) => {
  if (!env.PEXELS_API_KEY) {
    throw new Error("Pexels API key not configured");
  }
  try {
    console.log(`Searching Pexels for: "${query}" (${count} images)`);
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: env.PEXELS_API_KEY
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      return data.photos.map((photo) => ({
        url: photo.src.medium,
        // Use medium size for performance
        alt: photo.alt || query,
        photographer: photo.photographer,
        id: photo.id
      }));
    } else {
      console.log("No Pexels images found for query:", query);
      return [];
    }
  } catch (error) {
    console.error("Error searching Pexels:", error);
    return [];
  }
}, "searchPexelsImages");
var generateImageSearchQueries = /* @__PURE__ */ __name(async (content, env) => {
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return ["nature", "abstract", "business"];
  }
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1"
    });
    const prompt = `Analyze this content and generate 3-5 relevant image search keywords that would make good contextual images. Focus on the main themes, concepts, and visual elements that would enhance understanding.

Content: ${content.substring(0, 500)}...

Return only the keywords, separated by commas. Examples: "nature, forest, trees" or "technology, computers, digital" or "business, meeting, office"`;
    const completion = await client.chat.completions.create({
      model: "grok-3-beta",
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing content and suggesting relevant image search terms. Return only comma-separated keywords, no explanations."
        },
        { role: "user", content: prompt }
      ]
    });
    const keywords = completion.choices[0].message.content.trim();
    const queries = keywords.split(",").map((q) => q.trim()).filter((q) => q.length > 0);
    console.log("Generated image search queries:", queries);
    return queries.length > 0 ? queries : ["abstract", "concept", "modern"];
  } catch (error) {
    console.error("Error generating image queries:", error);
    return ["nature", "abstract", "business"];
  }
}, "generateImageSearchQueries");
var replacePlaceholderImages = /* @__PURE__ */ __name(async (content, originalContent, env) => {
  try {
    const searchQueries = await generateImageSearchQueries(originalContent, env);
    let updatedContent = content;
    if (content.includes("HEADER_IMAGE_PLACEHOLDER")) {
      console.log("Replacing header image placeholder...");
      const headerImages = await searchPexelsImages(searchQueries[0] || "abstract header", env, 1);
      if (headerImages.length > 0) {
        updatedContent = updatedContent.replace(/HEADER_IMAGE_PLACEHOLDER/g, headerImages[0].url);
        console.log("Header image replaced with:", headerImages[0].url);
      } else {
        updatedContent = updatedContent.replace(
          /HEADER_IMAGE_PLACEHOLDER/g,
          "https://vegvisr.imgix.net/contextual-header.png"
        );
      }
    }
    if (content.includes("LEFTSIDE_IMAGE_PLACEHOLDER")) {
      console.log("Replacing leftside image placeholder...");
      const leftsideImages = await searchPexelsImages(
        searchQueries[1] || searchQueries[0] || "concept",
        env,
        1
      );
      if (leftsideImages.length > 0) {
        updatedContent = updatedContent.replace(
          /LEFTSIDE_IMAGE_PLACEHOLDER/g,
          leftsideImages[0].url
        );
        console.log("Leftside image replaced with:", leftsideImages[0].url);
      } else {
        updatedContent = updatedContent.replace(
          /LEFTSIDE_IMAGE_PLACEHOLDER/g,
          "https://vegvisr.imgix.net/leftside-image.png"
        );
      }
    }
    if (content.includes("RIGHTSIDE_IMAGE_PLACEHOLDER")) {
      console.log("Replacing rightside image placeholder...");
      const rightsideImages = await searchPexelsImages(
        searchQueries[2] || searchQueries[0] || "modern",
        env,
        1
      );
      if (rightsideImages.length > 0) {
        updatedContent = updatedContent.replace(
          /RIGHTSIDE_IMAGE_PLACEHOLDER/g,
          rightsideImages[0].url
        );
        console.log("Rightside image replaced with:", rightsideImages[0].url);
      } else {
        updatedContent = updatedContent.replace(
          /RIGHTSIDE_IMAGE_PLACEHOLDER/g,
          "https://vegvisr.imgix.net/rightside-image.png"
        );
      }
    }
    return updatedContent;
  } catch (error) {
    console.error("Error replacing placeholder images:", error);
    return content.replace(/HEADER_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/contextual-header.png").replace(/LEFTSIDE_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/leftside-image.png").replace(/RIGHTSIDE_IMAGE_PLACEHOLDER/g, "https://vegvisr.imgix.net/rightside-image.png");
  }
}, "replacePlaceholderImages");
var handlePexelsImageSearch = /* @__PURE__ */ __name(async (request, env) => {
  if (!env.PEXELS_API_KEY) {
    return createErrorResponse("Pexels API key not configured", 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }
  const { query, count = 10 } = body;
  if (!query || typeof query !== "string") {
    return createErrorResponse("Query parameter is required and must be a string", 400);
  }
  try {
    const images = await searchPexelsImages(query, env, Math.min(count, 20));
    return createResponse(
      JSON.stringify({
        query,
        total: images.length,
        images,
        success: true
      })
    );
  } catch (error) {
    console.error("Error in Pexels search endpoint:", error);
    return createErrorResponse("Failed to search Pexels images: " + error.message, 500);
  }
}, "handlePexelsImageSearch");
var handleGoogleOAuthCallback = /* @__PURE__ */ __name(async () => {
  console.log("\u{1F510} handleGoogleOAuthCallback called");
  const callbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Google Photos Authorization</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 20px;
        box-sizing: border-box;
      }
      .container {
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 30px;
        border-radius: 16px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        width: 100%;
      }
      .icon {
        font-size: 48px;
        margin-bottom: 20px;
        animation: spin 2s linear infinite;
      }
      .status {
        font-size: 18px;
        margin-bottom: 15px;
        font-weight: 500;
      }
      .message {
        font-size: 14px;
        opacity: 0.8;
        line-height: 1.4;
      }
      .error {
        color: #ff6b6b;
      }
      .success {
        color: #51cf66;
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
      @keyframes fadeIn {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .container {
        animation: fadeIn 0.5s ease-out;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon" id="statusIcon">\u{1F504}</div>
      <div class="status" id="statusText">Processing authorization...</div>
      <div class="message" id="statusMessage">
        Please wait while we complete the authentication.
      </div>
    </div>

    <script>
      console.log('\u{1F510} Google Photos OAuth Callback Page Loaded')

      function updateStatus(icon, text, message, className = '') {
        document.getElementById('statusIcon').textContent = icon
        document.getElementById('statusText').textContent = text
        document.getElementById('statusMessage').textContent = message

        if (className) {
          document.getElementById('statusText').className = \`status \${className}\`
          document.getElementById('statusMessage').className = \`message \${className}\`
        }
      }

      function handleAuthCallback() {
        try {
          // Parse URL parameters
          const urlParams = new URLSearchParams(window.location.search)
          const code = urlParams.get('code')
          const error = urlParams.get('error')
          const errorDescription = urlParams.get('error_description')

          console.log('\u{1F4CB} URL Parameters:', { code: !!code, error, errorDescription })

          if (error) {
            console.error('\u274C OAuth Error:', error, errorDescription)

            updateStatus(
              '\u274C',
              'Authorization Failed',
              errorDescription || error || 'An error occurred during authorization.',
              'error',
            )

            // For redirect-based OAuth, redirect back to the Vue frontend with error
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            const frontendUrl = isLocal
              ? \`http://\${window.location.hostname}:5173/?google_auth_error=\${encodeURIComponent(errorDescription || error || 'Authorization failed')}\`
              : \`https://www.vegvisr.org/?google_auth_error=\${encodeURIComponent(errorDescription || error || 'Authorization failed')}\`

            // Redirect back to the frontend
            window.location.href = frontendUrl
            return
          }

          if (code) {
            console.log('\u2705 Authorization code received')

            updateStatus(
              '\u2705',
              'Authorization Successful!',
              'Connecting to your Google Photos... This window will close automatically.',
              'success',
            )

                        // For redirect-based OAuth, redirect back to the Vue frontend with the code
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            const frontendUrl = isLocal
              ? \`http://\${window.location.hostname}:5173/?google_auth_code=\${code}&google_auth_success=true\`
              : \`https://www.vegvisr.org/?google_auth_code=\${code}&google_auth_success=true\`

            // Redirect back to the frontend
            window.location.href = frontendUrl
          } else {
            console.error('\u274C No authorization code found in URL')

            updateStatus(
              '\u274C',
              'No Authorization Code',
              'The authorization process was incomplete. Please try again.',
              'error',
            )

            if (window.opener) {
              window.opener.postMessage(
                {
                  type: 'GOOGLE_AUTH_ERROR',
                  error: 'No authorization code received',
                },
                window.location.origin,
              )
            }

            setTimeout(() => {
              window.close()
            }, 3000)
          }
        } catch (err) {
          console.error('\u274C Callback processing error:', err)

          updateStatus(
            '\u274C',
            'Processing Error',
            'An error occurred while processing the authorization. Please try again.',
            'error',
          )

          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'GOOGLE_AUTH_ERROR',
                error: 'Callback processing error: ' + err.message,
              },
              window.location.origin,
            )
          }

          setTimeout(() => {
            window.close()
          }, 3000)
        }
      }

      // Handle the auth callback when page loads
      document.addEventListener('DOMContentLoaded', handleAuthCallback)

      // Also handle immediately in case DOMContentLoaded already fired
      if (document.readyState === 'loading') {
        // Still loading, wait for DOMContentLoaded
      } else {
        // Already loaded
        handleAuthCallback()
      }

      console.log('\u{1F680} Callback page initialized')
    <\/script>
  </body>
</html>`;
  console.log("\u2705 Returning OAuth callback HTML, length:", callbackHtml.length);
  return new Response(callbackHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      ...corsHeaders
    }
  });
}, "handleGoogleOAuthCallback");
var handleGooglePhotosAuth = /* @__PURE__ */ __name(async (request, env) => {
  try {
    const { code } = await request.json();
    if (!code) {
      return createErrorResponse("Authorization code is required", 400);
    }
    console.log("\u{1F510} Exchanging code for Google Photos access token...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: env.GOOGLE_PHOTOS_CLIENT_ID,
        client_secret: env.GOOGLE_PHOTOS_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: request.url.includes("localhost") || request.url.includes("127.0.0.1") ? request.url.includes("localhost") ? "http://localhost:8789/auth/google/callback.html" : "http://127.0.0.1:8789/auth/google/callback.html" : "https://api.vegvisr.org/auth/google/callback.html"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("\u274C Token exchange failed:", tokenData);
      return createErrorResponse(
        tokenData.error_description || "Failed to exchange authorization code",
        400
      );
    }
    if (tokenData.access_token) {
      console.log("\u2705 Google Photos authentication successful");
      return createResponse(
        JSON.stringify({
          success: true,
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in
        })
      );
    } else {
      return createErrorResponse("No access token received", 400);
    }
  } catch (error) {
    console.error("\u274C Google Photos auth error:", error);
    return createErrorResponse(error.message, 500);
  }
}, "handleGooglePhotosAuth");
var handleGooglePhotosSearch = /* @__PURE__ */ __name(async (request) => {
  try {
    const { access_token, searchParams } = await request.json();
    if (!access_token) {
      return createErrorResponse("Access token is required", 401);
    }
    console.log("\u{1F50D} Searching Google Photos...");
    const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pageSize: 20,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ["PHOTO"]
          },
          // Add content filter if search term is provided
          ...searchParams?.contentCategories && {
            contentFilter: {
              includedContentCategories: searchParams.contentCategories
            }
          }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("\u274C Google Photos search failed:", data);
      return createErrorResponse(data.error?.message || "Failed to search Google Photos", 400);
    }
    console.log(`\u2705 Found ${data.mediaItems?.length || 0} photos`);
    return createResponse(
      JSON.stringify({
        success: true,
        mediaItems: data.mediaItems || [],
        nextPageToken: data.nextPageToken
      })
    );
  } catch (error) {
    console.error("\u274C Google Photos search error:", error);
    return createErrorResponse(error.message, 500);
  }
}, "handleGooglePhotosSearch");
var handleGooglePhotosRecent = /* @__PURE__ */ __name(async (request) => {
  try {
    const { access_token } = await request.json();
    if (!access_token) {
      return createErrorResponse("Access token is required", 401);
    }
    console.log("\u{1F4F7} Getting recent Google Photos...");
    const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("\u274C Failed to get recent photos:", data);
      return createErrorResponse(data.error?.message || "Failed to get recent photos", 400);
    }
    console.log(`\u2705 Retrieved ${data.mediaItems?.length || 0} recent photos`);
    return createResponse(
      JSON.stringify({
        success: true,
        mediaItems: data.mediaItems || [],
        nextPageToken: data.nextPageToken
      })
    );
  } catch (error) {
    console.error("\u274C Recent photos error:", error);
    return createErrorResponse(error.message, 500);
  }
}, "handleGooglePhotosRecent");
async function handleCreateCustomDomain(request, env) {
  console.log("\u{1F527} === Custom Domain Registration Request Started ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  if (request.method === "OPTIONS") {
    console.log("\u2705 Handling CORS preflight request");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  if (request.method === "POST") {
    try {
      console.log("\u{1F4E5} Processing POST request for custom domain creation");
      const requestBody = await request.json();
      console.log("\u{1F4CB} Request body received:", JSON.stringify(requestBody, null, 2));
      const { subdomain, rootDomain, zoneId } = requestBody;
      let targetDomain;
      let targetZoneId;
      console.log("\u{1F50D} Input validation:");
      console.log("  - subdomain:", subdomain);
      console.log("  - rootDomain:", rootDomain);
      console.log("  - zoneId:", zoneId);
      if (!subdomain) {
        console.log("\u274C Subdomain validation failed - subdomain is required");
        return new Response(
          JSON.stringify({
            error: 'Subdomain is required (e.g., "torarne" for torarne.xyzvibe.com)'
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
      const targetRootDomain = rootDomain || "norsegong.com";
      console.log("\u{1F3AF} Target root domain determined:", targetRootDomain);
      if (isProtectedSubdomain(subdomain, targetRootDomain)) {
        console.log(
          `\u{1F6A8} SECURITY BLOCK: Attempted to create protected subdomain: ${subdomain}.${targetRootDomain}`
        );
        return new Response(
          JSON.stringify({
            error: `Subdomain '${subdomain}' is protected and cannot be created. Protected subdomains: ${PROTECTED_SUBDOMAINS[targetRootDomain]?.join(", ") || "none"}`,
            protectedSubdomain: true,
            availableProtectedList: PROTECTED_SUBDOMAINS[targetRootDomain] || []
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
      targetDomain = `${subdomain}.${targetRootDomain}`;
      console.log("\u{1F310} Full target domain:", targetDomain);
      targetZoneId = zoneId || DOMAIN_ZONE_MAPPING[targetRootDomain];
      console.log("\u{1F511} Zone ID lookup:");
      console.log("  - Available zone mappings:", JSON.stringify(DOMAIN_ZONE_MAPPING, null, 2));
      console.log("  - Resolved zone ID:", targetZoneId);
      if (!targetZoneId) {
        console.log("\u274C Zone ID validation failed - no zone ID found for domain");
        return new Response(
          JSON.stringify({
            error: `No Zone ID found for domain: ${targetDomain}. Supported domains: ${Object.keys(DOMAIN_ZONE_MAPPING).join(", ")}`
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
      console.log(`\u2705 Setting up custom domain: ${targetDomain} with Zone ID: ${targetZoneId}`);
      if (!env.CF_API_TOKEN) {
        console.log("\u274C CF_API_TOKEN environment variable is missing");
        return new Response(
          JSON.stringify({
            error: "CF_API_TOKEN environment variable is not configured",
            overallSuccess: false
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
      console.log("\u2705 CF_API_TOKEN is available");
      console.log("\u{1F527} Creating DNS record...");
      const dnsPayload = {
        type: "CNAME",
        name: targetDomain,
        content: "brand-worker.torarnehave.workers.dev",
        proxied: true
      };
      console.log("\u{1F4E4} DNS payload:", JSON.stringify(dnsPayload, null, 2));
      const dnsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dnsPayload)
        }
      );
      console.log("\u{1F4E5} DNS response status:", dnsResponse.status, dnsResponse.statusText);
      const dnsResult = await dnsResponse.json();
      console.log("\u{1F4CB} DNS response body:", JSON.stringify(dnsResult, null, 2));
      const dnsSetup = {
        success: dnsResult.success,
        errors: dnsResult.errors,
        result: dnsResult.result
      };
      console.log("\u{1F527} Creating worker route...");
      const workerPayload = {
        pattern: `${targetDomain}/*`,
        script: "brand-worker"
      };
      console.log("\u{1F4E4} Worker route payload:", JSON.stringify(workerPayload, null, 2));
      const workerResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(workerPayload)
        }
      );
      console.log(
        "\u{1F4E5} Worker route response status:",
        workerResponse.status,
        workerResponse.statusText
      );
      const workerResult = await workerResponse.json();
      console.log("\u{1F4CB} Worker route response body:", JSON.stringify(workerResult, null, 2));
      const workerSetup = {
        success: workerResult.success,
        errors: workerResult.errors,
        result: workerResult.result
      };
      const overallSuccess = dnsSetup.success && workerSetup.success;
      console.log("\u{1F3AF} Overall success:", overallSuccess);
      console.log("  - DNS setup success:", dnsSetup.success);
      console.log("  - Worker setup success:", workerSetup.success);
      const responseData = {
        overallSuccess,
        domain: targetDomain,
        zoneId: targetZoneId,
        dnsSetup,
        workerSetup,
        debug: {
          requestBody,
          targetRootDomain,
          availableDomains: Object.keys(DOMAIN_ZONE_MAPPING)
        }
      };
      console.log("\u{1F4E4} Final response:", JSON.stringify(responseData, null, 2));
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.log("\u274C Error in handleCreateCustomDomain:", error);
      console.log("\u274C Error stack:", error.stack);
      return new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          overallSuccess: false
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }
  console.log("\u274C Method not allowed:", request.method);
  return new Response("Method Not Allowed", { status: 405 });
}
__name(handleCreateCustomDomain, "handleCreateCustomDomain");
async function handleDeleteCustomDomain(request, env) {
  console.log("\u{1F5D1}\uFE0F handleDeleteCustomDomain called");
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    const requestBody = await request.json();
    console.log("\u{1F4E5} Delete request body:", JSON.stringify(requestBody, null, 2));
    const { subdomain, rootDomain } = requestBody;
    if (!subdomain || !rootDomain) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: subdomain and rootDomain",
          overallSuccess: false
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    const targetDomain = `${subdomain}.${rootDomain}`;
    console.log("\u{1F3AF} Target domain to delete:", targetDomain);
    if (isProtectedSubdomain(subdomain, rootDomain)) {
      console.log(
        `\u{1F6A8} SECURITY BLOCK: Attempted to delete protected subdomain: ${subdomain}.${rootDomain}`
      );
      return new Response(
        JSON.stringify({
          error: `Subdomain '${subdomain}' is protected and cannot be deleted. Protected subdomains: ${PROTECTED_SUBDOMAINS[rootDomain]?.join(", ") || "none"}`,
          protectedSubdomain: true,
          overallSuccess: false
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    const targetZoneId = getZoneIdForDomain(rootDomain);
    if (!targetZoneId) {
      return new Response(
        JSON.stringify({
          error: `Unsupported root domain: ${rootDomain}. Supported domains: ${Object.keys(DOMAIN_ZONE_MAPPING).join(", ")}`,
          overallSuccess: false
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    console.log("\u{1F3F7}\uFE0F Using zone ID:", targetZoneId);
    console.log("\u{1F50D} Finding DNS record for:", targetDomain);
    const dnsListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?name=${targetDomain}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    const dnsListResult = await dnsListResponse.json();
    console.log("\u{1F4CB} DNS list response:", JSON.stringify(dnsListResult, null, 2));
    let dnsSetup = { success: true, errors: [], deleted: false };
    if (dnsListResult.result && dnsListResult.result.length > 0) {
      const dnsRecord = dnsListResult.result[0];
      console.log("\u{1F3AF} Found DNS record to delete:", dnsRecord.id);
      const dnsDeleteResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${dnsRecord.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      const dnsDeleteResult = await dnsDeleteResponse.json();
      console.log("\u{1F5D1}\uFE0F DNS delete response:", JSON.stringify(dnsDeleteResult, null, 2));
      dnsSetup = {
        success: dnsDeleteResult.success,
        errors: dnsDeleteResult.errors || [],
        deleted: dnsDeleteResult.success,
        recordId: dnsRecord.id
      };
    } else {
      console.log("\u2139\uFE0F No DNS record found for domain:", targetDomain);
      dnsSetup.deleted = false;
      dnsSetup.message = "No DNS record found";
    }
    console.log("\u{1F50D} Finding worker route for:", `${targetDomain}/*`);
    const routesListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    const routesListResult = await routesListResponse.json();
    console.log("\u{1F4CB} Routes list response:", JSON.stringify(routesListResult, null, 2));
    let workerSetup = { success: true, errors: [], deleted: false };
    if (routesListResult.result && routesListResult.result.length > 0) {
      const targetRoute = routesListResult.result.find(
        (route) => route.pattern === `${targetDomain}/*`
      );
      if (targetRoute) {
        console.log("\u{1F3AF} Found worker route to delete:", targetRoute.id);
        const routeDeleteResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes/${targetRoute.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        const routeDeleteResult = await routeDeleteResponse.json();
        console.log("\u{1F5D1}\uFE0F Route delete response:", JSON.stringify(routeDeleteResult, null, 2));
        workerSetup = {
          success: routeDeleteResult.success,
          errors: routeDeleteResult.errors || [],
          deleted: routeDeleteResult.success,
          routeId: targetRoute.id
        };
      } else {
        console.log("\u2139\uFE0F No worker route found for pattern:", `${targetDomain}/*`);
        workerSetup.deleted = false;
        workerSetup.message = "No worker route found";
      }
    } else {
      console.log("\u2139\uFE0F No worker routes found in zone");
      workerSetup.deleted = false;
      workerSetup.message = "No worker routes found";
    }
    console.log("\u{1F5D1}\uFE0F Deleting KV store entry for:", `site-config:${targetDomain}`);
    let kvSetup = { success: true, errors: [], deleted: false };
    try {
      if (!env.SITE_CONFIGS) {
        throw new Error("SITE_CONFIGS KV namespace not available");
      }
      await env.SITE_CONFIGS.delete(`site-config:${targetDomain}`);
      kvSetup.deleted = true;
      kvSetup.message = "KV entry deleted successfully";
      console.log("\u2705 KV entry deleted successfully");
    } catch (kvError) {
      console.error("\u274C Error deleting KV entry:", kvError);
      kvSetup.success = false;
      kvSetup.errors.push({ message: kvError.message });
      kvSetup.message = "Failed to delete KV entry";
    }
    const overallSuccess = dnsSetup.success && workerSetup.success && kvSetup.success;
    console.log("\u{1F3AF} Overall deletion success:", overallSuccess);
    console.log("  - DNS deletion success:", dnsSetup.success);
    console.log("  - Worker deletion success:", workerSetup.success);
    console.log("  - KV deletion success:", kvSetup.success);
    const responseData = {
      overallSuccess,
      domain: targetDomain,
      zoneId: targetZoneId,
      dnsSetup,
      workerSetup,
      kvSetup,
      debug: {
        requestBody,
        targetRootDomain: rootDomain,
        availableDomains: Object.keys(DOMAIN_ZONE_MAPPING)
      }
    };
    console.log("\u{1F4E4} Final deletion response:", JSON.stringify(responseData, null, 2));
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.log("\u274C Error in handleDeleteCustomDomain:", error);
    console.log("\u274C Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        overallSuccess: false
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(handleDeleteCustomDomain, "handleDeleteCustomDomain");
var handleRAGProxyRequest = /* @__PURE__ */ __name(async (request, endpoint, env) => {
  try {
    const ragManagerUrl = `https://rag-manager-worker.torarnehave.workers.dev${endpoint}`;
    console.log(`[API Worker] Proxying to RAG Manager: ${ragManagerUrl}`);
    const response = await fetch(ragManagerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    return response;
  } catch (error) {
    console.error("[API Worker] RAG proxy error:", error);
    return createErrorResponse(`RAG proxy failed: ${error.message}`, 500);
  }
}, "handleRAGProxyRequest");
var handleDeploySandbox = /* @__PURE__ */ __name(async (request, env) => {
  try {
    const { userToken, code } = await request.json();
    if (!userToken || !code) {
      return createErrorResponse("Missing userToken or code", 400);
    }
    const sanitizedToken = userToken.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const workerName = `sandbox-${sanitizedToken}`.substring(0, 54);
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_API_TOKEN_SANDBOX;
    const workersSubdomain = env.CF_WORKERS_SUBDOMAIN;
    console.log(`Deploying persistent sandbox for user: ${workerName}`);
    console.log("Worker code preview:", code.substring(0, 200) + "...");
    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/javascript"
        },
        body: code
      }
    );
    const deployJson = await deployRes.json();
    if (!deployJson.success) {
      return createErrorResponse("Cloudflare API error: " + JSON.stringify(deployJson.errors), 500);
    }
    const endpoint = `https://${workerName}.${workersSubdomain}.workers.dev`;
    const sandboxMetadata = {
      userToken,
      workerName,
      endpoint,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      codePreview: code.substring(0, 500)
      // Store preview for debugging
    };
    await env.BINDING_NAME.put(`sandbox:${userToken}`, JSON.stringify(sandboxMetadata));
    return createResponse(
      JSON.stringify({
        success: true,
        endpoint,
        workerName,
        message: "Persistent sandbox updated successfully"
      }),
      200
    );
  } catch (e) {
    return createErrorResponse("Deploy error: " + e.message, 500);
  }
}, "handleDeploySandbox");
var handleCreateSandboxDomain = /* @__PURE__ */ __name(async (request, env) => {
  try {
    const { userToken } = await request.json();
    if (!userToken) {
      return createErrorResponse("Missing userToken", 400);
    }
    const sandboxData = await env.BINDING_NAME.get(`sandbox:${userToken}`);
    if (!sandboxData) {
      return createErrorResponse("Sandbox not found. Please deploy your sandbox first.", 404);
    }
    const sandbox = JSON.parse(sandboxData);
    const workerName = sandbox.workerName;
    const customSubdomain = workerName.replace("sandbox-", "");
    const domain = `${customSubdomain}.xyzvibe.com`;
    const zoneId = "602067f0cf860426a35860a8ab179a47";
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_API_TOKEN;
    const workersSubdomain = env.CF_WORKERS_SUBDOMAIN;
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "CNAME",
        name: domain,
        content: `${workerName}.${workersSubdomain}.workers.dev`,
        proxied: true
      })
    });
    const dnsJson = await dnsRes.json();
    if (!dnsJson.success) {
      return createErrorResponse("DNS error: " + JSON.stringify(dnsJson.errors), 500);
    }
    const domainRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostname: domain,
          service: workerName
        })
      }
    );
    const domainJson = await domainRes.json();
    if (!domainJson.success) {
      return createErrorResponse("Domain error: " + JSON.stringify(domainJson.errors), 500);
    }
    sandbox.customDomain = `https://${domain}`;
    sandbox.domainCreated = (/* @__PURE__ */ new Date()).toISOString();
    await env.BINDING_NAME.put(`sandbox:${userToken}`, JSON.stringify(sandbox));
    return createResponse(
      JSON.stringify({
        success: true,
        url: `https://${domain}`,
        workerUrl: sandbox.endpoint,
        message: "Custom domain created for persistent sandbox"
      }),
      200
    );
  } catch (e) {
    return createErrorResponse("Domain creation error: " + e.message, 500);
  }
}, "handleCreateSandboxDomain");
var handleGetSandboxInfo = /* @__PURE__ */ __name(async (request, env) => {
  try {
    const url = new URL(request.url);
    const userToken = url.searchParams.get("userToken");
    if (!userToken) {
      return createErrorResponse("Missing userToken parameter", 400);
    }
    const sandboxData = await env.BINDING_NAME.get(`sandbox:${userToken}`);
    if (!sandboxData) {
      return createResponse(
        JSON.stringify({
          exists: false,
          message: "No sandbox found for this user token"
        }),
        200
      );
    }
    const sandbox = JSON.parse(sandboxData);
    return createResponse(
      JSON.stringify({
        exists: true,
        sandbox: {
          workerName: sandbox.workerName,
          endpoint: sandbox.endpoint,
          customDomain: sandbox.customDomain || null,
          lastUpdated: sandbox.lastUpdated,
          domainCreated: sandbox.domainCreated || null
        }
      }),
      200
    );
  } catch (e) {
    return createErrorResponse("Error retrieving sandbox info: " + e.message, 500);
  }
}, "handleGetSandboxInfo");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    console.log("\u{1F50D} API Worker Request:", {
      method: request.method,
      pathname,
      fullUrl: request.url,
      origin: request.headers.get("Origin"),
      userAgent: request.headers.get("User-Agent"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (pathname === "/createknowledgegraph" && request.method === "GET") {
      return await handleCreateKnowledgeGraph(request, env);
    }
    if (pathname === "/save" && request.method === "POST") {
      return await handleSave(request, env);
    }
    if (pathname.startsWith("/view/") && request.method === "GET") {
      return await handleView(request, env);
    }
    if (pathname === "/blog-posts" && request.method === "GET") {
      return await handleBlogPosts(request, env);
    }
    if (pathname === "/hidden-blog-posts" && request.method === "GET") {
      return await handleBlogPosts(request, env, true);
    }
    if (pathname.startsWith("/blogpostdelete/") && request.method === "DELETE") {
      return await handleBlogPostDelete(request, env);
    }
    if (pathname === "/snippetadd" && request.method === "POST") {
      return await handleSnippetAdd(request, env);
    }
    if (pathname.startsWith("/snippets/") && request.method === "GET") {
      return await handleSnippetGet(request, env);
    }
    if (pathname === "/snippetlist" && request.method === "GET") {
      return await handleSnippetList(request, env);
    }
    if (pathname.startsWith("/snippetdelete") && request.method === "DELETE") {
      return await handleSnippetDelete(request, env);
    }
    if (pathname === "/upload" && request.method === "POST") {
      return await handleUpload(request, env);
    }
    if (pathname === "/search" && request.method === "GET") {
      return await handleSearch(request, env);
    }
    if (pathname === "/hid_vis" && request.method === "POST") {
      return await handleToggleVisibility(request, env);
    }
    if (pathname === "/getimage" && request.method === "GET") {
      return await handleGetImage(request, env);
    }
    if (pathname === "/getcorsimage" && request.method === "GET") {
      return await handleGetImageFromR2(request, env);
    }
    if (pathname === "/getcorsimage" && request.method === "HEAD") {
      return await handleGetImageHeaders(request, env);
    }
    if (pathname === "/summarize" && request.method === "POST") {
      return await handleSummarize(request, env);
    }
    if (pathname === "/groktest" && request.method === "POST") {
      return await handleGrokTest(request, env);
    }
    if (pathname === "/gemini-test" && request.method === "POST") {
      return await handleGeminiTest(request, env);
    }
    if (pathname === "/aiaction" && request.method === "POST") {
      return await handleAIAction(request, env);
    }
    if (pathname === "/getGoogleApiKey" && request.method === "GET") {
      return await handleGetGoogleApiKey(request, env);
    }
    if (pathname === "/updatekml" && request.method === "POST") {
      return await handleUpdateKml(request, env);
    }
    if (pathname === "/suggest-title" && request.method === "POST") {
      return await handleSuggestTitle(request, env);
    }
    if (pathname === "/suggest-description" && request.method === "POST") {
      return await handleSuggestDescription(request, env);
    }
    if (pathname === "/suggest-categories" && request.method === "POST") {
      return await handleSuggestCategories(request, env);
    }
    if (pathname === "/grok-issue-description" && request.method === "POST") {
      return await handleGrokIssueDescription(request, env);
    }
    if (pathname === "/generate-meta-areas" && request.method === "POST") {
      return await handleGenerateMetaAreas(request, env);
    }
    if (pathname === "/grok-ask" && request.method === "POST") {
      return await handleGrokAsk(request, env);
    }
    if (pathname === "/generate-header-image" && request.method === "POST") {
      return await handleGenerateHeaderImage(request, env);
    }
    if (pathname === "/generate-image-prompt" && request.method === "POST") {
      return await handleGenerateImagePrompt(request, env);
    }
    if (pathname === "/list-r2-images" && request.method === "GET") {
      return await handleListR2Images(request, env);
    }
    if (pathname === "/youtube-search" && request.method === "GET") {
      return await handleYouTubeSearch(request, env);
    }
    if (pathname.startsWith("/youtube-transcript-io/") && request.method === "GET") {
      return await handleYouTubeTranscriptIO(request, env);
    }
    if (pathname.startsWith("/downsub-transcript/") && request.method === "GET") {
      return await handleDownsubTranscript(request, env);
    }
    if (pathname === "/downsub-url-transcript" && request.method === "POST") {
      return await handleDownsubUrlTranscript(request, env);
    }
    if (pathname === "/mystmkrasave" && request.method === "POST") {
      return handleMystmkraProxy(request);
    }
    if (pathname === "/gpt4-vision-image" && request.method === "POST") {
      return await handleGPT4VisionImage(request, env);
    }
    if (pathname === "/save-approved-image" && request.method === "POST") {
      return await handleSaveApprovedImage(request, env);
    }
    if (pathname === "/ai-generate-node" && request.method === "POST") {
      return await handleAIGenerateNode(request, env);
    }
    if (pathname === "/process-transcript" && request.method === "POST") {
      return await handleProcessTranscript(request, env);
    }
    if (pathname === "/apply-style-template" && request.method === "POST") {
      return await handleApplyStyleTemplate(request, env);
    }
    if (pathname === "/style-templates" && request.method === "GET") {
      return await handleGetStyleTemplates(request, env);
    }
    if (pathname === "/pexels-search" && request.method === "POST") {
      return await handlePexelsImageSearch(request, env);
    }
    if (pathname === "/google-photos-auth" && request.method === "POST") {
      return await handleGooglePhotosAuth(request, env);
    }
    if (pathname === "/google-photos-search" && request.method === "POST") {
      return await handleGooglePhotosSearch(request);
    }
    if (pathname === "/google-photos-recent" && request.method === "POST") {
      return await handleGooglePhotosRecent(request);
    }
    if (pathname === "/auth/google/callback.html" && request.method === "GET") {
      console.log("\u2705 OAuth Callback Route Matched!", {
        pathname,
        method: request.method,
        queryParams: url.searchParams.toString()
      });
      return await handleGoogleOAuthCallback();
    }
    if (url.pathname === "/create-custom-domain") {
      return await handleCreateCustomDomain(request, env);
    }
    if (url.pathname === "/delete-custom-domain") {
      return await handleDeleteCustomDomain(request, env);
    }
    if (pathname === "/rag/analyze-graph" && request.method === "POST") {
      return await handleRAGProxyRequest(request, "/analyze-graph", env);
    }
    if (pathname === "/rag/create-index" && request.method === "POST") {
      return await handleRAGProxyRequest(request, "/create-rag-index", env);
    }
    if (pathname === "/rag/create-sandbox" && request.method === "POST") {
      return await handleRAGProxyRequest(request, "/create-rag-sandbox", env);
    }
    if (pathname === "/rag/list-sandboxes" && request.method === "GET") {
      return await handleRAGProxyRequest(request, "/list-sandboxes", env);
    }
    if (pathname === "/deploy-sandbox" && request.method === "POST") {
      return await handleDeploySandbox(request, env);
    }
    if (pathname === "/create-sandbox-domain" && request.method === "POST") {
      return await handleCreateSandboxDomain(request, env);
    }
    if (pathname === "/get-sandbox-info" && request.method === "GET") {
      return await handleGetSandboxInfo(request, env);
    }
    console.log("\u274C No route matched, returning 404:", {
      pathname,
      method: request.method,
      availableRoutes: [
        "/auth/google/callback.html",
        "/google-photos-auth",
        "/google-photos-search",
        "/google-photos-recent",
        "/rag/analyze-graph",
        "/rag/create-index",
        "/rag/create-sandbox",
        "/rag/list-sandboxes",
        "/deploy-sandbox",
        "/create-sandbox-domain",
        "/get-sandbox-info"
        // ... other routes
      ]
    });
    return createErrorResponse("Not Found", 404);
  }
};

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-7HcNyZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-7HcNyZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
// @license MIT
//# sourceMappingURL=index.js.map
