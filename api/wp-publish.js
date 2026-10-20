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

const AD_BANNER_DIMENSIONS = new Set([
  '728x90', '970x90', '970x250', '468x60', '320x50', '320x100',
  '300x50', '300x100', '300x250', '336x280', '160x600', '120x600',
  '120x240', '300x600', '300x1050', '250x250', '200x200', '125x125',
  '180x150', '234x60', '88x31', '120x90', '120x60', '80x60',
  '100x70', '110x75', '120x80', '150x150', '218x150', '100x100', '80x80'
]);

function isIgnorableImage(url, altText = '', tagHtml = '') {
  const lower = String(url || '').toLowerCase().trim();
  if (
    !lower ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('gravatar.com') ||
    lower.includes('/wp-includes/') ||
    lower.includes('/wp-content/plugins/') ||
    lower.includes('/plugins/') ||
    lower.includes('/wp-content/themes/') ||
    lower.includes('/themes/') ||
    lower.includes('s.w.org/images/core/emoji') ||
    lower.includes('emoji') ||
    lower.includes('smilies') ||
    lower.includes('favicon') ||
    lower.includes('site-logo') ||
    lower.includes('header-logo') ||
    lower.includes('footer-logo') ||
    lower.includes('custom-logo') ||
    lower.includes('gdpr') ||
    lower.includes('cookie') ||
    lower.includes('/logo.') ||
    lower.includes('-logo.') ||
    lower.includes('_logo.') ||
    lower.includes('pixel') ||
    lower.includes('analytics') ||
    lower.includes('doubleclick') ||
    lower.includes('googlesyndication') ||
    lower.includes('googleads') ||
    lower.includes('googleadservices') ||
    lower.includes('adservice.google') ||
    lower.includes('2mdn.net') ||
    lower.includes('adsafeprotected') ||
    lower.includes('moatads') ||
    lower.includes('doubleverify') ||
    lower.includes('mgid.com') ||
    lower.includes('adskeeper') ||
    lower.includes('avplayer.com') ||
    lower.includes('taboola.com') ||
    lower.includes('outbrain.com') ||
    lower.includes('outbrainimg.com') ||
    lower.includes('revcontent.com') ||
    lower.includes('zergnet.com') ||
    lower.includes('teads.tv') ||
    lower.includes('criteo.') ||
    lower.includes('rubiconproject.') ||
    lower.includes('pubmatic.') ||
    lower.includes('openx.') ||
    lower.includes('adnxs.com') ||
    lower.includes('smartadserver.') ||
    lower.includes('kargo.com') ||
    lower.includes('gumgum.com') ||
    lower.includes('nativo.com') ||
    lower.includes('sharethrough.com') ||
    lower.includes('connatix.com') ||
    lower.includes('primis.tech') ||
    lower.includes('vidazoo.com') ||
    lower.includes('aniview.com') ||
    lower.includes('bidgear.com') ||
    lower.includes('valueimpression.com') ||
    lower.includes('ezoic.') ||
    lower.includes('ezodn.com') ||
    lower.includes('mediavine.com') ||
    lower.includes('adthrive.com') ||
    lower.includes('raptive.com') ||
    lower.includes('monumetric.com') ||
    lower.includes('sovrn.com') ||
    lower.includes('lijit.com') ||
    lower.includes('propellerads.') ||
    lower.includes('adsterra.') ||
    lower.includes('exoclick.') ||
    lower.includes('juicyads.') ||
    lower.includes('popads.') ||
    lower.includes('amazon-adsystem.com') ||
    lower.includes('assoc-amazon.com') ||
    lower.includes('impactradius.') ||
    lower.includes('skimresources.com') ||
    lower.includes('viglink.com') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('google-analytics') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.') ||
    lower.includes('lazyload') ||
    lower.includes('placeholder') ||
    lower.includes('loading.')
  ) {
    return true;
  }

  if (
    /\/(ads?|adv|advert|advertisement|advertising|banners?|sponsors?|sponsored|promo|promotions?|affiliate|popunder|popup|ad-inserter|advanced-ads|wp-quads|adrotate|admanager|dfp|gpt|prebid|mgid|taboola|outbrain|adsense|avplayer)(?:[\/_.-]|$)/i.test(
      lower
    ) ||
    /(?:^|[\/_.-])(ad|ads|adv|advert|banner|sponsor|sponsored|promo|affiliate|quang-cao|quangcao)[0-9_-]*(?:\.(?:jpg|jpeg|png|webp|avif)|[\/_.-])/i.test(
      lower
    )
  ) {
    return true;
  }

  const dimMatch =
    lower.match(/-(\d{2,4})x(\d{2,4})\.(jpg|jpeg|png|webp|avif)/i) ||
    lower.match(/[?&](?:w|width)=(\d{2,4})&(?:h|height)=(\d{2,4})\b/i);
  if (dimMatch) {
    const w = Number(dimMatch[1]);
    const h = Number(dimMatch[2]);
    if (AD_BANNER_DIMENSIONS.has(`${w}x${h}`)) return true;
    if (w < 220 || h < 135) return true;
    if (w > 0 && h > 0 && (w / h >= 3.1 || h / w >= 2.3)) return true;
  }

  if (altText) {
    const cleanAlt = String(altText).trim();
    if (/\b[a-f0-9]{28,40}\b/i.test(cleanAlt)) return true;
    if (
      /^(advertisement|sponsored|quảng cáo|quang cao|ad|ads|banner|promo|sponsored link|partner|tvus\.info|beaware\.fun)$/i.test(
        cleanAlt
      ) ||
      /\b(advertisement|sponsored content|quảng cáo|banner quảng cáo|mgid|taboola|outbrain|adsense|avplayer|gdpr|click here to|buy now|shop now|casino|bet88|nhà cái)\b/i.test(
        cleanAlt
      )
    ) {
      return true;
    }
  }

  if (tagHtml) {
    if (
      /\b(?:class|id)=["'][^"']*\b(ad|ads|adv|advert|advertisement|banner|sponsor|sponsored|promo|mgid|mgbox|taboola|outbrain|adsbygoogle|wp-quads|quads-|ai-viewport|adrotate|advanced-ads|avatar|author-avatar|site-logo|custom-logo|mh-magazine-lite-small|size-mh-magazine-lite-small|attachment-thumbnail|size-thumbnail)\b/i.test(
        tagHtml
      ) ||
      /\bsizes=["'][^"']*max-width:\s*(?:[1-9]\d|1[0-8]\d)px/i.test(tagHtml)
    ) {
      return true;
    }
  }

  return false;
}

function stripAdAndRelatedContainersFromHtml(htmlChunk, baseUrl) {
  let cleaned = String(htmlChunk || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<ins\b[^>]*>[\s\S]*?<\/ins>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');

  cleaned = cleaned.replace(
    /<(div|section|figure|ul|ol|li|p|span|center)\b[^>]+(?:class|id|data-ad|data-widget)=["'][^"']*\b(ad-box|ads-box|ad-container|ads-container|ad-wrapper|ad-slot|ad-unit|ad-banner|ad-block|ads-block|code-block|ai-viewports?|wp-quads|quads-location|advads|adrotate|adsbygoogle|advertisement|advertising|sponsored|promo-box|affiliate|mgid|mgbox|taboola|outbrain|revcontent|zergnet|bidgear|ezoic|mediavine|adthrive|avplayer|related-posts|related_posts|yarpp|jp-relatedposts|crp_related|td-related|td_block_related|jnews_related|inline-related|also-read|read-also|must-read|more-posts|popular-posts|recent-posts|trending-posts|mh-custom-posts|mh-widget|widget|sidebar|sharedaddy|social-share|author-box|post-author|comments-area|post-navigation|newsletter|subscribe|gdpr|cookie)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );

  let basePathname = '';
  try {
    basePathname = new URL(baseUrl).pathname.replace(/\/+$/, '');
  } catch {}

  cleaned = cleaned.replace(
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*(?:<picture\b[^>]*>[\s\S]*?<\/picture>|<img\b[^>]*>|<span\b[^>]*>\s*<img\b[^>]*>\s*<\/span>)\s*<\/a>/gi,
    (fullMatch, hrefVal) => {
      const rawHref = String(hrefVal || '').trim();
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) {
        return fullMatch;
      }
      if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(rawHref) || /attachment_id=/i.test(rawHref)) {
        return fullMatch;
      }
      try {
        const resolvedHref = new URL(rawHref, baseUrl);
        const hrefPath = resolvedHref.pathname.replace(/\/+$/, '');
        if (basePathname && hrefPath === basePathname) {
          return fullMatch;
        }
      } catch {}
      return '';
    }
  );

  return cleaned;
}

function pickBestSrcFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const cleanedSrcset = String(srcset).replace(/data:image\/[^,\s]+,[^\s,]+/gi, '').trim();
  if (!cleanedSrcset || cleanedSrcset.startsWith('data:')) return '';
  const candidates = [];
  const parts = cleanedSrcset.split(/,\s+(?=(?:https?:\/\/|\/\/|\/|[a-zA-Z0-9_-]+\/))/);
  for (const part of parts) {
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
    if (width > 0 && width < 220) continue;
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
  const unlockedHtml = String(htmlChunk || '').replace(
    /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi,
    (_m, inner) => decodeHtmlEntities(inner)
  );
  const expandedHtml = stripAdAndRelatedContainersFromHtml(unlockedHtml, baseUrl);

  const imgRegex = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(expandedHtml)) !== null) {
    const tag = m[0];
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';

    if (isIgnorableImage('https://example.com/photo.jpg', alt, tag)) continue;

    const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const hMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (wMatch || hMatch) {
      const w = wMatch ? Number(wMatch[1]) : 0;
      const h = hMatch ? Number(hMatch[1]) : 0;
      if ((w > 0 && w < 220) || (h > 0 && h < 135)) continue;
      if (w > 0 && h > 0) {
        if (AD_BANNER_DIMENSIONS.has(`${w}x${h}`)) continue;
        if (w / h >= 3.1 || h / w >= 2.3) continue;
      }
    }

    let chosen = '';
    const srcCandidates = [
      tag.match(/\bdata-orig-file=["']([^"']+)["']/i),
      tag.match(/\bdata-large-file=["']([^"']+)["']/i),
      tag.match(/\bdata-full-url=["']([^"']+)["']/i),
      tag.match(/\bdata-large_image=["']([^"']+)["']/i),
      tag.match(/\bdata-hi-res-src=["']([^"']+)["']/i),
      tag.match(/\bdata-original=["']([^"']+)["']/i),
      tag.match(/\bdata-lazy-src=["']([^"']+)["']/i),
      tag.match(/\bdata-src=["']([^"']+)["']/i),
      tag.match(/\bdata-ezsrc=["']([^"']+)["']/i),
      tag.match(/\bdata-url=["']([^"']+)["']/i),
    ];
    for (const sc of srcCandidates) {
      if (sc && sc[1] && !sc[1].trim().startsWith('data:')) {
        const resolved = resolveAbsUrl(sc[1], baseUrl);
        if (resolved && !isIgnorableImage(resolved, alt, tag)) {
          chosen = resolved;
          break;
        }
      }
    }

    if (!chosen) {
      const ssMatches = [
        tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i),
        tag.match(/\bdata-srcset=["']([^"']+)["']/i),
        tag.match(/\bsrcset=["']([^"']+)["']/i),
      ];
      for (const ss of ssMatches) {
        if (ss && ss[1]) {
          const cand = pickBestSrcFromSrcset(ss[1], baseUrl);
          if (cand && !isIgnorableImage(cand, alt, tag)) {
            chosen = cand;
            break;
          }
        }
      }
    }

    if (!chosen) {
      const srcAttr = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1] && !srcAttr[1].trim().startsWith('data:')) {
        const rawCandidate = resolveAbsUrl(srcAttr[1], baseUrl);
        if (rawCandidate && !isIgnorableImage(rawCandidate, alt, tag)) {
          chosen = rawCandidate;
        }
      }
    }

    if (!chosen || isIgnorableImage(chosen, alt, tag)) continue;
    if (chosen.includes('/wp-content/uploads/')) {
      chosen = chosen.replace(/-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+|768x\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i, '');
    }
    list.push({ url: chosen, alt });
  }

  if (list.length === 0) {
    const sourceRegex = /<source\b[^>]*>/gi;
    let sm;
    while ((sm = sourceRegex.exec(expandedHtml)) !== null) {
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

    const htmlWithoutImgs = expandedHtml.replace(/<img\b[^>]*>/gi, '');
    const rawUploadRegex = /https?:\\?\/\\?\/[^"'\s<>\\]+\/wp-content\/uploads\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\s<>\\]*)?/gi;
    let rm;
    while ((rm = rawUploadRegex.exec(htmlWithoutImgs)) !== null) {
      let rawU = rm[0].replace(/\\\//g, '/');
      const resolvedRaw = resolveAbsUrl(rawU, baseUrl);
      if (!resolvedRaw || isIgnorableImage(resolvedRaw)) continue;
      if (rawU.includes('/wp-content/uploads/')) {
        rawU = rawU.replace(/-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+|768x\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i, '');
      }
      const resolved = resolveAbsUrl(rawU, baseUrl);
      if (resolved && !isIgnorableImage(resolved)) {
        list.push({ url: resolved, alt: '' });
      }
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

function cleanScrapedTitle(rawTitle, sourceUrl) {
  let cleaned = decodeHtmlEntities(rawTitle || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  let hostBrand = '';
  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./i, '').toLowerCase();
      hostBrand = host.split('.')[0] || '';
    } catch {}
  }

  cleaned = cleaned.replace(/\s+(?:\||::|«|»|\/\/)\s+[^|«»]{1,50}$/g, '').trim();

  if (hostBrand && hostBrand.length >= 2) {
    const escapedBrand = hostBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const spacedBrand = hostBrand.replace(/[-_]+/g, '[\\s\\-_]*');
    cleaned = cleaned
      .replace(
        new RegExp(`\\s+[-–—|:]\\s+(?:${escapedBrand}|${spacedBrand})(?:\\.[a-z.]{2,6})?\\s*$`, 'i'),
        ''
      )
      .trim();
  }

  cleaned = cleaned
    .replace(
      /\s+[-–—|]\s+[^|–—-]{2,40}\.(com|net|org|fun|vn|info|us|co\.uk|io|me|tv|news|live|online|site|xyz|club|buzz|today|world|media|press|daily|post|times|magazine)$/i,
      ''
    )
    .trim();

  const tailMatch = cleaned.match(/^(.*?\S)\s+[-–—]\s+([^|–—-]{2,35})$/);
  if (tailMatch && tailMatch[1].length >= 18) {
    const mainPart = tailMatch[1].trim();
    const tailPart = tailMatch[2].trim();
    const tailWords = tailPart.split(/\s+/);
    const isQuestionOrExclamation = /[?!]$/.test(tailPart);
    const hasStoryClauseWords =
      /\b(her|his|their|them|him|she|he|they|you|your|our|who|what|when|where|why|how|can|do|does|did|would|could|will|is|are|was|were|has|have|had|not|no|never|everyone|anyone|someone|nobody|choice|life|look|looks|years|year|old|age|now|today|after|before|without|with|from|into|about|because|while|still|even|more|most|less|part|episode|season|chapter|actress|actor|star|singer|model|fans|people|world|heart|hearts|plastic|surgery|wrinkles|beach|wedding|divorce|baby|son|daughter|husband|wife|partner)\b/i.test(
        tailPart
      );
    const isKnownSitePattern =
      /^(beaware|tvus|celeb24h|dailymail|daily\s+mail(?:\s+online)?|page\s+six|pagesix|tmz|just\s+jared|justjared|people|us\s+weekly|radaronline|radar\s+online|the\s+sun|the\s+mirror|mirror\s+online|bright\s+side|bored\s+panda|yahoo(?:\s+[a-z]+)?|msn|fox\s+news|cnn|bbc|ny\s+post|new\s+york\s+post|hollywood\s+life|e!\s*online|et\s+online|entertainment\s+tonight|vogue|elle|glamour|cosmopolitan|marie\s+claire|harper'?s\s+bazaar|vanity\s+fair|buzzfeed|huffpost|upworthy|littlethings|goalcast|newsner|apost|fabiosa|amebo|lifedaily|relieved|the\s+dodo|screen\s*rant|collider|deadline|variety|the\s+hollywood\s+reporter|indiewire|popcrush|allmusic|billboard|rolling\s+stone|nme|pitchfork|parade|woman'?s\s+world|closer\s+weekly|in\s+touch\s+weekly|life\s*&\s*style|ok!\s*magazine|star\s+magazine|national\s+enquirer|daily\s+express|daily\s+star|metro|independent|the\s+guardian|telegraph)$/i.test(
        tailPart
      );

    if (
      isKnownSitePattern ||
      (!isQuestionOrExclamation && !hasStoryClauseWords && tailWords.length <= 3 && tailPart.length <= 25)
    ) {
      cleaned = mainPart;
    }
  }

  if (cleaned && cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/(^\w|\.\s+\w|\b[a-z]{4,})/g, (m) =>
      m.charAt(0).toUpperCase() + m.slice(1)
    );
  }
  return cleaned;
}

function analyzeArticleSubjectAndContext(title, text, userKeyword, existingImages) {
  const fullText = decodeHtmlEntities(String(text || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanTitle = decodeHtmlEntities(String(title || ''))
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
  const sample = fullText.slice(0, 6000);

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
    'Considering', 'Regarding', 'Debuting', 'Watching', 'Adding', 'Dazzling', 'Posing',
    'Demonstrating', 'Discussing', 'Working', 'Seeing', 'Revealing', 'Unveiling',
    'Because', 'Although', 'Though', 'Since', 'Unless', 'Whether', 'Whenever', 'Whatever',
    'However', 'Moreover', 'Furthermore', 'Meanwhile', 'Instead', 'Otherwise', 'Therefore',
    'Thus', 'Hence', 'Yet', 'Still', 'Even', 'Only', 'Just', 'Also', 'Either', 'Neither',
    'Each', 'Every', 'Many', 'Most', 'Some', 'Several', 'Few', 'Other', 'Another', 'Such',
    'Same', 'Certain', 'Various', 'Different', 'Similar', 'Special', 'Specific', 'Additional',
    'Ultimately', 'As', 'If', 'Or', 'And', 'But', 'Nor', 'So', 'Once',
    'Hollywood', 'Caribbean', 'Barbados', 'Bahamas', 'Bora', 'Cabo', 'Ibiza', 'Mykonos',
    'Maui', 'Tahiti', 'Sardinia', 'Capri', 'Amalfi', 'Portofino', 'London', 'West', 'North',
    'South', 'East', 'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California',
    'Florida', 'Connecticut', 'Greenwich', 'United', 'States', 'America', 'British',
    'English', 'American', 'Great', 'Britain', 'French', 'Riviera', 'Mediterranean',
    'German', 'Italian', 'Spanish', 'Mexican', 'Saint', 'Tropez', 'Cannes',
    'Rome', 'Malibu', 'Hawaii', 'Manhattan', 'Dublin', 'Ireland', 'Nashville', 'Byron',
    'Bay', 'Australia', 'Australian', 'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday',
    'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter', 'Facebook',
    'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People', 'Weekly', 'Magazine',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Anyone', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Photos', 'Recognize', 'Them', 'Her', 'Him',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Hilton', 'Hills', 'Santa',
    'Stunning', 'Pregnant', 'Timeless', 'Beloved', 'Famous', 'Reality', 'Heartthrob', 'Icon',
    'Real', 'Housewives', 'Brat', 'Pack', 'Night', 'Heat', 'Glad', 'All', 'Over', 'Mark', 'Twain',
    'Morning', 'Show', 'France', 'Europe', 'European', 'Exclusive', 'Story', 'Highlights',
    'Season', 'Seasons', 'Episode', 'Episodes', 'Series', 'Chapter', 'Chapters', 'Part',
    'Netflix', 'Nevermore', 'Gothic', 'Visual', 'Style', 'Identity', 'History', 'Search',
    'Heart', 'Companion', 'Companions', 'Relationship', 'Sibling', 'Cast', 'Crew',
    'Production', 'Premiere', 'Release', 'Teaser', 'Trailer', 'Update', 'Updates',
    'Character', 'Characters', 'Mystery', 'Mysteries', 'Horror', 'Comedy', 'Drama',
    'Supernatural', 'Teen', 'World', 'Corridors', 'Classrooms', 'Costume', 'Wardrobe',
    'Appearance', 'Architecture', 'Atmosphere', 'Environment', 'Locations', 'Setting',
    'Settings', 'Islanders', 'Capital', 'Searchlight', 'University', 'College', 'Studio',
    'Studios', 'Network', 'Channel', 'Platform', 'Power', 'Couple', 'Rare', 'Beachside',
    'Escape', 'Relaxed', 'Day', 'Outing', 'Getaway', 'Vacation', 'Holiday', 'Chief',
    'Content', 'Officer', 'Executive', 'Producer', 'Producers', 'Director', 'Showrunners',
    'Writers', 'Creators', 'Eiffel', 'Tower', 'Famously', 'Contemporary', 'Archival',
    'Scroll', 'Stay', 'Read', 'Click', 'Share', 'Watch', 'See', 'Everything', 'Know', 'About',
    'Avalon', 'Getty', 'GettyImages', 'Backgrid', 'Splash', 'Shutterstock', 'WireImage',
    'Fatal', 'Attraction', 'Natural', 'Big', 'Chill', 'World', 'Garp', 'Friends', 'Key',
    'Die', 'Hard', 'Pulp', 'Fiction', 'Sixth', 'Sense', 'Unbreakable', 'Moonlighting',
    'Matrix', 'Reloaded', 'Revolutions', 'Spectre', 'Malena', 'Irreversible', 'Beetlejuice',
    'Heartbroken', 'Heartbreaking', 'Embraces', 'Wrinkles', 'Sagging', 'Jawline', 'Refusing',
    'Plastic', 'Surgery', 'Facelift', 'Dramatic', 'Full', 'Patient', 'Endure', 'Pain',
    'Leaves', 'Everyone', 'Talking', 'Daughter', 'Son', 'Father', 'Mother', 'Parents',
    'Children', 'Kids', 'Shares', 'Shared', 'Health', 'Ability', 'Speak', 'Walk', 'Lost',
    'Almost', 'Selling', 'Artwork', 'Paintings', 'Surprising', 'New', 'Life', 'Romance',
    'Marriage', 'Never', 'End', 'Late', 'Year', 'Old', 'Year-Old', 'Emotional', 'Moment',
    'Choice', 'Understands', 'Former', 'Youngest', 'Oldest', 'Teenager', 'Medical', 'Doctor',
    'Hospital', 'Home', 'Near', 'First', 'Time', 'Death', 'Tragic', 'Passing', 'Grief',
    'Sorrow', 'House', 'Outside', 'Woman', 'Man', 'Child', 'Baby', 'Twin', 'Brother', 'Sister',
    'Standout', 'Beachwear', 'Snapshots', 'Sunlit', 'Breakdown', 'Complete', 'Documented',
    'Featuring', 'Signature', 'Modeling', 'Recognizing', 'Closer', 'Look', 'Details', 'Moments'
  ]);

  const stopPhrases = new Set([
    'santa monica', 'sandy lane', 'beverly hills', 'palm springs', 'bora bora',
    'saint tropez', 'notting hill', 'new york', 'los angeles', 'miami beach',
    'french riviera', 'cabo san lucas', 'lake como', 'west hollywood', 'west london',
    'south of france', 'byron bay', 'die hard', 'pulp fiction', 'sixth sense',
    'legally blonde', 'morning show', 'dirty dancing', 'ferris bueller', 'big little lies',
    'hello sunshine', 'daily mail', 'page six', 'people magazine', 'golden globes',
    'academy awards', 'real housewives', 'dramatic full facelift', 'plastic surgery',
    'sagging jawline', 'emotional moment', 'heartbreaking update'
  ]);

  const isWednesdayShowContext = /\b(Nevermore|Addams|Ortega|Enid|Morticia|Ophelia|Pugsley|Gomez)\b/i.test(
    `${sample} ${cleanTitle}`
  );
  if (!isWednesdayShowContext) {
    stopWords.add('Wednesday');
  }

  const exPartnerSet = new Set();
  const exRegex =
    /\b(?:split|divorce|divorced|separated|separation|parted\s+ways)\s+from\s+(?:[a-z-]+\s+){0,3}([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})/gi;
  let exMatch;
  while ((exMatch = exRegex.exec(sample)) !== null) {
    exPartnerSet.add(exMatch[1].trim());
  }

  const stats = new Map();

  const companionRegex =
    /\b(?:with|alongside|beside|and)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|beau)\s*(?:,\s*(?:\d{2}-year-old\s+)?(?:[a-z-]+\s+){0,3})?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+(?:de|van|von|del|da|di|la|le))?\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set();
  let cm;
  while ((cm = companionRegex.exec(sample.slice(0, 1400))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 4)
      .join(' ');
    if (cName.split(/\s+/).length >= 2 && !stopPhrases.has(cName.toLowerCase())) {
      companionSet.add(cName);
    }
  }

  const nameAgeAfterRegex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+(?:de|van|von|del|da|di|la|le))?\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)\s*,\s*\d{2}\b/g;
  let nam;
  while ((nam = nameAgeAfterRegex.exec(sample.slice(0, 1400))) !== null) {
    const rawName = nam[1].trim();
    const cleanParts = rawName.split(/\s+/).filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 4).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: nam.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 48;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-zA-Z-]+){0,4})|(?:representative\s+for|breakout\s+star|personality|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|surgeon|mother|father|icon|legend|winner|daughter|son|director|showrunners?|executive)(?:\s+[a-zA-Z-]+){0,2})\s*,?\s+(?:Dr\.\s+)?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+(?:de|van|von|del|da|di|la|le))?\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 4).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 44;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  const regex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+(?:de|van|von|del|da|di|la|le))?(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}){1,2})\b/g;
  let m;
  const textToScan =
    sample.length >= 100
      ? `${sample} ${imgAltText}`.trim()
      : `${sample} ${imgAltText} ${cleanTitle}`.trim();
  while ((m = regex.exec(textToScan)) !== null) {
    const rawName = m[1].trim().replace(/['’]s$/i, '');
    const parts = rawName.split(/\s+/);
    const capParts = parts.filter((p) => !/^(de|van|von|del|da|di|la|le)$/i.test(p));
    if (capParts.some((p) => stopWords.has(p) || stopWords.has(p.replace(/['’]s$/i, '')))) continue;
    if (capParts.length < 2) continue;
    const candidate = parts.join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
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

  const lowerCleanTitle = cleanTitle.toLowerCase();
  for (const [fullName, info] of stats.entries()) {
    if (lowerCleanTitle.includes(fullName.toLowerCase())) {
      info.bioBoost += 22;
    }
    const tokens = fullName.split(/\s+/);
    const lastName = tokens[tokens.length - 1];
    if (lastName && lastName.length >= 4 && !stopWords.has(lastName)) {
      const escapedLast = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lastRegex = new RegExp(`(?<![a-zA-Z-])${escapedLast}(?![a-zA-Z-])`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(35, (totalLastMentions - info.count) * 7);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 80 ? 48 : a[1].firstIdx < 280 ? 36 : a[1].firstIdx < 550 ? 20 : 0;
    const leadBonusB = b[1].firstIdx < 80 ? 48 : b[1].firstIdx < 280 ? 36 : b[1].firstIdx < 550 ? 20 : 0;
    const compPenaltyA = a[1].isCompanion ? -28 : 0;
    const compPenaltyB = b[1].isCompanion ? -28 : 0;
    const exPenaltyA = exPartnerSet.has(a[0]) ? -50 : 0;
    const exPenaltyB = exPartnerSet.has(b[0]) ? -50 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA + exPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB + exPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  const cleanUserKw = String(userKeyword || '').trim();
  const isInvalidUserKw =
    !cleanUserKw ||
    cleanUserKw.split(/\s+/).length > 4 ||
    /\?|\b(spotted|soaking|beach|recognize|who|what|where|when|why|how|model|actress|actor|star|celebrity|outfits|turns|heads|look|like|can|you|her|him|them|familiar|face|sunny|carefree|stylish|moment|facelift|patient|endure|pain)\b/i.test(
      cleanUserKw
    );

  let primaryPerson =
    rankedPeople[0] || (!isInvalidUserKw ? cleanUserKw : '') || '';
  if (!primaryPerson && isWednesdayShowContext) {
    primaryPerson = /\bJenna\s+Ortega\b/i.test(sample) ? 'Jenna Ortega' : 'Wednesday Addams';
  }

  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      !exPartnerSet.has(p) &&
      !/^(Sports Illustrated|Daily Mail|Page Six|People Magazine|Golden Globes|Academy Awards)$/i.test(p) &&
      (info.isCompanion || info.bioBoost > 0 || (info.firstIdx < 650 && info.count >= 2)) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  const supportingEntities = rankedEntries
    .map(([p]) => p)
    .filter(
      (p) =>
        p !== primaryPerson &&
        p !== secondaryPerson &&
        !exPartnerSet.has(p) &&
        !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
        (!secondaryPerson || !secondaryPerson.toLowerCase().includes(p.toLowerCase()))
    )
    .slice(0, 8);

  const visualSceneText = `${imgAltText} ${sample.slice(0, 2400)}`.toLowerCase();
  const outfitKeywords = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|vibrant\s+red|vibrant\s+blue|monochromatic\s+black|sharp\s+black|sleek\s+black|minimal\s+black|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver|gothic|monochrome|tailored|oversized|fitted|linen|silk|satin|cashmere|knit|velvet|plunging|strapless|halter|two-piece|one-piece)\s+(?:two-piece\s+bikini|one-piece\s+swimsuit|bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|maxi\s+dress|summer\s+dress|sundress|tank\s+top|crop\s+top|t-shirt|tee|shirt|blouse|top|jacket|blazer|coat|trench\s+coat|cardigan|sweater|jumper|hoodie|suit|silhouette|pantsuit|jumpsuit|jeans|trousers|pants|slacks|skirt|miniskirt|leggings|outfit|ensemble|wardrobe|costume|look|attire|sunglasses|shades|hat|cap|beanie|boots|sneakers|heels|sandals|loafers))\b/gi;
  let om;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1]
      .replace(/^(sharp|sleek|minimal|monochromatic)\s+/i, '')
      .replace(/\s+silhouette$/i, ' swimsuit')
      .replace(/\s+/g, ' ')
      .trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 6) {
      outfitKeywords.push(phrase);
    }
  }

  const bodyLower = sample.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'notting hill',
    'west hollywood', 'london', 'malibu', 'venice beach', 'long beach', 'new york city',
    'new york', 'manhattan', 'miami beach', 'miami', 'bahamas', 'cabo san lucas',
    'cabo', 'caribbean', 'cannes', 'paris', 'eiffel tower', 'venice', 'beverly hills',
    'los angeles', 'santa monica', 'calabasas', 'brentwood', 'bel-air', 'hamptons',
    'montauk', 'aspen', 'palm springs', 'hawaii', 'maui', 'ibiza', 'mallorca',
    'mykonos', 'santorini', 'amalfi', 'positano', 'portofino', 'lake como',
    'sardinia', 'capri', 'rome', 'milan', 'florence', 'bora bora', 'tahiti',
    'fiji', 'sydney', 'melbourne', 'toronto', 'vancouver', 'tokyo', 'dubai',
    'nevermore academy', 'ireland', 'dublin'
  ];
  const locationKeywords = [];
  for (const loc of locationGlossary) {
    const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locRe = new RegExp(`\\b${escaped}\\b`, 'i');
    if (locRe.test(bodyLower) && locationKeywords.length < 4) {
      locationKeywords.push(loc);
    }
  }

  const timeframeKeywords = [];
  const timeRegex =
    /\b((?:in|since|during|by|until|around|early|late|mid-|summer|Spring|winter|fall|autumn)\s+(?:19\d{2}|20\d{2})|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:\d{1,2},?\s+)?(?:19\d{2}|20\d{2})|(?:this\s+past\s+)(?:january|february|march|april|may|june|july|august|september|october|november|december)|season\s+\d+|19\d{2}s|20\d{2})\b/gi;
  let tm;
  while ((tm = timeRegex.exec(sample)) !== null) {
    const tf = tm[1].replace(/^this\s+past\s+/i, '').replace(/\s+/g, ' ').trim();
    if (!timeframeKeywords.some((k) => k.toLowerCase() === tf.toLowerCase()) && timeframeKeywords.length < 5) {
      timeframeKeywords.push(tf);
    }
  }

  const affirmativeContentLower = bodyLower.replace(
    /\b(?:away\s+from|far\s+from|instead\s+of|rather\s+than|unlike|outside\s+of|avoiding|skipping)\s+[^.,;!\n]{3,70}/gi,
    ' '
  );

  const eventGlossary = [
    'baywatch', 'on set', 'beach set', 'reboot', 'lifeguard', 'miami swim week',
    'bikini', 'swimsuit', 'bathing suit', 'yacht', 'beach', 'boat', 'pregnant',
    'pregnancy', 'baby bump', 'stroll', 'lunch', 'brunch', 'kiss', 'kisses',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday', 'filming',
    'season 3', 'cast', 'premiere', 'talk show', 'interview'
  ];
  const eventKeywords = [];
  for (const ev of eventGlossary) {
    const escaped = ev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const evRe = new RegExp(`\\b${escaped}\\b`, 'i');
    if (
      evRe.test(affirmativeContentLower) &&
      eventKeywords.length < 5 &&
      !outfitKeywords.some((o) => o === ev)
    ) {
      eventKeywords.push(ev);
    }
  }

  const leadStorySample = `${cleanTitle} ${sample.slice(0, 1200)}`.toLowerCase();
  const storylineGlossary = [
    'frontotemporal dementia', 'dementia', 'aphasia', 'health update', 'health',
    'speak and walk', 'lost the ability', 'deep plane facelift', 'full facelift',
    'facelift', 'plastic surgery', 'cosmetic surgery', 'sagging jawline', 'turkey neck',
    'wrinkles', 'aging naturally', 'aging', 'selling her artwork', 'selling artwork',
    'handmade paintings', 'artwork', 'street fair', 'late 27-year-old son', 'late son',
    'tragic passing', 'grief', 'heartbroken', 'romance', 'marriage', 'walk down the aisle',
    'baywatch', 'reboot', 'beach set', 'black swimsuit', 'venice beach'
  ];
  const storylineKeywords = [];
  for (const sk of storylineGlossary) {
    const escaped = sk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const skRe = new RegExp(`\\b${escaped}\\b`, 'i');
    if (skRe.test(leadStorySample) && storylineKeywords.length < 6) {
      if (!storylineKeywords.some((existing) => existing.includes(sk) || sk.includes(existing))) {
        storylineKeywords.push(sk);
      }
    }
  }

  const strippedHeadline = cleanTitle
    .replace(/\b(?:can|do|would)\s+you\s+recognize\s+(?:her|him|them|this\s+[a-z\s]+)\??/gi, '')
    .replace(/\b(?:leaves\s+everyone\s+talking|and\s+not\s+everyone\s+understands\s+(?:her|his)\s+choice|a\s+surprising\s+new\s+chapter\s+in\s+(?:her|his)\s+life)\b!?/gi, '')
    .replace(/["“”'’?!:;—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const headlineIgnoreSet = new Set([
    'the', 'and', 'for', 'with', 'near', 'from', 'into', 'onto', 'over', 'after', 'before',
    'about', 'that', 'this', 'what', 'when', 'where', 'which', 'while', 'why', 'how', 'who',
    'her', 'his', 'their', 'she', 'he', 'they', 'them', 'him', 'you', 'your', 'our', 'has',
    'have', 'had', 'was', 'were', 'are', 'been', 'being', 'almost', 'may', 'never', 'end',
    'such', 'spotted', 'soaking', 'sun', 'model', 'actress', 'actor', 'star', 'celebrity',
    'moments', 'moment', 'emotional', 'heartbreaking', 'surprising', 'new', 'chapter', 'life'
  ]);
  const personNameTokensLower = new Set(
    `${primaryPerson} ${secondaryPerson} ${supportingEntities.join(' ')}`
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  );
  for (const w of strippedHeadline.toLowerCase().split(/\s+/)) {
    const cleanW = w.replace(/^['’]+|['’]+$/g, '').replace(/['’]s$/i, '');
    if (
      cleanW.length >= 4 &&
      !headlineIgnoreSet.has(cleanW) &&
      !personNameTokensLower.has(cleanW) &&
      !storylineKeywords.some((sk) => sk.includes(cleanW)) &&
      storylineKeywords.length < 7
    ) {
      storylineKeywords.push(cleanW);
    }
  }

  const isChildStory = /\b(daughter|son|children|teenager|18-year-old|27-year-old)\b/i.test(
    `${cleanTitle} ${sample.slice(0, 500)}`
  );
  const featuredFamilyEntity = isChildStory ? supportingEntities[0] || '' : '';

  const ageMatch = `${cleanTitle} ${sample.slice(0, 400)}`.match(/\b(\d{2})-year-old\b|\bat\s+(\d{2})\b/i);
  const agePhrase = ageMatch ? `${ageMatch[1] || ageMatch[2]} year old` : '';

  const eventWords = [
    ...storylineKeywords.slice(0, 3),
    ...eventKeywords.slice(0, 2),
    ...outfitKeywords.slice(0, 2),
    ...locationKeywords.slice(0, 2),
  ].slice(0, 7);

  const youtubeSearchQueries = [];
  if (primaryPerson) {
    const q1 = [
      primaryPerson,
      secondaryPerson || featuredFamilyEntity,
      ...storylineKeywords.slice(0, 2),
      ...(storylineKeywords.length === 0 ? eventWords.slice(0, 2) : []),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (q1) youtubeSearchQueries.push(q1);

    if (
      strippedHeadline.length >= 15 &&
      !/\bmodel\s+spotted\s+soaking\b/i.test(cleanTitle)
    ) {
      const headlineQ = [
        !strippedHeadline.toLowerCase().includes(primaryPerson.toLowerCase()) ? primaryPerson : '',
        featuredFamilyEntity &&
        !strippedHeadline.toLowerCase().includes(featuredFamilyEntity.toLowerCase())
          ? featuredFamilyEntity
          : '',
        strippedHeadline.split(/\s+/).slice(0, 9).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (headlineQ && !youtubeSearchQueries.includes(headlineQ)) {
        youtubeSearchQueries.push(headlineQ);
      }
    }

    const q3 = [
      primaryPerson,
      featuredFamilyEntity || secondaryPerson,
      ...(eventKeywords.length > 0 ? eventKeywords.slice(0, 2) : storylineKeywords.slice(0, 2)),
      locationKeywords[0] || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (q3 && !youtubeSearchQueries.includes(q3)) {
      youtubeSearchQueries.push(q3);
    }
  } else {
    const nonCelebQ1 = [agePhrase, ...storylineKeywords.slice(0, 3), 'transformation']
      .filter(Boolean)
      .join(' ')
      .trim();
    if (nonCelebQ1) youtubeSearchQueries.push(nonCelebQ1);
    if (strippedHeadline) youtubeSearchQueries.push(strippedHeadline);
  }

  let articleCategory = 'celebrity_romance_vacation';
  if (
    /\b(season\s+\d|netflix|showrunners?|episodes?|filming|cast|series|character|sequel|spin-?off|nevermore|addams|reboot|on\s+set|beach\s+set|baywatch)\b/i.test(
      affirmativeContentLower
    )
  ) {
    articleCategory = 'screen_production';
  } else if (
    /\b(red\s+carpet|awards?|gala|premiere|ceremony|gown|golden\s+globes|oscars|emmys|grammys)\b/i.test(
      affirmativeContentLower
    ) &&
    !/\b(yacht|beach|bikini|bathing\s+suit|swim\s+shorts|selling\s+her\s+artwork|street)\b/i.test(
      affirmativeContentLower
    )
  ) {
    articleCategory = 'red_carpet_event';
  } else if (/\b(19[6789]\d|archival|throwback|decades\s+ago|late\s+actor|legacy)\b/i.test(affirmativeContentLower)) {
    articleCategory = 'retrospective_feature';
  } else if (
    /\b(notting\s+hill|neighborhood|stroll|streets?\s+of|sidewalk|cafe|coffee|shopping|london|manhattan|new\s+york|west\s+hollywood|beverly\s+hills|selling\s+her\s+artwork)\b/i.test(
      affirmativeContentLower
    ) &&
    !/\b(beach|bikini|swimsuit|ocean|surf|waves|sand|yacht|resort|island|tropical)\b/i.test(affirmativeContentLower)
  ) {
    articleCategory = 'city_neighborhood_outing';
  }

  const subjectDisplay = secondaryPerson
    ? `${primaryPerson} and ${secondaryPerson}`
    : primaryPerson || strippedHeadline.split(/\s+/).slice(0, 5).join(' ') || 'the featured story';

  const combinedSearchQuery =
    youtubeSearchQueries[0] ||
    [
      primaryPerson,
      secondaryPerson,
      eventKeywords[0] || storylineKeywords[0] || '',
      outfitKeywords[0] || '',
      locationKeywords[0] || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

  return {
    primaryPerson,
    secondaryPerson,
    supportingEntities,
    outfitKeywords,
    locationKeywords,
    timeframeKeywords,
    eventKeywords,
    storylineKeywords,
    youtubeSearchQueries,
    eventWords,
    articleCategory,
    subjectDisplay,
    combinedSearchQuery: combinedSearchQuery || primaryPerson || strippedHeadline,
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

  const genericQueryNoiseRe =
    /^(model|actress|actor|star|celebrity|spotted|soaking|up|the|sun|at|beach|can|you|recognize|her|him|them|who|is|she|he|they|familiar|face|sunny|day|with|would|carefree|stylish|summer|moment|rare|candid|paparazzi|cast|and|creators|exclusive|story|news|photo|photos)$/i;

  const fallbackQueryTokens = cleanQuery
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !genericQueryNoiseRe.test(w));

  const primaryPerson = (
    effectiveProfile.primaryPerson ||
    fallbackQueryTokens.slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = (effectiveProfile.secondaryPerson || '').trim();
  const outfitKeywords = effectiveProfile.outfitKeywords || [];
  const locationKeywords = effectiveProfile.locationKeywords || [];
  const eventKeywords = effectiveProfile.eventKeywords || [];
  const timeframeKeywords = effectiveProfile.timeframeKeywords || [];
  const eventWords = effectiveProfile.eventWords || [];

  if (!primaryPerson || genericQueryNoiseRe.test(primaryPerson)) {
    return [];
  }

  const supportingEntities = effectiveProfile.supportingEntities || [];
  const storylineKeywords = effectiveProfile.storylineKeywords || [];

  const specificEvent =
    eventKeywords.find((e) => e !== 'beach' && e !== 'swimsuit' && e !== 'bikini') ||
    eventKeywords[0] ||
    supportingEntities[0] ||
    storylineKeywords[0] ||
    '';
  const secondaryEvent =
    eventKeywords.find((e) => e !== specificEvent) ||
    supportingEntities[1] ||
    storylineKeywords[1] ||
    '';

  const queries = [
    [
      primaryPerson,
      secondaryPerson,
      specificEvent,
      outfitKeywords[0],
      secondaryEvent === 'beach set' || secondaryEvent === 'on set' ? 'set' : locationKeywords[0],
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [
      primaryPerson,
      supportingEntities[0] || specificEvent,
      storylineKeywords[0] || outfitKeywords[0],
      timeframeKeywords[0] || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, secondaryPerson, outfitKeywords[0], locationKeywords[0], specificEvent]
      .filter(Boolean)
      .join(' ')
      .trim(),
    ...(effectiveProfile.articleCategory === 'retrospective_feature'
      ? [
          [primaryPerson, supportingEntities[0], 'young actress photo']
            .filter(Boolean)
            .join(' ')
            .trim(),
          [primaryPerson, storylineKeywords[0], 'vintage portrait']
            .filter(Boolean)
            .join(' ')
            .trim(),
        ]
      : [
          [
            primaryPerson,
            specificEvent,
            outfitKeywords[0],
            'celebmafia OR justjared OR dailymail OR hawtcelebs',
          ]
            .filter(Boolean)
            .join(' ')
            .trim(),
        ]),
    [primaryPerson, secondaryPerson, specificEvent, locationKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, secondaryPerson || supportingEntities[0], 'photos'].filter(Boolean).join(' ').trim(),
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
  const evTokens = [
    ...eventKeywords,
    ...supportingEntities.slice(0, 2),
    ...storylineKeywords.slice(0, 3),
  ]
    .flatMap((w) => w.toLowerCase().split(/\s+/))
    .filter((t) => t.length >= 3);

  const stockOrGenericBlockRe =
    /gettyimages\.|alamy\.|shutterstock\.|istockphoto\.|dreamstime\.|depositphotos\.|123rf\.|pond5\.|prettylittlething\.|shein\.|ido\.org\.tw|tiktok\.com\/api|pexels\.com|pixabay\.com|unsplash\.com|wallpaperaccess\.com|wallpapercave\.com|hdwallpapers|freepik\.com|vecteezy\.com|burst\.shopify\.com|kaboompics\.com|theplanetd\.com|cntraveler\.com|tripadvisor\.|booking\.com|expedia\.|coloring|clipart|[?&](Expires|Signature|AWSAccessKeyId|X-Amz-Signature)=/i;

  const normalizeFullResWpUrl = (rawImgUrl) => {
    let cleaned = String(rawImgUrl || '').trim();
    if (cleaned.includes('/wp-content/uploads/')) {
      cleaned = cleaned.replace(
        /-\d{2,4}x\d{2,4}(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i,
        ''
      );
    }
    return cleaned;
  };

  const getNormKey = (u) =>
    normalizeFullResWpUrl(u)
      .split('?')[0]
      .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
      .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
      .toLowerCase();

  const monthNames = [
    '', 'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const sourceDateHints = [];
  for (const exUrl of excludeKeys) {
    const ymMatch = String(exUrl || '').match(/\/(202\d)\/(0[1-9]|1[0-2])\//);
    if (ymMatch) {
      const yr = ymMatch[1];
      const moNum = parseInt(ymMatch[2], 10);
      const moName = monthNames[moNum];
      sourceDateHints.push(`/${yr}/${ymMatch[2]}/`);
      if (moName) {
        sourceDateHints.push(`${moName}-${yr}`);
        sourceDateHints.push(`${moName} ${yr}`);
      }
      break;
    }
  }
  for (const tf of timeframeKeywords) {
    const tfLower = String(tf || '').toLowerCase().trim();
    if (/^[a-z]+\s+202\d$/.test(tfLower)) {
      sourceDateHints.push(tfLower);
      sourceDateHints.push(tfLower.replace(/\s+/g, '-'));
    }
  }

  const colorTokenSet = new Set([
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'gold', 'silver',
    'floral', 'sheer', 'leather', 'denim', 'lace', 'sequin', 'striped', 'plaid',
    'beige', 'brown', 'purple', 'orange', 'navy', 'cream', 'khaki', 'burgundy', 'metallic'
  ]);
  const garmentSynonyms = [
    'swimsuit', 'suit', 'bikini', 'one-piece', 'swimwear', 'monokini', 'trunks',
    'dress', 'gown', 'skirt', 'top', 'shirt', 'blouse', 'jacket', 'coat', 'blazer',
    'sweater', 'cardigan', 'hoodie', 'jeans', 'pants', 'trousers', 'shorts', 'jumpsuit', 'bodysuit'
  ];

  const scoredCandidates = [];
  const seen = new Set(excludeKeys);
  const seenMd5 = new Set();

  for (const q of uniqueQueries) {
    if (scoredCandidates.length >= Math.max(limit * 3, 14)) break;
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
          const rawMurl = String(obj.murl || '').trim();
          const imgUrl = normalizeFullResWpUrl(rawMurl);
          if (!imgUrl || isIgnorableImage(imgUrl)) continue;
          if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(imgUrl)) continue;
          if (
            stockOrGenericBlockRe.test(imgUrl) ||
            stockOrGenericBlockRe.test(String(obj.purl || ''))
          ) {
            continue;
          }

          const normKey = getNormKey(imgUrl);
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

          let score = hasFullPrimary ? 65 : 48;

          if (secondaryPerson && hay.includes(secondaryPerson.toLowerCase())) score += 55;
          else if (sTokens.length > 0 && sTokens.every((tk) => hay.includes(tk))) score += 38;

          const hasWordToken = (text, token) => {
            const escaped = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
          };

          const uniqueEvMatched = new Set();
          for (const et of evTokens) {
            if (hasWordToken(hay, et) && !uniqueEvMatched.has(et)) {
              uniqueEvMatched.add(et);
              score += et === 'baywatch' || et === 'yacht' ? 36 : 18;
            }
          }

          let matchedColor = false;
          for (const ot of outfitTokens) {
            if (hasWordToken(hay, ot)) {
              if (colorTokenSet.has(ot)) {
                score += 65;
                matchedColor = true;
              } else {
                score += 35;
              }
            }
          }
          if (matchedColor && garmentSynonyms.some((g) => hasWordToken(hay, g))) {
            score += 40;
          }

          if (sourceDateHints.length > 0 && sourceDateHints.some((dh) => hay.includes(dh))) {
            score += 55;
          }

          for (const lt of locTokens) {
            if (hay.includes(lt)) score += 25;
          }
          if (
            /celebmafia\.|justjared\.|hawtcelebs\.|dailymail\.|pagesix\.|usmagazine\.|people\.com|thesun\.|mirror\.co\.uk|backgrid|barnorama\./i.test(
              hay
            )
          ) {
            score += 32;
          }

          if (effectiveProfile.articleCategory !== 'retrospective_feature') {
            if (/\b(2026|2025)\b/.test(hay)) score += 30;
            if (/\b(2016|2017|2018|2019|2020|2021|2022)\b/.test(hay)) score -= 50;
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

  const topCandidate = scoredCandidates[0];
  if (topCandidate && topCandidate.purl) {
    const stemMatch = topCandidate.url.match(
      /^(https?:\/\/[^?]+?[-_])(\d+)(\.(?:jpg|jpeg|png|webp))$/i
    );
    try {
      const galRes = await fetchWithTimeout(
        topCandidate.purl,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
        3500
      );
      if (galRes.ok) {
        const galHtml = await galRes.text();
        const rawUrls =
          galHtml.match(
            /https?:\/\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>\\]*)?/gi
          ) || [];
        const cleanBaseTitle = topCandidate.alt
          .replace(/\s*[•|–—-]\s*(CelebMafia|HawtCelebs|Just\s*Jared|Barnorama).*$/i, '')
          .replace(/\s*\.\.\.$/, '')
          .trim();

        for (const rawU of rawUrls) {
          const fullU = normalizeFullResWpUrl(rawU);
          if (!fullU || isIgnorableImage(fullU)) continue;
          const nKey = getNormKey(fullU);
          if (seen.has(nKey)) continue;

          const isSameNumberedStem =
            stemMatch &&
            fullU.toLowerCase().startsWith(stemMatch[1].toLowerCase()) &&
            new RegExp(
              `^${stemMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+\\.(jpg|jpeg|png|webp)$`,
              'i'
            ).test(fullU);

          const lowerU = fullU.toLowerCase();
          const hasAllPTokensInFile =
            !stemMatch && pTokens.length > 0 && pTokens.every((tk) => lowerU.includes(tk));
          const hasOutfitOrEventInFile =
            !stemMatch &&
            [...evTokens, ...outfitTokens].some((tk) => tk.length >= 4 && lowerU.includes(tk));

          if (isSameNumberedStem || (hasAllPTokensInFile && hasOutfitOrEventInFile)) {
            seen.add(nKey);
            scoredCandidates.push({
              url: fullU,
              alt: cleanBaseTitle || topCandidate.alt,
              isFeatured: false,
              isExternal: true,
              score: isSameNumberedStem ? topCandidate.score + 45 : topCandidate.score + 15,
              purl: topCandidate.purl,
            });
          }
        }
      }
    } catch {}
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates.slice(0, limit).map(({ score: _s, purl: _p, ...rest }) => rest);
}

async function searchRelatedYouTubeVideos(rawQuery, limit = 2, contextProfile, excludeVideoIds = []) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleanQuery &&
    !(contextProfile && contextProfile.primaryPerson) &&
    !(contextProfile && contextProfile.youtubeSearchQueries && contextProfile.youtubeSearchQueries.length)
  ) {
    return [];
  }

  const primaryPerson = ((contextProfile && contextProfile.primaryPerson) || '').trim();
  const secondaryPerson = ((contextProfile && contextProfile.secondaryPerson) || '').trim();
  const supportingEntities = (contextProfile && contextProfile.supportingEntities) || [];
  const storylineKeywords = (contextProfile && contextProfile.storylineKeywords) || [];
  const eventKeywords = (contextProfile && contextProfile.eventKeywords) || [];
  const outfitKeywords = (contextProfile && contextProfile.outfitKeywords) || [];
  const locationKeywords = (contextProfile && contextProfile.locationKeywords) || [];
  const profileQueries = (contextProfile && contextProfile.youtubeSearchQueries) || [];

  const isCustomUserQuery =
    cleanQuery.length >= 4 &&
    cleanQuery.toLowerCase() !== primaryPerson.toLowerCase() &&
    cleanQuery.toLowerCase() !== String((contextProfile && contextProfile.combinedSearchQuery) || '').toLowerCase() &&
    !/\b(can you recognize|do you recognize|leaves everyone talking)\b/i.test(cleanQuery);

  const queries = [
    ...(isCustomUserQuery
      ? [
          primaryPerson && !cleanQuery.toLowerCase().includes(primaryPerson.toLowerCase())
            ? `${primaryPerson} ${cleanQuery}`
            : cleanQuery,
        ]
      : []),
    ...profileQueries,
    [primaryPerson, secondaryPerson, ...storylineKeywords.slice(0, 3)].filter(Boolean).join(' ').trim(),
    [primaryPerson, ...eventKeywords.slice(0, 2), ...outfitKeywords.slice(0, 1)].filter(Boolean).join(' ').trim(),
    cleanQuery.split(/\s+/).slice(0, 9).join(' '),
  ].filter((q) => q && q.length >= 3);

  const uniqueQueries = [...new Set(queries)].slice(0, 3);

  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const supTokens = supportingEntities
    .slice(0, 2)
    .flatMap((e) => String(e || '').toLowerCase().split(/[\s-]+/))
    .filter((t) => t.length >= 3 && !pTokens.includes(t) && !sTokens.includes(t));

  const rawTopicWords = [
    ...storylineKeywords,
    ...eventKeywords,
    ...outfitKeywords,
    ...locationKeywords,
  ];
  const topicTokenStop = new Set([
    'the', 'and', 'with', 'from', 'into', 'near', 'home', 'year', 'old', 'ability',
    'lost', 'almost', 'shares', 'spotted', 'beach', 'los', 'angeles', 'new', 'york'
  ]);
  const storyTokens = [
    ...new Set(
      rawTopicWords
        .flatMap((phrase) => String(phrase || '').toLowerCase().split(/[\s-]+/))
        .filter((w) => w.length >= 3 && !topicTokenStop.has(w) && !pTokens.includes(w) && !sTokens.includes(w))
    ),
  ];

  const expandedStoryTokens = new Set(storyTokens);
  if (storyTokens.some((w) => ['son', 'late', 'grief', 'tragic', 'passing'].includes(w))) {
    ['son', 'death', 'dies', 'dead', 'tragic', 'cremated', 'autopsy', 'grief', 'seen', 'spotted'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['health', 'dementia', 'speak', 'walk', 'aphasia'].includes(w))) {
    ['health', 'dementia', 'update', 'condition', 'battle', 'frontotemporal', 'daughter', 'wife'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['wrinkles', 'aging', 'jawline', 'plastic', 'surgery'].includes(w))) {
    ['aging', 'age', 'wrinkles', 'beauty', 'timeless', 'natural', 'secrets', 'older', 'interview'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['artwork', 'paintings', 'selling', 'street'].includes(w))) {
    ['artwork', 'art', 'sells', 'selling', 'street', 'fair', 'vivienne', 'knox', 'daughter'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['romance', 'marriage', 'aisle'].includes(w))) {
    ['romance', 'marriage', 'girlfriend', 'relationship', 'milestone', 'date', 'serious'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['facelift', 'turkey', 'neck'].includes(w))) {
    ['facelift', 'rejuvenation', 'transformation', 'before', 'after', 'plastic', 'surgery', 'deep', 'plane'].forEach(
      (w) => expandedStoryTokens.add(w)
    );
  }
  if (storyTokens.some((w) => ['baywatch', 'reboot', 'swimsuit'].includes(w))) {
    ['baywatch', 'reboot', 'set', 'beach', 'swimsuit', 'filming', 'photoshoot', 'venice'].forEach((w) =>
      expandedStoryTokens.add(w)
    );
  }

  const isChildStory =
    storyTokens.includes('daughter') ||
    storyTokens.includes('son') ||
    supTokens.length > 0;

  const excludedSet = new Set(
    (Array.isArray(excludeVideoIds) ? excludeVideoIds : []).map((id) => String(id || '').trim()).filter(Boolean)
  );
  const candidates = [];
  const seen = new Set(excludedSet);

  const decodeYtJsonText = (raw) =>
    decodeHtmlEntities(
      String(raw || '')
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim()
    );

  const queryHtmlResults = await Promise.all(
    uniqueQueries.map(async (q, qIdx) => {
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
        if (!res.ok) return { qIdx, html: '' };
        return { qIdx, html: await res.text() };
      } catch {
        return { qIdx, html: '' };
      }
    })
  );

  for (const { qIdx, html } of queryHtmlResults) {
    if (!html) continue;
    const rawBlocks = html.split('"videoRenderer":{"videoId":"').slice(1, 15);
    let rankInQuery = 0;
    for (const rawBlock of rawBlocks) {
      rankInQuery++;
      const videoId = rawBlock.slice(0, 11);
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId) || seen.has(videoId)) continue;

      const cardChunk = rawBlock.slice(0, 4200);
      const titleMatch = cardChunk.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])+)"/);
      if (!titleMatch) continue;

      const rawTitle = decodeYtJsonText(titleMatch[1]);
      if (!rawTitle || rawTitle.length < 6) continue;

      const snippetMatches = [...cardChunk.matchAll(/"text":"((?:\\.|[^"\\])+)"/g)]
        .map((mItem) => decodeYtJsonText(mItem[1]))
        .filter((s) => s.length >= 15 && s !== rawTitle)
        .slice(0, 3)
        .join(' ');
      const pubTimeMatch = cardChunk.match(/"publishedTimeText":\{"simpleText":"([^"]+)"\}/);
      const pubTimeText = pubTimeMatch ? pubTimeMatch[1].toLowerCase() : '';

      const lowerTitle = rawTitle.toLowerCase();
      const lowerCombined = `${lowerTitle} ${snippetMatches.toLowerCase()}`;

      if (primaryPerson) {
        const hasFullPrimary = lowerCombined.includes(primaryPerson.toLowerCase());
        const hasPrimaryToken = pTokens.some((tk) => lowerTitle.includes(tk));
        const hasSupToken = supTokens.some((tk) => lowerTitle.includes(tk));
        if (!hasFullPrimary && !hasPrimaryToken && !hasSupToken) {
          continue;
        }
      }

      let score = Math.max(0, 24 - qIdx * 6 - rankInQuery * 2);

      if (primaryPerson) {
        if (lowerTitle.includes(primaryPerson.toLowerCase())) score += 60;
        else if (pTokens.every((tk) => lowerTitle.includes(tk))) score += 48;
        else if (pTokens.some((tk) => lowerTitle.includes(tk))) score += 26;
      }

      if (secondaryPerson) {
        if (lowerTitle.includes(secondaryPerson.toLowerCase())) score += 50;
        else if (sTokens.some((tk) => lowerTitle.includes(tk))) score += 28;
      }

      for (const st of supTokens) {
        if (lowerTitle.includes(st)) score += 42;
      }

      let matchedTopicCount = 0;
      for (const tok of expandedStoryTokens) {
        const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tokRe = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
        if (tokRe.test(lowerTitle)) {
          score += 34;
          matchedTopicCount++;
        } else if (tokRe.test(lowerCombined)) {
          score += 14;
          matchedTopicCount++;
        }
      }

      if (expandedStoryTokens.size > 0 && matchedTopicCount === 0) {
        score -= 85;
      }

      if (!isChildStory && /\b(daughter|son)\b/i.test(lowerTitle)) {
        score -= 55;
      }

      if (
        /\b(movie clip|full movie|official trailer|soundtrack|ost|02 \[4k\]|\[4k\]|fan edit|tribute|amv|#shorts)\b/i.test(
          lowerTitle
        ) &&
        (contextProfile && contextProfile.articleCategory) !== 'screen_production'
      ) {
        score -= 50;
      }

      if (/\b(hour|hours|day|days|week|weeks|month|months)\s+ago\b/i.test(pubTimeText)) {
        score += 22;
      } else if (/\b([5-9]|1\d)\s+years\s+ago\b/i.test(pubTimeText)) {
        score -= 30;
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
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

function stripTrackingQueryFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const toRemove = [];
    u.searchParams.forEach((_v, k) => {
      if (
        /^(fbclid|gclid|dclid|msclkid|twclid|ttclid|igshid|mibextid|mc_cid|mc_eid|_ga|_gl|ref|fb_action_ids|fb_action_types|fb_source|utm_[a-z0-9_]+|_aem_[a-z0-9_]*)$/i.test(
          k
        )
      ) {
        toRemove.push(k);
      }
    });
    for (const k of toRemove) u.searchParams.delete(k);
    return u.href;
  } catch {
    return rawUrl;
  }
}

async function scrapeWebArticleForSeoRewrite(rawUrl) {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = stripTrackingQueryFromUrl(cleanUrl);

  const parsedUrl = new URL(cleanUrl);
  const origin = parsedUrl.origin;

  let originalTitle = '';
  let originalExcerpt = '';
  const paragraphs = [];
  const images = [];
  const seenImgKeys = new Set();

  const addImage = (url, alt = '', isFeatured = false) => {
    const resolved = resolveAbsUrl(url, cleanUrl);
    if (!resolved || isIgnorableImage(resolved, alt)) return;
    let finalUrl = resolved;
    if (finalUrl.includes('/wp-content/uploads/')) {
      finalUrl = finalUrl.replace(
        /-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+|768x\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i,
        ''
      );
    }
    const key = finalUrl
      .split('?')[0]
      .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)$)/i, '')
      .toLowerCase();
    if (seenImgKeys.has(key)) return;
    seenImgKeys.add(key);
    images.push({
      url: finalUrl,
      alt: alt || originalTitle || 'Article Image',
      isFeatured,
      isExternal: false,
    });
  };

  const cleanBoilerplateTailFromParagraph = (rawTxt) => {
    return rawTxt
      .replace(
        /\s*(?:What|Who|Which) is your (?:absolute )?favorite\b[\s\S]*$/i,
        ''
      )
      .replace(
        /\s*(?:Let['’]s|Drop a comment|Share your thoughts|Tell us in the comments|Sound off in the comments|What do you think\??)\b[\s\S]*$/i,
        ''
      )
      .replace(
        /\s*(?:Scroll down to|Click through to|Stay tuned for|Follow us on)\b[\s\S]*$/i,
        ''
      )
      .trim();
  };

  const isPureBoilerplateLine = (txt) => {
    const lower = txt.toLowerCase();
    return (
      /^(read more|related:|also read|share this|follow us|subscribe|advertisement|sponsored|source:|photo credit|click here|leave a comment|let's swap)/i.test(
        lower
      ) ||
      /^(what|who|which) is your (absolute )?favorite\b/i.test(lower)
    );
  };

  const extractParagraphsFromHtml = (htmlChunk) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const tag = m[1].toLowerCase();
      const rawTxt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      const txt = cleanBoilerplateTailFromParagraph(rawTxt);
      if (!txt || isPureBoilerplateLine(txt)) continue;
      if ((tag === 'h2' || tag === 'h3') && txt.length >= 8 && txt.length <= 140) {
        const marker = `## ${txt}`;
        if (!paragraphs.includes(marker)) paragraphs.push(marker);
      } else if (txt.length >= 25 && !paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  };

  const parseWpPostObject = async (postJson) => {
    if (!postJson || !postJson.id) return;
    if (postJson.title && postJson.title.rendered) {
      originalTitle = cleanScrapedTitle(postJson.title.rendered, cleanUrl);
    }
    if (postJson.excerpt && postJson.excerpt.rendered) {
      originalExcerpt = stripHtmlTags(postJson.excerpt.rendered);
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
    if (featUrl) {
      addImage(featUrl, originalTitle, true);
    }

    const contentHtml = String((postJson.content && postJson.content.rendered) || '');
    extractParagraphsFromHtml(contentHtml);
    const contentImgs = collectImgsFromHtml(contentHtml, cleanUrl);
    for (const img of contentImgs) {
      addImage(img.url, img.alt || originalTitle, images.length === 0);
    }

    if (images.length === 0 && postJson.id) {
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
              if (mUrl) {
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
              originalTitle = cleanScrapedTitle(h1Match[1], cleanUrl);
            } else if (ogTitle && ogTitle[1]) {
              originalTitle = cleanScrapedTitle(ogTitle[1], cleanUrl);
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
          if (ogImg && ogImg[1]) {
            addImage(ogImg[1], originalTitle, images.length === 0);
          }

          const cleanBody = stripAdAndRelatedContainersFromHtml(html, cleanUrl)
            .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');

          let primaryZone = cleanBody;
          const articleTagMatch = cleanBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
          if (articleTagMatch && articleTagMatch[1]) {
            primaryZone = articleTagMatch[1];
          } else {
            const contentDivStart = cleanBody.search(
              /<div\b[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content|single-content|article-body|story-body)[^"']*["'][^>]*>/i
            );
            if (contentDivStart !== -1) {
              const afterStart = cleanBody.slice(contentDivStart, contentDivStart + 120000);
              const stopMatch = afterStart.match(
                /<(div|section|aside|footer)\b[^>]+(id|class)=["'][^"']*\b(related-posts|yarpp|jp-relatedposts|comments-area|post-navigation|site-footer|sidebar|mh-widget|widget)\b[^"']*["']/i
              );
              primaryZone = stopMatch && stopMatch.index ? afterStart.slice(0, stopMatch.index) : afterStart;
            } else {
              const mainMatch = cleanBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
              if (mainMatch && mainMatch[1]) primaryZone = mainMatch[1];
            }
          }

          extractParagraphsFromHtml(primaryZone);
          for (const img of collectImgsFromHtml(primaryZone, cleanUrl)) {
            addImage(img.url, img.alt || originalTitle, images.length === 0);
          }
        }
      }
    } catch {
      // Fallback to Jina Reader
    }
  }

  // Kênh dự phòng đặc biệt vượt tường lửa / chống copy (Jina Cloud Headless Browser) chỉ chạy khi trang chặn IP hoặc mã hóa ảnh bằng blob JS
  if (paragraphs.length < 2 || images.length === 0 || !originalTitle) {
    try {
      const jinaRes = await fetchWithTimeout(
        `https://r.jina.ai/${cleanUrl}`,
        {
          headers: {
            Accept: 'application/json',
            'X-With-Images-Summary': 'true',
            'X-No-Cache': 'true',
            'User-Agent': SCRAPER_USER_AGENT,
          },
        },
        6500
      );

      if (jinaRes.ok) {
        const jinaJson = await jinaRes.json().catch(() => null);
        const jData = jinaJson && jinaJson.data;
        if (jData) {
          if (!originalTitle && jData.title) {
            originalTitle = cleanScrapedTitle(String(jData.title), cleanUrl);
          }
          if (!originalExcerpt && jData.description) {
            originalExcerpt = decodeHtmlEntities(String(jData.description));
          }

          const rawMdContent = String(jData.content || '');
          const stopFooterIdx = rawMdContent.search(
            /\n(?:#+\s*)?(?:Related\s+Posts|You\s+May\s+Also\s+Like|More\s+From|Promoted\s+Content|Sponsored\s+Content|Around\s+The\s+Web|Leave\s+a\s+Reply|Leave\s+a\s+Comment)\b/i
          );
          const mdContent = stopFooterIdx !== -1 ? rawMdContent.slice(0, stopFooterIdx) : rawMdContent;

          const cleanedMdForImgs = mdContent.replace(
            /\[!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\]\((https?:\/\/[^)\s]+)\)/gi,
            (fullMd, _alt, _imgU, linkU) => {
              if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(linkU)) return fullMd;
              return '';
            }
          );

          const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
          let mim;
          while ((mim = mdImgRegex.exec(cleanedMdForImgs)) !== null) {
            const rawImgUrl = mim[2].trim();
            const altLabel = mim[1].trim();
            if (isIgnorableImage(rawImgUrl, altLabel)) continue;
            addImage(
              rawImgUrl,
              altLabel && !/^Image\s*\d+/i.test(altLabel) ? altLabel : originalTitle,
              images.length === 0
            );
          }

          if (jData.images && typeof jData.images === 'object') {
            for (const [imgAlt, imgUrlVal] of Object.entries(jData.images)) {
              const rawImgUrl = String(imgUrlVal || '').trim();
              if (!rawImgUrl || rawImgUrl.startsWith('blob:') || rawImgUrl.startsWith('data:')) continue;
              if (isIgnorableImage(rawImgUrl, imgAlt)) continue;
              addImage(
                rawImgUrl,
                imgAlt && !/^Image\s*\d+/i.test(imgAlt) ? imgAlt : originalTitle,
                images.length === 0
              );
            }
          }

          if (paragraphs.length < 2 && mdContent) {
            const mdLines = mdContent.split(/\n+/);
            for (const rawLine of mdLines) {
              let line = rawLine
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                .replace(/\[Video\s+\d+\]\([^)]*\)/gi, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^#+\s*/, '')
                .replace(/[*_`~]+/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              if (!line || line.length < 28) continue;
              if (
                /^(skip to content|search|menu|home|share|tweet|pin|copy link|read more|related posts|leave a comment|cancel reply|privacy policy|terms of service|we use cookies|accept all|manage preferences|advertisement|sponsored)/i.test(
                  line
                )
              ) {
                continue;
              }
              line = line
                .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
                .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
                .replace(/\s*Scroll down for a closer look[\s\S]*$/i, '')
                .trim();
              if (!line || line.length < 25) continue;
              if (!paragraphs.includes(line)) {
                paragraphs.push(line);
              }
            }
          }
        }
      }
    } catch {
      // Ignore Jina fallback error
    }
  }

  if (!originalTitle) {
    originalTitle = humanizeUrlSlugToTitle(parsedUrl.pathname) || 'Exclusive Celebrity Story';
  }
  originalTitle = cleanScrapedTitle(originalTitle, cleanUrl);

  return {
    sourceUrl: cleanUrl,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    originalTitle,
    originalExcerpt,
    articleText: paragraphs.join('\n\n'),
    images: images.slice(0, 20),
  };
}

function splitIntoSentences(text) {
  const cleaned = stripHtmlTags(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const protectedText = cleaned
    .replace(/\b(Dr|Mr|Ms|Mrs|St|Jr|Sr|vs|Prof|Inc|Ltd)\.\s+/g, '$1__DOT__ ')
    .replace(/\bU\.S\./g, 'U__DOT__S__DOT__');
  const rawParts = protectedText.split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/);
  return rawParts
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length >= 20);
}

function splitTextInto40To50WordParagraphs(text) {
  const cleaned = stripHtmlTags(text).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const totalWords = cleaned.split(/\s+/).filter(Boolean);
  if (totalWords.length <= 52) return [totalWords.join(' ')];

  const rawSentences =
    (cleaned.match(/[^.!?]+[.!?]+["'”’)]*/g) || [cleaned])
      .map((s) => s.trim())
      .filter(Boolean);

  const normalizedSentences = [];
  for (const s of rawSentences) {
    const w = s.split(/\s+/).filter(Boolean);
    if (w.length <= 52) {
      normalizedSentences.push(s);
    } else {
      const clauses = s.split(
        /(?:;\s+|\s+—\s+|,\s+(?=(?:and|but|while|showing|proving|making|highlighting|where|nhưng|đồng thời|qua đó|giúp)\b))/i
      );
      if (clauses.length > 1) {
        for (const cl of clauses) {
          let trimmed = cl.trim();
          if (!trimmed) continue;
          if (!/[.!?]["'”’)]*$/.test(trimmed)) trimmed = trimmed.replace(/[,;:-]+$/, '') + '.';
          trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          normalizedSentences.push(trimmed);
        }
      } else {
        normalizedSentences.push(s);
      }
    }
  }

  const paragraphs = [];
  let currentWords = [];

  for (const sent of normalizedSentences) {
    const sentWords = sent.split(/\s+/).filter(Boolean);
    if (currentWords.length === 0) {
      currentWords.push(...sentWords);
      if (currentWords.length >= 40) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
      continue;
    }

    if (currentWords.length + sentWords.length <= 56) {
      currentWords.push(...sentWords);
      if (currentWords.length >= 38) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
    } else {
      paragraphs.push(currentWords.join(' '));
      currentWords = [...sentWords];
      if (currentWords.length >= 40) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
    }
  }

  if (currentWords.length > 0) {
    if (currentWords.length < 22 && paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1] = `${paragraphs[paragraphs.length - 1]} ${currentWords.join(' ')}`;
    } else {
      paragraphs.push(currentWords.join(' '));
    }
  }

  return paragraphs;
}

function extractSpecificFactsFromParagraph(text, profile) {
  const clean = stripHtmlTags(text).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
  const sents = splitIntoSentences(clean);
  const firstSent = sents[0] || clean;
  const secondSent = sents[1] || '';
  const thirdSent = sents[2] || '';

  const quotedMatches = [
    ...(clean.match(/['"“‘]([^'"”’]{3,65})['"”’]/g) || []),
  ].map((q) => q.replace(/^['"“‘]|['"”’]$/g, '').trim());

  const yearMatches = [
    ...(clean.match(/\b(19\d{2}s?|20\d{2}s?|\d{1,2}-year-old|\d+\s+years?\b)/gi) || []),
  ];

  const stopSet = new Set([
    'The', 'In', 'On', 'At', 'For', 'With', 'From', 'Into', 'During', 'After', 'Before',
    'While', 'When', 'Where', 'Although', 'Because', 'Since', 'Unless', 'Until', 'Whether',
    'However', 'Moreover', 'Furthermore', 'Meanwhile', 'Instead', 'Beyond', 'Across',
    'Through', 'Between', 'Among', 'Around', 'Inside', 'Outside', 'Behind', 'Beneath',
    'Despite', 'Throughout', 'Alongside', 'Besides', 'Looking', 'Taking', 'Building',
    'Examining', 'Further', 'Adding', 'Bringing', 'Focusing', 'Tracing', 'Stepping',
    'Unpacking', 'Delving', 'Considering', 'Reflecting', 'Revisiting', 'Expanding',
    'According', 'Speaking', 'Walking', 'Strolling', 'Wearing', 'Sporting', 'Showing',
    'Sharing', 'Enjoying', 'Celebrating', 'Appearing', 'Making', 'Keeping', 'Proving',
    'He', 'She', 'They', 'Her', 'His', 'Their', 'This', 'That', 'These', 'Those',
    'Both', 'Each', 'Every', 'Many', 'Most', 'Some', 'Such', 'Other', 'Another',
  ]);
  const properPhrases = [];
  const propRe =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,18}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,18}){0,2})\b/g;
  let pm;
  while ((pm = propRe.exec(clean)) !== null) {
    const phrase = pm[1].trim();
    const firstWord = phrase.split(/\s+/)[0].replace(/['’]s$/i, '');
    if (stopSet.has(firstWord)) continue;
    if (!properPhrases.includes(phrase) && properPhrases.length < 8) {
      properPhrases.push(phrase);
    }
  }

  const visualPhrases = [];
  const visRe =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering|glittering|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard|denim|leather|lace|sheer|sequin|silver|tailored|oversized|fitted|linen|silk|satin|cashmere|knit|velvet|casual|relaxed)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|top|shirt|blouse|jacket|blazer|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble|wardrobe|sunglasses|look|attire))\b/gi;
  let vm;
  while ((vm = visRe.exec(clean)) !== null) {
    const vp = vm[1].trim();
    if (!visualPhrases.some((x) => x.toLowerCase() === vp.toLowerCase()) && visualPhrases.length < 5) {
      visualPhrases.push(vp);
    }
  }

  return {
    clean,
    sents,
    firstSent,
    secondSent,
    thirdSent,
    quotedMatches,
    yearMatches,
    properPhrases,
    visualPhrases,
    primary: profile.primaryPerson || profile.subjectDisplay || 'the star',
    secondary: profile.secondaryPerson || '',
  };
}

function expandFactBlockToAround150Words({
  baseFactText,
  contextProfile,
  allFactsPool,
  language,
  paragraphIndex,
}) {
  const extracted = extractSpecificFactsFromParagraph(baseFactText, contextProfile);
  const cleanBase = extracted.clean;
  const primary = extracted.primary;
  const secondary = extracted.secondary;
  const coupleOrSubject = secondary ? `${primary} and ${secondary}` : primary;

  const supList = contextProfile.supportingEntities || [];
  const localEntities = extracted.properPhrases.filter(
    (p) =>
      !primary.toLowerCase().includes(p.toLowerCase()) &&
      (!secondary || !secondary.toLowerCase().includes(p.toLowerCase()))
  );
  const anchorEntity =
    localEntities[0] ||
    (supList.length > 0 ? supList[paragraphIndex % supList.length] : '') ||
    coupleOrSubject;
  const secondAnchorEntity =
    localEntities[1] ||
    (supList.length > 1 ? supList[(paragraphIndex + 1) % supList.length] : '') ||
    primary;

  const loc =
    contextProfile.locationKeywords && contextProfile.locationKeywords.length > 0
      ? contextProfile.locationKeywords
          .slice(0, 2)
          .map((l) => l.replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(' and ')
      : '';
  const visualDetail =
    extracted.visualPhrases[0] ||
    (contextProfile.outfitKeywords && contextProfile.outfitKeywords.length > 0
      ? contextProfile.outfitKeywords[paragraphIndex % contextProfile.outfitKeywords.length]
      : '');
  const timeDetail =
    extracted.yearMatches[0] ||
    (contextProfile.timeframeKeywords && contextProfile.timeframeKeywords.length > 0
      ? contextProfile.timeframeKeywords[paragraphIndex % contextProfile.timeframeKeywords.length]
      : '');
  const quotedWork = extracted.quotedMatches[0] || '';

  const relatedSourceFacts = [];
  if (allFactsPool && allFactsPool.length > 0) {
    for (let offset = 0; offset < allFactsPool.length; offset++) {
      const candidateFact = allFactsPool[(paragraphIndex + offset) % allFactsPool.length];
      if (candidateFact && !cleanBase.includes(candidateFact.slice(0, 24))) {
        relatedSourceFacts.push(candidateFact);
      }
      if (relatedSourceFacts.length >= 3) break;
    }
  }
  const normalizeCompanionClause = (rawSent) => {
    const stripped = String(rawSent || '').replace(/^(?:But|And|However,?|Yet|Still,?|Meanwhile,?)\s+/i, '').trim();
    if (!stripped) return '';
    const firstWord = stripped.split(/\s+/)[0] || '';
    const isProperStart = /^[A-Z][a-z]+$/.test(firstWord) && !/^(As|In|On|At|For|With|From|After|Before|While|When|Beyond|Seeing|Stepping|Trading|Watching|There|The|This|Her|His|She|He|It)\b/.test(firstWord);
    return isProperStart ? stripped : `${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
  };
  const companionFact1 = normalizeCompanionClause(relatedSourceFacts[0] || '');
  const companionFact2 = normalizeCompanionClause(relatedSourceFacts[1] || '');

  let combined = cleanBase;
  const factBridgeSentences =
    language === 'vi'
      ? [
          ...(companionFact1
            ? [`Bên cạnh chi tiết trên, nội dung bài gốc cũng cho biết thêm rằng ${companionFact1}`]
            : []),
          `Hình ảnh ghi lại của ${coupleOrSubject}${visualDetail ? ` trong trang phục ${visualDetail}` : ''}${loc ? ` tại ${loc}` : ''} làm nổi bật phong cách thời trang cùng thần thái tự nhiên đúng như những gì bài viết gốc mô tả.`,
          `Khi đặt dữ kiện xoay quanh ${anchorEntity}${quotedWork ? ` cùng dấu ấn "${quotedWork}"` : ''}${timeDetail ? ` vào cột mốc ${timeDetail}` : ''} cạnh các chi tiết trong ảnh minh họa, người đọc dễ dàng theo dõi trọn vẹn mạch câu chuyện thực tế của bài báo.`,
          ...(companionFact2 ? [`Đồng thời, bài viết gốc nhấn mạnh thêm rằng ${companionFact2}`] : []),
          `Mọi chi tiết được ghi nhận quanh sự xuất hiện của ${coupleOrSubject}${loc ? ` ở ${loc}` : ''} đều bám sát chuỗi khoảnh khắc thực tế trong bài báo gốc mà không thêm thắt tình tiết ngoài lề.`,
        ]
      : [
          ...(companionFact1
            ? [`Connecting directly with that moment in the report, ${companionFact1}`]
            : []),
          `As captured in the original photographs, ${coupleOrSubject}${visualDetail ? ` in ${visualDetail}` : ''}${loc ? ` at ${loc}` : ''} drew immediate attention for the exact styling, fit, and confident presence highlighted throughout the piece.`,
          `Connecting the context around ${anchorEntity}${quotedWork ? ` and "${quotedWork}"` : ''}${timeDetail ? ` from ${timeDetail}` : ''} directly to the visual moments in the report gives readers the exact clues and details documented in the source article.`,
          ...(companionFact2
            ? [`Furthermore, as the source coverage notes, ${companionFact2}`]
            : []),
          `Every concrete observation in the source report about ${coupleOrSubject}${loc ? ` in ${loc}` : ''}${visualDetail ? ` wearing ${visualDetail}` : ''} reinforces the specific visual moments captured in the accompanying photos.`,
          `Taken together, these direct observations from the original article trace the complete appearance of ${primary}${loc ? ` in ${loc}` : ''} without departing from the documented facts of the outing.`,
        ];

  let attempt = 0;
  while (
    combined.split(/\s+/).filter(Boolean).length < 138 &&
    attempt < factBridgeSentences.length
  ) {
    const addon = factBridgeSentences[attempt];
    if (!combined.includes(addon.slice(0, 28))) {
      combined = `${combined} ${addon}`;
    }
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 165) {
    const sliced = finalWords.slice(0, 156).join(' ');
    const lastDot = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? ')
    );
    if (lastDot > 480) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

function buildHeadingForParagraph(unitText, profile, headingIndex, originalHeadings, language) {
  const cleanOrig = (originalHeadings || [])
    .map((h) => h.replace(/^##\s*/, '').trim())
    .filter((h) => h.length >= 8 && h.length <= 110);
  if (headingIndex < cleanOrig.length) {
    return cleanOrig[headingIndex];
  }

  const isVi = language === 'vi';
  const extracted = extractSpecificFactsFromParagraph(unitText, profile);
  const primary = extracted.primary;
  const secondary = extracted.secondary;
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const loc =
    profile.locationKeywords && profile.locationKeywords[0]
      ? profile.locationKeywords[0].replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
  const visual =
    extracted.visualPhrases[0] ||
    (profile.outfitKeywords && profile.outfitKeywords[headingIndex % profile.outfitKeywords.length]) ||
    '';
  const time =
    extracted.yearMatches[0] ||
    (profile.timeframeKeywords && profile.timeframeKeywords[headingIndex % profile.timeframeKeywords.length]) ||
    '';
  const quote = extracted.quotedMatches[0] || '';
  const localEntity =
    extracted.properPhrases.find(
      (p) =>
        !primary.toLowerCase().includes(p.toLowerCase()) &&
        (!secondary || !secondary.toLowerCase().includes(p.toLowerCase()))
    ) || '';

  if (isVi) {
    const viTemplates = [
      `${subjectPair}${loc ? ` Tại ${loc}` : ''}: Chi Tiết Thực Tế Trong Từng Khung Hình`,
      `Dấu Ấn Của ${primary}${quote ? ` Với "${quote}"` : localEntity ? ` Cùng ${localEntity}` : ''} Trong Bài Viết`,
      `Phong Cách Thời Trang${visual ? ` (${visual})` : ''} Của ${subjectPair} Qua Ảnh Minh Họa`,
      `Bối Cảnh Câu Chuyện${time ? ` Năm ${time}` : ''}${loc ? ` Ở ${loc}` : ''} Và Những Dữ Kiện Đáng Chú Ý`,
      `Chi Tiết Đáng Chú Ý Về ${subjectPair}${localEntity ? ` Và ${localEntity}` : ''} Nhìn Từ Nội Dung Chính`,
      `Toàn Cảnh Câu Chuyện Của ${primary} Qua Các Đoạn Văn Gốc`,
    ];
    return viTemplates[headingIndex % viTemplates.length];
  }

  const enTemplates = [
    `${subjectPair}${loc ? ` in ${loc}` : ''}: Inside the Candid Moments Captured on Camera`,
    `${primary}'s Highlights${quote ? ` From "${quote}"` : localEntity ? ` Alongside ${localEntity}` : ''} and Key Story Details`,
    `Standout Style and Visual Details${visual ? `: The ${visual} Look` : ` of ${subjectPair}`}`,
    `Timeline and Context${time ? ` (${time})` : ''}: What the Article Reveals About ${subjectPair}`,
    `Behind the Photographs: ${localEntity || subjectPair}${loc ? ` in ${loc}` : ''} and Notable Highlights`,
    `Every Detail Documented in ${subjectPair}'s Latest Snapshots`,
    `Closer Look at the Visual Details and Background Surrounding ${primary}`,
  ];
  return enTemplates[headingIndex % enTemplates.length];
}

function buildLongFormSeoArticle2000To5000Words({
  articleTitle,
  focusKeyword,
  sourceArticleText,
  images,
  youtubeVideos,
  language,
  contextProfile,
}) {
  const isVi = language === 'vi';
  const profile =
    contextProfile ||
    analyzeArticleSubjectAndContext(articleTitle, sourceArticleText, focusKeyword, images);

  const rawLines = String(sourceArticleText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const originalHeadings = [];
  const sourceParagraphs = [];

  for (const line of rawLines) {
    const cleanedLine = line
      .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite\b[\s\S]*$/i, '')
      .replace(/\s*(?:Let['’]s|Drop a comment|Share your thoughts|Tell us in the comments)\b[\s\S]*$/i, '')
      .trim();
    if (!cleanedLine) continue;

    if (cleanedLine.startsWith('## ')) {
      originalHeadings.push(cleanedLine.replace(/^##\s*/, '').trim());
    } else if (
      cleanedLine.length >= 12 &&
      cleanedLine.length <= 85 &&
      !/[.!]$/.test(cleanedLine) &&
      (cleanedLine.endsWith('?') || /^[a-z0-9\s'’“-]+$/i.test(cleanedLine))
    ) {
      originalHeadings.push(cleanedLine);
    } else if (cleanedLine.length >= 25) {
      sourceParagraphs.push(cleanedLine);
    }
  }

  const allSourceSentences = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    for (const s of sents) {
      if (!allSourceSentences.includes(s)) {
        allSourceSentences.push(s);
      }
    }
  }

  const factUnits = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    if (sents.length >= 2) {
      for (const s of sents) {
        factUnits.push(s);
      }
    } else if (sp.length >= 25) {
      factUnits.push(sp);
    }
  }

  const primary = profile.primaryPerson || profile.subjectDisplay || 'the star';
  const secondary = profile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const locs = (profile.locationKeywords || []).map((l) =>
    l.replace(/\b\w/g, (c) => c.toUpperCase())
  );
  const outfits = profile.outfitKeywords || [];

  let synIdx = 0;
  while (factUnits.length < 15 && synIdx < Math.max(allSourceSentences.length * 2, 15)) {
    if (allSourceSentences.length > 0) {
      const sA = allSourceSentences[synIdx % allSourceSentences.length];
      const sB =
        allSourceSentences[(synIdx + 1) % allSourceSentences.length] || '';
      const prefix = isVi
        ? 'Đi sâu vào dữ kiện thực tế và hình ảnh được ghi nhận trong bài gốc:'
        : 'Focusing on the documented details and visual moments from the source report:';

      const combinedUnit =
        sB && sB !== sA ? `${prefix} ${sA} ${sB}` : `${prefix} ${sA}`;
      factUnits.push(combinedUnit);
    } else {
      const fallbackUnit = isVi
        ? `Trong các đoạn văn và hình ảnh minh họa của bài viết, câu chuyện xoay quanh ${subjectPair}${locs[0] ? ` tại ${locs[0]}` : ''}${outfits[0] ? ` với trang phục ${outfits[0]}` : ''} được khắc họa rõ nét qua từng khoảnh khắc thực tế.`
        : `Across the paragraphs and illustrative photographs of the report, the story of ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` featuring ${outfits[0]}` : ''} unfolds through specific, real-world moments.`;
      factUnits.push(fallbackUnit);
    }
    synIdx++;
  }

  const targetUnits = factUnits.slice(0, 16);
  // Chia mỗi khối mở rộng thành các đoạn văn ngắn 40 - 50 từ xuống dòng rõ ràng theo đúng yêu cầu của người dùng!
  const finalShortParagraphs40To50Words = [];

  targetUnits.forEach((unitText, idx) => {
    const expanded150 = expandFactBlockToAround150Words({
      baseFactText: unitText,
      contextProfile: profile,
      allFactsPool: allSourceSentences,
      language,
      paragraphIndex: idx,
    });

    let h2ForPara;
    if (idx > 0 && idx % 2 === 0) {
      const h2Index = Math.floor((idx - 2) / 2);
      h2ForPara = buildHeadingForParagraph(
        unitText,
        profile,
        h2Index,
        originalHeadings,
        language
      );
    }

    const shortChunks = splitTextInto40To50WordParagraphs(expanded150);
    shortChunks.forEach((chunkText, subIdx) => {
      finalShortParagraphs40To50Words.push({
        h2: subIdx === 0 ? h2ForPara : undefined,
        text: chunkText,
      });
    });
  });

  const htmlBlocks = [];
  const totalParas = finalShortParagraphs40To50Words.length;
  let imgIdx = 0;

  const buildImageCaptionFromParagraphs = (img, displayNum) => {
    const rawAlt = String((img && img.alt) || '').trim();
    const isGenericOrCuriosityAlt =
      !rawAlt ||
      rawAlt === articleTitle ||
      /\?$|\b(recognize|who are they|who is he|who is she|article image|key photo|story image)\b/i.test(
        rawAlt
      );
    if (!isGenericOrCuriosityAlt && rawAlt.length >= 12) {
      return rawAlt;
    }
    if (allSourceSentences.length > 0) {
      const matchingSent =
        allSourceSentences[(displayNum - 1) % allSourceSentences.length] || '';
      const shortSent = matchingSent.split(/\s+/).slice(0, 18).join(' ').replace(/[,:;]+$/, '');
      if (shortSent.length >= 15) {
        return `${subjectPair}: ${shortSent}${shortSent.endsWith('.') ? '' : '...'}`;
      }
    }
    return `${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` (${outfits[0]})` : ''} - Photo #${displayNum}`;
  };

  const renderFigureBlock = (img, displayNum) => {
    const cleanAlt = buildImageCaptionFromParagraphs(img, displayNum);
    const altText = String(cleanAlt).replace(/"/g, '&quot;');
    const sourceBadge = img.isExternal
      ? isVi
        ? `Ảnh bổ sung #${displayNum}`
        : `Supplemental Photo #${displayNum}`
      : isVi
      ? `Ảnh trong bài #${displayNum}`
      : `Article Photo #${displayNum}`;
    return `<figure class="wp-block-image size-large article-image-block" style="margin: 24px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" loading="lazy" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
  };

  if (images.length > 0) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

  const remainingImgs = Math.max(0, images.length - imgIdx);
  const imgStep =
    remainingImgs > 0 ? Math.max(2, Math.floor(totalParas / (remainingImgs + 1))) : 999;

  finalShortParagraphs40To50Words.forEach((item, idx) => {
    if (item.h2) {
      htmlBlocks.push(
        `<h2 style="margin: 28px 0 14px 0; font-weight: 800; line-height: 1.35;">${item.h2}</h2>`
      );
    }

    htmlBlocks.push(
      `<p style="margin: 0 0 18px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>`
    );

    if (
      imgIdx < images.length &&
      ((idx + 1) % imgStep === 0 || idx >= totalParas - (images.length - imgIdx))
    ) {
      htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
    }
  });

  while (imgIdx < images.length) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
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
    paragraphCount: finalShortParagraphs40To50Words.length,
  };
}

async function tryDiscoverSourceArticleImagesFromText(rawTitle, rawBodyText) {
  const candidateOrigins = ['https://beaware.fun'];
  const slugFromTitle = String(rawTitle || '')
    .toLowerCase()
    .replace(/['’"“”?!:;,.()[\]]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const firstSentence = splitIntoSentences(rawBodyText)[0] || '';
  const searchSnippet = firstSentence
    .split(/\s+/)
    .slice(0, 9)
    .join(' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const origin of candidateOrigins) {
    try {
      if (slugFromTitle && slugFromTitle.length >= 12) {
        const slugUrl = `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slugFromTitle)}&_embed`;
        const res = await fetchWithTimeout(
          slugUrl,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr[0] && arr[0].link) {
            const scraped = await scrapeWebArticleForSeoRewrite(String(arr[0].link));
            if (scraped.images.length > 0) {
              return {
                title: scraped.originalTitle,
                excerpt: scraped.originalExcerpt,
                articleText: scraped.articleText,
                sourceUrl: scraped.sourceUrl,
                images: scraped.images,
              };
            }
          }
        }
      }

      if (searchSnippet && searchSnippet.length >= 18) {
        const searchUrl = `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchSnippet)}&per_page=3&_embed`;
        const res = await fetchWithTimeout(
          searchUrl,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            const probeWords = searchSnippet.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
            const matchedPost =
              arr.find((p) =>
                stripHtmlTags(String((p && p.content && p.content.rendered) || ''))
                  .toLowerCase()
                  .includes(probeWords)
              ) || arr[0];
            if (matchedPost && matchedPost.link) {
              const scraped = await scrapeWebArticleForSeoRewrite(String(matchedPost.link));
              if (scraped.images.length > 0) {
                return {
                  title: scraped.originalTitle,
                  excerpt: scraped.originalExcerpt,
                  articleText: scraped.articleText,
                  sourceUrl: scraped.sourceUrl,
                  images: scraped.images,
                };
              }
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

async function generateSeoArticleWithAiFast(params) {
  const language = params.language === 'vi' ? 'vi' : 'en';
  let scrapedImages = [];
  let sourceTitle = params.existingTitle ? cleanScrapedTitle(params.existingTitle) : '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  const extractNonImageHttpUrl = (inputStr) => {
    const matches = String(inputStr || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const rawM of matches) {
      const cleaned = rawM.replace(/[),.;]+$/, '');
      if (!/\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i.test(cleaned) && !/youtube\.com|youtu\.be/i.test(cleaned)) {
        return cleaned;
      }
    }
    return '';
  };

  const urlToScrape =
    String(params.sourceUrl || '').trim() ||
    extractNonImageHttpUrl(params.topic) ||
    extractNonImageHttpUrl(params.existingContent);

  if (urlToScrape) {
    try {
      const scraped = await scrapeWebArticleForSeoRewrite(urlToScrape);
      scrapedImages = scraped.images;
      if (
        scraped.originalTitle &&
        (!sourceTitle ||
          params.mode === 'from_url' ||
          (!/[?!:]/.test(sourceTitle) && /[?!:]/.test(scraped.originalTitle)))
      ) {
        sourceTitle = scraped.originalTitle;
      }
      sourceExcerpt = scraped.originalExcerpt;
      sourceArticleText = scraped.articleText;
      resolvedSourceUrl = scraped.sourceUrl;
    } catch (err) {
      if (params.mode === 'from_url') throw err;
    }
  }

  const isGeneratedBoilerplate = (txt) =>
    /Across the paragraphs and illustrative photographs of the report|Looking closely at the specific details documented in this passage and the accompanying photographs|🎬 Related Videos & Exclusive Moments|🎬 Video Liên Quan Đáng Chú Ý/i.test(
      txt
    );

  const rawHtmlOrText = [params.topic, params.existingContent]
    .map((s) => String(s || '').trim())
    .filter((s) => s && s !== sourceTitle && s !== urlToScrape && !isGeneratedBoilerplate(s))
    .join('\n\n');

  if (!sourceArticleText && rawHtmlOrText) {
    const extractedParas = [];
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let pm;
    while ((pm = pRegex.exec(rawHtmlOrText)) !== null) {
      const cleanP = stripHtmlTags(pm[2])
        .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
        .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        cleanP.length >= 20 &&
        !isGeneratedBoilerplate(cleanP) &&
        !extractedParas.includes(cleanP)
      ) {
        extractedParas.push(cleanP);
      }
    }

    if (extractedParas.length > 0) {
      sourceArticleText = extractedParas.join('\n\n');
    } else {
      sourceArticleText = stripHtmlTags(rawHtmlOrText)
        .replace(/https?:\/\/[^\s"'<>]+/gi, '')
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 20 && !isGeneratedBoilerplate(l))
        .join('\n\n');
    }
  }

  if (Array.isArray(params.existingImages) && params.existingImages.length > 0) {
    const seen = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const ex of params.existingImages) {
      if (!ex || !ex.url) continue;
      const k = String(ex.url).split('?')[0].toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        scrapedImages.push({
          url: String(ex.url),
          alt: String(ex.alt || sourceTitle || 'Article Image'),
          isFeatured: scrapedImages.length === 0,
          isExternal: Boolean(ex.isExternal),
        });
      }
    }
  }

  if (params.existingContent || params.topic) {
    const existingImgs = collectImgsFromHtml(
      `${params.topic || ''}\n${params.existingContent || ''}`,
      resolvedSourceUrl || DEFAULT_WP_SITE
    );
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

  if ((scrapedImages.length === 0 || !sourceArticleText) && (sourceTitle || sourceArticleText || params.topic)) {
    const discovered = await tryDiscoverSourceArticleImagesFromText(
      sourceTitle || params.topic,
      sourceArticleText || params.topic
    );
    if (discovered && discovered.images.length > 0) {
      if (scrapedImages.length === 0) scrapedImages = discovered.images;
      if (
        discovered.title &&
        (!sourceTitle || (!/[?!:]/.test(sourceTitle) && /[?!:]/.test(discovered.title)))
      ) {
        sourceTitle = discovered.title;
      }
      if (!sourceExcerpt && discovered.excerpt) sourceExcerpt = discovered.excerpt;
      if (!sourceArticleText && discovered.articleText) sourceArticleText = discovered.articleText;
      if (!resolvedSourceUrl && discovered.sourceUrl) resolvedSourceUrl = discovered.sourceUrl;
    }
  }

  const contextProfile = analyzeArticleSubjectAndContext(
    sourceTitle || params.topic,
    sourceArticleText || params.existingContent || params.topic,
    params.keyword,
    scrapedImages
  );

  const effectiveTopic =
    sourceTitle || String(params.topic || '').trim() || String(params.existingContent || '').slice(0, 120);
  const kw =
    contextProfile.primaryPerson ||
    String(params.keyword || '').trim() ||
    effectiveTopic.split(/[:–—|-]/)[0].trim();

  const generatedTitle = cleanScrapedTitle(
    sourceTitle ||
      String(params.topic || '').split('\n')[0].trim().slice(0, 95) ||
      'Exclusive Celebrity Story & Highlights',
    resolvedSourceUrl || urlToScrape
  );

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

  const firstCleanSent = splitIntoSentences(sourceArticleText)[0] || '';
  const generatedExcerpt =
    sourceExcerpt ||
    (firstCleanSent
      ? firstCleanSent.slice(0, 158)
      : `Read the full story about ${contextProfile.subjectDisplay || kw}.`);

  const generatedKeyword =
    (contextProfile.primaryPerson || kw).slice(0, 55) || 'Celebrity';
  const generatedTags = [
    contextProfile.primaryPerson || generatedKeyword,
    ...(contextProfile.secondaryPerson ? [contextProfile.secondaryPerson] : []),
    ...(contextProfile.supportingEntities || []).slice(0, 2),
    params.categoryName || 'Showbiz',
    'Celeb24h',
  ];

  const searchTopicQuery =
    contextProfile.combinedSearchQuery || generatedKeyword || generatedTitle;

  const originalOnlyImages = scrapedImages.filter((im) => !im.isExternal);
  const relatedVideos = await searchRelatedYouTubeVideos(searchTopicQuery, 2, contextProfile);

  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    images: [],
    youtubeVideos: relatedVideos,
    language,
    contextProfile,
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
    featuredImageUrl: (originalOnlyImages[0] && originalOnlyImages[0].url) || '',
    extractedImages: originalOnlyImages,
    sourceImages: originalOnlyImages,
    externalImages: [],
    originalImageCount: originalOnlyImages.length,
    externalImageCount: 0,
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
          existingTitle: body.existingTitle ? String(body.existingTitle) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
          existingImages: Array.isArray(body.existingImages) ? body.existingImages : undefined,
        });
        return res.status(200).json(result);
      }

      // 2. Xử lý tìm 2 Video YouTube liên quan
      if (action === 'search_youtube') {
        const query = String(body.query || '');
        const customQuery = String(body.customQuery || '').trim();
        const excludeVideoIds = Array.isArray(body.excludeVideoIds) ? body.excludeVideoIds : [];
        const existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        let effectiveTitle = String(body.title || query);
        let effectiveText = String(body.articleText || '')
          .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        let ctxProfile = analyzeArticleSubjectAndContext(
          effectiveTitle,
          effectiveText || query,
          customQuery || query,
          existingImgs
        );

        if (!ctxProfile.primaryPerson || effectiveText.length < 100) {
          const urlMatch = String(body.articleText || body.query || '').match(
            /https?:\/\/[^\s"'<>]+/i
          );
          const urlCandidate =
            String(body.sourceUrl || '').trim() || (urlMatch ? urlMatch[0] : '');
          if (urlCandidate) {
            try {
              const scraped = await scrapeWebArticleForSeoRewrite(urlCandidate);
              if (scraped.articleText) effectiveText = scraped.articleText;
              if (scraped.originalTitle) effectiveTitle = scraped.originalTitle;
            } catch {}
          }
          if (!effectiveText || effectiveText.length < 100) {
            const disc = await tryDiscoverSourceArticleImagesFromText(
              effectiveTitle,
              effectiveText || query
            );
            if (disc) {
              if (disc.articleText) effectiveText = disc.articleText;
              if (disc.title) effectiveTitle = disc.title;
            }
          }
          ctxProfile = analyzeArticleSubjectAndContext(
            effectiveTitle,
            effectiveText || query,
            customQuery || query,
            existingImgs
          );
        }

        const effectiveSearchInput =
          customQuery || (ctxProfile && ctxProfile.combinedSearchQuery) || query;
        const videos = await searchRelatedYouTubeVideos(
          effectiveSearchInput,
          Number(body.limit || 2),
          ctxProfile,
          excludeVideoIds
        );
        return res.status(200).json({
          ok: true,
          videos,
          primaryPerson: (ctxProfile && ctxProfile.primaryPerson) || '',
          searchQuery: effectiveSearchInput,
        });
      }

      // 3. Xử lý tìm thêm ảnh ngoài (hoặc tự động dò ảnh bài gốc nếu chưa có ảnh gốc)
      if (action === 'search_external_images') {
        const query = String(body.query || '');
        const forceExternalSearch = Boolean(body.forceExternalSearch);
        let existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        let discoveredOrigImgs = [];
        let effectiveTitle = String(body.title || '');
        let effectiveText = String(body.articleText || '')
          .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        let ctxProfile = analyzeArticleSubjectAndContext(
          effectiveTitle || query,
          effectiveText || query,
          query,
          existingImgs
        );

        const hasOrigImgs = existingImgs.some((im) => im && !im.isExternal);
        const needsSourceDiscovery =
          !hasOrigImgs || !ctxProfile.primaryPerson || effectiveText.length < 100;

        if (needsSourceDiscovery) {
          const urlMatch = String(body.articleText || body.query || '').match(
            /https?:\/\/[^\s"'<>]+/i
          );
          const urlCandidate =
            String(body.sourceUrl || '').trim() || (urlMatch ? urlMatch[0] : '');
          if (urlCandidate) {
            try {
              const scraped = await scrapeWebArticleForSeoRewrite(urlCandidate);
              if (scraped.articleText && scraped.articleText.length > effectiveText.length) {
                effectiveText = scraped.articleText;
              }
              if (scraped.originalTitle && !effectiveTitle) {
                effectiveTitle = scraped.originalTitle;
              }
              if (!hasOrigImgs && scraped.images.length > 0) {
                discoveredOrigImgs = scraped.images.map((im, idx) => ({
                  url: im.url,
                  alt: im.alt || scraped.originalTitle || effectiveTitle,
                  isFeatured: idx === 0,
                  isExternal: false,
                }));
              }
            } catch {}
          }
          if (
            (discoveredOrigImgs.length === 0 && !hasOrigImgs) ||
            !effectiveText ||
            effectiveText.length < 100
          ) {
            const disc = await tryDiscoverSourceArticleImagesFromText(
              effectiveTitle || query,
              effectiveText || query
            );
            if (disc) {
              if (disc.articleText && disc.articleText.length > effectiveText.length) {
                effectiveText = disc.articleText;
              }
              if (disc.title && !effectiveTitle) {
                effectiveTitle = disc.title;
              }
              if (!hasOrigImgs && disc.images.length > 0) {
                discoveredOrigImgs = disc.images.map((im, idx) => ({
                  url: im.url,
                  alt: im.alt || disc.title || effectiveTitle,
                  isFeatured: idx === 0,
                  isExternal: false,
                }));
              }
            }
          }
          if (discoveredOrigImgs.length > 0) {
            existingImgs = [...discoveredOrigImgs, ...existingImgs];
          }
          ctxProfile = analyzeArticleSubjectAndContext(
            effectiveTitle || query,
            effectiveText || query,
            query,
            existingImgs
          );
        }

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

        const requestedLimit = Number(body.limit || 6);
        const neededCount = forceExternalSearch
          ? requestedLimit
          : Math.max(1, requestedLimit);
        const extImages =
          neededCount > 0
            ? await searchExternalRelatedImages(
                (ctxProfile && ctxProfile.combinedSearchQuery) || query,
                neededCount,
                excludeKeys,
                ctxProfile
              )
            : [];
        return res.status(200).json({
          ok: true,
          images: [...discoveredOrigImgs, ...extImages],
          externalImages: extImages,
          originalImages: discoveredOrigImgs,
          primaryPerson: (ctxProfile && ctxProfile.primaryPerson) || '',
          searchQuery: (ctxProfile && ctxProfile.combinedSearchQuery) || query,
        });
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
      let pubTitle = String(body.title || '').trim();
      let pubContent = String(body.content || '').trim();
      let pubExcerpt = String(body.excerpt || '').trim();
      let candidateImgs = Array.isArray(body.extractedImages)
        ? body.extractedImages.filter((im) => im && im.url)
        : [];

      const isBrokenFallbackDraft =
        /Across the paragraphs and illustrative photographs of the report, the story of/i.test(
          pubContent
        ) ||
        /Read the full story about .*?\s+\./i.test(pubExcerpt);

      if (isBrokenFallbackDraft || !/<img\b/i.test(pubContent)) {
        if (isBrokenFallbackDraft) {
          try {
            const regenerated = await generateSeoArticleWithAiFast({
              mode: body.sourceUrl ? 'from_url' : 'from_text',
              topic: body.sourceUrl || pubTitle,
              sourceUrl: body.sourceUrl,
              language: 'en',
            });
            if (regenerated && regenerated.contentHtml && /<img\b/i.test(regenerated.contentHtml)) {
              pubTitle = regenerated.title || pubTitle;
              pubContent = regenerated.contentHtml;
              pubExcerpt = regenerated.excerpt || pubExcerpt;
              if (Array.isArray(regenerated.extractedImages) && regenerated.extractedImages.length > 0) {
                candidateImgs = regenerated.extractedImages;
              }
              if (!body.featuredImageUrl && regenerated.featuredImageUrl) {
                body.featuredImageUrl = regenerated.featuredImageUrl;
              }
            }
          } catch {}
        }

        if (!/<img\b/i.test(pubContent)) {
          if (candidateImgs.length === 0 && body.sourceUrl) {
            try {
              const scraped = await scrapeWebArticleForSeoRewrite(String(body.sourceUrl));
              candidateImgs = [...scraped.images];
            } catch {}
          }
          if (candidateImgs.length === 0 && (pubTitle || pubContent)) {
            try {
              const discovered = await tryDiscoverSourceArticleImagesFromText(pubTitle, pubContent);
              if (discovered && discovered.images.length > 0) {
                candidateImgs = [...discovered.images];
                if (discovered.title && !/[?!:]/.test(pubTitle) && /[?!:]/.test(discovered.title)) {
                  pubTitle = discovered.title;
                }
              }
            } catch {}
          }
          if (candidateImgs.length < 5) {
            try {
              const ctxProfile = analyzeArticleSubjectAndContext(
                pubTitle,
                pubContent,
                undefined,
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
      }
      body.excerpt = pubExcerpt;

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
            const tryDownloadImg = async (u, ref) => {
              try {
                const r = await fetchWithTimeout(
                  u,
                  {
                    headers: {
                      'User-Agent': SCRAPER_USER_AGENT,
                      Referer: ref,
                      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                    },
                  },
                  4500
                );
                if (!r.ok) return null;
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                if (ct.includes('text/html')) return null;
                const arr = await r.arrayBuffer();
                const b = Buffer.from(arr);
                if (b.byteLength < 400) return null;
                return { buf: b, mime: ct.startsWith('image/') ? ct.split(';')[0] : 'image/jpeg' };
              } catch {
                return null;
              }
            };
            let dl = await tryDownloadImg(String(effectiveFeaturedUrl), refererOrigin);
            if (!dl) {
              const wsrv = `https://wsrv.nl/?url=${encodeURIComponent(String(effectiveFeaturedUrl))}&output=jpg`;
              dl = await tryDownloadImg(wsrv, 'https://wsrv.nl/');
            }
            if (dl) {
              buffer = dl.buf;
              mimeType = dl.mime;
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
