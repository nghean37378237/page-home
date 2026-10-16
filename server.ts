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
} from './src/server/wpPublishService';
import { extractImagesFromWebUrl } from './src/server/webImageExtractor';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

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
        const videos = await searchRelatedYouTubeVideos(query, Number(body.limit) || 2);
        res.json({ ok: true, videos });
        return;
      }

      if (action === 'search_external_images') {
        const query = String(body.query || '');
        const images = await searchExternalRelatedImages(query, Number(body.limit) || 6);
        res.json({ ok: true, images });
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
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
        });
        res.json(result);
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
