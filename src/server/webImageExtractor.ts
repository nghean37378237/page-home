const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface ExtractedWebImage {
  url: string;
  dataUrl: string;
  alt?: string;
  isFeatured?: boolean;
}

export interface ExtractedWebArticleResult {
  ok: boolean;
  sourceUrl: string;
  title: string;
  excerpt: string;
  siteName: string;
  images: ExtractedWebImage[];
}

function decodeHtmlEntities(str: string): string {
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

function resolveAbsoluteUrl(rawUrl: string, baseUrl: string): string {
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

function isJunkImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
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
    lower.includes('placeholder') ||
    lower.includes('loading.')
  ) {
    return true;
  }
  const tinyWpMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyWpMatch) {
    const w = Number(tinyWpMatch[1]);
    const h = Number(tinyWpMatch[2]);
    if (w < 150 && h < 150) return true;
  }
  return false;
}

function pickBestUrlFromSrcset(srcset: string, baseUrl: string): string {
  if (!srcset) return '';
  const cleanedSrcset = srcset.replace(/data:image\/[^,\s]+,[^\s,]+/gi, '');
  const candidates: { url: string; width: number }[] = [];
  const parts = cleanedSrcset.split(',');
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

async function fetchImageAsDataUrl(imageUrl: string, refererUrl: string): Promise<string | null> {
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
    // Bỏ qua các ảnh quá nhỏ (< 3.5KB thường là icon hoặc pixel tracking)
    if (arrayBuffer.byteLength < 3500) {
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType.split(';')[0]};base64,${base64}`;
  } catch {
    return null;
  }
}

function extractImagesFromHtmlChunk(
  htmlChunk: string,
  baseUrl: string
): { url: string; alt: string }[] {
  const results: { url: string; alt: string }[] = [];

  // 1. Quét thẻ <source> bên trong <picture> (rất phổ biến ở báo điện tử như VnExpress, Kenh14, TuoiTre, CNN...)
  const sourceTagRegex = /<source\b[^>]*>/gi;
  let sourceMatch: RegExpExecArray | null;
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

  // 2. Quét thẻ <img> với mọi chuẩn lazy-load của các báo & CMS
  const imgTagRegex = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;

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

function extractImagesFromJsonLd(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  const collectFromNode = (node: any) => {
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

export async function extractImagesFromWebUrl(
  rawInputUrl: string
): Promise<ExtractedWebArticleResult> {
  let cleanUrl = String(rawInputUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const parsedUrl = new URL(cleanUrl);
  const origin = parsedUrl.origin;

  let title = '';
  let excerpt = '';
  const candidateImages: { url: string; alt: string; isFeatured?: boolean }[] = [];
  const seenNormalized = new Set<string>();

  const addCandidate = (url: string, alt = '', isFeatured = false) => {
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

  // 1. Kiểm tra nếu là bài viết WordPress dạng /{postId}, ?p={postId} hoặc /{slug}
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  const numericIdMatch =
    pathSegments.length > 0 && /^\d+$/.test(pathSegments[0])
      ? Number(pathSegments[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p')!)
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  const slugCandidates = pathSegments
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
    .filter((s) => s && !/^\d+$/.test(s) && !/^(vn\d*|en\d*|us\d*|uk\d*|amp|feed|print|page)$/i.test(s) && !(s.length <= 4 && /^[a-z]{1,3}\d{1,2}$/i.test(s)))
    .sort((a, b) => b.length - a.length);
  const lastSlugSegment = slugCandidates[0] || '';

  let articleBodySample = '';

  const tryFetchWpRestPost = async (apiEndpointUrl: string) => {
    try {
      const wpRes = await fetch(
        apiEndpointUrl.includes('_embed')
          ? apiEndpointUrl
          : `${apiEndpointUrl}${apiEndpointUrl.includes('?') ? '&' : '?'}_embed`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!wpRes.ok) return;
      const rawJson: any = await wpRes.json();
      const postJson = Array.isArray(rawJson) ? rawJson[0] : rawJson;
      if (postJson && postJson.id) {
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
        if (featUrl && !/\bcollage[-_\d]/i.test(featUrl)) {
          addCandidate(featUrl, title || 'Ảnh đại diện bài viết', true);
        }
        const contentHtml = postJson.content?.rendered || '';
        articleBodySample = decodeHtmlEntities(contentHtml.replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1400);
        const contentImgs = extractImagesFromHtmlChunk(contentHtml, cleanUrl);
        for (const img of contentImgs) {
          addCandidate(img.url, img.alt || title, candidateImages.length === 0);
        }
      }
    } catch {
      // Ignore WP REST errors and fallback to HTML scraping
    }
  };

  if (numericIdMatch) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericIdMatch}?_embed`);
  } else if (lastSlugSegment) {
    await tryFetchWpRestPost(
      `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSlugSegment)}&_embed`
    );
    if (candidateImages.length === 0) {
      const searchQ = lastSlugSegment.replace(/[-_]+/g, ' ').trim();
      if (searchQ.length >= 5) {
        await tryFetchWpRestPost(
          `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchQ)}&per_page=1&_embed`
        );
        if (candidateImages.length === 0) {
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

  // 2. Quét trực tiếp HTML trang web CHỈ KHI WP REST API chưa lấy được ảnh bài viết
  if (candidateImages.length === 0 || !title) {
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!pageRes.ok && candidateImages.length === 0) {
      throw new Error(`Không thể truy cập đường dẫn (${pageRes.status}). Hãy kiểm tra lại link!`);
    }

    if (pageRes.ok) {
      const html = await pageRes.text();

      const wpJsonLinkMatch = html.match(
        /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
      );
      if (wpJsonLinkMatch && wpJsonLinkMatch[1] && candidateImages.length === 0) {
        await tryFetchWpRestPost(resolveAbsoluteUrl(wpJsonLinkMatch[1], cleanUrl));
      }

      if (candidateImages.length === 0 || !title) {
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
        if (ogImg && ogImg[1] && !/\bcollage[-_\d]/i.test(ogImg[1])) {
          addCandidate(ogImg[1], title || 'Ảnh đại diện', true);
        }

        const jsonLdUrls = extractImagesFromJsonLd(html, cleanUrl);
        for (const jUrl of jsonLdUrls) {
          addCandidate(jUrl, title, candidateImages.length === 0);
        }

        const cleanedBody = html
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

        let primaryZone = cleanedBody;
        const articleTagMatch = cleanedBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
        if (articleTagMatch && articleTagMatch[1]) {
          primaryZone = articleTagMatch[1];
        } else {
          const contentDivStart = cleanedBody.search(
            /<div\b[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content|single-content|article-body|story-body)[^"']*["'][^>]*>/i
          );
          if (contentDivStart !== -1) {
            primaryZone = cleanedBody.slice(contentDivStart, contentDivStart + 120000);
          } else {
            const mainMatch = cleanedBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
            if (mainMatch && mainMatch[1]) primaryZone = mainMatch[1];
          }
        }

        if (!articleBodySample) {
          articleBodySample = decodeHtmlEntities(primaryZone.replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1400);
        }
        const articleImgs = extractImagesFromHtmlChunk(primaryZone, cleanUrl);
        for (const img of articleImgs) {
          addCandidate(img.url, img.alt || title, candidateImages.length === 0);
        }
      }
    }
  }

  // 2.5. YÊU CẦU NGƯỜI DÙNG:
  // Trước tiên lấy hết ảnh trong bài viết ở link bài.
  // Nếu số ảnh trong bài < 5 ảnh thì lấy thêm ảnh ngoài cho đủ 5 đến 7 ảnh (6 ảnh); còn nếu đã đủ >= 5 ảnh rồi thì thôi!
  if (candidateImages.length < 5) {
    const neededCount = 6 - candidateImages.length;
    const stopWords = new Set([
      'There', 'The', 'This', 'That', 'These', 'Those', 'When', 'While', 'Where',
      'What', 'Who', 'Why', 'How', 'Proving', 'Looking', 'Taking', 'Channeling',
      'Addressing', 'Stepping', 'Enjoying', 'Sharing', 'Showing', 'Making',
      'Hollywood', 'Caribbean', 'Barbados', 'London', 'West', 'North', 'South',
      'East', 'United', 'States', 'America', 'British', 'English', 'American',
      'Anyone', 'But', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Actor'
    ]);
    const nameRegex = /\b([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15}){1,2})\b/g;
    const counts = new Map<string, number>();
    let nm: RegExpExecArray | null;
    const sampleText = `${title} ${articleBodySample}`;
    while ((nm = nameRegex.exec(sampleText)) !== null) {
      const cand = nm[1].trim();
      if (cand.split(/\s+/).some((w) => stopWords.has(w))) continue;
      counts.set(cand, (counts.get(cand) || 0) + 1);
    }
    let bestPerson = '';
    let bestCount = 0;
    for (const [k, v] of counts.entries()) {
      if (v > bestCount) {
        bestPerson = k;
        bestCount = v;
      }
    }
    const searchQuery = (bestPerson || title || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
    if (searchQuery) {
      try {
        const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(
          searchQuery.split(/\s+/).slice(0, 8).join(' ')
        )}&form=HDRSC2&first=1`;
        const bingRes = await fetch(bingUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (bingRes.ok) {
          const bHtml = await bingRes.text();
          const mRegex = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/gi;
          let bm: RegExpExecArray | null;
          let addedExt = 0;
          while ((bm = mRegex.exec(bHtml)) !== null && addedExt < neededCount) {
            const extUrl = decodeHtmlEntities(bm[1]).trim();
            if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(extUrl)) continue;
            const beforeLen = candidateImages.length;
            addCandidate(extUrl, `${bestPerson || title} (Ảnh bổ sung)`, false);
            if (candidateImages.length > beforeLen) addedExt++;
          }
        }
      } catch {
        // ignore external image supplement error
      }
    }
  }

  // 3. Tải tối đa 12 ảnh đầu tiên sang dạng Base64 DataURL để ghép Canvas không bao giờ bị lỗi CORS dù ảnh từ bất kỳ web nào
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
      } as ExtractedWebImage;
    })
  );

  const validImages = downloaded.filter((x): x is ExtractedWebImage => Boolean(x));

  if (validImages.length === 0) {
    throw new Error('Không tìm thấy ảnh hợp lệ nào trong bài viết này. Vui lòng thử link bài viết khác!');
  }

  return {
    ok: true,
    sourceUrl: cleanUrl,
    title: title || 'Bài viết từ Website',
    excerpt,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    images: validImages,
  };
}
