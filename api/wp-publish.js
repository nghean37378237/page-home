import {
  fetchWpPublishInitData,
  publishArticleToTarget,
  uploadMediaToWordPress,
  generateSeoArticleWithAi,
  searchRelatedYouTubeVideos,
  searchExternalRelatedImages,
} from '../src/server/wpPublishService';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await fetchWpPublishInitData();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action || 'publish';

      if (action === 'upload_media') {
        const result = await uploadMediaToWordPress({
          base64Data: body.base64Data,
          imageUrl: body.imageUrl,
          fileName: body.fileName,
          altText: body.altText,
        });
        return res.status(200).json(result);
      }

      if (action === 'ai_write' || action === 'ai_generate') {
        const result = await generateSeoArticleWithAi({
          topic: String(body.topic || ''),
          keyword: body.keyword ? String(body.keyword) : undefined,
          language: body.language === 'vi' ? 'vi' : 'en',
          tone: body.tone ? String(body.tone) : undefined,
          categoryName: body.categoryName ? String(body.categoryName) : undefined,
          mode: body.mode || 'from_text',
          sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
        });
        return res.status(200).json(result);
      }

      if (action === 'search_youtube') {
        const videos = await searchRelatedYouTubeVideos(
          String(body.query || ''),
          Number(body.limit || 2)
        );
        return res.status(200).json({ ok: true, videos });
      }

      if (action === 'search_external_images') {
        const images = await searchExternalRelatedImages(
          String(body.query || ''),
          Number(body.limit || 6)
        );
        return res.status(200).json({ ok: true, images });
      }

      const result = await publishArticleToTarget({
        postId: body.postId ? Number(body.postId) : undefined,
        title: String(body.title || ''),
        content: String(body.content || ''),
        excerpt: body.excerpt ? String(body.excerpt) : '',
        slug: body.slug ? String(body.slug) : undefined,
        status: body.status || 'publish',
        employeeCode: String(body.employeeCode || 'A0006'),
        categories: Array.isArray(body.categories) ? body.categories.map(Number) : [2],
        featuredMediaId: body.featuredMediaId ? Number(body.featuredMediaId) : undefined,
        featuredImageUrl: body.featuredImageUrl ? String(body.featuredImageUrl) : undefined,
        seoMeta: body.seoMeta,
      });

      return res.status(200).json(result);
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi xử lý máy chủ khi viết hoặc đẩy bài lên Web',
    });
  }
}
