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
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned || cleaned.startsWith('data:')) return '';
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
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.')
  ) {
    return true;
  }
  // Bỏ qua các thumbnail quá nhỏ dạng -100x100, -150x150 nếu là WordPress
  const tinyWpMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp)/);
  if (tinyWpMatch) {
    const w = Number(tinyWpMatch[1]);
    const h = Number(tinyWpMatch[2]);
    if (w < 160 && h < 160) return true;
  }
  return false;
}

/**
 * Chuyển URL ảnh WordPress bị thu nhỏ (-300x200.jpg) sang bản gốc độ phân giải cao hơn hoặc chọn từ srcset
 */
function upgradeWpImageResolution(url: string): string {
  // Giữ nguyên nhưng có thể thử lấy bản lớn từ srcset trước
  return url;
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
    }
    candidates.push({ url: u, width });
  }
  if (candidates.length === 0) return '';
  // Ưu tiên ảnh có chiều rộng khoảng 700px - 1400px để vừa nét vừa tải nhanh
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
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: refererUrl,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
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
    // Bỏ qua các ảnh quá nhỏ (< 3KB thường là icon hoặc pixel tracking)
    if (arrayBuffer.byteLength < 3000) {
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
        tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1]) {
        chosenUrl = resolveAbsoluteUrl(srcAttr[1], baseUrl);
      }
    }

    if (!chosenUrl || isJunkImageUrl(chosenUrl)) continue;

    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';

    results.push({ url: upgradeWpImageResolution(chosenUrl), alt });
  }

  return results;
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
    // Chuẩn hóa tên file bỏ hậu tố kích thước WP (-768x512) để tránh trùng 1 ảnh nhiều kích cỡ
    const dedupeKey = resolved
      .split('?')[0]
      .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp)$)/i, '')
      .toLowerCase();
    if (seenNormalized.has(dedupeKey)) return;
    seenNormalized.add(dedupeKey);
    candidateImages.push({ url: resolved, alt, isFeatured });
  };

  // 1. Kiểm tra nếu là bài viết WordPress dạng /{postId} hoặc có WP REST API
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  const numericIdMatch =
    pathSegments.length > 0 && /^\d+$/.test(pathSegments[0])
      ? Number(pathSegments[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p')!)
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  if (numericIdMatch) {
    try {
      const wpApiUrl = `${origin}/wp-json/wp/v2/posts/${numericIdMatch}?_embed`;
      const wpRes = await fetch(wpApiUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (wpRes.ok) {
        const postJson: any = await wpRes.json();
        if (postJson && postJson.id) {
          title = decodeHtmlEntities(postJson.title?.rendered || '');
          excerpt = decodeHtmlEntities(
            String(postJson.excerpt?.rendered || '').replace(/<[^>]+>/g, '')
          );
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
      }
    } catch {
      // Fallback sang cào HTML trực tiếp bên dưới
    }
  }

  // 2. Nếu chưa lấy được qua WP ID hoặc cần lấy thêm từ HTML trang web
  if (candidateImages.length === 0 || !title) {
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

      // Lấy og:image (ảnh đại diện bài báo)
      const ogImg =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImg && ogImg[1]) {
        addCandidate(ogImg[1], title || 'Ảnh đại diện', true);
      }

      // Ưu tiên vùng nội dung bài viết (<article> hoặc .entry-content / .post-content) trước
      const articleMatch =
        html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
        html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

      if (articleMatch && articleMatch[1]) {
        const articleImgs = extractImagesFromHtmlChunk(articleMatch[1], cleanUrl);
        for (const img of articleImgs) {
          addCandidate(img.url, img.alt || title, false);
        }
      }

      // Nếu trong <article> ít hơn 4 ảnh thì quét thêm toàn trang (bỏ footer/sidebar rác)
      if (candidateImages.length < 6) {
        const allImgs = extractImagesFromHtmlChunk(html, cleanUrl);
        for (const img of allImgs) {
          addCandidate(img.url, img.alt || title, false);
        }
      }
    }
  }

  // 3. Tải tối đa 10 ảnh đầu tiên sang dạng Base64 DataURL để ghép Canvas không bị lỗi CORS
  const topCandidates = candidateImages.slice(0, 10);
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
