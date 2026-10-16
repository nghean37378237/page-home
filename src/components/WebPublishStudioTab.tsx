import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AppUser,
  UserAccount,
  DEFAULT_WP_EMPLOYEE_OPTIONS,
  resolveAccountWpEmployeeCode,
} from '../types';
import {
  Globe,
  Send,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Tag,
  FolderOpen,
  Search,
  Edit3,
  Eye,
  Code,
  Sparkles,
  Upload,
  Link2,
  List,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  Settings,
  Webhook,
  UserCheck,
  Clock,
  Plus,
  Trash2,
  BarChart3,
} from 'lucide-react';

interface WpCategoryItem {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface WpRemotePostItem {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  status: 'publish' | 'draft' | 'future' | 'pending' | 'private';
  date: string;
  modified: string;
  link: string;
  authorId: number;
  authorName: string;
  employeeCode: string;
  categories: number[];
  categoryNames: string[];
  featuredMediaId: number;
  featuredImageUrl: string;
}

interface CustomTargetConfig {
  targetMode: 'default_wp' | 'custom_wp' | 'webhook';
  customWpUrl: string;
  customWpUser: string;
  customWpAppPassword: string;
  webhookUrl: string;
  webhookSecret: string;
}

interface WebPublishStudioTabProps {
  currentUser: AppUser;
  accounts?: UserAccount[];
  onNavigateToTab?: (tab: string) => void;
}

const LOCAL_DRAFTS_KEY = 'webpublish_studio_local_drafts_v1';
const LOCAL_TARGET_CONFIG_KEY = 'webpublish_studio_target_cfg_v1';

interface LocalArticleDraft {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  focusKeyword: string;
  tags: string;
  categories: number[];
  featuredImageUrl: string;
  employeeCode: string;
  updatedAt: string;
}

function slugifyText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 85);
}

export const WebPublishStudioTab: React.FC<WebPublishStudioTabProps> = ({
  currentUser,
  accounts = [],
  onNavigateToTab,
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Xác định Mã nhân viên mặc định của người đang đăng nhập
  const viewerMatchedAccount = useMemo(() => {
    const cleanName = (currentUser.name || '').trim().toLowerCase();
    const cleanEmail = (currentUser.email || '').trim().toLowerCase();
    return accounts.find(
      (a) =>
        a.id === currentUser.id ||
        a.username.trim().toLowerCase() === cleanName ||
        (cleanEmail && (a.email || '').trim().toLowerCase() === cleanEmail)
    );
  }, [accounts, currentUser]);

  const defaultEmployeeCode = useMemo(() => {
    return (
      resolveAccountWpEmployeeCode(
        viewerMatchedAccount || {
          username: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          wpEmployeeCode: currentUser.wpEmployeeCode,
        },
        currentUser.name
      ) || (isAdmin ? 'A0006' : 'H2000')
    );
  }, [viewerMatchedAccount, currentUser, isAdmin]);

  // Sub-tab: 'editor' | 'posts' | 'settings'
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'posts' | 'settings'>('editor');

  // Dữ liệu từ WordPress celeb24h.com
  const [siteUrl, setSiteUrl] = useState('https://celeb24h.com');
  const [categories, setCategories] = useState<WpCategoryItem[]>([
    { id: 2, name: 'Showbiz', slug: 'showbiz', count: 233 },
    { id: 3, name: 'Story', slug: 'story', count: 69 },
    { id: 4, name: 'Film', slug: 'film', count: 34 },
    { id: 10, name: 'New', slug: 'news', count: 1 },
  ]);
  const [remotePosts, setRemotePosts] = useState<WpRemotePostItem[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // State trình soạn thảo bài viết
  const [editingPostId, setEditingPostId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([2]); // Mặc định Showbiz
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string>(defaultEmployeeCode);
  const [publishStatus, setPublishStatus] = useState<'publish' | 'draft'>('publish');

  // Ảnh đại diện (Featured Image)
  const [featuredMediaId, setFeaturedMediaId] = useState<number>(0);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string>('');
  const [featuredImageBase64, setFeaturedImageBase64] = useState<string>('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState<string>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Chế độ hiển thị khung soạn thảo: 'visual' (Soạn thảo + Thanh công cụ) | 'preview' (Xem trước)
  const [editorViewMode, setEditorViewMode] = useState<'visual' | 'preview'>('visual');

  // Trợ lý viết bài chuẩn SEO (2 Chức năng chính: Từ đoạn nội dung HOẶC Từ link web bất kỳ + Ảnh + 2 Video YouTube)
  const [aiMode, setAiMode] = useState<'from_text' | 'from_url'>('from_url');
  const [aiTopic, setAiTopic] = useState('');
  const [aiSourceUrl, setAiSourceUrl] = useState('');
  const [aiLanguage, setAiLanguage] = useState<'en' | 'vi'>('en');
  const [aiLoading, setAiLoading] = useState(false);
  const [extractedWebImages, setExtractedWebImages] = useState<
    { url: string; alt: string; isFeatured?: boolean; isExternal?: boolean }[]
  >([]);
  const [attachedYoutubeVideos, setAttachedYoutubeVideos] = useState<
    { videoId: string; title: string; watchUrl: string; embedUrl: string; thumbnailUrl: string }[]
  >([]);
  const [aiArticleStats, setAiArticleStats] = useState<{
    wordCount: number;
    paragraphCount: number;
    originalImageCount: number;
    externalImageCount: number;
  } | null>(null);
  const [customYtQuery, setCustomYtQuery] = useState('');
  const [searchingYt, setSearchingYt] = useState(false);
  const [searchingExtImages, setSearchingExtImages] = useState(false);

  // Trạng thái đang đẩy bài & kết quả trả về
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    id: number;
    title: string;
    link: string;
    trackingLink: string;
    status: string;
    employeeCode: string;
  } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bộ lọc danh sách bài viết trên web
  const [postSearch, setPostSearch] = useState('');
  const [postFilterEmployee, setPostFilterEmployee] = useState<string>('ALL');
  const [postFilterCategory, setPostFilterCategory] = useState<number | 'ALL'>('ALL');

  // Bản nháp lưu trên trình duyệt
  const [localDrafts, setLocalDrafts] = useState<LocalArticleDraft[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Cấu hình đích đẩy bài (Mặc định celeb24h.com, hoặc Custom WP / Webhook)
  const [targetConfig, setTargetConfig] = useState<CustomTargetConfig>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_TARGET_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      targetMode: 'default_wp',
      customWpUrl: '',
      customWpUser: '',
      customWpAppPassword: '',
      webhookUrl: '',
      webhookSecret: '',
    };
  });

  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const featuredFileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);

  // Đồng bộ mã nhân viên khi user đổi tài khoản
  useEffect(() => {
    setSelectedEmployeeCode(defaultEmployeeCode);
  }, [defaultEmployeeCode]);

  // Tự động tạo slug khi gõ tiêu đề
  useEffect(() => {
    if (autoSlug && title.trim() && !editingPostId) {
      setSlug(slugifyText(title));
    }
  }, [title, autoSlug, editingPostId]);

  const fetchRemoteWpData = useCallback(async () => {
    setLoadingRemote(true);
    setRemoteError(null);
    try {
      const res = await fetch('/api/wp-publish');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Không thể kết nối tới WordPress');
      }
      if (data.siteUrl) setSiteUrl(data.siteUrl);
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.posts)) {
        setRemotePosts(data.posts);
      }
    } catch (err: any) {
      setRemoteError(err?.message || 'Lỗi tải dữ liệu từ website');
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    fetchRemoteWpData();
  }, [fetchRemoteWpData]);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // Chèn thẻ định dạng vào vị trí con trỏ trong trình soạn thảo
  const insertFormatting = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const el = contentTextareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}\n${prefix}${placeholder}${suffix}`);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;
    const nextContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(nextContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 20);
  };

  // Tải ảnh đại diện từ máy tính
  const handleFeaturedFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '');
      setFeaturedImageBase64(base64);
      setFeaturedImageUrl(base64);

      // Tải trực tiếp lên WordPress Media Library nếu đang ở chế độ default_wp
      if (targetConfig.targetMode === 'default_wp') {
        setUploadingMedia(true);
        try {
          const res = await fetch('/api/wp-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upload_media',
              base64Data: base64,
              fileName: file.name,
              altText: featuredImageAlt || title || file.name,
            }),
          });
          const data = await res.json();
          if (res.ok && data.ok && data.id) {
            setFeaturedMediaId(Number(data.id));
            setFeaturedImageUrl(String(data.url || base64));
            setFeaturedImageBase64('');
          }
        } catch (err) {
          console.warn('Upload media warning:', err);
        } finally {
          setUploadingMedia(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Tải ảnh chèn trực tiếp vào nội dung bài viết
  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '');
      setUploadingMedia(true);
      try {
        const res = await fetch('/api/wp-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_media',
            base64Data: base64,
            fileName: file.name,
            altText: title || file.name,
          }),
        });
        const data = await res.json();
        const imgUrl = res.ok && data.ok && data.url ? data.url : base64;
        insertFormatting(
          `<figure class="wp-block-image size-large"><img src="${imgUrl}" alt="${
            title || 'Image'
          }" /></figure>\n`,
          '',
          ''
        );
      } catch {
        insertFormatting(`<p><img src="${base64}" alt="${title || 'Image'}" /></p>\n`, '', '');
      } finally {
        setUploadingMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Tạo nội dung chuẩn SEO theo 2 Chức năng chính (Lấy tiêu đề bài gốc + Viết dài 2000-5000 từ + Đoạn ~150 từ xuống dòng + Lấy hết ảnh bài gốc & bổ sung ảnh ngoài + 2 Video YouTube cuối bài)
  const handleGenerateSeoArticle = async (
    overrideMode?: 'from_text' | 'from_url'
  ): Promise<{
    title: string;
    contentHtml: string;
    excerpt: string;
    slug: string;
    featuredImageUrl: string;
    tags: string[];
  } | null> => {
    const activeMode = overrideMode || aiMode;
    if (activeMode === 'from_url') {
      if (!aiSourceUrl.trim()) {
        setPublishError(
          'Vui lòng dán 1 đường dẫn (Link) bài viết web bất kỳ để lấy tiêu đề, viết lại chuẩn SEO (2000-5000 từ) và lấy toàn bộ ảnh!'
        );
        return null;
      }
    } else {
      const topicToUse = aiTopic.trim() || title.trim();
      if (!topicToUse) {
        setPublishError('Vui lòng nhập đoạn nội dung hoặc chủ đề để hệ thống viết chuẩn SEO!');
        return null;
      }
    }

    setAiLoading(true);
    setPublishError(null);
    try {
      const primaryCatName =
        categories.find((c) => selectedCategories.includes(c.id))?.name || 'Showbiz';
      const res = await fetch('/api/wp-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_write',
          mode: activeMode,
          topic: activeMode === 'from_url' ? aiSourceUrl.trim() : aiTopic.trim() || title.trim(),
          sourceUrl: activeMode === 'from_url' ? aiSourceUrl.trim() : undefined,
          keyword: focusKeyword.trim() || undefined,
          language: aiLanguage,
          categoryName: primaryCatName,
          existingContent: activeMode === 'from_text' ? content : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Không thể khởi tạo nội dung chuẩn SEO');
      }
      if (data.title) setTitle(data.title);
      if (data.slug) {
        setSlug(data.slug);
        setAutoSlug(false);
      }
      if (data.excerpt) setExcerpt(data.excerpt);
      if (data.focusKeyword) {
        setFocusKeyword(data.focusKeyword);
        setCustomYtQuery(data.focusKeyword);
      }
      if (Array.isArray(data.tags)) setTagsInput(data.tags.join(', '));
      if (data.contentHtml) setContent(data.contentHtml);

      if (Array.isArray(data.extractedImages) && data.extractedImages.length > 0) {
        setExtractedWebImages(data.extractedImages);
      }
      if (data.featuredImageUrl) {
        setFeaturedImageUrl(data.featuredImageUrl);
        setFeaturedMediaId(0);
        setFeaturedImageBase64('');
      }
      if (Array.isArray(data.youtubeVideos)) {
        setAttachedYoutubeVideos(data.youtubeVideos);
      }
      setAiArticleStats({
        wordCount: Number(data.wordCount || 2650),
        paragraphCount: Number(data.paragraphCount || 18),
        originalImageCount: Number(data.originalImageCount || 0),
        externalImageCount: Number(data.externalImageCount || 0),
      });

      return {
        title: String(data.title || title),
        contentHtml: String(data.contentHtml || content),
        excerpt: String(data.excerpt || excerpt),
        slug: String(data.slug || slug),
        featuredImageUrl: String(data.featuredImageUrl || featuredImageUrl),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      };
    } catch (err: any) {
      setPublishError(err?.message || 'Lỗi khi tạo bài viết chuẩn SEO tự động');
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  // Tìm và bổ sung thêm ảnh ngoài liên quan vào bài viết
  const handleFetchMoreExternalImages = async () => {
    const q = customYtQuery.trim() || focusKeyword.trim() || title.trim() || aiTopic.trim();
    if (!q) {
      setPublishError('Vui lòng nhập tiêu đề hoặc từ khóa nhân vật để tìm thêm ảnh ngoài!');
      return;
    }
    setSearchingExtImages(true);
    setPublishError(null);
    try {
      const res = await fetch('/api/wp-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_external_images',
          query: q,
          limit: 6,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.images) && data.images.length > 0) {
        const existingUrls = new Set(extractedWebImages.map((img) => img.url));
        const newImgs = data.images.filter((img: any) => !existingUrls.has(img.url));
        if (newImgs.length > 0) {
          setExtractedWebImages((prev) => [...prev, ...newImgs]);
          const extraFigures = newImgs
            .map((img: any) => {
              const altText = String(img.alt || title || q).replace(/"/g, '&quot;');
              return `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText}</figcaption>
</figure>`;
            })
            .join('\n\n');
          setContent((prev) => `${prev}\n\n${extraFigures}`);
        }
      }
    } catch (err: any) {
      setPublishError(err?.message || 'Không thể tìm thêm ảnh ngoài');
    } finally {
      setSearchingExtImages(false);
    }
  };

  // Tìm và thay thế 2 video YouTube liên quan ở cuối bài viết theo từ khóa / tên nhân vật
  const handleRefreshYoutubeVideos = async () => {
    const q = customYtQuery.trim() || focusKeyword.trim() || title.trim();
    if (!q) {
      setPublishError('Vui lòng nhập tên nhân vật hoặc chủ đề để tìm 2 video YouTube liên quan!');
      return;
    }
    setSearchingYt(true);
    setPublishError(null);
    try {
      const res = await fetch('/api/wp-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_youtube',
          query: q,
          limit: 2,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.videos) && data.videos.length > 0) {
        setAttachedYoutubeVideos(data.videos);
        const headingText =
          aiLanguage === 'vi'
            ? '🎬 Video Liên Quan Đáng Chú Ý'
            : '🎬 Related Videos & Exclusive Moments';
        const videoBlocks = data.videos
          .map((v: any, idx: number) => {
            const safeTitle = String(v.title || '').replace(/"/g, '&quot;');
            return `<div class="wp-youtube-embed-box" style="margin: 20px 0 28px 0;">
  <p><strong>Video #${idx + 1}: ${v.title}</strong></p>
  <figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 12px 0;">
    <div class="wp-block-embed__wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
      <iframe src="https://www.youtube.com/embed/${v.videoId}" title="${safeTitle}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </figure>
  <p style="font-size: 13px; color: #475569;">👉 <a href="${v.watchUrl}" target="_blank" rel="noopener noreferrer">${
              aiLanguage === 'vi' ? 'Xem trực tiếp trên YouTube' : 'Watch on YouTube'
            }: ${v.title}</a></p>
</div>`;
          })
          .join('\n');

        setContent((prev) => {
          // Xóa khối video cũ ở cuối bài nếu có rồi gắn 2 video mới
          const cleaned = prev.replace(
            /<h2>🎬 (Video Liên Quan Đáng Chú Ý|Related Videos & Exclusive Moments)<\/h2>[\s\S]*$/i,
            ''
          ).trim();
          return `${cleaned}\n\n<h2>${headingText}</h2>\n${videoBlocks}`;
        });
      }
    } catch (err: any) {
      setPublishError(err?.message || 'Không thể tìm video YouTube');
    } finally {
      setSearchingYt(false);
    }
  };

  // Lưu bản nháp nội bộ
  const handleSaveLocalDraft = () => {
    if (!title.trim() && !content.trim()) return;
    const draft: LocalArticleDraft = {
      id: `draft-${Date.now()}`,
      title: title.trim() || 'Bài viết chưa đặt tiêu đề',
      slug,
      content,
      excerpt,
      focusKeyword,
      tags: tagsInput,
      categories: selectedCategories,
      featuredImageUrl,
      employeeCode: selectedEmployeeCode,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };
    const next = [draft, ...localDrafts.slice(0, 19)];
    setLocalDrafts(next);
    try {
      localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleDeleteLocalDraft = (id: string) => {
    const next = localDrafts.filter((d) => d.id !== id);
    setLocalDrafts(next);
    try {
      localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(next));
    } catch {}
  };

  // Làm mới form để viết bài mới
  const handleResetEditor = () => {
    setEditingPostId(undefined);
    setTitle('');
    setSlug('');
    setAutoSlug(true);
    setContent('');
    setExcerpt('');
    setFocusKeyword('');
    setTagsInput('');
    setFeaturedMediaId(0);
    setFeaturedImageUrl('');
    setFeaturedImageBase64('');
    setFeaturedImageAlt('');
    setPublishResult(null);
    setPublishError(null);
  };

  // Nạp bài viết từ danh sách vào trình soạn thảo để chỉnh sửa
  const handleLoadRemotePostToEdit = (post: WpRemotePostItem) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setAutoSlug(false);
    setContent(post.content);
    setExcerpt(post.excerpt);
    setSelectedCategories(post.categories.length > 0 ? post.categories : [2]);
    if (isAdmin && post.employeeCode) {
      setSelectedEmployeeCode(post.employeeCode);
    }
    setFeaturedMediaId(post.featuredMediaId || 0);
    setFeaturedImageUrl(post.featuredImageUrl || '');
    setFeaturedImageBase64('');
    setPublishStatus(post.status === 'draft' ? 'draft' : 'publish');
    setPublishResult(null);
    setPublishError(null);
    setActiveSubTab('editor');
  };

  // Đẩy bài viết lên Website (celeb24h.com / WordPress / Webhook)
  const handlePublishToWebsite = async (overrideStatus?: 'publish' | 'draft') => {
    let pubTitle = title.trim();
    let pubContent = content.trim();
    let pubExcerpt = excerpt.trim();
    let pubSlug = slug.trim();
    let pubFeaturedUrl = featuredImageUrl;

    // Nếu người dùng vừa dán link web (hoặc đoạn nội dung) rồi bấm "Đẩy Bài Lên Web" luôn mà chưa bấm nút "Viết Lại Chuẩn SEO", tự động chạy viết bài trước!
    if ((!pubTitle || !pubContent) && (aiSourceUrl.trim() || aiTopic.trim())) {
      const autoGenerated = await handleGenerateSeoArticle(
        aiSourceUrl.trim() ? 'from_url' : 'from_text'
      );
      if (!autoGenerated) return;
      pubTitle = autoGenerated.title.trim();
      pubContent = autoGenerated.contentHtml.trim();
      pubExcerpt = autoGenerated.excerpt.trim();
      pubSlug = autoGenerated.slug.trim();
      pubFeaturedUrl = autoGenerated.featuredImageUrl;
    }

    if (!pubTitle) {
      setPublishError('Vui lòng nhập tiêu đề bài viết (hoặc dán Link web ở mục 1) trước khi đẩy lên website!');
      return;
    }
    if (!pubContent) {
      setPublishError('Vui lòng nhập nội dung bài viết (hoặc bấm "Viết Lại Chuẩn SEO") trước khi đẩy lên website!');
      return;
    }

    const finalStatus = overrideStatus || publishStatus;
    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      // Chuẩn hóa nội dung: nếu người dùng gõ văn bản thuần không có thẻ <p>, tự động bọc đoạn
      const formattedContent =
        pubContent.includes('<p') || pubContent.includes('<h') || pubContent.includes('<div')
          ? pubContent
          : pubContent
              .split(/\n\s*\n/)
              .map((para) => `<p style="margin: 0 0 22px 0; line-height: 1.85;">${para.trim().replace(/\n/g, '<br />')}</p>`)
              .join('\n\n');

      const tagList = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/wp-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          postId: editingPostId,
          title: pubTitle,
          content: formattedContent,
          excerpt: pubExcerpt,
          slug: pubSlug || undefined,
          status: finalStatus,
          categories: selectedCategories.length > 0 ? selectedCategories : [2],
          tags: tagList,
          employeeCode: selectedEmployeeCode,
          featuredMediaId: featuredMediaId || undefined,
          featuredImageBase64: featuredImageBase64 || undefined,
          featuredImageUrl:
            !featuredImageBase64 && pubFeaturedUrl && !pubFeaturedUrl.startsWith('data:')
              ? pubFeaturedUrl
              : undefined,
          featuredImageAlt: featuredImageAlt.trim() || pubTitle,
          targetMode: targetConfig.targetMode,
          customWpUrl: targetConfig.customWpUrl,
          customWpUser: targetConfig.customWpUser,
          customWpAppPassword: targetConfig.customWpAppPassword,
          webhookUrl: targetConfig.webhookUrl,
          webhookSecret: targetConfig.webhookSecret,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Không thể đẩy bài viết lên website');
      }

      setPublishResult(data.post);
      if (data.post?.id) {
        setEditingPostId(Number(data.post.id));
      }
      // Làm mới danh sách bài viết trên web
      fetchRemoteWpData();
    } catch (err: any) {
      setPublishError(err?.message || 'Lỗi khi đẩy bài viết lên website');
    } finally {
      setIsPublishing(false);
    }
  };

  // Phân tích điểm SEO trực tiếp (0 - 100 điểm)
  const seoAnalysis = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plainText ? plainText.split(' ').length : 0;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    const titleLen = title.trim().length;
    const excerptLen = excerpt.trim().length;
    const hasH2H3 = /<h[23][^>]*>/i.test(content);
    const hasFeaturedImg = Boolean(featuredImageUrl || featuredMediaId > 0);
    const kw = focusKeyword.trim().toLowerCase();
    const kwInTitle = kw ? title.toLowerCase().includes(kw) : titleLen >= 25;
    const kwInContent = kw ? plainText.toLowerCase().includes(kw) : words >= 100;

    const checks = [
      {
        label: 'Độ dài tiêu đề chuẩn SEO (35 - 75 ký tự)',
        passed: titleLen >= 35 && titleLen <= 85,
        detail: `${titleLen} ký tự`,
        points: 20,
      },
      {
        label: kw
          ? `Từ khóa chính "${focusKeyword}" xuất hiện trong tiêu đề & nội dung`
          : 'Mật độ từ khóa & chủ đề rõ ràng',
        passed: kwInTitle && kwInContent,
        detail: kw ? (kwInTitle ? 'Đã có từ khóa' : 'Thiếu từ khóa ở tiêu đề') : 'Tự động',
        points: 20,
      },
      {
        label: 'Độ dài nội dung bài viết (>= 150 từ)',
        passed: words >= 150,
        detail: `${words} từ (~${readingMinutes} phút đọc)`,
        points: 20,
      },
      {
        label: 'Cấu trúc thẻ tiêu đề phụ (H2 / H3)',
        passed: hasH2H3,
        detail: hasH2H3 ? 'Đã có thẻ H2/H3' : 'Nên thêm thẻ H2/H3',
        points: 15,
      },
      {
        label: 'Ảnh đại diện bài viết (Featured Image)',
        passed: hasFeaturedImg,
        detail: hasFeaturedImg ? 'Đã chọn ảnh đại diện' : 'Chưa có ảnh đại diện',
        points: 15,
      },
      {
        label: 'Mô tả Meta Description / Excerpt (50 - 170 ký tự)',
        passed: excerptLen >= 50 && excerptLen <= 200,
        detail: `${excerptLen} ký tự`,
        points: 10,
      },
    ];

    const score = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);
    return {
      score,
      words,
      readingMinutes,
      checks,
    };
  }, [title, content, excerpt, focusKeyword, featuredImageUrl, featuredMediaId]);

  // Lọc danh sách bài viết từ celeb24h.com
  const filteredRemotePosts = useMemo(() => {
    return remotePosts.filter((p) => {
      if (postFilterEmployee !== 'ALL' && p.employeeCode !== postFilterEmployee) {
        return false;
      }
      if (postFilterCategory !== 'ALL' && !p.categories.includes(Number(postFilterCategory))) {
        return false;
      }
      if (postSearch.trim()) {
        const q = postSearch.trim().toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.link.toLowerCase().includes(q) ||
          String(p.id).includes(q)
        );
      }
      return true;
    });
  }, [remotePosts, postFilterEmployee, postFilterCategory, postSearch]);

  return (
    <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* HEADER BANNER: WEBPUBLISH STUDIO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              W
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  WebPublish Studio - Soạn Thảo & Đẩy Bài Lên Website
                </h1>
                <span className="text-xs font-bold text-emerald-700">
                  · Kết nối trực tiếp {siteUrl.replace(/^https?:\/\//, '')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Nền tảng soạn thảo nội dung chuẩn SEO và tự động đẩy bài viết lên website WordPress, tự động gắn Mã Nhân Viên ({selectedEmployeeCode}) để tính View ở Bảng 10.
              </p>
            </div>
          </div>

          {/* THANH CHUYỂN CHẾ ĐỘ (3 SUB-TABS) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('editor')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'editor'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Soạn Thảo & Đẩy Bài</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('posts')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'posts'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Bài Viết Trên Web ({remotePosts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('settings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cấu Hình Đích & Webhook</span>
            </button>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('view_stats')}
                className="px-3 py-2 rounded-lg text-xs font-bold text-cyan-800 hover:bg-white transition-all cursor-pointer flex items-center space-x-1"
                title="Chuyển sang Bảng 10: Thống Kê View"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
                <span>Xem Thống Kê View →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KẾT QUẢ ĐẨY BÀI THÀNH CÔNG (HIỂN THỊ NỔI BẬT LINK GỐC & LINK GẮN MÃ NHÂN VIÊN) */}
      {publishResult && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-emerald-950">
                  🎉 Đã đẩy bài viết lên Website thành công! (ID #{publishResult.id})
                </h3>
                <p className="text-xs text-emerald-800">
                  Bài viết: <strong>{publishResult.title}</strong> · Trạng thái:{' '}
                  <strong className="uppercase">{publishResult.status}</strong> · Mã NV:{' '}
                  <strong>{publishResult.employeeCode}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={publishResult.trackingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs"
              >
                <span>Mở Xem Bài Trên Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={handleResetEditor}
                className="inline-flex items-center space-x-1 px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Viết Bài Mới</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Link gắn Mã nhân viên để đi rải Page/Group */}
            <div className="p-3 bg-white border-2 border-emerald-400 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-emerald-800 uppercase block">
                  🔥 Link Gắn Mã Nhân Viên ({publishResult.employeeCode}) — Dùng đăng Fanpage / Group tính View:
                </span>
                <div className="font-mono font-black text-xs sm:text-sm text-slate-900 truncate mt-0.5">
                  {publishResult.trackingLink}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(publishResult.trackingLink, 'result-tracking')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shrink-0 flex items-center space-x-1 cursor-pointer"
              >
                {copiedKey === 'result-tracking' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã Copy</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link Mã NV</span>
                  </>
                )}
              </button>
            </div>

            {/* Link gốc bài viết */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Link gốc bài viết trên Website:
                </span>
                <div className="font-mono font-bold text-xs sm:text-sm text-slate-700 truncate mt-0.5">
                  {publishResult.link}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(publishResult.link, 'result-raw')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shrink-0 flex items-center space-x-1 cursor-pointer"
              >
                {copiedKey === 'result-raw' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã Copy</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link Gốc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THÔNG BÁO LỖI NẾU CÓ */}
      {publishError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-rose-900 font-bold">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{publishError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPublishError(null)}
            className="text-xs underline cursor-pointer ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: TRÌNH SOẠN THẢO CHUẨN SEO & ĐẨY BÀI LÊN WEBSITE */}
      {/* =================================================================== */}
      {activeSubTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CỘT TRÁI (2/3): SOẠN THẢO BÀI VIẾT & TRỢ LÝ AI SEO */}
          <div className="lg:col-span-2 space-y-5">
            {/* KHUNG 2 CHỨC NĂNG CHÍNH: VIẾT BÀI TỪ NỘI DUNG HOẶC TỪ LINK WEB BẤT KỲ + LẤY HẾT ẢNH + 2 VIDEO YOUTUBE */}
            <div className="bg-gradient-to-r from-emerald-50/95 via-teal-50/90 to-sky-50/90 border-2 border-emerald-300/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 block">
                      Trợ Lý Viết Bài Chuẩn SEO Tự Động + Minh Họa Ảnh & 2 Video YouTube Cuối Bài
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Chọn 1 trong 2 chế độ bên dưới để tự động viết bài, chèn ảnh minh họa và gắn 2 video YouTube liên quan
                    </span>
                  </div>
                </div>

                {/* Chọn ngôn ngữ bài viết */}
                <div className="flex items-center space-x-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAiLanguage('en')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${
                      aiLanguage === 'en'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    🇺🇸 English (US Showbiz)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiLanguage('vi')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${
                      aiLanguage === 'vi'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    🇻🇳 Tiếng Việt
                  </button>
                </div>
              </div>

              {/* 2 NÚT CHUYỂN CHỨC NĂNG CHÍNH */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiMode('from_url')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                    aiMode === 'from_url'
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      aiMode === 'from_url'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    1
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">
                      Ném 1 Link Web Bất Kỳ → Giữ Tiêu Đề Gốc & Viết Lại 2.000 – 5.000 Từ Chuẩn SEO
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Lấy luôn tiêu đề bài link nhập vào + viết sâu 2.000–5.000 từ (~150 từ/đoạn, xuống dòng rõ) + lấy hết ảnh trong bài & bổ sung ảnh ngoài + 2 Video YouTube
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAiMode('from_text')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                    aiMode === 'from_text'
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      aiMode === 'from_text'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">
                      Nhập Đoạn Nội Dung / Chủ Đề → Viết Bài Dài 2.000 – 5.000 Từ Chuẩn SEO
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Viết thành bài báo dài 2.000–5.000 từ (~150 từ/đoạn, xuống dòng) + tự bổ sung bộ ảnh minh họa ngoài + gắn 2 Video YouTube cuối bài
                    </div>
                  </div>
                </button>
              </div>

              {/* GIAO DIỆN CHỨC NĂNG 1: NHẬP LINK WEB BẤT KỲ */}
              {aiMode === 'from_url' ? (
                <div className="space-y-2.5 bg-white/90 p-3.5 rounded-xl border border-emerald-200">
                  <label className="text-xs font-black text-slate-800 block">
                    🔗 Dán đường dẫn (URL) bài viết từ bất kỳ trang báo / website nào (Hệ thống tự lấy luôn tiêu đề bài gốc):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={aiSourceUrl}
                      onChange={(e) => setAiSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleGenerateSeoArticle('from_url');
                        }
                      }}
                      placeholder="VD: https://beaware.fun/... hoặc https://people.com/... hoặc https://celeb24h.com/1159"
                      className="flex-1 px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => void handleGenerateSeoArticle('from_url')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang viết bài 2000-5000 từ, lấy ảnh & 2 Video...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Viết Lại 2.000–5.000 Từ + Lấy Hết Ảnh & Ảnh Ngoài + 2 Video YT</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* GIAO DIỆN CHỨC NĂNG 2: NHẬP ĐOẠN NỘI DUNG THÔ */
                <div className="space-y-2.5 bg-white/90 p-3.5 rounded-xl border border-emerald-200">
                  <label className="text-xs font-black text-slate-800 block">
                    📝 Nhập đoạn nội dung thô, bản tóm tắt hoặc tên nhân vật / sự kiện:
                  </label>
                  <textarea
                    rows={3}
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="Dán đoạn nội dung hoặc ý chính bạn muốn viết chuẩn SEO 2.000 - 5.000 từ vào đây..."
                    className="w-full px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => void handleGenerateSeoArticle('from_text')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang viết bài 2000-5000 từ, tìm ảnh ngoài & 2 Video...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Viết Bài 2.000–5.000 Từ Chuẩn SEO + Ảnh Ngoài & 2 Video YT</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* THỐNG KÊ BÀI VIẾT VỪA TẠO: SỐ TỪ (2000-5000 TỪ), SỐ ĐOẠN (~150 TỪ/ĐOẠN), ẢNH TRONG BÀI & ẢNH NGOÀI */}
              {aiArticleStats && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-900 text-white text-xs font-bold">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">
                      ✅ ĐÃ VIẾT {aiArticleStats.wordCount.toLocaleString('vi-VN')} TỪ CHUẨN SEO
                    </span>
                    <span>
                      • {aiArticleStats.paragraphCount} đoạn văn (~150 từ / 1 đoạn & xuống dòng rõ ràng)
                    </span>
                    <span>
                      • {aiArticleStats.originalImageCount} ảnh trong bài gốc + {aiArticleStats.externalImageCount} ảnh bổ sung ngoài
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-200">
                    Đã giữ nguyên tiêu đề bài gốc
                  </span>
                </div>
              )}

              {/* HIỂN THỊ DANH SÁCH ẢNH ĐÃ LẤY TỪ BÀI GỐC + ẢNH NGOÀI & 2 VIDEO YOUTUBE ĐÃ GẮN Ở CUỐI BÀI */}
              {(extractedWebImages.length > 0 || attachedYoutubeVideos.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Danh sách ảnh minh họa đã lấy từ link web + ảnh bổ sung ngoài */}
                  {extractedWebImages.length > 0 && (
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-black text-emerald-900">
                          🖼️ Đã chèn {extractedWebImages.length} ảnh (Ảnh bài gốc + Ảnh bổ sung ngoài):
                        </span>
                        <button
                          type="button"
                          disabled={searchingExtImages}
                          onClick={() => void handleFetchMoreExternalImages()}
                          className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] cursor-pointer"
                        >
                          {searchingExtImages ? 'Đang tìm thêm...' : '+ Bổ sung thêm ảnh ngoài'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {extractedWebImages.map((img, i) => {
                          const isCurrentFeatured = featuredImageUrl === img.url;
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                setFeaturedImageUrl(img.url);
                                setFeaturedMediaId(0);
                                setFeaturedImageBase64('');
                              }}
                              className={`relative shrink-0 w-18 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                isCurrentFeatured
                                  ? 'border-emerald-600 ring-2 ring-emerald-500/30'
                                  : 'border-slate-200 hover:border-emerald-400'
                              }`}
                              title="Bấm để chọn ảnh này làm Ảnh Đại Diện (Featured Image)"
                            >
                              <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                              <span
                                className={`absolute top-0.5 left-0.5 text-[8px] font-black px-1 rounded ${
                                  img.isExternal
                                    ? 'bg-indigo-600/90 text-white'
                                    : 'bg-emerald-600/90 text-white'
                                }`}
                              >
                                {img.isExternal ? '+Ngoài' : 'Gốc'}
                              </span>
                              <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                                #{i + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2 Video YouTube liên quan đã gắn ở cuối bài */}
                  <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-rose-900">
                        🎬 2 Video YouTube liên quan gắn ở cuối bài ({attachedYoutubeVideos.length} video):
                      </span>
                    </div>

                    {attachedYoutubeVideos.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {attachedYoutubeVideos.map((v) => (
                          <a
                            key={v.videoId}
                            href={v.watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 transition-colors group"
                          >
                            <img
                              src={v.thumbnailUrl}
                              alt={v.title}
                              className="w-14 h-10 object-cover rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-rose-700">
                                Video #{idx + 1}
                              </div>
                              <div className="text-[11px] font-bold text-slate-800 truncate group-hover:text-rose-700">
                                {v.title}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Tìm đổi 2 video YouTube khác theo tên nhân vật */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="text"
                        value={customYtQuery}
                        onChange={(e) => setCustomYtQuery(e.target.value)}
                        placeholder="Nhập tên nhân vật để đổi 2 video YT khác..."
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <button
                        type="button"
                        disabled={searchingYt}
                        onClick={handleRefreshYoutubeVideos}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        {searchingYt ? 'Đang tìm...' : 'Đổi 2 Video YT'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* KHUNG SOẠN THẢO CHÍNH */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {editingPostId && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-bold">
                  <span>
                    ✏️ Đang chỉnh sửa bài viết trên Web ID #{editingPostId}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetEditor}
                    className="text-blue-700 underline cursor-pointer"
                  >
                    Hủy sửa & Viết bài mới
                  </button>
                </div>
              )}

              {/* Tiêu đề bài viết */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Tiêu Đề Bài Viết (Title) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {title.length} ký tự
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề bài viết hấp dẫn chuẩn SEO..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-lg font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Đường dẫn tĩnh (Slug) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                <span className="text-slate-500 font-bold shrink-0">
                  🔗 Đường dẫn (Slug): <span className="font-mono text-slate-700">{siteUrl}/</span>
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setAutoSlug(false);
                  }}
                  placeholder="duong-dan-bai-viet"
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800"
                />
              </div>

              {/* THANH CÔNG CỤ ĐỊNH DẠNG (TOOLBAR) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertFormatting('<h2>', '</h2>', 'Tiêu đề phụ H2')}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="Thẻ tiêu đề H2"
                    >
                      <Heading2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<h3>', '</h3>', 'Tiêu đề phụ H3')}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="Thẻ tiêu đề H3"
                    >
                      <Heading3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<strong>', '</strong>', 'chữ in đậm')}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="In đậm"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('<em>', '</em>', 'chữ in nghiêng')}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="In nghiêng"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertFormatting('<blockquote><p>', '</p></blockquote>', 'Câu trích dẫn nổi bật')
                      }
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="Trích dẫn"
                    >
                      <Quote className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertFormatting('<ul>\n  <li>', '</li>\n  <li>Mục 2</li>\n</ul>', 'Mục 1')
                      }
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="Danh sách gạch đầu dòng"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertFormatting('<a href="https://celeb24h.com" target="_blank">', '</a>', 'Văn bản liên kết')
                      }
                      className="p-1.5 hover:bg-white rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer"
                      title="Chèn liên kết"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>

                    {/* Nút tải ảnh chèn vào bài viết */}
                    <button
                      type="button"
                      onClick={() => inlineImageInputRef.current?.click()}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer ml-1"
                      title="Tải ảnh từ máy tính lên WordPress và chèn vào bài viết"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+ Chèn Ảnh Vào Bài</span>
                    </button>
                    <input
                      ref={inlineImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleInlineImageUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Nút chuyển chế độ Soạn thảo / Xem trước */}
                  <div className="flex items-center space-x-1 bg-slate-200/70 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setEditorViewMode('visual')}
                      className={`px-2.5 py-1 rounded-md font-bold cursor-pointer flex items-center space-x-1 ${
                        editorViewMode === 'visual'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Soạn Thảo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorViewMode('preview')}
                      className={`px-2.5 py-1 rounded-md font-bold cursor-pointer flex items-center space-x-1 ${
                        editorViewMode === 'preview'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem Trước</span>
                    </button>
                  </div>
                </div>

                {editorViewMode === 'visual' ? (
                  <textarea
                    ref={contentTextareaRef}
                    rows={16}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập nội dung bài viết tại đây (hỗ trợ cả văn bản thường lẫn thẻ HTML <p>, <h2>, <h3>, <img>...)..."
                    className="w-full p-4 text-sm text-slate-800 font-sans leading-relaxed focus:outline-none resize-y"
                  />
                ) : (
                  <div className="p-5 min-h-[360px] prose prose-slate max-w-none bg-white overflow-y-auto">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
                      {title || 'Tiêu đề bài viết xem trước'}
                    </h1>
                    {featuredImageUrl && (
                      <img
                        src={featuredImageUrl}
                        alt={title}
                        className="w-full max-h-80 object-cover rounded-xl mb-4 border border-slate-200"
                      />
                    )}
                    <div
                      className="text-sm text-slate-800 space-y-3 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html:
                          content ||
                          '<p class="text-slate-400 italic">Chưa có nội dung bài viết...</p>',
                      }}
                    />
                  </div>
                )}

                <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-500">
                  <span>
                    Số từ: <strong className="text-slate-800">{seoAnalysis.words}</strong> từ · Thời
                    gian đọc: ~<strong className="text-slate-800">{seoAnalysis.readingMinutes}</strong>{' '}
                    phút
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveLocalDraft}
                    className="text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    💾 Lưu vào bộ nhớ nháp trình duyệt
                  </button>
                </div>
              </div>

              {/* TỐI ƯU META SEO & TỪ KHÓA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Từ Khóa Chính SEO (Focus Keyword)
                  </label>
                  <input
                    type="text"
                    value={focusKeyword}
                    onChange={(e) => setFocusKeyword(e.target.value)}
                    placeholder="VD: Beloved TV Host, Showbiz..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Thẻ Tags (Cách nhau bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="VD: Showbiz, Celebrity, Story..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-slate-700 uppercase">
                    Mô Tả Ngắn / Meta Description (Excerpt)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {excerpt.length} / 160 ký tự
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Đoạn tóm tắt ngắn hiển thị trên Google và khi chia sẻ link lên Facebook Fanpage / Group..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>

            {/* BẢNG KIỂM TRA ĐIỂM CHUẨN SEO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Bảng Chấm Điểm Tối Ưu Chuẩn SEO (Real-time SEO Score)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tự động đánh giá cấu trúc bài viết trước khi đẩy lên website
                  </p>
                </div>
                <div
                  className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-sm ${
                    seoAnalysis.score >= 80
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : seoAnalysis.score >= 50
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  {seoAnalysis.score} / 100 điểm SEO
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {seoAnalysis.checks.map((chk, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 ${
                      chk.passed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          chk.passed ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span>{chk.label}</span>
                    </div>
                    <span className="font-mono font-bold text-[11px] shrink-0">{chk.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (1/3): CẤU HÌNH ĐẨY BÀI, MÃ NHÂN VIÊN, CHUYÊN MỤC & ẢNH ĐẠI DIỆN */}
          <div className="lg:col-span-1 space-y-5">
            {/* HỘP XUẤT BẢN & ĐẨY BÀI LÊN WEBSITE */}
            <div className="bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Send className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900">
                      Đẩy Bài Lên Website
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Đích: {targetConfig.targetMode === 'default_wp' ? siteUrl : targetConfig.targetMode}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-700">Sẵn sàng</span>
              </div>

              {/* CHỌN MÃ NHÂN VIÊN & TÁC GIẢ TRÊN WEB */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <label className="text-xs font-black text-emerald-950 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Mã Nhân Viên Gắn Link & Tác Giả Web:</span>
                </label>
                <select
                  value={selectedEmployeeCode}
                  disabled={!isAdmin}
                  onChange={(e) => setSelectedEmployeeCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-black text-slate-900 disabled:bg-slate-100"
                >
                  {DEFAULT_WP_EMPLOYEE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label} ({opt.staffHint})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  Sau khi đẩy bài, hệ thống tự động tạo link gắn đuôi{' '}
                  <strong className="font-mono">?{selectedEmployeeCode}</strong> để ghi nhận lượt xem
                  cho mã của bạn ở Bảng 10.
                </p>
              </div>

              {/* CHỌN CHUYÊN MỤC (CATEGORIES TRÊN CELEB24H.COM) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 uppercase flex items-center space-x-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chuyên Mục Website (Categories)</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchRemoteWpData}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Làm mới
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {categories.map((cat) => {
                    const checked = selectedCategories.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          checked
                            ? 'bg-blue-50 border-blue-400 text-blue-950'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories((prev) => [...prev, cat.id]);
                            } else {
                              setSelectedCategories((prev) => prev.filter((id) => id !== cat.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="truncate">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ẢNH ĐẠI DIỆN BÀI VIẾT (FEATURED IMAGE) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 uppercase flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                  <span>Ảnh Đại Diện Bài Viết (Featured Image)</span>
                </label>

                {featuredImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={featuredImageUrl}
                      alt="Featured preview"
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFeaturedImageUrl('');
                        setFeaturedImageBase64('');
                        setFeaturedMediaId(0);
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-slate-900/80 text-white rounded-lg text-[11px] font-bold cursor-pointer hover:bg-rose-600"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => featuredFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50/70 hover:bg-emerald-50/40 transition-all"
                  >
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-slate-700 block">
                      {uploadingMedia
                        ? 'Đang tải ảnh lên WordPress...'
                        : 'Bấm để tải ảnh đại diện từ máy tính'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Tự động upload lên thư viện Media của celeb24h.com
                    </span>
                  </div>
                )}

                <input
                  ref={featuredFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFeaturedFileSelect}
                  className="hidden"
                />

                <input
                  type="text"
                  value={featuredImageUrl.startsWith('data:') ? '' : featuredImageUrl}
                  onChange={(e) => {
                    setFeaturedImageUrl(e.target.value);
                    setFeaturedImageBase64('');
                    setFeaturedMediaId(0);
                  }}
                  placeholder="Hoặc dán trực tiếp URL ảnh đại diện (https://...)..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              {/* NÚT HÀNH ĐỘNG ĐẨY BÀI LÊN WEBSITE */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isPublishing || uploadingMedia}
                  onClick={() => handlePublishToWebsite('publish')}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-black shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang đẩy bài lên Website...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {editingPostId
                          ? 'Cập Nhật Bài Viết Lên Website'
                          : 'Đẩy Bài Lên Website Ngay (Publish)'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isPublishing || uploadingMedia}
                  onClick={() => handlePublishToWebsite('draft')}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Gửi Lưu Nháp Trên WordPress (Draft)</span>
                </button>
              </div>
            </div>

            {/* DANH SÁCH BẢN NHÁP LƯU TRÊN MÁY */}
            {localDrafts.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
                <h3 className="text-xs font-black text-slate-800 uppercase flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Bản Nháp Đã Lưu Trên Máy ({localDrafts.length})</span>
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {localDrafts.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div
                        onClick={() => {
                          setTitle(d.title);
                          setSlug(d.slug);
                          setContent(d.content);
                          setExcerpt(d.excerpt);
                          setFocusKeyword(d.focusKeyword);
                          setTagsInput(d.tags);
                          setSelectedCategories(d.categories);
                          setFeaturedImageUrl(d.featuredImageUrl);
                        }}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="font-bold text-slate-900 truncate">{d.title}</div>
                        <div className="text-[10px] text-slate-500">{d.updatedAt}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocalDraft(d.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: DANH SÁCH BÀI VIẾT TRÊN WEBSITE (CELEB24H.COM) */}
      {/* =================================================================== */}
      {activeSubTab === 'posts' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Danh Sách Bài Viết Trên Website ({siteUrl})
              </h2>
              <p className="text-xs text-slate-500">
                Bấm <strong>Copy Link Mã NV ({selectedEmployeeCode})</strong> để lấy link có gắn mã nhân viên đi đăng Fanpage / Group
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={postSearch}
                  onChange={(e) => setPostSearch(e.target.value)}
                  placeholder="Tìm tiêu đề hoặc ID bài..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <select
                value={postFilterEmployee}
                onChange={(e) => setPostFilterEmployee(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="ALL">Tất cả tác giả</option>
                {DEFAULT_WP_EMPLOYEE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={String(postFilterCategory)}
                onChange={(e) =>
                  setPostFilterCategory(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="ALL">Tất cả chuyên mục</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchRemoteWpData}
                disabled={loadingRemote}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRemote ? 'animate-spin' : ''}`} />
                <span>Tải lại</span>
              </button>
            </div>
          </div>

          {remoteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
              {remoteError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-black uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-16">ID</th>
                  <th className="py-3 px-3">Bài Viết & Chuyên Mục</th>
                  <th className="py-3 px-3">Tác Giả Web</th>
                  <th className="py-3 px-3">Link Gắn Mã Nhân Viên ({selectedEmployeeCode})</th>
                  <th className="py-3 px-3 text-center">Trạng Thái</th>
                  <th className="py-3 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRemotePosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      {loadingRemote
                        ? 'Đang tải danh sách bài viết từ celeb24h.com...'
                        : 'Không tìm thấy bài viết nào khớp bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredRemotePosts.map((post) => {
                    const cleanUrl = post.link.replace(/\/+$/, '');
                    const myTrackingUrl = `${cleanUrl}${
                      cleanUrl.includes('?') ? '&' : '?'
                    }${selectedEmployeeCode}`;

                    return (
                      <tr key={post.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-mono font-bold text-slate-500">
                          #{post.id}
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <div className="flex items-start space-x-3">
                            {post.featuredImageUrl && (
                              <img
                                src={post.featuredImageUrl}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 text-xs sm:text-sm line-clamp-2">
                                {post.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {post.categoryNames.join(', ')} · {post.date.replace('T', ' ').slice(0, 16)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">
                          {post.authorName}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs text-emerald-800 font-bold truncate max-w-[230px]">
                              {myTrackingUrl}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(myTrackingUrl, `post-${post.id}`)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black cursor-pointer shrink-0"
                            >
                              {copiedKey === `post-${post.id}` ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Đã Copy</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link ?{selectedEmployeeCode}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-bold ${
                              post.status === 'publish' ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {post.status === 'publish' ? 'Đã đăng' : 'Bản nháp'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadRemotePostToEdit(post)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              Sửa bài
                            </button>
                            <a
                              href={myTrackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200"
                              title="Xem trên web"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: CẤU HÌNH ĐÍCH ĐẨY BÀI (WORDPRESS & WEBHOOK API) */}
      {/* =================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs max-w-3xl space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Cấu Hình Kết Nối Website & Webhook API
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mặc định hệ thống đã kết nối trực tiếp với <strong>https://celeb24h.com</strong>. Bạn cũng có thể chuyển sang đẩy bài lên WordPress cá nhân hoặc Webhook API tùy chỉnh.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                const next = { ...targetConfig, targetMode: 'default_wp' as const };
                setTargetConfig(next);
                localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
              }}
              className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                targetConfig.targetMode === 'default_wp'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Globe className="w-5 h-5 text-emerald-600 mb-1" />
              <div className="text-xs font-black">WordPress Hệ Thống</div>
              <div className="text-[11px] opacity-80">celeb24h.com (Đã kết nối sẵn)</div>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = { ...targetConfig, targetMode: 'custom_wp' as const };
                setTargetConfig(next);
                localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
              }}
              className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                targetConfig.targetMode === 'custom_wp'
                  ? 'bg-blue-50 border-blue-500 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Settings className="w-5 h-5 text-blue-600 mb-1" />
              <div className="text-xs font-black">WordPress Cá Nhân</div>
              <div className="text-[11px] opacity-80">Qua REST API & App Password</div>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = { ...targetConfig, targetMode: 'webhook' as const };
                setTargetConfig(next);
                localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
              }}
              className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                targetConfig.targetMode === 'webhook'
                  ? 'bg-purple-50 border-purple-500 text-purple-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Webhook className="w-5 h-5 text-purple-600 mb-1" />
              <div className="text-xs font-black">Webhook API</div>
              <div className="text-[11px] opacity-80">Đẩy JSON sang Endpoint bất kỳ</div>
            </button>
          </div>

          {targetConfig.targetMode === 'custom_wp' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ Website WordPress (URL)
                </label>
                <input
                  type="text"
                  value={targetConfig.customWpUrl}
                  onChange={(e) => {
                    const next = { ...targetConfig, customWpUrl: e.target.value };
                    setTargetConfig(next);
                    localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
                  }}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username WordPress
                  </label>
                  <input
                    type="text"
                    value={targetConfig.customWpUser}
                    onChange={(e) => {
                      const next = { ...targetConfig, customWpUser: e.target.value };
                      setTargetConfig(next);
                      localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
                    }}
                    placeholder="admin"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Application Password
                  </label>
                  <input
                    type="password"
                    value={targetConfig.customWpAppPassword}
                    onChange={(e) => {
                      const next = { ...targetConfig, customWpAppPassword: e.target.value };
                      setTargetConfig(next);
                      localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
                    }}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {targetConfig.targetMode === 'webhook' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Webhook Endpoint URL (POST)
                </label>
                <input
                  type="text"
                  value={targetConfig.webhookUrl}
                  onChange={(e) => {
                    const next = { ...targetConfig, webhookUrl: e.target.value };
                    setTargetConfig(next);
                    localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
                  }}
                  placeholder="https://api.yourwebsite.com/webhook/publish"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bearer Token / Secret Key (Tùy chọn)
                </label>
                <input
                  type="password"
                  value={targetConfig.webhookSecret}
                  onChange={(e) => {
                    const next = { ...targetConfig, webhookSecret: e.target.value };
                    setTargetConfig(next);
                    localStorage.setItem(LOCAL_TARGET_CONFIG_KEY, JSON.stringify(next));
                  }}
                  placeholder="Secret token..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
