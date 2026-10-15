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

function isJunkImageUrl(url) {
  const lower = url.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('gravatar.com') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('emoji') ||
    lower.includes('smilies') ||
    lower.includes('avatar') ||
    lower.includes('favicon') ||
    lower.includes('logo') ||
    lower.includes('icon') ||
    lower.includes('pixel') ||
    lower.includes('analytics') ||
    lower.includes('doubleclick') ||
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
  const tinyWpMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyWpMatch) {
    const w = Number(tinyWpMatch[1]);
    const h = Number(tinyWpMatch[2]);
    if (w < 160 && h < 160) return true;
  }
  return false;
}

function pickBestUrlFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const candidates = [];
  const parts = srcset.split(',');
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length === 0) continue;
    const u = resolveAbsoluteUrl(tokens[0], baseUrl);
    if (!u) continue;
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
    const scoreA = a.width >= 600 && a.width <= 1600 ? a.width + 2000 : a.width;
    const scoreB = b.width >= 600 && b.width <= 1600 ? b.width + 2000 : b.width;
    return scoreB - scoreA;
  });
  return candidates[0].url;
}

async function fetchImageAsDataUrl(imageUrl, refererUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: refererUrl,
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
}

function extractImagesFromHtmlChunk(htmlChunk, baseUrl) {
  const results = [];

  const sourceTagRegex = /<source\b[^>]*>/gi;
  let sourceMatch;
  while ((sourceMatch = sourceTagRegex.exec(htmlChunk)) !== null) {
    const tag = sourceMatch[0];
    const srcsetMatch =
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (srcsetMatch && srcsetMatch[1]) {
      const bestUrl = pickBestUrlFromSrcset(srcsetMatch[1], baseUrl);
      if (bestUrl && !isJunkImageUrl(bestUrl)) {
        results.push({ url: bestUrl, alt: '' });
      }
    }
  }

  const imgTagRegex = /<img\b[^>]*>/gi;
  let match;

  while ((match = imgTagRegex.exec(htmlChunk)) !== null) {
    const tag = match[0];
    const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const heightMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (widthMatch && heightMatch) {
      const w = Number(widthMatch[1]);
      const h = Number(heightMatch[1]);
      if (w > 0 && h > 0 && w < 120 && h < 120) continue;
    }

    const srcsetMatch =
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);

    let chosenUrl = '';
    if (srcsetMatch && srcsetMatch[1]) {
      chosenUrl = pickBestUrlFromSrcset(srcsetMatch[1], baseUrl);
    }

    if (!chosenUrl) {
      const srcAttr =
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-original=["']([^"']+)["']/i) ||
        tag.match(/\bdata-full-url=["']([^"']+)["']/i) ||
        tag.match(/\bdata-hi-res-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-url=["']([^"']+)["']/i) ||
        tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1]) {
        chosenUrl = resolveAbsoluteUrl(srcAttr[1], baseUrl);
      }
    }

    if (!chosenUrl || isJunkImageUrl(chosenUrl)) continue;

    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';

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

    const tryFetchWpRestPost = async (apiEndpointUrl) => {
      try {
        const wpRes = await fetch(
          apiEndpointUrl.includes('_embed')
            ? apiEndpointUrl
            : `${apiEndpointUrl}${apiEndpointUrl.includes('?') ? '&' : '?'}_embed`,
          { headers: { 'User-Agent': USER_AGENT } }
        );
        if (!wpRes.ok) return;
        const postJson = await wpRes.json();
        if (postJson && postJson.id) {
          if (!title) title = decodeHtmlEntities(postJson.title?.rendered || '');
          if (!excerpt) {
            excerpt = decodeHtmlEntities(
              String(postJson.excerpt?.rendered || '').replace(/<[^>]+>/g, '')
            );
          }
          const embeddedMedia = postJson._embedded?.['wp:featuredmedia']?.[0];
          const featUrl =
            embeddedMedia?.media_details?.sizes?.large?.source_url ||
            embeddedMedia?.source_url ||
            '';
          if (featUrl) {
            addCandidate(featUrl, title || 'Ảnh đại diện bài viết', true);
          }
          const contentHtml = postJson.content?.rendered || '';
          const contentImgs = extractImagesFromHtmlChunk(contentHtml, cleanUrl);
          for (const img of contentImgs) {
            addCandidate(img.url, img.alt || title, false);
          }
        }
      } catch {
        // Fallback
      }
    };

    if (numericIdMatch) {
      await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericIdMatch}?_embed`);
    }

    if (candidateImages.length === 0 || !title) {
      const pageRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!pageRes.ok && candidateImages.length === 0) {
        return res.status(400).json({
          ok: false,
          error: `Không thể truy cập đường dẫn (${pageRes.status}). Hãy kiểm tra lại link!`,
        });
      }

      if (pageRes.ok) {
        const html = await pageRes.text();

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

        const wpJsonLinkMatch = html.match(
          /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
        );
        if (wpJsonLinkMatch && wpJsonLinkMatch[1] && candidateImages.length === 0) {
          await tryFetchWpRestPost(resolveAbsoluteUrl(wpJsonLinkMatch[1], cleanUrl));
        }

        const ogImg =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (ogImg && ogImg[1]) {
          addCandidate(ogImg[1], title || 'Ảnh đại diện', true);
        }

        const jsonLdUrls = extractImagesFromJsonLd(html, cleanUrl);
        for (const jUrl of jsonLdUrls) {
          addCandidate(jUrl, title, candidateImages.length === 0);
        }

        const articleMatch =
          html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
          html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

        if (articleMatch && articleMatch[1]) {
          const articleImgs = extractImagesFromHtmlChunk(articleMatch[1], cleanUrl);
          for (const img of articleImgs) {
            addCandidate(img.url, img.alt || title, false);
          }
        }

        if (candidateImages.length < 6) {
          const cleanedBody = html
            .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');
          const allImgs = extractImagesFromHtmlChunk(cleanedBody, cleanUrl);
          for (const img of allImgs) {
            addCandidate(img.url, img.alt || title, false);
          }
        }
      }
    }

    const topCandidates = candidateImages.slice(0, 12);
    const downloaded = await Promise.all(
      topCandidates.map(async (item) => {
        const dataUrl = await fetchImageAsDataUrl(item.url, origin);
        if (!dataUrl) return null;
        return {
          url: item.url,
          dataUrl,
          alt: item.alt,
          isFeatured: item.isFeatured,
        };
      })
    );

    const validImages = downloaded.filter(Boolean);

    if (validImages.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Không tìm thấy ảnh hợp lệ nào trong bài viết này. Vui lòng thử link bài viết khác!',
      });
    }

    return res.status(200).json({
      ok: true,
      sourceUrl: cleanUrl,
      title: title || 'Bài viết từ Website',
      excerpt,
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
