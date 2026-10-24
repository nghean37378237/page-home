import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fetchWpStatsDashboard, fetchWpLivePanelOnly } from './src/server/wpStatsService';
import {
  fetchWpPublishInitData,
  publishArticleToTarget,
  uploadMediaToWordPress,
  generateSeoArticleWithAi,
  searchRelatedYouTubeVideos,
  searchExternalRelatedImages,
  analyzeArticleSubjectAndContext,
  scrapeWebArticleForSeoRewrite,
  tryDiscoverSourceArticleImagesFromText,
  findExistingDuplicatePostOnWp,
  inspectAndUpdateOldCeleb24hPost,
} from './src/server/wpPublishService';
import { extractImagesFromWebUrl } from './src/server/webImageExtractor';
import { fetchMgidPublisherDashboard } from './src/server/mgidService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  // API Route: Báo cáo Doanh Thu MGID Publisher Dashboard (https://pub.mgid.com/dashboard) - KHÓA ĐỘC QUYỀN CHỈ ADMIN XEM DUY NHẤT
  const handleMgidStatsRequest = async (req: express.Request, res: express.Response) => {
    try {
      const adminRoleHeader = String(req.headers['x-admin-role'] || req.query.role || '').toLowerCase();
      if (adminRoleHeader !== 'admin') {
        res.status(403).json({
          ok: false,
          error: 'Khu vực bảo mật: Chỉ Quản Trị Viên (Admin) duy nhất mới có quyền truy cập Báo Cáo Doanh Thu MGID.',
        });
        return;
      }

      const source = req.method === 'POST' ? req.body || {} : req.query || {};
      const payload = await fetchMgidPublisherDashboard({
        apiToken: source.apiToken ? String(source.apiToken) : undefined,
        clientId: source.clientId ? String(source.clientId) : undefined,
        email: source.email ? String(source.email) : undefined,
        password: source.password ? String(source.password) : undefined,
        domain: source.domain ? String(source.domain) : undefined,
        dateInterval: source.dateInterval ? (String(source.dateInterval) as any) : 'thisMonth',
        dateFrom: source.dateFrom ? String(source.dateFrom) : undefined,
        dateTo: source.dateTo ? String(source.dateTo) : undefined,
        usdToVndRate: source.usdToVndRate ? Number(source.usdToVndRate) : undefined,
      });

      res.json(payload);
    } catch (error: any) {
      console.error('[/api/mgid-stats] Error:', error);
      res.status(500).json({
        ok: false,
        error: error?.message || 'Lỗi khi kết nối tới MGID Publisher API',
      });
    }
  };

  app.get('/api/mgid-stats', handleMgidStatsRequest);
  app.post('/api/mgid-stats', handleMgidStatsRequest);


  // API Route: Tự động lấy ảnh & tiêu đề từ bất kỳ link bài viết web nào để ghép ảnh trong Bảng 9
  app.post('/api/extract-web-images', async (req, res) => {
    try {
      const url = String(req.body?.url || '');
      const result = await extractImagesFromWebUrl(url);
      res.json(result);
    } catch (error: any) {
      console.error('[/api/extract-web-images] Error:', error);
      res.status(400).json({
        ok: false,
        error: error?.message || 'Không thể lấy ảnh từ đường dẫn bài viết này',
      });
    }
  });

  app.get('/api/extract-web-images', async (req, res) => {
    try {
      const url = String(req.query.url || '');
      const result = await extractImagesFromWebUrl(url);
      res.json(result);
    } catch (error: any) {
      console.error('[/api/extract-web-images GET] Error:', error);
      res.status(400).json({
        ok: false,
        error: error?.message || 'Không thể lấy ảnh từ đường dẫn bài viết này',
      });
    }
  });

  // API Route: WebPublish Studio - Soạn thảo & Đẩy bài lên Website (celeb24h.com, WordPress, Webhook API)
  app.get('/api/wp-publish', async (_req, res) => {
    try {
      const data = await fetchWpPublishInitData();
      res.json(data);
    } catch (error: any) {
      console.error('[/api/wp-publish GET] Error:', error);
      res.status(500).json({
        ok: false,
        error: error?.message || 'Không thể tải danh mục và bài viết từ website',
      });
    }
  });

  app.post('/api/wp-publish', async (req, res) => {
    try {
      const body = req.body || {};
      const action = String(body.action || 'publish');

      if (action === 'upload_media') {
        const uploaded = await uploadMediaToWordPress({
          base64Data: body.base64Data,
          imageUrl: body.imageUrl,
          fileName: body.fileName,
          altText: body.altText,
        });
        res.json({ ok: true, ...uploaded });
        return;
      }

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
          const urlCandidate =
            String(body.sourceUrl || '').trim() ||
            (String(body.articleText || body.query || '').match(/https?:\/\/[^\s"'<>]+/i)?.[0] || '');
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
              effectiveText || query,
              existingImgs
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
          customQuery || ctxProfile?.combinedSearchQuery || query;
        const videos = await searchRelatedYouTubeVideos(
          effectiveSearchInput,
          Number(body.limit) || 2,
          ctxProfile,
          excludeVideoIds
        );
        res.json({
          ok: true,
          videos,
          primaryPerson: ctxProfile?.primaryPerson || '',
          searchQuery: effectiveSearchInput,
        });
        return;
      }

      if (action === 'search_external_images') {
        const query = String(body.query || '');
        const forceExternalSearch = Boolean(body.forceExternalSearch);
        let existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        let discoveredOrigImgs: any[] = [];
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

        const hasOrigImgs = existingImgs.some((im: any) => im && !im.isExternal);
        const needsSourceDiscovery =
          !hasOrigImgs || !ctxProfile.primaryPerson || effectiveText.length < 100;

        if (needsSourceDiscovery) {
          const urlCandidate =
            String(body.sourceUrl || '').trim() ||
            (String(body.articleText || body.query || '').match(/https?:\/\/[^\s"'<>]+/i)?.[0] || '');
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
              effectiveText || query,
              existingImgs
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

        const excludeKeys = new Set<string>(
          existingImgs
            .map((im: any) =>
              String(im?.url || '')
                .split('?')[0]
                .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
                .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
                .toLowerCase()
            )
            .filter(Boolean)
        );

        const requestedLimit = Number(body.limit) || 6;
        const neededCount = forceExternalSearch
          ? requestedLimit
          : Math.max(1, requestedLimit);

        const extImages =
          neededCount > 0
            ? await searchExternalRelatedImages(
                ctxProfile?.combinedSearchQuery || query,
                neededCount,
                excludeKeys,
                ctxProfile
              )
            : [];
        res.json({
          ok: true,
          images: [...discoveredOrigImgs, ...extImages],
          externalImages: extImages,
          originalImages: discoveredOrigImgs,
          primaryPerson: ctxProfile?.primaryPerson || '',
          searchQuery: ctxProfile?.combinedSearchQuery || query,
        });
        return;
      }

      if (action === 'check_duplicate') {
        let checkTitle = String(body.title || '').trim();
        let checkText = String(body.articleText || '').trim();
        const checkUrl = String(body.sourceUrl || '').trim();
        if (checkUrl && (!checkTitle || !checkText)) {
          try {
            const scraped = await scrapeWebArticleForSeoRewrite(checkUrl);
            if (!checkTitle && scraped.originalTitle) checkTitle = scraped.originalTitle;
            if (!checkText && scraped.articleText) checkText = scraped.articleText;
          } catch {}
        }
        const duplicate = await findExistingDuplicatePostOnWp({
          title: checkTitle,
          slug: body.slug ? String(body.slug) : undefined,
          sourceUrl: checkUrl || undefined,
          articleText: checkText || undefined,
          baseSiteUrl: body.customWpUrl ? String(body.customWpUrl) : undefined,
        });
        res.json({
          ok: true,
          duplicateFound: Boolean(duplicate),
          duplicate: duplicate || null,
        });
        return;
      }

      if (action === 'inspect_old_celeb24h' || action === 'update_old_celeb24h') {
        const result = await inspectAndUpdateOldCeleb24hPost({
          celeb24hUrl: String(body.celeb24hUrl || body.sourceUrl || body.url || ''),
          referenceSourceUrl: body.referenceSourceUrl ? String(body.referenceSourceUrl) : undefined,
          employeeCode: body.employeeCode ? String(body.employeeCode) : undefined,
          language: body.language === 'vi' ? 'vi' : 'en',
          autoApplyUpdate: action === 'update_old_celeb24h' ? true : Boolean(body.autoApplyUpdate),
          supplementOptions: body.supplementOptions || undefined,
        });
        res.json(result);
        return;
      }

      if (action === 'ai_write' || action === 'ai_generate') {
        const result = await generateSeoArticleWithAi({
          topic: String(body.topic || ''),
          keyword: body.keyword ? String(body.keyword) : undefined,
          language: body.language === 'vi' ? 'vi' : 'en',
          categoryName: body.categoryName ? String(body.categoryName) : undefined,
          mode: body.mode || undefined,
          sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
          existingTitle: body.existingTitle ? String(body.existingTitle) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
          existingImages: Array.isArray(body.existingImages) ? body.existingImages : undefined,
          employeeCode: body.employeeCode ? String(body.employeeCode) : undefined,
          autoUpdateIfDuplicate: body.autoUpdateIfDuplicate !== false,
        });
        res.json(result);
        return;
      }

      if (action !== 'publish') {
        res.status(400).json({
          ok: false,
          error: `Action không hợp lệ: "${action}"`,
        });
        return;
      }

      const published = await publishArticleToTarget({
        postId: body.postId ? Number(body.postId) : undefined,
        title: String(body.title || ''),
        content: String(body.content || ''),
        excerpt: body.excerpt ? String(body.excerpt) : '',
        slug: body.slug ? String(body.slug) : undefined,
        status: body.status || 'publish',
        categories: Array.isArray(body.categories) ? body.categories.map(Number) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        employeeCode: body.employeeCode ? String(body.employeeCode) : undefined,
        featuredMediaId: body.featuredMediaId ? Number(body.featuredMediaId) : undefined,
        featuredImageBase64: body.featuredImageBase64 ? String(body.featuredImageBase64) : undefined,
        featuredImageUrl: body.featuredImageUrl ? String(body.featuredImageUrl) : undefined,
        featuredImageAlt: body.featuredImageAlt ? String(body.featuredImageAlt) : undefined,
        sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
        extractedImages: Array.isArray(body.extractedImages) ? body.extractedImages : undefined,
        targetMode: body.targetMode || 'default_wp',
        customWpUrl: body.customWpUrl,
        customWpUser: body.customWpUser,
        customWpAppPassword: body.customWpAppPassword,
        webhookUrl: body.webhookUrl,
        webhookSecret: body.webhookSecret,
      });

      res.json(published);
    } catch (error: any) {
      console.error('[/api/wp-publish POST] Error:', error);
      res.status(500).json({
        ok: false,
        error: error?.message || 'Lỗi khi đẩy bài viết lên website',
      });
    }
  });

  // API Route: Lấy dữ liệu bảng thống kê trực tiếp từ WordPress celeb24h.com
  app.get('/api/wp-stats', async (req, res) => {
    try {
      const mode = String(req.query.mode || 'dashboard');
      if (mode === 'live') {
        const liveEmployee = String(req.query.live_employee || '');
        const scope = String(req.query.scope || '');
        const realtime = await fetchWpLivePanelOnly(liveEmployee, scope);
        res.json({ ok: true, realtime });
        return;
      }

      const rawScope = String(req.query.scope || '');
      const validScope: 'site' | 'mine' | 'employee' | undefined =
        rawScope === 'site' || rawScope === 'mine' || rawScope === 'employee'
          ? rawScope
          : undefined;

      const payload = await fetchWpStatsDashboard({
        range: req.query.range ? String(req.query.range) : '7',
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        scope: validScope,
        employee: req.query.employee ? String(req.query.employee) : '',
        viewerEmployeeCode: req.query.viewer_employee ? String(req.query.viewer_employee) : '',
        liveEmployee:
          req.query.live_employee !== undefined ? String(req.query.live_employee) : undefined,
        topRange: req.query.top_range ? String(req.query.top_range) : '7',
        topFrom: req.query.top_from ? String(req.query.top_from) : undefined,
        topTo: req.query.top_to ? String(req.query.top_to) : undefined,
        empDays: req.query.emp_days ? String(req.query.emp_days) : '7',
        empDetailCode: req.query.emp_detail ? String(req.query.emp_detail) : undefined,
        staffTopPeriod: req.query.staff_top_period ? String(req.query.staff_top_period) : '7',
      });

      res.json(payload);
    } catch (error: any) {
      console.error('[/api/wp-stats] Error:', error);
      res.status(500).json({
        ok: false,
        error: error?.message || 'Không thể lấy dữ liệu thống kê từ celeb24h.com',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
