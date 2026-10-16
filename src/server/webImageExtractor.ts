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
  // Bỏ qua các thumbnail quá nhỏ dạng -100x100, -150x150
  const tinyWpMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyWpMatch) {
    const w = Number(tinyWpMatch[1]);
    const h = Number(tinyWpMatch[2]);
    if (w < 160 && h < 160) return true;
  }
  return false;
}

function pickBestUrlFromSrcset(srcset: string, baseUrl: string): string {
  if (!srcset) return '';
  const candidates: { url: string; width: number }[] = [];
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
  // Ưu tiên ảnh có chiều rộng khoảng 600px - 1600px để vừa nét vừa tải nhanh
  candidates.sort((a, b) => {
    const scoreA = a.width >= 600 && a.width <= 1600 ? a.width + 2000 : a.width;
    const scoreB = b.width >= 600 && b.width <= 1600 ? b.width + 2000 : b.width;
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

  const lastSlugSegment =
    pathSegments.length > 0 && !/^\d+$/.test(pathSegments[pathSegments.length - 1])
      ? pathSegments[pathSegments.length - 1].replace(/\.(html|htm|php)$/i, '')
      : '';

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
      // Ignore WP REST errors and fallback to HTML scraping
    }
  };

  if (numericIdMatch) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericIdMatch}?_embed`);
  } else if (lastSlugSegment) {
    await tryFetchWpRestPost(
      `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSlugSegment)}&_embed`
    );
  }

  // 2. Quét trực tiếp HTML trang web (hỗ trợ mọi báo điện tử, blog, WordPress dạng slug, trang tin quốc tế...)
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

      // Kiểm tra xem trang web có phải WordPress dùng URL dạng chữ (slug) không thông qua thẻ <link rel="alternate" type="application/json" href=".../wp-json/wp/v2/posts/...">
      const wpJsonLinkMatch = html.match(
        /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
      );
      if (wpJsonLinkMatch && wpJsonLinkMatch[1] && candidateImages.length === 0) {
        await tryFetchWpRestPost(resolveAbsoluteUrl(wpJsonLinkMatch[1], cleanUrl));
      }

      // Lấy og:image / twitter:image (ảnh đại diện bài báo)
      const ogImg =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImg && ogImg[1]) {
        addCandidate(ogImg[1], title || 'Ảnh đại diện', true);
      }

      // Lấy ảnh từ cấu trúc dữ liệu chuẩn SEO JSON-LD (nếu có)
      const jsonLdUrls = extractImagesFromJsonLd(html, cleanUrl);
      for (const jUrl of jsonLdUrls) {
        addCandidate(jUrl, title, candidateImages.length === 0);
      }

      // Ưu tiên vùng nội dung bài viết (<article> hoặc <main>) trước
      const articleMatch =
        html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
        html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

      if (articleMatch && articleMatch[1]) {
        const articleImgs = extractImagesFromHtmlChunk(articleMatch[1], cleanUrl);
        for (const img of articleImgs) {
          addCandidate(img.url, img.alt || title, false);
        }
      }

      // Nếu trong <article> ít hơn 6 ảnh thì quét thêm body (đã lọc bỏ header/footer/nav)
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
