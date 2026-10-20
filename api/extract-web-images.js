const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function resolveAbsoluteUrl(rawUrl, baseUrl) {
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
  '120x240', '300x600', '250x250', '200x200', '180x150', '125x125',
  '88x31', '120x90', '120x60', '234x60', '240x400', '300x1050',
]);

function isJunkImageUrl(url, altText = '', tagHtml = '') {
  const lower = String(url || '').toLowerCase().trim();
  if (
    !lower ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('.svg?') ||
    lower.includes('.gif?') ||
    lower.includes('.ico?') ||
    lower.includes('gravatar.com') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('emoji') ||
    lower.includes('smilies') ||
    lower.includes('favicon') ||
    lower.includes('site-logo') ||
    lower.includes('custom-logo') ||
    lower.includes('logo') ||
    lower.includes('avatar') ||
    lower.includes('icon') ||
    lower.includes('badge') ||
    lower.includes('button') ||
    lower.includes('pixel') ||
    lower.includes('analytics') ||
    lower.includes('doubleclick') ||
    lower.includes('googlesyndication') ||
    lower.includes('googleadservices') ||
    lower.includes('adservice') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('google-analytics') ||
    lower.includes('mgid.com') ||
    lower.includes('avplayer.com') ||
    lower.includes('taboola') ||
    lower.includes('outbrain') ||
    lower.includes('revcontent') ||
    lower.includes('adskeeper') ||
    lower.includes('adblade') ||
    lower.includes('zergnet') ||
    lower.includes('criteo') ||
    lower.includes('adnxs') ||
    lower.includes('rubiconproject') ||
    lower.includes('pubmatic') ||
    lower.includes('openx') ||
    lower.includes('smartadserver') ||
    lower.includes('amazon-adsystem') ||
    lower.includes('media.net') ||
    lower.includes('propellerads') ||
    lower.includes('popads') ||
    lower.includes('exoclick') ||
    lower.includes('adsterra') ||
    lower.includes('monumetric') ||
    lower.includes('mediavine') ||
    lower.includes('adthrive') ||
    lower.includes('raptive') ||
    lower.includes('ezoic') ||
    lower.includes('setupad') ||
    lower.includes('freestar') ||
    lower.includes('playwire') ||
    lower.includes('connatix') ||
    lower.includes('primis') ||
    lower.includes('brid.tv') ||
    lower.includes('vidoomy') ||
    lower.includes('teads') ||
    lower.includes('sharethrough') ||
    lower.includes('triplelift') ||
    lower.includes('nativo') ||
    lower.includes('zemanta') ||
    lower.includes('dianomi') ||
    lower.includes('plista') ||
    lower.includes('engageya') ||
    lower.includes('content.ad') ||
    lower.includes('lockerdome') ||
    lower.includes('bidvertiser') ||
    lower.includes('infolinks') ||
    lower.includes('viglink') ||
    lower.includes('skimlinks') ||
    lower.includes('sovrn') ||
    lower.includes('awin1') ||
    lower.includes('impact.com') ||
    lower.includes('rakuten') ||
    lower.includes('clickbank') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.') ||
    lower.includes('lazyload') ||
    lower.includes('placeholder') ||
    lower.includes('loading.') ||
    lower.includes('spinner') ||
    lower.includes('adbanner') ||
    lower.includes('ad-banner') ||
    lower.includes('ad_banner') ||
    lower.includes('adsense') ||
    lower.includes('adsbygoogle') ||
    lower.includes('sponsored') ||
    lower.includes('affiliate')
  ) {
    return true;
  }

  if (
    /(\/|^)(ads?|adv|advert|advertisement|banners?|sponsors?|sponsored|promo|promotions?|affiliates?|popups?|cta|dfp|adserver|adunit|adslot)(\/|-|_|\.|\?|$)/i.test(
      lower
    )
  ) {
    return true;
  }

  if (
    /[?&](ad|ads|ad_id|adunit|campaign_id|click_id|aff_id|affiliate_id|utm_medium=(banner|cpc|display|sponsored|affiliate))\b/i.test(
      lower
    )
  ) {
    return true;
  }

  const dimMatches = [...lower.matchAll(/[_-](\d{2,4})x(\d{2,4})(?=\.(jpg|jpeg|png|webp|avif)|[_-]|$)/gi)];
  for (const dm of dimMatches) {
    const w = Number(dm[1]);
    const h = Number(dm[2]);
    const dimKey = `${w}x${h}`;
    if (AD_BANNER_DIMENSIONS.has(dimKey)) return true;
    if (w > 0 && h > 0) {
      if (w < 180 || h < 140 || w * h < 32000) return true;
      if (w >= 300 && h <= 120 && w / h >= 3.2) return true;
      if (h >= 400 && w <= 200 && h / w >= 2.4) return true;
    }
  }

  if (altText) {
    const lowerAlt = String(altText).toLowerCase().trim();
    if (
      /^(advertisement|sponsored|promoted|ad|ads|banner|quảng cáo|tài trợ|liên kết tài trợ)$/i.test(
        lowerAlt
      ) ||
      /\b(advertisement|sponsored content|promoted link|ad banner|quảng cáo|nhà tài trợ)\b/i.test(
        lowerAlt
      )
    ) {
      return true;
    }
  }

  if (tagHtml) {
    const lowerTag = String(tagHtml).toLowerCase();
    if (
      /\b(class|id|data-ad|data-widget)=["'][^"']*(ad-|ads-|advert|banner|sponsor|promo|affiliate|mgid|taboola|outbrain|revcontent|adsbygoogle|code-block|ai-insert|quads|advads|adrotate|widget|sidebar|related-post)/i.test(
        lowerTag
      )
    ) {
      return true;
    }
  }

  return false;
}

function pickBestUrlFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const cleanedSrcset = String(srcset).replace(/data:image\/[^,\s]+,[^\s,]+/gi, '');
  const candidates = [];
  const parts = cleanedSrcset.split(/,\s*(?=(?:https?:\/\/|\/))/i);
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length === 0 || !tokens[0] || tokens[0].startsWith('data:')) continue;
    const u = resolveAbsoluteUrl(tokens[0], baseUrl);
    if (!u || isJunkImageUrl(u)) continue;
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

async function fetchImageAsDataUrl(imageUrl, refererUrl) {
  const tryDownload = async (targetUrl, ref) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          ...(ref ? { Referer: ref } : {}),
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength < 3500) {
        return null;
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${contentType.split(';')[0]};base64,${base64}`;
    } catch {
      return null;
    }
  };

  const direct = await tryDownload(imageUrl, refererUrl);
  if (direct) return direct;
  const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=jpg`;
  return tryDownload(proxyUrl, '');
}

function extractImagesFromHtmlChunk(rawHtmlChunk, baseUrl) {
  const results = [];
  let htmlChunk = String(rawHtmlChunk || '')
    .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, '$1')
    .replace(/<ins\b[^>]*>[\s\S]*?<\/ins>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(
      /<(div|section|aside|ul|figure|p|span)\b[^>]+(class|id|data-ad|data-widget|data-type)=["'][^"']*(ad-|ads-|advert|banner|sponsor|promo|affiliate|mgid|taboola|outbrain|revcontent|zergnet|adskeeper|adsbygoogle|google-auto-placed|code-block|ai-insert|ai-viewports|quads|advads|adrotate|related|yarpp|sharedaddy|jp-relatedposts|sidebar|widget|more-posts|popular-posts|recent-posts|trending|must-read|also-read|read-more|post-navigation|nav-links|author-box|comments|newsletter|subscribe|popup|modal|cookie)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (fullMatch, aAttrs, innerHtml) => {
      if (!/<img\b/i.test(innerHtml)) return fullMatch;
      if (/\brel=["'][^"']*sponsored/i.test(aAttrs)) return '';
      if (
        /\b(class|id)=["'][^"']*(ad-|ads-|advert|banner|sponsor|promo|affiliate|mgid|taboola|outbrain)/i.test(
          aAttrs
        )
      ) {
        return '';
      }
      const hrefMatch = aAttrs.match(/\bhref=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1]) {
        const rawHref = hrefMatch[1].trim();
        if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:')) {
          const isDirectImageLink =
            /\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(rawHref) ||
            /\/wp-content\/uploads\//i.test(rawHref) ||
            /\/attachment\//i.test(rawHref);
          if (!isDirectImageLink) {
            return '';
          }
        }
      }
      return innerHtml;
    });

  htmlChunk = htmlChunk.replace(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi, (_full, inner) => {
    const imgMatch = inner.match(/<img\b[^>]*>/i);
    if (!imgMatch) return '';
    const imgTag = imgMatch[0];
    if (/\b(srcset|data-srcset|data-lazy-srcset)=/i.test(imgTag)) return imgTag;
    const sourceMatch = inner.match(
      /<source\b[^>]*\b(?:data-srcset|data-lazy-srcset|srcset)=["']([^"']+)["'][^>]*>/i
    );
    if (sourceMatch && sourceMatch[1]) {
      return imgTag.replace(/<img\b/i, `<img data-picture-srcset="${sourceMatch[1]}"`);
    }
    return imgTag;
  });

  const imgTagRegex = /<img\b[^>]*>/gi;
  let match;

  while ((match = imgTagRegex.exec(htmlChunk)) !== null) {
    const tag = match[0];
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';

    if (isJunkImageUrl('https://example.com/photo.jpg', alt, tag)) continue;

    const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const heightMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (widthMatch && heightMatch) {
      const w = Number(widthMatch[1]);
      const h = Number(heightMatch[1]);
      if (w > 0 && h > 0) {
        if (w < 180 || h < 140 || w * h < 32000) continue;
        if (AD_BANNER_DIMENSIONS.has(`${w}x${h}`)) continue;
        if (w >= 300 && h <= 120 && w / h >= 3.2) continue;
        if (h >= 400 && w <= 200 && h / w >= 2.4) continue;
      }
    } else if (widthMatch) {
      const w = Number(widthMatch[1]);
      if (w > 0 && w < 180) continue;
    } else if (heightMatch) {
      const h = Number(heightMatch[1]);
      if (h > 0 && h < 140) continue;
    }

    let chosenUrl = '';
    const lazyAttrs = [
      'data-orig-file',
      'data-large-file',
      'data-full-url',
      'data-hi-res-src',
      'data-original',
      'data-lazy-src',
      'data-src',
      'data-url',
      'data-img-url',
    ];
    for (const attr of lazyAttrs) {
      const mAttr = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'));
      if (mAttr && mAttr[1] && !mAttr[1].trim().startsWith('data:')) {
        const cand = resolveAbsoluteUrl(mAttr[1], baseUrl);
        if (cand && !isJunkImageUrl(cand, alt, tag)) {
          chosenUrl = cand;
          break;
        }
      }
    }

    if (!chosenUrl) {
      const srcsetMatch =
        tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
        tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
        tag.match(/\bsrcset=["']([^"']+)["']/i) ||
        tag.match(/\bdata-picture-srcset=["']([^"']+)["']/i);
      if (srcsetMatch && srcsetMatch[1] && !srcsetMatch[1].trim().startsWith('data:')) {
        chosenUrl = pickBestUrlFromSrcset(srcsetMatch[1], baseUrl);
      }
    }

    if (!chosenUrl) {
      const srcAttr = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1] && !srcAttr[1].trim().startsWith('data:')) {
        chosenUrl = resolveAbsoluteUrl(srcAttr[1], baseUrl);
      }
    }

    if (!chosenUrl || isJunkImageUrl(chosenUrl, alt, tag)) continue;
    if (chosenUrl.includes('/wp-content/uploads/')) {
      chosenUrl = chosenUrl.replace(
        /-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+|768x\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i,
        ''
      );
    }
    if (isJunkImageUrl(chosenUrl, alt, tag)) continue;

    results.push({ url: chosenUrl, alt });
  }

  return results;
}

function extractImagesFromJsonLd(html, baseUrl) {
  const urls = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  const collectFromNode = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(collectFromNode);
      return;
    }
    const imgField = node.image || node.thumbnailUrl;
    if (typeof imgField === 'string') {
      const u = resolveAbsoluteUrl(imgField, baseUrl);
      if (u) urls.push(u);
    } else if (Array.isArray(imgField)) {
      for (const item of imgField) {
        if (typeof item === 'string') {
          const u = resolveAbsoluteUrl(item, baseUrl);
          if (u) urls.push(u);
        } else if (item && typeof item.url === 'string') {
          const u = resolveAbsoluteUrl(item.url, baseUrl);
          if (u) urls.push(u);
        }
      }
    } else if (imgField && typeof imgField.url === 'string') {
      const u = resolveAbsoluteUrl(imgField.url, baseUrl);
      if (u) urls.push(u);
    }
    if (node['@graph'] && Array.isArray(node['@graph'])) {
      node['@graph'].forEach(collectFromNode);
    }
  };

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      collectFromNode(parsed);
    } catch {
      // Ignore malformed JSON-LD
    }
  }
  return urls;
}

function stripTrackingParams(rawUrl) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawInputUrl = req.method === 'POST' ? req.body?.url : req.query?.url;
    let cleanUrl = String(rawInputUrl || '').trim();
    if (!cleanUrl) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập đường dẫn (URL) bài viết web!' });
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }
    cleanUrl = stripTrackingParams(cleanUrl);

    const parsedUrl = new URL(cleanUrl);
    const origin = parsedUrl.origin;

    let title = '';
    let excerpt = '';
    const candidateImages = [];
    const seenNormalized = new Set();

    const addCandidate = (url, alt = '', isFeatured = false) => {
      const resolved = resolveAbsoluteUrl(url, cleanUrl);
      if (!resolved || isJunkImageUrl(resolved)) return;
      const dedupeKey = resolved
        .split('?')[0]
        .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)$)/i, '')
        .toLowerCase();
      if (seenNormalized.has(dedupeKey)) return;
      seenNormalized.add(dedupeKey);
      candidateImages.push({ url: resolved, alt, isFeatured });
    };

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const numericIdMatch =
      pathSegments.length > 0 && /^\d+$/.test(pathSegments[0])
        ? Number(pathSegments[0])
        : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p'))
        ? Number(parsedUrl.searchParams.get('p'))
        : null;

    let articleBodySample = '';
    const extractedParagraphs = [];
    let matchedWpPostId = 0;

    const collectParagraphsFromHtml = (htmlChunk) => {
      const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let m;
      while ((m = pRegex.exec(htmlChunk)) !== null) {
        const text = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .trim();
        if (
          text.length >= 35 &&
          !/^(read more|related|share this|follow us|copyright|all rights reserved|photo:|credit:|source:|advertisement|subscribe|sign up|click here|see also)/i.test(text) &&
          !extractedParagraphs.includes(text)
        ) {
          extractedParagraphs.push(text);
        }
      }
    };

    const tryFetchWpRestPost = async (apiEndpointUrl) => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4500);
        const wpRes = await fetch(
          apiEndpointUrl.includes('_embed')
            ? apiEndpointUrl
            : `${apiEndpointUrl}${apiEndpointUrl.includes('?') ? '&' : '?'}_embed`,
          { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal }
        ).finally(() => clearTimeout(t));
        if (!wpRes.ok) return;
        const rawJson = await wpRes.json();
        const postJson = Array.isArray(rawJson) ? rawJson[0] : rawJson;
        if (postJson && postJson.id) {
          matchedWpPostId = Number(postJson.id) || 0;
          if (!title) title = decodeHtmlEntities(postJson.title?.rendered || '');
          if (!excerpt) {
            excerpt = decodeHtmlEntities(
              String(postJson.excerpt?.rendered || '').replace(/<[^>]+>/g, '')
            );
          }
          const embeddedMedia = postJson._embedded?.['wp:featuredmedia']?.[0];
          const featUrl =
            embeddedMedia?.media_details?.sizes?.full?.source_url ||
            embeddedMedia?.media_details?.sizes?.large?.source_url ||
            embeddedMedia?.source_url ||
            '';
          if (featUrl) {
            addCandidate(featUrl, title || 'Ảnh đại diện bài viết', true);
          }
          const contentHtml = postJson.content?.rendered || '';
          collectParagraphsFromHtml(contentHtml);
          articleBodySample = decodeHtmlEntities(contentHtml.replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2000);
          const contentImgs = extractImagesFromHtmlChunk(contentHtml, cleanUrl);
          for (const img of contentImgs) {
            addCandidate(img.url, img.alt || title, candidateImages.length === 0);
          }
        }
      } catch {
        // Fallback
      }
    };

    if (numericIdMatch) {
      await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericIdMatch}?_embed`);
    } else if (pathSegments.length > 0) {
      const slugCandidates = pathSegments
        .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
        .filter((s) => s && !/^\d+$/.test(s) && !/^(vn\d*|en\d*|us\d*|uk\d*|amp|feed|print|page)$/i.test(s) && !(s.length <= 4 && /^[a-z]{1,3}\d{1,2}$/i.test(s)))
        .sort((a, b) => b.length - a.length);
      const lastSegment = slugCandidates[0] || '';
      if (lastSegment && lastSegment.length >= 3) {
        await tryFetchWpRestPost(
          `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSegment)}&_embed`
        );
        if (candidateImages.length === 0 && extractedParagraphs.length === 0) {
          const searchWords = lastSegment.replace(/[-_]+/g, ' ').trim();
          if (searchWords.length >= 5) {
            await tryFetchWpRestPost(
              `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchWords)}&per_page=1&_embed`
            );
          }
        }
      }
    }

    if (matchedWpPostId > 0 && candidateImages.length === 0) {
      try {
        const mediaRes = await fetch(
          `${origin}/wp-json/wp/v2/media?parent=${matchedWpPostId}&per_page=20`,
          { headers: { 'User-Agent': USER_AGENT } }
        );
        if (mediaRes.ok) {
          const mediaItems = await mediaRes.json();
          if (Array.isArray(mediaItems)) {
            for (const mItem of mediaItems) {
              const mUrl =
                mItem?.media_details?.sizes?.full?.source_url ||
                mItem?.media_details?.sizes?.large?.source_url ||
                mItem?.source_url ||
                '';
              const mAlt = decodeHtmlEntities(mItem?.alt_text || mItem?.title?.rendered || title);
              if (mUrl && !isJunkImageUrl(mUrl, mAlt)) {
                addCandidate(mUrl, mAlt, candidateImages.length === 0);
              }
            }
          }
        }
      } catch {}
    }

    if (matchedWpPostId === 0 && (candidateImages.length === 0 || !title || extractedParagraphs.length === 0)) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const pageRes = await fetch(cleanUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(t));

        if (pageRes.ok) {
          const html = await pageRes.text();

          const wpJsonLinkMatch = html.match(
            /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
          );
          if (wpJsonLinkMatch && wpJsonLinkMatch[1] && candidateImages.length === 0) {
            await tryFetchWpRestPost(resolveAbsoluteUrl(wpJsonLinkMatch[1], cleanUrl));
          }

          if (matchedWpPostId === 0 && (candidateImages.length === 0 || !title || extractedParagraphs.length === 0)) {
            if (!title) {
              const ogTitle =
                html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
                html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
              if (ogTitle && ogTitle[1]) {
                title = decodeHtmlEntities(ogTitle[1].replace(/<[^>]+>/g, ''));
              }
            }

            if (!excerpt) {
              const ogDesc =
                html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
              if (ogDesc && ogDesc[1]) {
                excerpt = decodeHtmlEntities(ogDesc[1]);
              }
            }

            const ogImg =
              html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
              html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
            if (ogImg && ogImg[1] && !isJunkImageUrl(ogImg[1], title)) {
              addCandidate(ogImg[1], title || 'Ảnh đại diện', true);
            }

            const jsonLdUrls = extractImagesFromJsonLd(html, cleanUrl);
            for (const jUrl of jsonLdUrls) {
              if (!isJunkImageUrl(jUrl, title)) {
                addCandidate(jUrl, title, candidateImages.length === 0);
              }
            }

            const cleanedBody = html
              .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, '$1')
              .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
              .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
              .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
              .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
              .replace(
                /<(div|section|ul|aside)\b[^>]+(class|id)=["'][^"']*(related|yarpp|sharedaddy|jp-relatedposts|post-navigation|comments-area|sidebar|widget|more-posts|popular-posts|recent-posts|ad-|ads-|advert|banner|sponsor|promo|mgid|taboola|outbrain|code-block|ai-insert)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
                ''
              );

            let primaryZone = cleanedBody;
            const articleTagMatch = cleanedBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
            if (articleTagMatch && articleTagMatch[1]) {
              primaryZone = articleTagMatch[1];
            } else {
              const contentDivStart = cleanedBody.search(
                /<div\b[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content|single-content|article-body|story-body)[^"']*["'][^>]*>/i
              );
              if (contentDivStart !== -1) {
                primaryZone = cleanedBody.slice(contentDivStart, contentDivStart + 90000);
              } else {
                const mainMatch = cleanedBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
                if (mainMatch && mainMatch[1]) primaryZone = mainMatch[1];
              }
            }

            if (extractedParagraphs.length === 0) {
              collectParagraphsFromHtml(primaryZone);
            }
            if (!articleBodySample) {
              articleBodySample = decodeHtmlEntities(primaryZone.replace(/<[^>]+>/g, ' '))
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 2000);
            }
            const articleImgs = extractImagesFromHtmlChunk(primaryZone, cleanUrl);
            for (const img of articleImgs) {
              addCandidate(img.url, img.alt || title, candidateImages.length === 0);
            }
          }
        }
      } catch {}
    }

    // Tầng phá chặn Copy & vượt tường lửa Cloudflare (Jina Reader Headless Browser)
    if (matchedWpPostId === 0 && (candidateImages.length === 0 || extractedParagraphs.length === 0 || !title)) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5800);
        const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
          headers: {
            Accept: 'application/json',
            'X-With-Images-Summary': 'true',
            'User-Agent': USER_AGENT,
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(t));

        if (jinaRes.ok) {
          const jinaJson = await jinaRes.json();
          const jData = jinaJson?.data || {};
          if (!title && jData.title) {
            title = decodeHtmlEntities(String(jData.title))
              .replace(/\s+[|–—-]\s+[^|–—-]{2,35}$/i, '')
              .trim();
          }
          if (!excerpt && jData.description) {
            excerpt = decodeHtmlEntities(String(jData.description)).trim();
          }
          if (jData.content) {
            let rawMd = String(jData.content);
            const footerCutoff = rawMd.search(
              /\n(?:#{1,4}\s*)?(?:Leave a Reply|Leave a Comment|Related Posts|Related Articles|You May Also Like|More From|Recent Posts|Popular Posts|Trending Now|Sponsored Content|Promoted Links|Around the Web)\b/i
            );
            if (footerCutoff !== -1) {
              rawMd = rawMd.slice(0, footerCutoff);
            }
            const cleanedMdForImgs = rawMd.replace(
              /\[!\[([^\]]*)\]\((https?:\/\/[^)\s"']+)\)\]\((https?:\/\/[^)\s"']+)\)/gi,
              (full, _alt, _imgUrl, linkUrl) => {
                if (
                  /\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(linkUrl) ||
                  /\/wp-content\/uploads\//i.test(linkUrl)
                ) {
                  return full;
                }
                return '';
              }
            );

            const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s"']+)\)/gi;
            let mim;
            while ((mim = mdImgRegex.exec(cleanedMdForImgs)) !== null) {
              const altTxt = mim[1].trim();
              const u = mim[2].trim();
              if (!isJunkImageUrl(u, altTxt)) {
                addCandidate(u, altTxt || title || 'Article Image', candidateImages.length === 0);
              }
            }
            if (extractedParagraphs.length === 0) {
              const lines = rawMd
                .split(/\n+/)
                .map((line) =>
                  line
                    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                    .replace(/\[Video\s+\d+\]\([^)]*\)/gi, '')
                    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                    .replace(/[*_#>~`]+/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                )
                .filter(
                  (line) =>
                    line.length >= 40 &&
                    !/^(read more|related|share this|follow us|copyright|all rights reserved|advertisement|sponsored|subscribe|skip to content)/i.test(
                      line
                    )
                );
              for (const l of lines) {
                if (!extractedParagraphs.includes(l)) extractedParagraphs.push(l);
              }
              if (!articleBodySample && extractedParagraphs.length > 0) {
                articleBodySample = extractedParagraphs.join(' ').slice(0, 2000);
              }
            }
          }
          if (candidateImages.length === 0 && jData.images && typeof jData.images === 'object') {
            const articleHost = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();
            for (const [imgKey, rawImgUrl] of Object.entries(jData.images)) {
              const u = String(rawImgUrl || '').trim();
              if (!/^https?:\/\//i.test(u)) continue;
              if (isJunkImageUrl(u, String(imgKey || ''))) continue;
              try {
                const imgHost = new URL(u).hostname.replace(/^www\./i, '').toLowerCase();
                const isSameSiteOrCdn =
                  imgHost === articleHost ||
                  imgHost.endsWith(`.${articleHost}`) ||
                  /wp\.com|cloudinary|imgix|akamaized|cloudfront|fbcdn|twimg|pinimg|imgur|Getty|shutterstock/i.test(
                    imgHost
                  );
                if (!isSameSiteOrCdn) continue;
              } catch {
                continue;
              }
              addCandidate(u, title || 'Article Image', candidateImages.length === 0);
            }
          }
        }
      } catch {}
    }

    const topCandidates = candidateImages.slice(0, 12);
    const downloaded = await Promise.all(
      topCandidates.map(async (item) => {
        const dataUrl = await fetchImageAsDataUrl(item.url, origin);
        return {
          url: item.url,
          dataUrl: dataUrl || item.url,
          alt: item.alt,
          isFeatured: item.isFeatured,
        };
      })
    );

    const validImages = downloaded.filter((x) => Boolean(x && x.url));

    if (validImages.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Không tìm thấy ảnh hợp lệ nào trong bài viết này. Vui lòng thử link bài viết khác!',
      });
    }

    let cleanedTitle = (title || '')
      .replace(/\s+(?:\||::|«|»|\/\/)\s+[^|«»]{1,50}$/g, '')
      .replace(
        /\s+[-–—|]\s+[^|–—-]{2,40}\.(com|net|org|fun|vn|info|us|co\.uk|io|me|tv|news|live|online|site|xyz|club|buzz|today|world|media|press|daily|post|times|magazine)$/i,
        ''
      )
      .trim();
    const hostBrand = parsedUrl.hostname.replace(/^www\./i, '').split('.')[0] || '';
    if (hostBrand && hostBrand.length >= 2) {
      const escapedBrand = hostBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanedTitle = cleanedTitle
        .replace(new RegExp(`\\s+[-–—|:]\\s+${escapedBrand}(?:\\.[a-z.]{2,6})?\\s*$`, 'i'), '')
        .trim();
    }
    const tailMatch = cleanedTitle.match(/^(.*?\S)\s+[-–—]\s+([^|–—-]{2,35})$/);
    if (tailMatch && tailMatch[1].length >= 18) {
      const mainPart = tailMatch[1].trim();
      const tailPart = tailMatch[2].trim();
      const tailWords = tailPart.split(/\s+/);
      const isQuestionOrExclamation = /[?!]$/.test(tailPart);
      const hasStoryClauseWords =
        /\b(her|his|their|them|him|she|he|they|you|your|our|who|what|when|where|why|how|can|do|does|did|would|could|will|is|are|was|were|has|have|had|not|no|never|everyone|anyone|someone|nobody|choice|life|look|looks|years|year|old|age|now|today|after|before|without|with|from|into|about|because|while|still|even|more|most|less|part|episode|season|chapter|actress|actor|star|singer|model|fans|people|world|heart|hearts|plastic|surgery|wrinkles|beach|wedding|divorce|baby|son|daughter|husband|wife|partner)\b/i.test(
          tailPart
        );
      if (!isQuestionOrExclamation && !hasStoryClauseWords && tailWords.length <= 3 && tailPart.length <= 25) {
        cleanedTitle = mainPart;
      }
    }

    return res.status(200).json({
      ok: true,
      sourceUrl: cleanUrl,
      title: cleanedTitle || 'Bài viết từ Website',
      excerpt,
      articleText: extractedParagraphs.join('\n\n').slice(0, 16000) || articleBodySample,
      siteName: parsedUrl.hostname.replace(/^www\./, ''),
      images: validImages,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi khi trích xuất ảnh từ đường dẫn web',
    });
  }
}
