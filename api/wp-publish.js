// Vercel Serverless Function for /api/wp-publish (100% Self-Contained Pure JS)
const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const SCRAPER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const WP_EMPLOYEE_AUTHOR_MAP = [
  { code: 'M2001', wpUserId: 2, wpUsername: 'Ly', displayName: 'Ms Ly (M2001)', staffUsername: 'MS.LY' },
  { code: 'H2000', wpUserId: 3, wpUsername: 'Huyen', displayName: 'Ms Huyen (H2000)', staffUsername: 'MS.HUYEN' },
  { code: 'H0088', wpUserId: 4, wpUsername: 'Hiep', displayName: 'Hiep MS (H0088)', staffUsername: 'MSHIEP' },
  { code: 'A0005', wpUserId: 5, wpUsername: 'Nhi', displayName: 'Ms Nhi (A0005)', staffUsername: 'MS.NHI' },
  { code: 'A0006', wpUserId: 6, wpUsername: 'adgoole', displayName: 'Mr Google (A0006)', staffUsername: 'Quản Lý (Admin)' },
  { code: 'H0082', wpUserId: 1, wpUsername: 'admin', displayName: 'Admin (H0082)', staffUsername: 'Admin' },
];

let cachedPublishSession = null;

function fetchWithTimeout(url, options = {}, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#038;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html) {
  if (!html) return '';
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function resolveWpUserIdByEmployeeCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.code === clean);
  return found ? found.wpUserId : 6;
}

function resolveEmployeeByWpUserId(wpUserId) {
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.wpUserId === Number(wpUserId));
  return (
    found || {
      code: 'A0006',
      wpUserId: Number(wpUserId) || 6,
      wpUsername: 'adgoole',
      displayName: 'Mr Google (A0006)',
      staffUsername: 'Quản Lý (Admin)',
    }
  );
}

function resolveAbsUrl(rawUrl, baseUrl) {
  const cleaned = String(rawUrl || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return '';
  try {
    return new URL(cleaned, baseUrl).href;
  } catch {
    return '';
  }
}

function isIgnorableImage(url) {
  const lower = String(url || '').toLowerCase();
  if (
    !lower ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('gravatar.com') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('emoji') ||
    lower.includes('smilies') ||
    lower.includes('favicon') ||
    lower.includes('site-logo') ||
    lower.includes('custom-logo') ||
    lower.includes('pixel') ||
    lower.includes('analytics') ||
    lower.includes('doubleclick') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('google-analytics') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.') ||
    lower.includes('lazyload') ||
    lower.includes('placeholder')
  ) {
    return true;
  }
  const tinyMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyMatch) {
    const w = Number(tinyMatch[1]);
    const h = Number(tinyMatch[2]);
    if (w < 150 && h < 150) return true;
  }
  return false;
}

function pickBestSrcFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const cleanedSrcset = String(srcset).replace(/data:image\/[^,\s]+,[^\s,]+/gi, '');
  const candidates = [];
  for (const part of cleanedSrcset.split(',')) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0] || tokens[0].startsWith('data:')) continue;
    const u = resolveAbsUrl(tokens[0], baseUrl);
    if (!u || isIgnorableImage(u)) continue;
    let width = 0;
    if (tokens[1] && tokens[1].endsWith('w')) {
      width = parseInt(tokens[1].slice(0, -1), 10) || 0;
    } else if (tokens[1] && tokens[1].endsWith('x')) {
      width = (parseFloat(tokens[1].slice(0, -1)) || 1) * 600;
    }
    candidates.push({ url: u, width });
  }
  if (candidates.length === 0) return '';
  candidates.sort((a, b) => {
    const scoreA = a.width >= 500 && a.width <= 1800 ? a.width + 2000 : a.width;
    const scoreB = b.width >= 500 && b.width <= 1800 ? b.width + 2000 : b.width;
    return scoreB - scoreA;
  });
  return candidates[0].url;
}

function collectImgsFromHtml(htmlChunk, baseUrl) {
  const list = [];
  const sourceRegex = /<source\b[^>]*>/gi;
  let sm;
  while ((sm = sourceRegex.exec(htmlChunk)) !== null) {
    const tag = sm[0];
    const ss =
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (ss && ss[1]) {
      const best = pickBestSrcFromSrcset(ss[1], baseUrl);
      if (best && !isIgnorableImage(best)) {
        list.push({ url: best, alt: '' });
      }
    }
  }

  const imgRegex = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(htmlChunk)) !== null) {
    const tag = m[0];
    const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const hMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (wMatch && hMatch) {
      const w = Number(wMatch[1]);
      const h = Number(hMatch[1]);
      if (w > 10 && h > 10 && w < 110 && h < 110) continue;
    }

    const ssMatches = [
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i),
      tag.match(/\bdata-srcset=["']([^"']+)["']/i),
      tag.match(/\bsrcset=["']([^"']+)["']/i),
    ];
    let chosen = '';
    for (const ss of ssMatches) {
      if (ss && ss[1]) {
        const cand = pickBestSrcFromSrcset(ss[1], baseUrl);
        if (cand && !isIgnorableImage(cand)) {
          chosen = cand;
          break;
        }
      }
    }

    if (!chosen) {
      const srcCandidates = [
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i),
        tag.match(/\bdata-src=["']([^"']+)["']/i),
        tag.match(/\bdata-original=["']([^"']+)["']/i),
        tag.match(/\bdata-full-url=["']([^"']+)["']/i),
        tag.match(/\bdata-large_image=["']([^"']+)["']/i),
        tag.match(/\bdata-hi-res-src=["']([^"']+)["']/i),
        tag.match(/\bdata-orig-file=["']([^"']+)["']/i),
        tag.match(/\bdata-ezsrc=["']([^"']+)["']/i),
        tag.match(/\bdata-url=["']([^"']+)["']/i),
        tag.match(/\bsrc=["']([^"']+)["']/i),
      ];
      for (const sc of srcCandidates) {
        if (sc && sc[1] && !sc[1].trim().startsWith('data:')) {
          const resolved = resolveAbsUrl(sc[1], baseUrl);
          if (resolved && !isIgnorableImage(resolved)) {
            chosen = resolved;
            break;
          }
        }
      }
    }
    if (!chosen || isIgnorableImage(chosen)) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
    list.push({ url: chosen, alt });
  }

  const figLinkRegex =
    /<(?:figure|div)\b[^>]*class=["'][^"']*(?:wp-block-image|wp-caption|gallery-item|post-thumbnail|featured-image)[^"']*["'][^>]*>[\s\S]*?<a\b[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi;
  let flm;
  while ((flm = figLinkRegex.exec(htmlChunk)) !== null) {
    const resolved = resolveAbsUrl(flm[1], baseUrl);
    if (resolved && !isIgnorableImage(resolved)) {
      list.push({ url: resolved, alt: '' });
    }
  }

  return list;
}

function isTrackingOrLocalePathSegment(seg) {
  const s = String(seg || '').toLowerCase().trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(vn\d*|en\d*|us\d*|uk\d*|au\d*|ca\d*|amp|feed|print|page|embed|track)$/i.test(s)) {
    return true;
  }
  if (s.length <= 4 && /^[a-z]{1,3}\d{1,2}$/i.test(s)) return true;
  return false;
}

function humanizeUrlSlugToTitle(pathname) {
  const segs = String(pathname || '')
    .split('/')
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
    .filter((s) => s && !isTrackingOrLocalePathSegment(s));
  const best =
    segs.sort((a, b) => b.length - a.length)[0] ||
    String(pathname || '').split('/').filter(Boolean).pop() ||
    '';
  const cleaned = best.replace(/[-_]+/g, ' ').trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return '';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanScrapedTitle(rawTitle) {
  const decoded = decodeHtmlEntities(rawTitle || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded
    .replace(/\s+[|–—-]\s+[^|–—-]{2,35}\.(com|net|org|fun|vn|info|us|co\.uk)$/i, '')
    .trim();
}

function analyzeArticleSubjectAndContext(title, text, userKeyword, existingImages) {
  const fullText = decodeHtmlEntities(String(text || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const imgAltText = Array.isArray(existingImages)
    ? existingImages
        .map((im) => `${(im && im.alt) || ''} ${String((im && im.url) || '').split('/').pop() || ''}`)
        .join(' ')
    : '';
  const sample = fullText.slice(0, 4500);

  const stopWords = new Set([
    'There', 'The', 'This', 'That', 'These', 'Those', 'When', 'While', 'Where',
    'What', 'Who', 'Why', 'How', 'Proving', 'Looking', 'Taking', 'Channeling',
    'Addressing', 'Stepping', 'Enjoying', 'Sharing', 'Showing', 'Making', 'Soaking',
    'Confirming', 'Embracing', 'Walking', 'Strolling', 'Wearing', 'Smiling', 'Spotted',
    'Showcasing', 'Exiting', 'Following', 'Among', 'At', 'In', 'On', 'By', 'With',
    'From', 'For', 'After', 'Before', 'During', 'Despite', 'Between', 'Beyond',
    'Within', 'Without', 'Through', 'Throughout', 'Against', 'Around', 'Behind',
    'Inside', 'Outside', 'Under', 'Until', 'Upon', 'According', 'Speaking', 'Shielding',
    'Completing', 'Expecting', 'Running', 'Visiting', 'Both', 'Holding', 'Wrapping',
    'Hollywood', 'Caribbean', 'Barbados', 'London', 'West', 'North', 'South', 'East',
    'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California', 'Florida',
    'United', 'States', 'America', 'British', 'English', 'American', 'Great', 'Britain',
    'French', 'Riviera', 'Mediterranean', 'German', 'Italian', 'Spanish', 'Mexican',
    'Saint', 'Tropez', 'Cannes', 'Paris', 'Rome', 'Malibu', 'Hawaii', 'Manhattan',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter',
    'Facebook', 'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Sandy', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Anyone', 'But', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Recognize', 'Them', 'Her', 'Him',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Beverly', 'Hilton', 'Hills', 'Santa', 'Monica',
    'Stunning', 'Pregnant', 'Timeless', 'Beloved', 'Famous', 'Reality', 'Heartthrob', 'Icon',
    'Real', 'Housewives', 'Brat', 'Pack', 'Night', 'Heat', 'Glad', 'All', 'Over', 'Mark', 'Twain',
    'Morning', 'Show', 'France', 'Europe', 'European', 'Exclusive', 'Story', 'Highlights'
  ]);

  const stats = new Map();

  const companionRegex =
    /\b(?:with|alongside|beside)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|model|actress|actor)?\s*,?\s*([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set();
  let cm;
  while ((cm = companionRegex.exec(sample.slice(0, 800))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 3)
      .join(' ');
    if (cName.split(/\s+/).length >= 2) {
      companionSet.add(cName);
    }
  }

  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-z-]+){0,3})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|husband|wife|partner|boyfriend|girlfriend|mother|father|icon|legend|winner|daughter|son)(?:\s+[a-z-]+){0,2})\s*,?\s+([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 38;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  const regex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}){1,2})\b/g;
  let m;
  const textToScan = sample || `${title || ''} ${imgAltText}`;
  while ((m = regex.exec(textToScan)) !== null) {
    const rawName = m[1].trim();
    const parts = rawName.split(/\s+/);
    if (parts.some((p) => stopWords.has(p))) continue;
    if (parts.length < 2) continue;
    const candidate = parts.join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: m.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.count += 1;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  for (const [fullName, info] of stats.entries()) {
    const tokens = fullName.split(/\s+/);
    const lastName = tokens[tokens.length - 1];
    if (lastName && lastName.length >= 4) {
      const lastRegex = new RegExp(`\\b${lastName}\\b`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(24, (totalLastMentions - info.count) * 6);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 260 ? 38 : a[1].firstIdx < 500 ? 22 : 0;
    const leadBonusB = b[1].firstIdx < 260 ? 38 : b[1].firstIdx < 500 ? 22 : 0;
    const compPenaltyA = a[1].isCompanion ? -25 : 0;
    const compPenaltyB = b[1].isCompanion ? -25 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  const primaryPerson =
    rankedPeople[0] ||
    (userKeyword && String(userKeyword).trim()) ||
    String(title || '').split(/[:–—|-]/)[0].trim();

  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      info.firstIdx < 650 &&
      (info.count >= 2 || info.bioBoost > 0) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  const visualSceneText = `${title || ''} ${imgAltText} ${sample.slice(0, 1100)}`.toLowerCase();
  const outfitKeywords = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|tank\s+top|t-shirt|tee|shirt|top|jacket|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble))\b/gi;
  let om;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 3) {
      outfitKeywords.push(phrase);
    }
  }

  const openingScene = `${title || ''} ${imgAltText} ${sample.slice(0, 750)}`.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'notting hill',
    'west hollywood', 'london', 'malibu', 'new york', 'manhattan', 'miami',
    'bahamas', 'cabo', 'caribbean', 'cannes', 'paris', 'venice', 'beverly hills', 'los angeles'
  ];
  const locationKeywords = [];
  for (const loc of locationGlossary) {
    if (openingScene.includes(loc) && locationKeywords.length < 2) {
      locationKeywords.push(loc);
    }
  }

  const eventGlossary = [
    'bikini', 'swimsuit', 'bathing suit', 'yacht', 'beach', 'boat', 'pregnant',
    'pregnancy', 'baby bump', 'stroll', 'lunch', 'brunch', 'kiss', 'kisses',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday'
  ];
  const eventKeywords = [];
  for (const ev of eventGlossary) {
    if (
      openingScene.includes(ev) &&
      eventKeywords.length < 3 &&
      !outfitKeywords.some((o) => o.includes(ev))
    ) {
      eventKeywords.push(ev);
    }
  }

  const eventWords = [...outfitKeywords, ...locationKeywords, ...eventKeywords].slice(0, 6);

  const subjectDisplay = secondaryPerson
    ? `${primaryPerson} and ${secondaryPerson}`
    : primaryPerson;

  const combinedSearchQuery = [
    primaryPerson,
    secondaryPerson,
    outfitKeywords[0] || '',
    locationKeywords[0] || '',
    eventKeywords[0] || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    primaryPerson,
    secondaryPerson,
    outfitKeywords,
    locationKeywords,
    eventKeywords,
    eventWords,
    subjectDisplay,
    combinedSearchQuery: combinedSearchQuery || primaryPerson || title,
  };
}

async function searchExternalRelatedImages(rawQuery, limit = 6, excludeKeys = new Set(), contextProfile) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const effectiveProfile =
    contextProfile || analyzeArticleSubjectAndContext(cleanQuery, cleanQuery);

  const primaryPerson = (
    effectiveProfile.primaryPerson ||
    cleanQuery.split(/\s+/).slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = (effectiveProfile.secondaryPerson || '').trim();
  const outfitKeywords = effectiveProfile.outfitKeywords || [];
  const locationKeywords = effectiveProfile.locationKeywords || [];
  const eventKeywords = effectiveProfile.eventKeywords || [];
  const eventWords = effectiveProfile.eventWords || [];

  if (!primaryPerson && !cleanQuery) return [];

  const queries = [
    [primaryPerson, secondaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0], 'dailymail']
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, secondaryPerson, locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], eventKeywords[0]].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const outfitTokens = outfitKeywords
    .flatMap((w) => w.toLowerCase().split(/\s+/))
    .filter((t) => t.length >= 3);
  const locTokens = locationKeywords.map((w) => w.toLowerCase()).filter(Boolean);
  const evTokens = eventKeywords.map((w) => w.toLowerCase()).filter(Boolean);

  const scoredCandidates = [];
  const seen = new Set(excludeKeys);
  const seenMd5 = new Set();

  for (const q of uniqueQueries) {
    if (scoredCandidates.length >= Math.max(limit * 3, 10)) break;
    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
        q
      )}&setmkt=en-US&setlang=en-US&cc=US&first=1`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
            Cookie: '_EDGE_S=mkt=en-us; SRCHHPGUSR=SRCHLANG=en&WLS=2',
          },
        },
        4200
      );
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.matchAll(/m="(\{[^"]+\})"/g);
      for (const m of matches) {
        try {
          const obj = JSON.parse(decodeHtmlEntities(m[1]));
          const imgUrl = String(obj.murl || '').trim();
          if (!imgUrl || isIgnorableImage(imgUrl)) continue;
          if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(imgUrl)) continue;
          if (
            /gettyimages\.|alamy\.|shutterstock\.|istockphoto\.|dreamstime\.|depositphotos\.|123rf\.|pond5\.|prettylittlething\.|shein\.|ido\.org\.tw|tiktok\.com\/api/i.test(
              imgUrl
            )
          ) {
            continue;
          }

          const normKey = imgUrl
            .split('?')[0]
            .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
            .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
            .toLowerCase();
          if (seen.has(normKey)) continue;
          if (obj.md5 && seenMd5.has(String(obj.md5))) continue;

          const titleText = decodeHtmlEntities(String(obj.t || obj.desc || ''))
            .replace(/[\uE000-\uF8FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const purl = String(obj.purl || '');
          const hay = `${titleText} ${purl} ${imgUrl}`.toLowerCase();

          const hasFullPrimary =
            Boolean(primaryPerson) && hay.includes(primaryPerson.toLowerCase());
          const hasAllPTokens = pTokens.length > 0 && pTokens.every((tk) => hay.includes(tk));
          if (!hasFullPrimary && !hasAllPTokens) continue;

          let score = hasFullPrimary ? 60 : 45;

          if (secondaryPerson && hay.includes(secondaryPerson.toLowerCase())) score += 50;
          else if (sTokens.length > 0 && sTokens.every((tk) => hay.includes(tk))) score += 35;

          for (const ot of outfitTokens) {
            if (hay.includes(ot)) score += 22;
          }
          for (const lt of locTokens) {
            if (hay.includes(lt)) score += 25;
          }
          for (const et of evTokens) {
            if (hay.includes(et)) score += 15;
          }
          if (
            /dailymail\.|justjared\.|hawtcelebs\.|celebmafia\.|pagesix\.|usmagazine\.|people\.com|thesun\.|mirror\.co\.uk|backgrid/i.test(
              hay
            )
          ) {
            score += 30;
          }

          seen.add(normKey);
          if (obj.md5) seenMd5.add(String(obj.md5));

          scoredCandidates.push({
            url: imgUrl,
            alt: titleText || `${primaryPerson} - ${eventWords.join(' ')}`.trim(),
            isFeatured: false,
            isExternal: true,
            score,
            purl,
          });
        } catch {
          // ignore malformed item
        }
      }
    } catch {
      // ignore timeout/search errors
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score);
  const topPurl = scoredCandidates[0] && scoredCandidates[0].purl;
  if (topPurl) {
    for (const item of scoredCandidates) {
      if (item.purl && item.purl === topPurl) {
        item.score += 25;
      }
    }
    scoredCandidates.sort((a, b) => b.score - a.score);
  }

  return scoredCandidates.slice(0, limit).map(({ score: _s, purl: _p, ...rest }) => rest);
}

async function searchRelatedYouTubeVideos(rawQuery, limit = 2, contextProfile) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery && !(contextProfile && contextProfile.primaryPerson)) return [];

  const primaryPerson = (
    (contextProfile && contextProfile.primaryPerson) ||
    cleanQuery.split(/\s+/).slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = ((contextProfile && contextProfile.secondaryPerson) || '').trim();
  const eventWords = (contextProfile && contextProfile.eventWords) || [];

  const queries = [
    [primaryPerson, secondaryPerson, eventWords.slice(0, 2).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, eventWords.slice(0, 3).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
    cleanQuery.split(/\s+/).slice(0, 8).join(' '),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const eTokens = eventWords.map((w) => w.toLowerCase()).filter(Boolean);

  const candidates = [];
  const seen = new Set();

  for (const q of uniqueQueries) {
    if (candidates.length >= 12) break;
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const res = await fetchWithTimeout(
        searchUrl,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
          },
        },
        4200
      );
      if (!res.ok) continue;
      const html = await res.text();

      const rendererRegex =
        /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
      let match;
      while ((match = rendererRegex.exec(html)) !== null && candidates.length < 18) {
        const videoId = match[1];
        const rawTitle = decodeHtmlEntities(
          match[2]
            .replace(/\\u0026/g, '&')
            .replace(/\\"/g, '"')
            .trim()
        );
        if (!videoId || seen.has(videoId)) continue;

        const lowerTitle = rawTitle.toLowerCase();
        const hasPerson =
          (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) ||
          pTokens.some((tk) => lowerTitle.includes(tk));
        if (!hasPerson && candidates.length >= limit) continue;

        let score = 0;
        if (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) score += 50;
        else if (hasPerson) score += 25;

        if (secondaryPerson && lowerTitle.includes(secondaryPerson.toLowerCase())) score += 45;
        else if (sTokens.some((tk) => lowerTitle.includes(tk))) score += 20;

        for (const ew of eTokens) {
          if (lowerTitle.includes(ew)) score += 15;
        }

        seen.add(videoId);
        candidates.push({
          videoId,
          title: rawTitle,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          score,
        });
      }
    } catch {
      // ignore timeout
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

async function scrapeWebArticleForSeoRewrite(rawUrl) {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const parsedUrl = new URL(cleanUrl);
  const origin = parsedUrl.origin;

  let originalTitle = '';
  let originalExcerpt = '';
  const paragraphs = [];
  const images = [];
  const seenImgKeys = new Set();

  const addImage = (url, alt = '', isFeatured = false) => {
    const resolved = resolveAbsUrl(url, cleanUrl);
    if (!resolved || isIgnorableImage(resolved)) return;
    const key = resolved
      .split('?')[0]
      .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)$)/i, '')
      .toLowerCase();
    if (seenImgKeys.has(key)) return;
    seenImgKeys.add(key);
    images.push({
      url: resolved,
      alt: alt || originalTitle || 'Article Image',
      isFeatured,
      isExternal: false,
    });
  };

  const extractParagraphsFromHtml = (htmlChunk) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const txt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      if (txt.length >= 25 && !paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  };

  const parseWpPostObject = async (postJson) => {
    if (!postJson || !postJson.id) return;
    if (postJson.title && postJson.title.rendered) {
      originalTitle = cleanScrapedTitle(postJson.title.rendered);
    }
    if (postJson.excerpt && postJson.excerpt.rendered) {
      originalExcerpt = stripHtmlTags(postJson.excerpt.rendered);
    }
    const contentHtml = String((postJson.content && postJson.content.rendered) || '');
    extractParagraphsFromHtml(contentHtml);
    const contentImgs = collectImgsFromHtml(contentHtml, cleanUrl);
    for (const img of contentImgs) {
      addImage(img.url, img.alt || originalTitle, images.length === 0);
    }

    const embeddedMedia =
      postJson._embedded &&
      postJson._embedded['wp:featuredmedia'] &&
      postJson._embedded['wp:featuredmedia'][0];
    const featUrl =
      (embeddedMedia &&
        embeddedMedia.media_details &&
        embeddedMedia.media_details.sizes &&
        embeddedMedia.media_details.sizes.full &&
        embeddedMedia.media_details.sizes.full.source_url) ||
      (embeddedMedia &&
        embeddedMedia.media_details &&
        embeddedMedia.media_details.sizes &&
        embeddedMedia.media_details.sizes.large &&
        embeddedMedia.media_details.sizes.large.source_url) ||
      (embeddedMedia && embeddedMedia.source_url) ||
      '';
    if (featUrl && (contentImgs.length === 0 || !/\bcollage[-_\d]/i.test(featUrl))) {
      addImage(featUrl, originalTitle, images.length === 0);
    }

    if (images.length < 5 && postJson.id) {
      try {
        const mediaRes = await fetchWithTimeout(
          `${origin}/wp-json/wp/v2/media?parent=${postJson.id}&per_page=20`,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (mediaRes.ok) {
          const mediaList = await mediaRes.json();
          if (Array.isArray(mediaList)) {
            for (const mItem of mediaList) {
              const mUrl =
                (mItem &&
                  mItem.media_details &&
                  mItem.media_details.sizes &&
                  mItem.media_details.sizes.full &&
                  mItem.media_details.sizes.full.source_url) ||
                (mItem &&
                  mItem.media_details &&
                  mItem.media_details.sizes &&
                  mItem.media_details.sizes.large &&
                  mItem.media_details.sizes.large.source_url) ||
                (mItem && mItem.source_url) ||
                '';
              if (mUrl && !/\bcollage[-_\d]/i.test(mUrl)) {
                addImage(
                  mUrl,
                  decodeHtmlEntities((mItem && mItem.alt_text) || (mItem && mItem.title && mItem.title.rendered) || originalTitle),
                  images.length === 0
                );
              }
            }
          }
        }
      } catch {}
    }
  };

  const pathSegs = parsedUrl.pathname.split('/').filter(Boolean);
  const numericId =
    pathSegs.length > 0 && /^\d+$/.test(pathSegs[0])
      ? Number(pathSegs[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p'))
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  const slugCandidates = pathSegs
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
    .filter((s) => s && !isTrackingOrLocalePathSegment(s))
    .sort((a, b) => b.length - a.length);
  const lastSlugSeg = slugCandidates[0] || '';

  const tryFetchWpRestPost = async (apiEndpoint) => {
    try {
      const wpRes = await fetchWithTimeout(
        apiEndpoint.includes('_embed')
          ? apiEndpoint
          : `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}_embed`,
        { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
        4500
      );
      if (!wpRes.ok) return;
      const data = await wpRes.json();
      if (Array.isArray(data) && data.length > 0) {
        await parseWpPostObject(data[0]);
      } else if (data && data.id) {
        await parseWpPostObject(data);
      }
    } catch {
      // fallback to HTML
    }
  };

  if (numericId) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericId}?_embed`);
  } else if (lastSlugSeg) {
    await tryFetchWpRestPost(
      `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSlugSeg)}&_embed`
    );
    if (images.length === 0 && paragraphs.length === 0) {
      const searchQ = lastSlugSeg.replace(/[-_]+/g, ' ').trim();
      if (searchQ.length >= 5) {
        await tryFetchWpRestPost(
          `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchQ)}&per_page=1&_embed`
        );
        if (images.length === 0 && paragraphs.length === 0) {
          const shortQ = searchQ.split(/\s+/).slice(0, 5).join(' ');
          if (shortQ && shortQ !== searchQ) {
            await tryFetchWpRestPost(
              `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(shortQ)}&per_page=1&_embed`
            );
          }
        }
      }
    }
  }

  if (paragraphs.length === 0 || images.length === 0 || !originalTitle) {
    try {
      const pageRes = await fetchWithTimeout(
        cleanUrl,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        },
        4500
      );

      if (pageRes.ok) {
        const html = await pageRes.text();

        const wpJsonLink = html.match(
          /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
        );
        const shortlinkId = html.match(/<link[^>]+rel=["']shortlink["'][^>]+href=["'][^"']*\?p=(\d+)["']/i);
        const postClassId = html.match(/\bpostid-(\d+)\b/i);

        if (images.length === 0) {
          if (wpJsonLink && wpJsonLink[1]) {
            await tryFetchWpRestPost(resolveAbsUrl(wpJsonLink[1], cleanUrl));
          } else if ((shortlinkId && shortlinkId[1]) || (postClassId && postClassId[1])) {
            const pid = (shortlinkId && shortlinkId[1]) || (postClassId && postClassId[1]);
            await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${pid}?_embed`);
          }
        }

        if (images.length === 0 || paragraphs.length === 0 || !originalTitle) {
          if (!originalTitle) {
            const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
            const ogTitle =
              html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
              html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (h1Match && stripHtmlTags(h1Match[1]).length > 10) {
              originalTitle = cleanScrapedTitle(h1Match[1]);
            } else if (ogTitle && ogTitle[1]) {
              originalTitle = cleanScrapedTitle(ogTitle[1]);
            }
          }

          if (!originalExcerpt) {
            const ogDesc =
              html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (ogDesc && ogDesc[1]) {
              originalExcerpt = decodeHtmlEntities(ogDesc[1]);
            }
          }

          const ogImg =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
          if (ogImg && ogImg[1] && !/\bcollage[-_\d]/i.test(ogImg[1])) {
            addImage(ogImg[1], originalTitle, images.length === 0);
          }

          const cleanBody = html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
            .replace(
              /<(div|section|ul)\b[^>]+(class|id)=["'][^"']*(related|yarpp|sharedaddy|jp-relatedposts|post-navigation|comments-area|sidebar|widget|more-posts|popular-posts|recent-posts)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
              ''
            );

          let primaryZone = cleanBody;
          const articleTagMatch = cleanBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
          if (articleTagMatch && articleTagMatch[1]) {
            primaryZone = articleTagMatch[1];
          } else {
            const contentDivStart = cleanBody.search(
              /<div\b[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content|single-content|article-body|story-body)[^"']*["'][^>]*>/i
            );
            if (contentDivStart !== -1) {
              primaryZone = cleanBody.slice(contentDivStart, contentDivStart + 120000);
            } else {
              const mainMatch = cleanBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
              if (mainMatch && mainMatch[1]) primaryZone = mainMatch[1];
            }
          }

          extractParagraphsFromHtml(primaryZone);
          for (const img of collectImgsFromHtml(primaryZone, cleanUrl)) {
            addImage(img.url, img.alt || originalTitle, images.length === 0);
          }
          if (images.length < 2) {
            for (const img of collectImgsFromHtml(cleanBody, cleanUrl)) {
              addImage(img.url, img.alt || originalTitle, images.length === 0);
            }
          }
        }
      }
    } catch {
      // Fallback to slug title
    }
  }

  if (!originalTitle) {
    originalTitle = humanizeUrlSlugToTitle(parsedUrl.pathname) || 'Exclusive Celebrity Story';
  }

  return {
    sourceUrl: cleanUrl,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    originalTitle,
    originalExcerpt,
    articleText: paragraphs.join('\n\n'),
    images: images.slice(0, 20),
  };
}

function normalizeParagraphToAround150Words(baseText, subject, title, language, sectionIdx) {
  const clean = stripHtmlTags(baseText).replace(/\s+/g, ' ').trim();

  const enElaborations = [
    `Throughout the unfolding moments surrounding ${subject}, long-time followers and entertainment observers have pointed out how naturally these details resonate with audiences worldwide. Every candid frame and subtle interaction adds another layer of authenticity to "${title}", demonstrating why genuine human connection continues to stand out in modern celebrity culture. Readers following the story have shared hundreds of thoughtful perspectives across social platforms, praising the relaxed confidence, timeless poise, and unmistakable warmth captured throughout the occasion.`,
    `Looking closer at the broader context of ${subject}, industry insiders note that moments like this rarely happen in isolation; instead, they reflect years of personal growth, evolving priorities, and a conscious desire to balance public expectations with private fulfillment. Whether stepping away from high-pressure production schedules or simply enjoying unscripted time with loved ones, the narrative around "${title}" highlights a refreshing shift toward mindfulness and grounded living that fans deeply admire.`,
    `From a visual and storytelling standpoint, the atmosphere surrounding ${subject} offers a vivid contrast to the carefully choreographed appearances typically seen at major red-carpet premieres and press tours. Observers quickly noticed the effortless styling, natural lighting, and relaxed body language that made the entire outing feel both cinematic and deeply relatable. It is precisely this blend of star power and everyday simplicity that keeps "${title}" trending across entertainment circles.`,
    `Furthermore, cultural commentators emphasize that public fascination with ${subject} stems from a genuine appreciation for resilience and authenticity in the spotlight. Over the years, audiences have grown increasingly drawn to stories that celebrate real companionship, quiet confidence, and meaningful milestones rather than fleeting headlines. As discussions around "${title}" continue to gain momentum, admirers everywhere are reminded of the enduring appeal of sincerity both on and off the screen.`,
  ];

  const viElaborations = [
    `Nhìn lại toàn bộ những khoảnh khắc xoay quanh ${subject}, đông đảo khán giả và giới quan sát giải trí đều nhận thấy sự chân thực, gần gũi hiếm có trong từng khung hình. Từng cử chỉ tự nhiên và thần thái rạng rỡ trong câu chuyện "${title}" đã tạo nên sức hút mạnh mẽ trên khắp các diễn đàn mạng xã hội, chứng minh rằng chính những giá trị cảm xúc đời thường mới là điều chạm đến trái tim người hâm mộ một cách bền vững nhất.`,
    `Đặt trong bối cảnh rộng hơn về hành trình của ${subject}, nhiều chuyên gia truyền thông đánh giá rằng những khoảnh khắc thư thái này phản ánh sự trưởng thành sâu sắc trong phong cách sống cũng như cách cân bằng giữa ánh hào quang và cuộc sống riêng tư. Thay vì những xuất hiện cầu kỳ trên thảm đỏ, câu chuyện "${title}" mang lại cảm giác bình yên, tinh tế và tràn đầy năng lượng tích cực cho người xem.`,
    `Xét dưới góc độ hình ảnh và sức lan tỏa truyền thông, từng chi tiết gắn liền với ${subject} đều toát lên vẻ đẹp tự nhiên, phóng khoáng nhưng vẫn giữ được dấu ấn riêng biệt. Ngay khi loạt hình ảnh và thông tin về "${title}" được đăng tải, hàng ngàn bình luận từ cộng đồng mạng đã bày tỏ sự ngưỡng mộ trước phong thái tự tin, giản dị và nguồn cảm hứng sống tích cực mà nhân vật mang lại.`,
    `Hơn thế nữa, sức hút bền bỉ của ${subject} trong lòng công chúng còn đến từ sự trân trọng những khoảnh khắc gắn kết chân thành bên những người thân yêu. Giữa nhịp sống sôi động của làng giải trí hiện đại, "${title}" giống như một lát cắt đầy cảm xúc, giúp khán giả hiểu thêm về những góc nhìn nhân văn, sâu lắng phía sau ống kính máy quay.`,
  ];

  const pool = language === 'vi' ? viElaborations : enElaborations;
  let combined = clean;
  let attempt = 0;

  while (combined.split(/\s+/).filter(Boolean).length < 138 && attempt < 4) {
    const addon = pool[(sectionIdx + attempt) % pool.length];
    combined = combined ? `${combined} ${addon}` : addon;
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 172) {
    const sliced = finalWords.slice(0, 162).join(' ');
    const lastDot = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
    if (lastDot > 550) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

function buildLongFormSeoArticle2000To5000Words({
  articleTitle,
  focusKeyword,
  sourceArticleText,
  images,
  youtubeVideos,
  language,
}) {
  const isVi = language === 'vi';
  const subject = focusKeyword || articleTitle.split(/[:–—|-]/)[0].trim() || 'the star';

  const rawParagraphs = [];
  if (sourceArticleText) {
    for (const line of String(sourceArticleText).split(/\n+/)) {
      const t = line.replace(/\s+/g, ' ').trim();
      if (t.length > 35 && !rawParagraphs.includes(t)) {
        rawParagraphs.push(t);
      }
    }
  }

  const sectionBlueprints = isVi
    ? [
        {
          h2: `1. Toàn cảnh câu chuyện: ${articleTitle}`,
          seeds: [
            `Câu chuyện xoay quanh "${articleTitle}" đang nhanh chóng trở thành một trong những chủ đề tâm điểm thu hút sự quan tâm lớn từ công chúng và người hâm mộ. Ngay từ những hình ảnh và thông tin đầu tiên xuất hiện, ${subject} đã gây ấn tượng mạnh mẽ bởi thần thái tự nhiên, cuốn hút cùng những khoảnh khắc đời thường đầy cảm xúc.`,
            `Không chỉ dừng lại ở một tin tức giải trí thông thường, những chi tiết xoay quanh ${subject} còn mở ra góc nhìn gần gũi và chân thực hơn về cuộc sống phía sau ánh đèn sân khấu. Sự kết hợp giữa phong thái tự tin và không gian thư giãn đã tạo nên một bức tranh sinh động khiến khán giả không ngừng bàn luận.`,
          ],
        },
        {
          h2: `2. Những khoảnh khắc đắt giá và chi tiết ấn tượng nhất`,
          seeds: [
            `Đi sâu vào từng khoảnh khắc được ghi lại, người xem dễ dàng nhận thấy sự thoải mái và năng lượng tích cực toả ra từ ${subject}. Từng cử chỉ nhỏ, ánh nhìn cho đến nụ cười rạng rỡ đều phản ánh một tâm thế bình yên, tận hưởng trọn vẹn từng giây phút bên cạnh những người thân thiết.`,
            `Nhiều người hâm mộ tinh ý nhận ra rằng chính sự giản dị, không phô trương trong cách xuất hiện của ${subject} lại tạo nên sức hút đặc biệt. Mỗi khung hình trong bài viết đều mang màu sắc tự nhiên, chân thật như một thước phim đời thường sống động.`,
          ],
        },
        {
          h2: `3. Phong cách, thần thái và dấu ấn cá nhân của ${subject}`,
          seeds: [
            `Bên cạnh câu chuyện chính, phong cách thời trang và thần thái của ${subject} trong dịp này cũng nhận được vô số lời khen ngợi từ các tạp chí đời sống và cộng đồng mạng. Sự lựa chọn trang phục tinh tế, hài hòa với bối cảnh giúp tôn lên vẻ đẹp khỏe khoắn, thanh lịch và đầy cuốn hút.`,
            `Qua nhiều năm hoạt động, ${subject} luôn biết cách làm mới hình ảnh của mình mà vẫn giữ trọn vẹn bản sắc cá nhân. Dù xuất hiện tại các sự kiện lớn hay trong những chuyến nghỉ dưỡng riêng tư, sức hút tự nhiên ấy vẫn luôn tỏa sáng rõ nét.`,
          ],
        },
        {
          h2: `4. Bối cảnh hậu trường và câu chuyện phía sau ống kính`,
          seeds: [
            `Ít ai biết rằng đằng sau những khoảnh khắc thư giãn được chia sẻ rộng rãi là cả một hành trình làm việc nghiêm túc và bền bỉ của ${subject}. Việc dành thời gian nghỉ ngơi, tái tạo năng lượng và tận hưởng không gian riêng tư đóng vai trò vô cùng quan trọng để duy trì sự cân bằng trong cuộc sống.`,
            `Những nguồn tin thân cận cho biết ${subject} luôn ưu tiên những khoảng lặng ý nghĩa bên gia đình, bạn bè và người đồng hành sau mỗi dự án dài hơi. Chính sự trân trọng những giá trị bình dị này đã giúp nhân vật giữ vững tinh thần lạc quan.`,
          ],
        },
        {
          h2: `5. Sự đồng hành, gắn kết và cảm xúc chân thành`,
          seeds: [
            `Một trong những điểm nhấn khiến khán giả đặc biệt yêu thích ở "${articleTitle}" chính là sự gắn kết ấm áp và tự nhiên giữa các nhân vật trong câu chuyện. Không cần những lời tuyên bố ồn ào, sự quan tâm tinh tế dành cho nhau qua từng hành động nhỏ đã nói lên tất cả.`,
            `Trong mắt công chúng, những khoảnh khắc sẻ chia giản dị như vậy luôn có sức lay động mạnh mẽ hơn bất kỳ kịch bản cầu kỳ nào. Đó cũng là lý do khiến câu chuyện về ${subject} nhanh chóng nhận được sự đồng cảm sâu sắc từ người đọc ở nhiều độ tuổi.`,
          ],
        },
        {
          h2: `6. Phản ứng bùng nổ từ người hâm mộ và cộng đồng mạng`,
          seeds: [
            `Ngay sau khi loạt hình ảnh và thông tin về "${articleTitle}" được lan truyền, hàng loạt diễn đàn giải trí và mạng xã hội đã ghi nhận lượng tương tác tăng vọt. Hàng ngàn bình luận bày tỏ sự yêu mến, chúc phúc cũng như ngưỡng mộ trước cuộc sống viên mãn, tự tại của ${subject}.`,
            `Nhiều khán giả lâu năm cũng chia sẻ lại những kỷ niệm và dấu ấn đáng nhớ trong sự nghiệp của ${subject}, tạo nên một làn sóng thảo luận sôi nổi và tích cực. Sự ủng hộ nồng nhiệt từ công chúng một lần nữa khẳng định vị trí vững chắc của nhân vật trong lòng người hâm mộ.`,
          ],
        },
        {
          h2: `7. Góc nhìn truyền thông và sức lan tỏa trong văn hóa đại chúng`,
          seeds: [
            `Dưới góc nhìn của các nhà phân tích truyền thông, sức hút từ câu chuyện "${articleTitle}" cho thấy xu hướng thưởng thức thông tin của độc giả hiện đại đang ngày càng hướng tới sự chân thực. Khán giả ngày nay yêu thích những hình ảnh đời thường, gần gũi và giàu cảm xúc thực tế của người nổi tiếng.`,
            `Sự xuất hiện của ${subject} trong bối cảnh tự nhiên không chỉ mang lại cảm giác dễ chịu cho người xem mà còn truyền tải thông điệp ý nghĩa về việc yêu thương bản thân, tận hưởng hiện tại và trân trọng từng khoảnh khắc quý giá của cuộc sống.`,
          ],
        },
        {
          h2: `8. Hành trình phát triển và những cột mốc đáng nhớ của ${subject}`,
          seeds: [
            `Nhìn lại chặng đường đã qua, ${subject} đã không ngừng nỗ lực để khẳng định tài năng và bản lĩnh qua từng giai đoạn. Mỗi cột mốc trong sự nghiệp cũng như trong cuộc sống cá nhân đều để lại dấu ấn sâu đậm nhờ sự nghiêm túc, cầu thị và niềm đam mê bền bỉ.`,
            `Chính nền tảng vững chắc đó đã giúp ${subject} luôn giữ được sự tự tin và phong độ ổn định trước mọi biến động. Người hâm mộ hoàn toàn có cơ sở để kỳ vọng vào những bước tiến mới đầy hứa hẹn của nhân vật trong thời gian tới.`,
          ],
        },
        {
          h2: `9. Tổng kết: Dư âm đẹp từ câu chuyện "${articleTitle}"`,
          seeds: [
            `Khép lại toàn bộ câu chuyện xoay quanh "${articleTitle}", điều đọng lại sâu sắc nhất trong lòng độc giả chính là nguồn năng lượng tích cực, sự bình yên và vẻ đẹp chân thực của ${subject}. Mỗi bức ảnh và từng chi tiết trong bài đều góp phần khắc họa một khoảnh khắc đáng nhớ.`,
            `Trong thời gian tới, chắc chắn những thông tin và hoạt động mới tiếp theo của ${subject} sẽ tiếp tục nhận được sự dõi theo nồng nhiệt từ khán giả. Hãy cùng xem thêm các hình ảnh minh họa chi tiết và 2 video liên quan đặc sắc ngay bên dưới để có góc nhìn trọn vẹn nhất.`,
          ],
        },
      ]
    : [
        {
          h2: `1. The Full Story Behind: ${articleTitle}`,
          seeds: [
            `The unfolding story surrounding "${articleTitle}" has quickly captured the imagination of entertainment readers and devoted fans alike. From the very first candid snapshots that surfaced online, ${subject} drew widespread admiration for projecting effortless warmth, genuine relaxation, and an unmistakable sense of joy that immediately stood out across social media feeds.`,
            `Beyond the initial headlines, a closer look at ${subject} during this memorable outing reveals why audiences remain so deeply connected to authentic, unscripted celebrity moments. Rather than a staged publicity appearance, every detail of the day reflected natural ease, companionship, and a refreshing break from the demands of the spotlight.`,
          ],
        },
        {
          h2: `2. Key Highlights and Unfiltered Candid Moments`,
          seeds: [
            `Examining the standout moments from "${articleTitle}", observers immediately noticed how relaxed and present ${subject} appeared throughout the entire experience. Every shared laugh, unhurried stroll, and sunlit backdrop contributed to an atmosphere of pure contentment that fans rarely get to witness in such vivid detail.`,
            `What makes these glimpses of ${subject} especially compelling is the complete absence of pretension. In an era dominated by heavily curated digital personas, seeing genuine spontaneity and real-life happiness unfold naturally creates an immediate emotional bond with readers everywhere.`,
          ],
        },
        {
          h2: `3. Effortless Style, Poise, and Visual Presence`,
          seeds: [
            `Style watchers and entertainment editors were equally quick to praise the effortless aesthetic displayed by ${subject} in "${articleTitle}". Combining comfort with timeless elegance, the look complemented the relaxed setting while showcasing the natural confidence and radiant energy that have long defined the star's public appeal.`,
            `Over the years, ${subject} has consistently demonstrated an innate ability to turn even the simplest off-duty outing into a masterclass in understated grace. Whether appearing on international red carpets or enjoying a quiet getaway, that signature poise remains unmistakable.`,
          ],
        },
        {
          h2: `4. Behind the Scenes: Balancing Fame and Personal Peace`,
          seeds: [
            `To truly appreciate the significance of "${articleTitle}", it helps to consider the demanding pace of ${subject}'s professional journey. Between rigorous production schedules, media commitments, and creative projects, carving out dedicated time to unwind and recharge away from cameras is essential for long-term well-being.`,
            `Those familiar with ${subject}'s approach to life and career often note a deliberate emphasis on protecting meaningful personal time. Stepping back to enjoy simple pleasures alongside trusted companions offers a vital sense of grounding that fuels both personal happiness and artistic longevity.`,
          ],
        },
        {
          h2: `5. Genuine Connection and Shared Companionship`,
          seeds: [
            `At the heart of "${articleTitle}" lies a warm portrait of companionship and mutual support. Throughout the outing, the natural chemistry and relaxed body language around ${subject} spoke volumes, illustrating how meaningful relationships thrive on quiet everyday moments rather than grand public gestures.`,
            `For fans following the story, seeing ${subject} surrounded by genuine warmth and affection proved especially heartwarming. It serves as a powerful reminder that behind global recognition and industry accolades, the most cherished chapters of life are built on trust, laughter, and shared presence.`,
          ],
        },
        {
          h2: `6. How Fans and Social Media Are Reacting Worldwide`,
          seeds: [
            `Within hours of "${articleTitle}" circulating online, fan communities and entertainment platforms lit up with thousands of supportive comments and reactions. Admirers from around the globe praised ${subject} for looking radiant, happy, and completely at ease, turning the story into one of the week's most uplifting trending topics.`,
            `Long-time supporters also took the opportunity to reflect on ${subject}'s enduring impact, sharing favorite memories and celebrating the positive energy evident in every photo. The overwhelmingly warm reception underscores the deep goodwill and respect the star has cultivated with audiences over time.`,
          ],
        },
        {
          h2: `7. Cultural Context and the Appeal of Authentic Stardom`,
          seeds: [
            `Media commentators observing the response to "${articleTitle}" point out a broader shift in how modern audiences engage with celebrity culture. Today's readers gravitate strongly toward stories that highlight real humanity, emotional honesty, and relatable lifestyle moments rather than manufactured drama.`,
            `By embracing a grounded, authentic way of living, ${subject} exemplifies the kind of modern stardom that resonates across generations. Every candid image from this chapter reinforces a message of balance, self-assurance, and appreciation for life's simple joys.`,
          ],
        },
        {
          h2: `8. Career Evolution and Lasting Legacy of ${subject}`,
          seeds: [
            `Looking at the bigger picture, "${articleTitle}" arrives during a fascinating chapter in the ongoing evolution of ${subject}. Through dedication, versatility, and an unwavering commitment to craft, the star has built a remarkable body of work that continues to inspire both peers and newcomers alike.`,
            `That hard-earned professional foundation allows ${subject} to navigate the entertainment world on their own terms, choosing projects and personal priorities with clarity and confidence. Fans eagerly anticipating what comes next can see that this sense of fulfillment sets the stage for even greater chapters ahead.`,
          ],
        },
        {
          h2: `9. Final Thoughts and Exclusive Video Highlights`,
          seeds: [
            `Ultimately, the enduring takeaway from "${articleTitle}" is a celebration of authenticity, joy, and well-deserved serenity for ${subject}. Every paragraph and photograph from this story captures a refreshing snapshot of life lived genuinely and wholeheartedly in the present moment.`,
            `As conversations around ${subject} continue to unfold, be sure to explore the complete gallery of original and supplemental photographs throughout this feature, along with the two related YouTube videos embedded below for deeper context and memorable highlights.`,
          ],
        },
      ];

  const finalParagraphs150Words = [];
  let rawCursor = 0;

  sectionBlueprints.forEach((sec, secIdx) => {
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const rawCandidate =
        rawCursor < rawParagraphs.length
          ? `${rawParagraphs[rawCursor]} ${sec.seeds[pIdx % sec.seeds.length]}`
          : sec.seeds[pIdx % sec.seeds.length];
      if (rawCursor < rawParagraphs.length) rawCursor++;

      const normalized150 = normalizeParagraphToAround150Words(
        rawCandidate,
        subject,
        articleTitle,
        language,
        secIdx * 3 + pIdx
      );

      finalParagraphs150Words.push({
        h2: pIdx === 0 ? sec.h2 : undefined,
        text: normalized150,
      });
    }
  });

  while (rawCursor < rawParagraphs.length && finalParagraphs150Words.length < 28) {
    const extraRaw = rawParagraphs[rawCursor++];
    const normalized150 = normalizeParagraphToAround150Words(
      extraRaw,
      subject,
      articleTitle,
      language,
      finalParagraphs150Words.length
    );
    finalParagraphs150Words.push({ text: normalized150 });
  }

  const htmlBlocks = [];
  const totalParas = finalParagraphs150Words.length;
  const imgStep =
    images.length > 0 ? Math.max(1, Math.floor(totalParas / (images.length + 1))) : 999;
  let imgIdx = 0;

  finalParagraphs150Words.forEach((item, idx) => {
    if (item.h2) {
      htmlBlocks.push(
        `<h2 style="margin: 30px 0 14px 0; font-weight: 800; line-height: 1.35;">${item.h2}</h2>`
      );
    }

    htmlBlocks.push(
      `<p style="margin: 0 0 22px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>\n<br />`
    );

    if (imgIdx < images.length && ((idx + 1) % imgStep === 0 || idx === totalParas - 2)) {
      const img = images[imgIdx++];
      const altText = String(img.alt || articleTitle).replace(/"/g, '&quot;');
      const sourceBadge = img.isExternal
        ? isVi
          ? 'Ảnh tư liệu mở rộng'
          : 'Editorial Visual Highlight'
        : isVi
        ? 'Hình ảnh trong bài'
        : 'Featured Story Moment';
      htmlBlocks.push(
        `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`
      );
    }
  });

  while (imgIdx < images.length) {
    const img = images[imgIdx++];
    const altText = String(img.alt || articleTitle).replace(/"/g, '&quot;');
    htmlBlocks.push(
      `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText}</figcaption>
</figure>`
    );
  }

  if (youtubeVideos.length > 0) {
    const headingText = isVi
      ? '🎬 Video Liên Quan Đáng Chú Ý'
      : '🎬 Related Videos & Exclusive Moments';

    htmlBlocks.push(`<h2 style="margin: 32px 0 16px 0; font-weight: 800;">${headingText}</h2>`);

    youtubeVideos.forEach((v, idx) => {
      const safeTitle = String(v.title || '').replace(/"/g, '&quot;');
      htmlBlocks.push(
        `<div class="wp-youtube-embed-box" style="margin: 20px 0 28px 0;">
  <p style="margin-bottom: 10px;"><strong>Video #${idx + 1}: ${v.title}</strong></p>
  <figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 12px 0;">
    <div class="wp-block-embed__wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
      <iframe src="https://www.youtube.com/embed/${v.videoId}" title="${safeTitle}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </figure>
  <p style="font-size: 13px; color: #475569;">👉 <a href="${v.watchUrl}" target="_blank" rel="noopener noreferrer">${
          isVi ? 'Xem trực tiếp trên YouTube' : 'Watch on YouTube'
        }: ${v.title}</a></p>
</div>`
      );
    });
  }

  const finalHtml = htmlBlocks.join('\n\n');
  const plainWords = stripHtmlTags(finalHtml).split(/\s+/).filter(Boolean).length;

  return {
    html: finalHtml,
    wordCount: plainWords,
    paragraphCount: finalParagraphs150Words.length,
  };
}

async function generateSeoArticleWithAiFast(params) {
  const language = params.language === 'vi' ? 'vi' : 'en';
  let scrapedImages = [];
  let sourceTitle = '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  const rawUrlCandidate = String(params.sourceUrl || '').trim() || String(params.topic || '').trim();
  const detectedUrlMatch = rawUrlCandidate.match(/https?:\/\/[^\s"'<>]+/i);
  const urlToScrape =
    params.mode === 'from_url'
      ? rawUrlCandidate
      : detectedUrlMatch
      ? detectedUrlMatch[0]
      : '';

  if (urlToScrape) {
    const scraped = await scrapeWebArticleForSeoRewrite(urlToScrape);
    scrapedImages = scraped.images;
    sourceTitle = scraped.originalTitle;
    sourceExcerpt = scraped.originalExcerpt;
    sourceArticleText = scraped.articleText;
    resolvedSourceUrl = scraped.sourceUrl;
  }

  if (params.existingContent) {
    const existingImgs = collectImgsFromHtml(String(params.existingContent), resolvedSourceUrl || DEFAULT_WP_SITE);
    const seen = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const ex of existingImgs) {
      const k = ex.url.split('?')[0].toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        scrapedImages.push({
          url: ex.url,
          alt: ex.alt || sourceTitle || 'Article Image',
          isFeatured: scrapedImages.length === 0,
          isExternal: false,
        });
      }
    }
  }

  const effectiveTopic =
    sourceTitle || String(params.topic || '').trim() || String(params.existingContent || '').slice(0, 120);
  const kw = String(params.keyword || '').trim() || effectiveTopic.split(/[:–—|-]/)[0].trim();

  const generatedTitle =
    sourceTitle ||
    String(params.topic || '').split('\n')[0].trim().slice(0, 95) ||
    'Exclusive Celebrity Story & Highlights';

  const generatedSlug = generatedTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  const generatedExcerpt =
    sourceExcerpt ||
    (sourceArticleText
      ? sourceArticleText.slice(0, 158)
      : `Read the full in-depth story on ${generatedTitle}.`);

  const contextProfile = analyzeArticleSubjectAndContext(
    generatedTitle,
    sourceArticleText || params.topic,
    params.keyword,
    scrapedImages
  );
  const generatedKeyword =
    (contextProfile.primaryPerson || kw).slice(0, 55) || 'Celebrity';
  const generatedTags = [
    contextProfile.primaryPerson || generatedKeyword,
    ...(contextProfile.secondaryPerson ? [contextProfile.secondaryPerson] : []),
    params.categoryName || 'Showbiz',
    'Entertainment',
    'Celeb24h',
  ];

  const existingKeys = new Set(scrapedImages.map((img) => img.url.split('?')[0].toLowerCase()));
  const searchTopicQuery =
    contextProfile.combinedSearchQuery || generatedKeyword || generatedTitle;

  // Trước tiên lấy HẾT ảnh trong bài viết ở link bài (scrapedImages).
  // Nếu số ảnh < 5 thì mới lấy thêm ảnh ngoài ĐÚNG DIỄN VIÊN & SỰ KIỆN TRONG BÀI cho đủ 5 đến 7 ảnh (6 ảnh). Nếu đã >= 5 ảnh thì thôi!
  const neededExternalCount =
    scrapedImages.length >= 5 ? 0 : Math.max(0, 6 - scrapedImages.length);

  const [externalImages, relatedVideos] = await Promise.all([
    neededExternalCount > 0
      ? searchExternalRelatedImages(
          searchTopicQuery,
          neededExternalCount,
          existingKeys,
          contextProfile
        )
      : Promise.resolve([]),
    searchRelatedYouTubeVideos(searchTopicQuery, 2, contextProfile),
  ]);

  const allCombinedImages = [...scrapedImages, ...externalImages];

  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    images: allCombinedImages,
    youtubeVideos: relatedVideos,
    language,
  });

  return {
    ok: true,
    mode: resolvedSourceUrl ? 'from_url' : 'from_text',
    sourceUrl: resolvedSourceUrl || undefined,
    title: generatedTitle,
    slug: generatedSlug,
    excerpt: generatedExcerpt,
    focusKeyword: generatedKeyword,
    searchQuery: searchTopicQuery,
    tags: generatedTags,
    contentHtml: longFormResult.html,
    wordCount: longFormResult.wordCount,
    paragraphCount: longFormResult.paragraphCount,
    featuredImageUrl:
      (scrapedImages[0] && scrapedImages[0].url) ||
      (allCombinedImages[0] && allCombinedImages[0].url) ||
      '',
    extractedImages: allCombinedImages,
    sourceImages: scrapedImages,
    externalImages,
    originalImageCount: scrapedImages.length,
    externalImageCount: externalImages.length,
    youtubeVideos: relatedVideos,
  };
}

async function getWpRestSession(forceRefresh = false) {
  if (!forceRefresh && cachedPublishSession && cachedPublishSession.expiresAt > Date.now()) {
    return cachedPublishSession;
  }

  const loginUrl = `${DEFAULT_WP_SITE}/wp-login.php`;
  const body = new URLSearchParams({
    log: DEFAULT_WP_USER,
    pwd: DEFAULT_WP_PASS,
    'wp-submit': 'Log In',
    redirect_to: `${DEFAULT_WP_SITE}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetchWithTimeout(
    loginUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
        'User-Agent': SCRAPER_USER_AGENT,
      },
      body: body.toString(),
      redirect: 'manual',
    },
    6000
  );

  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  const cookieHeader = rawCookies
    .map((c) => c.split(';')[0])
    .filter(
      (c) =>
        c.startsWith('wordpress_logged_in_') ||
        c.startsWith('wordpress_sec_') ||
        c.startsWith('wordpress_') ||
        c.startsWith('wp-settings-')
    )
    .join('; ');

  const postNewRes = await fetchWithTimeout(
    `${DEFAULT_WP_SITE}/wp-admin/post-new.php`,
    {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': SCRAPER_USER_AGENT,
      },
    },
    6000
  );
  const html = await postNewRes.text();
  const nonceMatch = html.match(/wpApiSettings\s*=\s*(\{[^;]+\})/);
  let restNonce = '';
  let restRoot = `${DEFAULT_WP_SITE}/wp-json/`;

  if (nonceMatch && nonceMatch[1]) {
    try {
      const parsed = JSON.parse(nonceMatch[1]);
      restNonce = parsed.nonce || '';
      restRoot = parsed.root || restRoot;
    } catch {}
  }

  cachedPublishSession = {
    cookieHeader,
    restNonce,
    restRoot: restRoot.endsWith('/') ? restRoot : `${restRoot}/`,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };

  return cachedPublishSession;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const session = await getWpRestSession();
      const headers = {
        Cookie: session.cookieHeader,
        'X-WP-Nonce': session.restNonce,
        'User-Agent': SCRAPER_USER_AGENT,
      };

      const [catRes, postsRes] = await Promise.all([
        fetchWithTimeout(`${session.restRoot}wp/v2/categories?per_page=50`, { headers }, 5500),
        fetchWithTimeout(
          `${session.restRoot}wp/v2/posts?_embed&per_page=25&status=publish,draft,future&context=edit`,
          { headers },
          5500
        ),
      ]);

      const rawCats = catRes.ok ? await catRes.json() : [];
      const categories = Array.isArray(rawCats)
        ? rawCats.map((c) => ({
            id: Number(c.id),
            name: decodeHtmlEntities(c.name || ''),
            slug: String(c.slug || ''),
            count: Number(c.count || 0),
          }))
        : [];

      const catMap = new Map();
      categories.forEach((c) => catMap.set(c.id, c.name));

      const rawPosts = postsRes.ok ? await postsRes.json() : [];
      const posts = Array.isArray(rawPosts)
        ? rawPosts.map((p) => {
            const authorInfo = resolveEmployeeByWpUserId(p.author);
            const catIds = Array.isArray(p.categories) ? p.categories.map(Number) : [];
            const embeddedMedia =
              p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0];
            const featuredImageUrl =
              (embeddedMedia && embeddedMedia.source_url) ||
              (embeddedMedia &&
                embeddedMedia.media_details &&
                embeddedMedia.media_details.sizes &&
                embeddedMedia.media_details.sizes.medium &&
                embeddedMedia.media_details.sizes.medium.source_url) ||
              '';
            return {
              id: Number(p.id),
              title: decodeHtmlEntities(
                typeof p.title === 'object' ? p.title.raw || p.title.rendered || '' : p.title || ''
              ),
              content:
                typeof p.content === 'object'
                  ? p.content.raw || p.content.rendered || ''
                  : p.content || '',
              excerpt: stripHtmlTags(
                typeof p.excerpt === 'object'
                  ? p.excerpt.raw || p.excerpt.rendered || ''
                  : p.excerpt || ''
              ),
              slug: String(p.slug || ''),
              status: p.status || 'publish',
              date: String(p.date || ''),
              modified: String(p.modified || ''),
              link: String(p.link || `${DEFAULT_WP_SITE}/${p.id}`),
              authorId: Number(p.author || 6),
              authorName: authorInfo.displayName,
              employeeCode: authorInfo.code,
              categories: catIds,
              categoryNames: catIds.map((id) => catMap.get(id) || `#${id}`),
              featuredMediaId: Number(p.featured_media || 0),
              featuredImageUrl,
            };
          })
        : [];

      return res.status(200).json({
        ok: true,
        siteUrl: DEFAULT_WP_SITE,
        categories,
        posts,
        authors: WP_EMPLOYEE_AUTHOR_MAP,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || 'publish');

      // 1. Xử lý Viết bài chuẩn SEO 2.000 - 5.000 từ + lấy hết ảnh + ảnh ngoài + 2 Video YouTube
      if (action === 'ai_write' || action === 'ai_generate') {
        const result = await generateSeoArticleWithAiFast({
          topic: String(body.topic || ''),
          keyword: body.keyword ? String(body.keyword) : undefined,
          language: body.language === 'vi' ? 'vi' : 'en',
          categoryName: body.categoryName ? String(body.categoryName) : undefined,
          mode: body.mode || 'from_url',
          sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
        });
        return res.status(200).json(result);
      }

      // 2. Xử lý tìm 2 Video YouTube liên quan
      if (action === 'search_youtube') {
        const query = String(body.query || '');
        const existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        const ctxProfile =
          body.articleText || body.title
            ? analyzeArticleSubjectAndContext(
                String(body.title || query),
                String(body.articleText || query),
                query,
                existingImgs
              )
            : undefined;
        const videos = await searchRelatedYouTubeVideos(
          (ctxProfile && ctxProfile.combinedSearchQuery) || query,
          Number(body.limit || 2),
          ctxProfile
        );
        return res.status(200).json({ ok: true, videos });
      }

      // 3. Xử lý tìm thêm ảnh ngoài
      if (action === 'search_external_images') {
        const query = String(body.query || '');
        const existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        const excludeKeys = new Set(
          existingImgs
            .map((im) =>
              String((im && im.url) || '')
                .split('?')[0]
                .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
                .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
                .toLowerCase()
            )
            .filter(Boolean)
        );
        const ctxProfile =
          body.articleText || body.title || existingImgs.length > 0
            ? analyzeArticleSubjectAndContext(
                String(body.title || query),
                String(body.articleText || query),
                query,
                existingImgs
              )
            : undefined;
        const images = await searchExternalRelatedImages(
          (ctxProfile && ctxProfile.combinedSearchQuery) || query,
          Number(body.limit || 6),
          excludeKeys,
          ctxProfile
        );
        return res.status(200).json({ ok: true, images });
      }

      const session = await getWpRestSession();

      // 4. Upload Media lên WordPress
      if (action === 'upload_media') {
        let buffer;
        let mimeType = 'image/jpeg';
        const finalFileName = body.fileName || `celeb24h-${Date.now()}.jpg`;
        if (body.base64Data) {
          const match = String(body.base64Data).match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
          );
          if (match) {
            mimeType = match[1];
            buffer = Buffer.from(match[2], 'base64');
          } else {
            buffer = Buffer.from(body.base64Data, 'base64');
          }
        } else if (body.imageUrl) {
          let refererOrigin = DEFAULT_WP_SITE;
          try {
            refererOrigin = `${new URL(String(body.imageUrl)).origin}/`;
          } catch {}
          const imgRes = await fetchWithTimeout(
            body.imageUrl,
            {
              headers: {
                'User-Agent': SCRAPER_USER_AGENT,
                Referer: refererOrigin,
                Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
              },
            },
            5000
          );
          const arr = await imgRes.arrayBuffer();
          buffer = Buffer.from(arr);
        }
        const uploadRes = await fetchWithTimeout(
          `${session.restRoot}wp/v2/media`,
          {
            method: 'POST',
            headers: {
              Cookie: session.cookieHeader,
              'X-WP-Nonce': session.restNonce,
              'Content-Type': mimeType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
            },
            body: new Uint8Array(buffer),
          },
          6000
        );
        const mediaJson = await uploadRes.json();
        return res.status(200).json({
          ok: uploadRes.ok,
          id: Number(mediaJson.id || 0),
          url: String(mediaJson.source_url || ''),
        });
      }

      // 5. Đẩy bài viết lên WordPress
      const empCode = String(body.employeeCode || 'A0006').trim().toUpperCase();
      const wpAuthorId = resolveWpUserIdByEmployeeCode(empCode);
      const pubTitle = String(body.title || '').trim();
      let pubContent = String(body.content || '').trim();
      let candidateImgs = Array.isArray(body.extractedImages)
        ? body.extractedImages.filter((im) => im && im.url)
        : [];

      if (!/<img\b/i.test(pubContent)) {
        if (candidateImgs.length === 0 && body.sourceUrl) {
          try {
            const scraped = await scrapeWebArticleForSeoRewrite(String(body.sourceUrl));
            candidateImgs = [...scraped.images];
          } catch {}
        }
        if (candidateImgs.length < 5) {
          try {
            const ctxProfile = analyzeArticleSubjectAndContext(
              pubTitle,
              pubContent,
              Array.isArray(body.tags) ? body.tags[0] : undefined,
              candidateImgs
            );
            const excludeKeys = new Set(
              candidateImgs.map((im) =>
                String(im.url || '')
                  .split('?')[0]
                  .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
                  .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
                  .toLowerCase()
              )
            );
            const needed = Math.max(0, 6 - candidateImgs.length);
            if (needed > 0) {
              const ext = await searchExternalRelatedImages(
                ctxProfile.combinedSearchQuery || pubTitle,
                needed,
                excludeKeys,
                ctxProfile
              );
              candidateImgs = [...candidateImgs, ...ext];
            }
          } catch {}
        }
        if (candidateImgs.length === 0 && body.featuredImageUrl) {
          candidateImgs = [{ url: String(body.featuredImageUrl), alt: pubTitle }];
        }
        if (candidateImgs.length > 0) {
          const figureBlocks = candidateImgs.map((img) => {
            const altText = String(img.alt || pubTitle).replace(/"/g, '&quot;');
            const sourceBadge = img.isExternal ? 'Editorial Visual Highlight' : 'Featured Story Moment';
            return `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
          });
          const pParts = pubContent.split(/(<\/p>\s*(?:<br\s*\/?>)?)/i);
          if (pParts.length < 3) {
            pubContent = `${figureBlocks[0]}\n\n${pubContent}\n\n${figureBlocks.slice(1).join('\n\n')}`;
          } else {
            const totalParas = Math.floor(pParts.length / 2);
            const step = Math.max(1, Math.floor(totalParas / (figureBlocks.length + 1)));
            let figIdx = 0;
            let paraCount = 0;
            const out = [];
            for (let i = 0; i < pParts.length; i++) {
              out.push(pParts[i]);
              if (i % 2 === 1) {
                paraCount++;
                if (figIdx < figureBlocks.length && (paraCount % step === 0 || paraCount === totalParas - 1)) {
                  out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
                }
              }
            }
            while (figIdx < figureBlocks.length) {
              out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
            }
            pubContent = out.join('');
          }
        }
      }

      const effectiveFeaturedUrl =
        body.featuredImageUrl || (candidateImgs[0] && candidateImgs[0].url) || '';

      let featuredMediaId = Number(body.featuredMediaId || 0);
      if (!featuredMediaId && (body.featuredImageBase64 || effectiveFeaturedUrl)) {
        try {
          let buffer = null;
          let mimeType = 'image/jpeg';
          if (body.featuredImageBase64) {
            const m = String(body.featuredImageBase64).match(
              /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
            );
            if (m) {
              mimeType = m[1];
              buffer = Buffer.from(m[2], 'base64');
            }
          } else if (effectiveFeaturedUrl) {
            let refererOrigin = DEFAULT_WP_SITE;
            try {
              refererOrigin = `${new URL(String(effectiveFeaturedUrl)).origin}/`;
            } catch {}
            const imgRes = await fetchWithTimeout(
              String(effectiveFeaturedUrl),
              {
                headers: {
                  'User-Agent': SCRAPER_USER_AGENT,
                  Referer: refererOrigin,
                  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                },
              },
              4500
            );
            if (imgRes.ok) {
              const ct = imgRes.headers.get('content-type');
              if (ct && ct.startsWith('image/')) mimeType = ct.split(';')[0];
              const arr = await imgRes.arrayBuffer();
              buffer = Buffer.from(arr);
            }
          }
          if (buffer) {
            const upRes = await fetchWithTimeout(
              `${session.restRoot}wp/v2/media`,
              {
                method: 'POST',
                headers: {
                  Cookie: session.cookieHeader,
                  'X-WP-Nonce': session.restNonce,
                  'Content-Type': mimeType,
                  'Content-Disposition': `attachment; filename="featured-${Date.now()}.jpg"`,
                },
                body: new Uint8Array(buffer),
              },
              5000
            );
            if (upRes.ok) {
              const upJson = await upRes.json();
              if (upJson && upJson.id) featuredMediaId = Number(upJson.id);
            }
          }
        } catch {
          // continue publishing even if featured image upload times out
        }
      }

      const postPayload = {
        title: pubTitle,
        content: pubContent,
        excerpt: String(body.excerpt || '').trim(),
        status: body.status || 'publish',
        author: wpAuthorId,
        categories:
          Array.isArray(body.categories) && body.categories.length > 0 ? body.categories : [2],
      };
      if (body.slug) postPayload.slug = body.slug;
      if (featuredMediaId) postPayload.featured_media = featuredMediaId;

      const endpoint = body.postId
        ? `${session.restRoot}wp/v2/posts/${body.postId}`
        : `${session.restRoot}wp/v2/posts`;

      const wpRes = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            Cookie: session.cookieHeader,
            'X-WP-Nonce': session.restNonce,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postPayload),
        },
        7000
      );
      const created = await wpRes.json();
      if (!wpRes.ok) {
        return res.status(wpRes.status).json({
          ok: false,
          error: (created && created.message) || 'Không thể đẩy bài lên WordPress',
        });
      }
      const cleanLink = String(created.link || `${DEFAULT_WP_SITE}/${created.id}`).replace(
        /\/+$/,
        ''
      );
      const trackingLink = empCode
        ? `${cleanLink}${cleanLink.includes('?') ? '&' : '?'}${empCode}`
        : cleanLink;

      return res.status(200).json({
        ok: true,
        post: {
          id: Number(created.id),
          title: postPayload.title,
          link: cleanLink,
          trackingLink,
          status: created.status || body.status || 'publish',
          slug: String(created.slug || ''),
          date: String(created.date || new Date().toISOString()),
          authorId: wpAuthorId,
          employeeCode: empCode,
        },
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Internal Server Error',
    });
  }
}
