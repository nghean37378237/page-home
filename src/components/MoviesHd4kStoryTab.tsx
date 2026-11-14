import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AppUser,
  UserAccount,
  DEFAULT_WP_EMPLOYEE_OPTIONS,
  resolveAccountWpEmployeeCode,
} from '../types';
import {
  BookOpen,
  Sparkles,
  Send,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
  Upload,
  Eye,
  Code,
  Columns,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Quote,
  Settings,
  FileText,
  Trash2,
  Edit3,
  Link2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe,
  Search,
  Plus,
  FolderOpen,
  Tag,
  UserCheck,
  Wand2,
} from 'lucide-react';

interface MoviesWpCategoryItem {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface MoviesWpPostItem {
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
  postType?: 'posts' | 'np_story';
}

interface StoryImageCandidate {
  url: string;
  alt: string;
  isFeatured?: boolean;
  isExternal?: boolean;
}

interface LocalStoryDraft {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string;
  categories: number[];
  featuredImageUrl: string;
  employeeCode: string;
  storyStyle: StoryStyleKey;
  language: 'en' | 'vi';
  updatedAt: string;
}

interface MoviesTargetConfig {
  targetMode: 'default_wp' | 'custom_wp' | 'webhook';
  customWpUrl: string;
  customWpUser: string;
  customWpAppPassword: string;
  webhookUrl: string;
  webhookSecret: string;
}

type StoryStyleKey =
  | 'emotional_drama'
  | 'movie_story'
  | 'mystery_twist'
  | 'romance_life'
  | 'celebrity_chronicle';

type StoryPovKey = 'third_person' | 'first_person';

interface MoviesHd4kStoryTabProps {
  currentUser: AppUser;
  accounts?: UserAccount[];
  onNavigateToTab?: (tab: string) => void;
}

const LOCAL_STORY_DRAFTS_KEY = 'movieshd4k_story_local_drafts_v1';
const LOCAL_MOVIES_CONFIG_KEY = 'movieshd4k_story_target_cfg_v1';

const STORY_STYLE_OPTIONS: { key: StoryStyleKey; label: string; hint: string }[] = [
  { key: 'emotional_drama', label: 'Cảm Động · Nhân Văn', hint: 'Chiều sâu tâm lý & cao trào chạm cảm xúc' },
  { key: 'movie_story', label: 'Kể Chuyện Phim', hint: 'Theo phân cảnh điện ảnh kịch tính' },
  { key: 'mystery_twist', label: 'Bí Ẩn · Plot Twist', hint: 'Cài cắm manh mối & cú bẻ lái bất ngờ' },
  { key: 'romance_life', label: 'Tình Cảm · Gia Đình', hint: 'Chân thật, ấm áp & những lựa chọn khó khăn' },
  { key: 'celebrity_chronicle', label: 'Hậu Trường · Hồi Ký', hint: 'Chuyện đời ngôi sao kể theo lối tự sự' },
];

function slugifyStoryText(input: string): string {
  return (input || '')
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

function stripTagsPlain(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const MoviesHd4kStoryTab: React.FC<MoviesHd4kStoryTabProps> = ({
  currentUser,
  accounts = [],
  onNavigateToTab,
}) => {
  const isAdmin = currentUser.role === 'admin';

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
      ) || (isAdmin ? 'A0006' : 'M2001')
    );
  }, [viewerMatchedAccount, currentUser, isAdmin]);

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'posts' | 'drafts' | 'settings'>('editor');

  // Remote WordPress state
  const [siteUrl, setSiteUrl] = useState('https://movieshd4k.com');
  const [loginUrl, setLoginUrl] = useState('https://movieshd4k.com/nghean3737');
  const [authConnected, setAuthConnected] = useState(false);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [categories, setCategories] = useState<MoviesWpCategoryItem[]>([
    { id: 12, name: 'Story', slug: 'story', count: 1 },
    { id: 7, name: 'Film', slug: 'film', count: 86 },
    { id: 6, name: 'showbiz', slug: 'new', count: 5 },
    { id: 11, name: 'Hotnew', slug: 'hotnew', count: 0 },
    { id: 14, name: 'Post', slug: 'post', count: 0 },
  ]);
  const [remotePosts, setRemotePosts] = useState<MoviesWpPostItem[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [postSearch, setPostSearch] = useState('');

  // Editor state
  const [editingPostId, setEditingPostId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [tagsInput, setTagsInput] = useState('Story, MoviesHD4K');
  const [postType, setPostType] = useState<'np_story' | 'posts'>('np_story');
  const [genres, setGenres] = useState<MoviesWpCategoryItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([12]); // Default Story
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string>(defaultEmployeeCode);
  const [publishStatus, setPublishStatus] = useState<'publish' | 'draft'>('publish');
  const [editorViewMode, setEditorViewMode] = useState<'preview' | 'split' | 'html'>('preview');

  // Featured & story images
  const [featuredMediaId, setFeaturedMediaId] = useState<number>(0);
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [featuredImageBase64, setFeaturedImageBase64] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [manualImageUrlInput, setManualImageUrlInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [storyImages, setStoryImages] = useState<StoryImageCandidate[]>([]);

  // AI Story Studio controls (Free Tier Gemini)
  const [aiMode, setAiMode] = useState<'from_idea' | 'from_url' | 'rewrite_draft'>('from_idea');
  const [aiTopic, setAiTopic] = useState('');
  const [aiSourceUrl, setAiSourceUrl] = useState('');
  const [aiKeyword, setAiKeyword] = useState('');
  const [storyStyle, setStoryStyle] = useState<StoryStyleKey>('emotional_drama');
  const [storyPov, setStoryPov] = useState<StoryPovKey>('third_person');
  const [chapterCount, setChapterCount] = useState<number>(5);
  const [aiLanguage, setAiLanguage] = useState<'en' | 'vi'>('en');
  const [aiLoading, setAiLoading] = useState(false);
  const [extractingSource, setExtractingSource] = useState(false);
  const [searchingImages, setSearchingImages] = useState(false);

  // Publishing & feedback
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [publishedResult, setPublishedResult] = useState<{
    postId?: number;
    link?: string;
    trackingLink?: string;
    status?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Local drafts
  const [localDrafts, setLocalDrafts] = useState<LocalStoryDraft[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORY_DRAFTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Target connection config
  const [targetConfig, setTargetConfig] = useState<MoviesTargetConfig>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_MOVIES_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          targetMode: parsed.targetMode || 'default_wp',
          customWpUrl: parsed.customWpUrl || 'https://movieshd4k.com',
          customWpUser: parsed.customWpUser || '',
          customWpAppPassword: parsed.customWpAppPassword || '',
          webhookUrl: parsed.webhookUrl || '',
          webhookSecret: parsed.webhookSecret || '',
        };
      }
    } catch {}
    return {
      targetMode: 'default_wp',
      customWpUrl: 'https://movieshd4k.com',
      customWpUser: '',
      customWpAppPassword: '',
      webhookUrl: '',
      webhookSecret: '',
    };
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedEmployeeCode(defaultEmployeeCode);
  }, [defaultEmployeeCode]);

  useEffect(() => {
    if (autoSlug && title) {
      setSlug(slugifyStoryText(title));
    }
  }, [title, autoSlug]);

  const saveDraftsToStorage = useCallback((next: LocalStoryDraft[]) => {
    setLocalDrafts(next);
    try {
      localStorage.setItem(LOCAL_STORY_DRAFTS_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const saveTargetConfig = useCallback((next: MoviesTargetConfig) => {
    setTargetConfig(next);
    try {
      localStorage.setItem(LOCAL_MOVIES_CONFIG_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const loadRemoteData = useCallback(async () => {
    setLoadingRemote(true);
    setRemoteError(null);
    try {
      const res = await fetch('/api/movieshd4k-publish');
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Không thể tải dữ liệu từ movieshd4k.com');
      }
      if (data.siteUrl) setSiteUrl(data.siteUrl);
      if (data.loginUrl) setLoginUrl(data.loginUrl);
      setAuthConnected(Boolean(data.authConnected));
      setAuthWarning(data.authWarning || null);
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
        const storyCat = data.categories.find(
          (c: MoviesWpCategoryItem) => c.slug === 'story' || c.name.toLowerCase() === 'story'
        );
        if (storyCat && selectedCategories.length === 0) {
          setSelectedCategories([storyCat.id]);
        }
      }
      if (Array.isArray(data.genres)) {
        setGenres(data.genres);
      }
      if (Array.isArray(data.posts)) {
        setRemotePosts(data.posts);
      }
    } catch (err: any) {
      setRemoteError(err?.message || 'Lỗi kết nối tới movieshd4k.com');
    } finally {
      setLoadingRemote(false);
    }
  }, [selectedCategories.length]);

  useEffect(() => {
    void loadRemoteData();
  }, [loadRemoteData]);

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {}
  };

  const wordStats = useMemo(() => {
    const plain = stripTagsPlain(content);
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const chapters = (content.match(/<h[23]\b[^>]*>/gi) || []).length;
    const images = (content.match(/<img\b/gi) || []).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return { words, chapters, images, minutes };
  }, [content]);

  const previewTrackingUrl = useMemo(() => {
    const base = siteUrl.replace(/\/+$/, '');
    const pathSlug = (slug || slugifyStoryText(title) || 'story-slug').replace(/^\/+/, '');
    const code = (selectedEmployeeCode || '').trim().toUpperCase();
    return code ? `${base}/${pathSlug}?${code}` : `${base}/${pathSlug}`;
  }, [siteUrl, slug, title, selectedEmployeeCode]);

  const insertHtmlSnippet = (before: string, after = '') => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}\n${before}${after}`);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end);
    const nextVal = `${content.slice(0, start)}${before}${selected || (after ? 'Nội dung...' : '')}${after}${content.slice(end)}`;
    setContent(nextVal);
    if (editorViewMode === 'preview') setEditorViewMode('split');
    setTimeout(() => {
      el.focus();
      const pos = start + before.length + (selected ? selected.length : 0);
      el.setSelectionRange(pos, pos);
    }, 10);
  };

  const handleInsertImageToStory = (url: string, alt?: string) => {
    if (!url) return;
    const fig = `\n<figure class="wp-block-image size-large"><img src="${url}" alt="${
      alt || title || 'Story image'
    }" /><figcaption>${alt || title || ''}</figcaption></figure>\n`;
    setContent((prev) => `${prev}${fig}`);
    setNotice({ type: 'info', message: 'Đã chèn ảnh minh họa vào cuối nội dung truyện.' });
  };

  const handleExtractSourceUrl = async () => {
    const cleanUrl = aiSourceUrl.trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      setNotice({ type: 'error', message: 'Vui lòng nhập đường dẫn URL hợp lệ bắt đầu bằng http/https.' });
      return;
    }
    setExtractingSource(true);
    setNotice(null);
    try {
      const res = await fetch('/api/movieshd4k-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_source', sourceUrl: cleanUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Không thể lấy nội dung từ link này');
      }
      if (data.title && !aiTopic.trim()) {
        setAiTopic(data.title);
      }
      if (data.articleText) {
        setAiTopic((prev) =>
          prev.trim()
            ? `${prev.trim()}\n\n--- Tư liệu trích xuất từ link ---\n${data.articleText.slice(0, 6000)}`
            : `${data.title ? `${data.title}\n\n` : ''}${data.articleText.slice(0, 6000)}`
        );
      }
      if (Array.isArray(data.images) && data.images.length > 0) {
        setStoryImages(data.images);
        if (!featuredImageUrl) {
          setFeaturedImageUrl(data.images[0].url);
          setFeaturedImageAlt(data.images[0].alt || data.title || '');
        }
      }
      setNotice({
        type: 'success',
        message: `Đã trích xuất nội dung và ${data.images?.length || 0} ảnh từ link nguồn.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Lỗi khi lấy dữ liệu từ link' });
    } finally {
      setExtractingSource(false);
    }
  };

  const handleSearchRelatedImages = async () => {
    const q = (aiKeyword || title || aiTopic).trim();
    if (!q) {
      setNotice({ type: 'error', message: 'Nhập tiêu đề hoặc từ khóa truyện trước khi tìm ảnh.' });
      return;
    }
    setSearchingImages(true);
    setNotice(null);
    try {
      const res = await fetch('/api/movieshd4k-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_external_images',
          query: q,
          title: title || q,
          articleText: content || aiTopic,
          existingImages: storyImages,
          limit: 6,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Không tìm thấy ảnh liên quan');
      }
      const found: StoryImageCandidate[] = Array.isArray(data.images) ? data.images : [];
      if (found.length > 0) {
        setStoryImages((prev) => {
          const seen = new Set(prev.map((p) => p.url));
          const merged = [...prev];
          found.forEach((im) => {
            if (im.url && !seen.has(im.url)) {
              seen.add(im.url);
              merged.push(im);
            }
          });
          return merged;
        });
        if (!featuredImageUrl) {
          setFeaturedImageUrl(found[0].url);
          setFeaturedImageAlt(found[0].alt || title || '');
        }
      }
      setNotice({
        type: 'success',
        message: `Đã tìm thấy thêm ${found.length} ảnh minh họa phù hợp với câu chuyện.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Lỗi khi tìm ảnh minh họa' });
    } finally {
      setSearchingImages(false);
    }
  };

  const handleGenerateStoryWithAi = async () => {
    if (aiMode === 'from_url' && !aiSourceUrl.trim() && !aiTopic.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng dán Link bài viết/phim hoặc nhập cốt truyện.' });
      return;
    }
    if (aiMode === 'from_idea' && !aiTopic.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập ý tưởng, tên phim hoặc tóm tắt câu chuyện.' });
      return;
    }
    if (aiMode === 'rewrite_draft' && !content.trim() && !aiTopic.trim()) {
      setNotice({ type: 'error', message: 'Chưa có nội dung bản nháp để chuyển sang văn phong truyện.' });
      return;
    }

    setAiLoading(true);
    setNotice(null);
    try {
      const catNames = categories
        .filter((c) => selectedCategories.includes(c.id))
        .map((c) => c.name)
        .join(', ');

      const res = await fetch('/api/movieshd4k-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_story',
          mode: aiMode,
          topic: aiTopic,
          sourceUrl: aiMode === 'from_url' ? aiSourceUrl.trim() : undefined,
          storyStyle,
          storyPov,
          chapterCount,
          language: aiLanguage,
          categoryName: catNames || 'Story',
          keyword: aiKeyword.trim() || undefined,
          existingTitle: title.trim() || undefined,
          existingContent: aiMode === 'rewrite_draft' ? content : undefined,
          existingImages: storyImages,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Không thể tạo truyện từ AI');
      }

      if (data.title) setTitle(data.title);
      if (data.slug) {
        setAutoSlug(false);
        setSlug(data.slug);
      }
      if (data.content) setContent(data.content);
      if (data.excerpt) setExcerpt(data.excerpt);
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        setTagsInput(data.tags.join(', '));
      }
      if (Array.isArray(data.images) && data.images.length > 0) {
        setStoryImages(data.images);
        if (!featuredImageUrl) {
          setFeaturedImageUrl(data.images[0].url);
          setFeaturedImageAlt(data.title || data.images[0].alt || '');
        }
      }

      setNotice({
        type: data.warning ? 'info' : 'success',
        message: data.warning
          ? data.warning
          : `Đã sáng tác xong truyện ${data.chapterCount} chương (${data.wordCount} từ · ~${data.readingMinutes} phút đọc) bằng Gemini Free Tier (${data.model}).`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Lỗi khi viết truyện AI' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleUploadLocalImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '');
      if (!base64) return;
      setFeaturedImageBase64(base64);
      setFeaturedImageUrl(base64);
      setFeaturedImageAlt(title || file.name);
      setUploadingMedia(true);
      try {
        const res = await fetch('/api/movieshd4k-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_media',
            base64Data: base64,
            fileName: file.name,
            altText: title || file.name,
            customWpUrl: targetConfig.targetMode === 'custom_wp' ? targetConfig.customWpUrl : undefined,
            customWpUser: targetConfig.targetMode === 'custom_wp' ? targetConfig.customWpUser : undefined,
            customWpAppPassword:
              targetConfig.targetMode === 'custom_wp' ? targetConfig.customWpAppPassword : undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data.mediaId) {
          setFeaturedMediaId(Number(data.mediaId));
          if (data.mediaUrl) setFeaturedImageUrl(data.mediaUrl);
          setNotice({ type: 'success', message: `Đã tải ảnh bìa lên movieshd4k.com (#${data.mediaId}).` });
        }
      } catch {
        // Fallback: upload on publish
      } finally {
        setUploadingMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddManualImageUrl = () => {
    const u = manualImageUrlInput.trim();
    if (!u || !u.startsWith('http')) {
      setNotice({ type: 'error', message: 'Vui lòng nhập URL ảnh hợp lệ.' });
      return;
    }
    const candidate: StoryImageCandidate = { url: u, alt: title || 'Story cover', isFeatured: !featuredImageUrl };
    setStoryImages((prev) => (prev.some((p) => p.url === u) ? prev : [candidate, ...prev]));
    if (!featuredImageUrl) {
      setFeaturedImageUrl(u);
      setFeaturedImageAlt(title || '');
      setFeaturedMediaId(0);
    }
    setManualImageUrlInput('');
  };

  const handleSaveDraft = () => {
    if (!title.trim() && !content.trim()) {
      setNotice({ type: 'error', message: 'Cần có tiêu đề hoặc nội dung để lưu bản nháp.' });
      return;
    }
    const draft: LocalStoryDraft = {
      id: `story-draft-${Date.now()}`,
      title: title.trim() || 'Truyện chưa đặt tên',
      slug: slug || slugifyStoryText(title),
      content,
      excerpt,
      tags: tagsInput,
      categories: selectedCategories,
      featuredImageUrl,
      employeeCode: selectedEmployeeCode,
      storyStyle,
      language: aiLanguage,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };
    const next = [draft, ...localDrafts].slice(0, 30);
    saveDraftsToStorage(next);
    setNotice({ type: 'success', message: 'Đã lưu bản nháp truyện vào bộ nhớ trình duyệt.' });
  };

  const handleLoadDraft = (draft: LocalStoryDraft) => {
    setEditingPostId(undefined);
    setTitle(draft.title);
    setSlug(draft.slug);
    setAutoSlug(false);
    setContent(draft.content);
    setExcerpt(draft.excerpt);
    setTagsInput(draft.tags);
    setSelectedCategories(draft.categories.length > 0 ? draft.categories : [12]);
    setFeaturedImageUrl(draft.featuredImageUrl);
    setFeaturedMediaId(0);
    setSelectedEmployeeCode(draft.employeeCode || defaultEmployeeCode);
    setStoryStyle(draft.storyStyle || 'emotional_drama');
    setAiLanguage(draft.language || 'en');
    setActiveSubTab('editor');
    setNotice({ type: 'info', message: `Đã nạp lại bản nháp "${draft.title}".` });
  };

  const handleLoadRemotePostForEdit = (post: MoviesWpPostItem) => {
    setEditingPostId(post.id);
    setPostType(post.postType === 'posts' ? 'posts' : 'np_story');
    setTitle(post.title);
    setSlug(post.slug);
    setAutoSlug(false);
    setContent(post.content);
    setExcerpt(post.excerpt);
    if (post.postType === 'posts') {
      setSelectedCategories(post.categories.length > 0 ? post.categories : [12]);
    } else {
      setSelectedGenres(post.categories);
    }
    setFeaturedMediaId(post.featuredMediaId || 0);
    setFeaturedImageUrl(post.featuredImageUrl || '');
    setFeaturedImageBase64('');
    setSelectedEmployeeCode(post.employeeCode || defaultEmployeeCode);
    setPublishStatus(post.status === 'draft' ? 'draft' : 'publish');
    setActiveSubTab('editor');
    setNotice({ type: 'info', message: `Đang chỉnh sửa bài #${post.id}: "${post.title}".` });
  };

  const handleResetEditor = () => {
    setEditingPostId(undefined);
    setTitle('');
    setSlug('');
    setAutoSlug(true);
    setContent('');
    setExcerpt('');
    setFeaturedMediaId(0);
    setFeaturedImageUrl('');
    setFeaturedImageBase64('');
    setStoryImages([]);
    setPublishedResult(null);
    setNotice(null);
  };

  const handlePublishStory = async () => {
    if (!title.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập tiêu đề truyện.' });
      return;
    }
    if (!content.trim()) {
      setNotice({ type: 'error', message: 'Nội dung truyện đang trống.' });
      return;
    }

    setPublishing(true);
    setNotice(null);
    setPublishedResult(null);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/movieshd4k-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          postId: editingPostId,
          postType,
          title: title.trim(),
          content,
          excerpt: excerpt.trim(),
          slug: slug.trim() || slugifyStoryText(title),
          status: publishStatus,
          categories: selectedCategories.length > 0 ? selectedCategories : [12],
          genres: selectedGenres,
          tags,
          employeeCode: selectedEmployeeCode,
          featuredMediaId: featuredMediaId || undefined,
          featuredImageBase64: featuredImageBase64 || undefined,
          featuredImageUrl:
            featuredImageUrl && !featuredImageUrl.startsWith('data:') ? featuredImageUrl : undefined,
          featuredImageAlt: featuredImageAlt || title,
          targetMode: targetConfig.targetMode,
          customWpUrl: targetConfig.customWpUrl,
          customWpUser: targetConfig.customWpUser,
          customWpAppPassword: targetConfig.customWpAppPassword,
          webhookUrl: targetConfig.webhookUrl,
          webhookSecret: targetConfig.webhookSecret,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Không thể đẩy truyện lên movieshd4k.com');
      }

      setPublishedResult({
        postId: data.postId,
        link: data.link,
        trackingLink: data.trackingLink || data.link,
        status: data.status,
      });
      if (data.postId) setEditingPostId(Number(data.postId));
      setNotice({ type: 'success', message: data.message || 'Đã đẩy truyện lên movieshd4k.com!' });
      void loadRemoteData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Lỗi khi đăng truyện' });
    } finally {
      setPublishing(false);
    }
  };

  const handleSendToImageStudio = (urlToSend: string) => {
    if (urlToSend) {
      try {
        localStorage.setItem('celeb24h_pending_collage_url', urlToSend);
      } catch {}
    }
    if (onNavigateToTab) {
      onNavigateToTab('image_studio');
    }
  };

  const filteredRemotePosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return remotePosts;
    return remotePosts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.categoryNames.some((c) => c.toLowerCase().includes(q))
    );
  }, [remotePosts, postSearch]);

  return (
    <div className="space-y-4">
      {/* HEADER BAR CHUYÊN BIỆT CHO MOVIESHD4K.COM */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm px-4 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Story Studio · movieshd4k.com
                </h2>
                <span className="text-xs font-mono text-indigo-300">{siteUrl}</span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                    authConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      authConnected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {authConnected ? 'Đã kết nối WP Admin' : 'Chưa xác thực phiên'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Tab tách riêng để sáng tác & viết lại bài theo <strong>dạng truyện kể nhiều chương</strong>, đẩy thẳng lên WordPress{' '}
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-300 underline hover:text-indigo-200"
                >
                  movieshd4k.com
                </a>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={loginUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở WP Admin (/nghean3737)</span>
            </a>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('web_publish')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/90 hover:bg-emerald-600 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Sang B11: celeb24h.com</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadRemoteData()}
              disabled={loadingRemote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRemote ? 'animate-spin' : ''}`} />
              <span>Đồng bộ Web</span>
            </button>
          </div>
        </div>

        {/* SUB-TAB NAVIGATION */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab('editor')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeSubTab === 'editor'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Soạn Truyện (AI Story)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('posts')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeSubTab === 'posts'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bài Trên movieshd4k.com ({remotePosts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('drafts')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeSubTab === 'drafts'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Bản Nháp ({localDrafts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('settings')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeSubTab === 'settings'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt Kết Nối</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Chế độ AI: <span className="text-emerald-300 font-semibold">Gemini Free Tier</span> · Mã NV:{' '}
            <span className="text-indigo-300 font-mono font-bold">{selectedEmployeeCode}</span>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      {(remoteError || authWarning) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Lưu ý kết nối movieshd4k.com:</strong> {remoteError || authWarning}
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs border flex items-start justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-start gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {publishedResult && (
        <div className="bg-emerald-950 text-white rounded-xl p-4 border border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Đã xuất bản thành công lên movieshd4k.com (ID #{publishedResult.postId || 'new'})
              </span>
            </div>
            <div className="text-xs font-mono text-emerald-100 break-all">
              Link Tracking NV: {publishedResult.trackingLink}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {publishedResult.trackingLink && (
              <button
                type="button"
                onClick={() => void handleCopyText(publishedResult.trackingLink!, 'pub_track')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {copiedKey === 'pub_track' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'pub_track' ? 'Đã chép' : 'Copy Link NV'}</span>
              </button>
            )}
            {publishedResult.link && (
              <>
                <a
                  href={publishedResult.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Xem Truyện Trên Web</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleSendToImageStudio(publishedResult.link!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Sang B9 Làm Ảnh</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: TRÌNH SOẠN TRUYỆN */}
      {activeSubTab === 'editor' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* CỘT TRÁI (8/12): AI STORY GENERATOR + SOẠN THẢO + PREVIEW */}
          <div className="xl:col-span-8 space-y-4">
            {/* KHỐI 1: TRỢ LÝ SÁNG TÁC DẠNG TRUYỆN (FREE GEMINI) */}
            <div className="bg-white rounded-xl border border-indigo-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-sm font-bold text-indigo-950">
                    1. Trợ Lý Viết Dạng Truyện (AI Free Mode)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'from_idea', label: 'Từ Ý Tưởng / Cốt Truyện' },
                      { id: 'from_url', label: 'Từ Link Bài / Phim' },
                      { id: 'rewrite_draft', label: 'Chuyển Bản Nháp Thành Truyện' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAiMode(m.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        aiMode === m.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {aiMode === 'from_url' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={aiSourceUrl}
                        onChange={(e) => setAiSourceUrl(e.target.value)}
                        placeholder="Dán link bài viết, tóm tắt phim hoặc câu chuyện nguồn (https://...)"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleExtractSourceUrl()}
                      disabled={extractingSource}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${extractingSource ? 'animate-spin' : ''}`} />
                      <span>{extractingSource ? 'Đang lấy...' : 'Lấy Nội Dung & Ảnh'}</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {aiMode === 'rewrite_draft'
                      ? 'Ghi chú định hướng viết lại câu chuyện (tuỳ chọn):'
                      : 'Nhập tên phim, cốt truyện, nhân vật hoặc nội dung nguồn:'}
                  </label>
                  <textarea
                    rows={3}
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="Ví dụ: Một người cha câm lặng làm bảo vệ suốt 20 năm để nuôi con gái thành bác sĩ, ngày tốt nghiệp cô phát hiện sự thật về chiếc áo bảo vệ..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* CẤU HÌNH VĂN PHONG TRUYỆN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Thể loại truyện
                    </label>
                    <select
                      value={storyStyle}
                      onChange={(e) => setStoryStyle(e.target.value as StoryStyleKey)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      {STORY_STYLE_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ngôi kể
                    </label>
                    <select
                      value={storyPov}
                      onChange={(e) => setStoryPov(e.target.value as StoryPovKey)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value="third_person">Ngôi thứ 3 (Kể chuyện)</option>
                      <option value="first_person">Ngôi thứ 1 (Tôi / Tự thuật)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Độ dài (Số chương)
                    </label>
                    <select
                      value={chapterCount}
                      onChange={(e) => setChapterCount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value={4}>4 Chương (Ngắn gọn)</option>
                      <option value={5}>5 Chương (Chuẩn đọc web)</option>
                      <option value={6}>6 Chương (Truyện dài)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ngôn ngữ xuất bản
                    </label>
                    <select
                      value={aiLanguage}
                      onChange={(e) => setAiLanguage(e.target.value as 'en' | 'vi')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value="en">English (Quốc tế)</option>
                      <option value="vi">Tiếng Việt</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <input
                    type="text"
                    value={aiKeyword}
                    onChange={(e) => setAiKeyword(e.target.value)}
                    placeholder="Từ khóa chính / tên nhân vật (tìm ảnh chuẩn hơn)..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSearchRelatedImages()}
                      disabled={searchingImages}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{searchingImages ? 'Đang tìm...' : 'Tìm Ảnh Minh Họa'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateStoryWithAi()}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap cursor-pointer shadow-xs"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                      <span>{aiLoading ? 'Đang sáng tác truyện...' : 'Viết Dạng Truyện (AI)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* KHỐI 2: TRÌNH SOẠN THẢO & XEM TRƯỚC TRUYỆN */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    2. Trình Biên Tập Truyện {editingPostId ? `(#${editingPostId})` : ''}
                  </h3>
                  <div className="text-xs text-slate-600 font-medium tabular-nums">
                    {wordStats.words} từ · {wordStats.chapters} chương · {wordStats.images} ảnh · ~
                    {wordStats.minutes} phút đọc
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditorViewMode('preview')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      editorViewMode === 'preview'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem Truyện</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorViewMode('split')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      editorViewMode === 'split'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Song Song</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorViewMode('html')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      editorViewMode === 'html'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>HTML</span>
                  </button>
                  {editingPostId && (
                    <button
                      type="button"
                      onClick={handleResetEditor}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                    >
                      + Truyện Mới
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Tiêu đề & Slug */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Tiêu đề truyện cuốn hút (Ví dụ: He Worked as a Janitor for 20 Years Until His Daughter Discovered the Truth...)"
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Slug:</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setSlug(e.target.value);
                      }}
                      placeholder="duong-dan-truyen"
                      className="flex-1 min-w-[200px] px-2.5 py-1 rounded border border-slate-300 font-mono text-xs text-slate-800"
                    />
                    <label className="inline-flex items-center gap-1 text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Tự tạo theo tiêu đề</span>
                    </label>
                  </div>
                </div>

                {/* Thanh công cụ định dạng truyện */}
                <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('<h2>Chương: ', '</h2>\n')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                    <span>Chương (H2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('<h3>Cảnh: ', '</h3>\n')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <Heading3 className="w-3.5 h-3.5" />
                    <span>Cảnh (H3)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('<strong>', '</strong>')}
                    className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="In đậm"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('<em>', '</em>')}
                    className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="In nghiêng"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('<blockquote><p>', '</p></blockquote>\n')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <Quote className="w-3.5 h-3.5" />
                    <span>Lời Thoại / Trích Dẫn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertHtmlSnippet('\n<p style="text-align:center;opacity:0.6;">* * *</p>\n')}
                    className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Ngắt Cảnh (* * *)
                  </button>
                </div>

                {/* Khung Nội dung: HTML / Split / Preview */}
                <div
                  className={
                    editorViewMode === 'split'
                      ? 'grid grid-cols-1 lg:grid-cols-2 gap-3'
                      : 'block'
                  }
                >
                  {(editorViewMode === 'html' || editorViewMode === 'split') && (
                    <textarea
                      ref={textareaRef}
                      rows={20}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nội dung truyện HTML sẽ hiển thị ở đây sau khi AI sáng tác hoặc bạn tự nhập..."
                      className="w-full px-3 py-2.5 text-xs font-mono leading-relaxed rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  )}

                  {(editorViewMode === 'preview' || editorViewMode === 'split') && (
                    <div className="rounded-lg border border-slate-200 bg-[#fcfbf9] p-5 min-h-[420px] max-h-[680px] overflow-y-auto">
                      {!content.trim() ? (
                        <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-slate-400">
                          <BookOpen className="w-10 h-10 mb-2 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-500">
                            Chưa có nội dung truyện để xem trước
                          </p>
                          <p className="text-xs text-slate-400 mt-1 max-w-md">
                            Nhập ý tưởng hoặc dán link bài viết ở khung phía trên rồi nhấn{' '}
                            <strong>Viết Dạng Truyện (AI)</strong>.
                          </p>
                        </div>
                      ) : (
                        <article className="prose prose-sm sm:prose max-w-none text-slate-800 leading-relaxed">
                          {title && (
                            <h1 className="text-xl font-extrabold text-slate-950 mb-4 leading-snug">
                              {title}
                            </h1>
                          )}
                          {featuredImageUrl && (
                            <div className="mb-5">
                              <img
                                src={featuredImageUrl}
                                alt={featuredImageAlt || title}
                                className="w-full max-h-80 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                          <div
                            className="space-y-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-indigo-950 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_p]:text-[14.5px] [&_p]:leading-7 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_figure]:my-4 [&_img]:rounded-lg [&_img]:max-h-96 [&_img]:mx-auto [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-slate-500 [&_figcaption]:mt-1"
                            dangerouslySetInnerHTML={{ __html: content }}
                          />
                        </article>
                      )}
                    </div>
                  )}
                </div>

                {/* Tóm tắt (Excerpt) & Thư viện ảnh nguồn */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lời dẫn / Mô tả ngắn (Excerpt)
                    </label>
                    <textarea
                      rows={2}
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      placeholder="Đoạn mở đầu kích thích tò mò người đọc..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thẻ Tag truyện (cách nhau dấu phẩy)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Story, Movie Story, Emotional, MoviesHD4K"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Bộ sưu tập ảnh tìm được */}
                {storyImages.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Ảnh minh họa cho truyện ({storyImages.length})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Chọn Đặt Ảnh Bìa hoặc Chèn Vào Truyện
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {storyImages.map((img, idx) => {
                        const isCover = featuredImageUrl === img.url;
                        return (
                          <div
                            key={`${img.url}-${idx}`}
                            className={`rounded-lg border overflow-hidden bg-slate-50 ${
                              isCover ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={img.alt || 'Story'}
                              className="w-full h-24 object-cover"
                            />
                            <div className="p-1.5 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setFeaturedImageUrl(img.url);
                                  setFeaturedImageBase64('');
                                  setFeaturedMediaId(0);
                                  setFeaturedImageAlt(img.alt || title);
                                }}
                                className={`flex-1 py-1 rounded text-[10px] font-bold cursor-pointer ${
                                  isCover
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {isCover ? '✓ Ảnh Bìa' : 'Đặt Bìa'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInsertImageToStory(img.url, img.alt)}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                + Chèn
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (4/12): CÀI ĐẶT XUẤT BẢN LÊN MOVIESHD4K.COM */}
          <div className="xl:col-span-4 space-y-4">
            {/* 1. Xuất bản & Lưu nháp */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Xuất Bản · movieshd4k.com</h3>
                <span className="text-[11px] font-semibold text-indigo-700">WordPress REST</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Mục đăng trên movieshd4k.com
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostType('np_story')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      postType === 'np_story'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Truyện (/truyen/)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('posts')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      postType === 'posts'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Bài Viết (Story/Film)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Trạng thái đăng bài
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishStatus('publish')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                      publishStatus === 'publish'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Công Khai Ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishStatus('draft')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                      publishStatus === 'draft'
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Lưu Nháp WP
                  </button>
                </div>
              </div>

              {/* Mã Nhân Viên Tracking */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mã Nhân Viên gắn Link Tracking</span>
                </label>
                <select
                  value={selectedEmployeeCode}
                  onChange={(e) => setSelectedEmployeeCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800"
                >
                  {DEFAULT_WP_EMPLOYEE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label} ({opt.staffHint})
                    </option>
                  ))}
                </select>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Link Tracking dự kiến:</span>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(previewTrackingUrl, 'preview_track')}
                      className="text-indigo-700 font-semibold hover:underline cursor-pointer"
                    >
                      {copiedKey === 'preview_track' ? 'Đã chép' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-slate-800 break-all">
                    {previewTrackingUrl}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Lưu Nháp Tạm
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublishStory()}
                  disabled={publishing}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {publishing
                      ? 'Đang đẩy...'
                      : editingPostId
                      ? 'Cập Nhật Truyện'
                      : 'Đăng Lên Web'}
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Chuyên mục / Thể loại trên movieshd4k.com */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  <span>
                    {postType === 'np_story' && genres.length > 0
                      ? 'Thể Loại Truyện (np_genre)'
                      : 'Chuyên Mục movieshd4k.com'}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  {postType === 'np_story' ? 'Mục /truyen/' : 'Mục Bài Viết'}
                </span>
              </div>
              {postType === 'np_story' && genres.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {genres.map((g) => {
                    const checked = selectedGenres.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedGenres((prev) =>
                                prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              );
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span>{g.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">{g.count}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {categories.map((cat) => {
                    const checked = selectedCategories.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedCategories((prev) =>
                                prev.includes(cat.id)
                                  ? prev.length > 1
                                    ? prev.filter((id) => id !== cat.id)
                                    : prev
                                  : [...prev, cat.id]
                              );
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span>{cat.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">{cat.count}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Ảnh đại diện (Featured Cover) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>Ảnh Bìa Truyện (Featured)</span>
                </h3>
                {featuredMediaId > 0 && (
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    Media #{featuredMediaId}
                  </span>
                )}
              </div>

              {featuredImageUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={featuredImageUrl}
                    alt={featuredImageAlt || title}
                    className="w-full h-44 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedImageUrl('');
                      setFeaturedImageBase64('');
                      setFeaturedMediaId(0);
                    }}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900/75 text-white text-[10px] font-semibold hover:bg-slate-900 cursor-pointer"
                  >
                    Bỏ ảnh
                  </button>
                </div>
              ) : (
                <div className="h-32 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <ImageIcon className="w-6 h-6 mb-1" />
                  <span>Chưa chọn ảnh bìa truyện</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadLocalImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingMedia ? 'Đang tải ảnh lên WP...' : 'Tải Ảnh Từ Máy Tính'}</span>
              </button>

              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={manualImageUrlInput}
                  onChange={(e) => setManualImageUrlInput(e.target.value)}
                  placeholder="Hoặc dán URL ảnh (https://...)"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                />
                <button
                  type="button"
                  onClick={handleAddManualImageUrl}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BÀI ĐÃ ĐĂNG TRÊN MOVIESHD4K.COM */}
      {activeSubTab === 'posts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Danh sách bài viết trên {siteUrl} ({filteredRemotePosts.length})
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                placeholder="Tìm tiêu đề, slug, chuyên mục..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
          </div>

          {filteredRemotePosts.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              {loadingRemote
                ? 'Đang tải bài viết từ movieshd4k.com...'
                : 'Chưa tải được bài viết hoặc chưa có bài phù hợp bộ lọc.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">ID</th>
                    <th className="py-2.5 px-3 font-bold">Tiêu đề truyện</th>
                    <th className="py-2.5 px-3 font-bold">Chuyên mục</th>
                    <th className="py-2.5 px-3 font-bold">Trạng thái</th>
                    <th className="py-2.5 px-3 font-bold">Ngày đăng</th>
                    <th className="py-2.5 px-3 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRemotePosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono text-slate-500">#{post.id}</td>
                      <td className="py-2.5 px-3 max-w-md">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {post.title || '(Không tiêu đề)'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {post.link}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {post.categoryNames.join(', ') || 'Story'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            post.status === 'publish'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {post.status === 'publish' ? 'Công khai' : post.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 tabular-nums">
                        {post.date ? new Date(post.date).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadRemotePostForEdit(post)}
                            className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer"
                          >
                            Sửa
                          </button>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                          >
                            Mở Web
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BẢN NHÁP LƯU TẠM */}
      {activeSubTab === 'drafts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Bản Nháp Truyện Đã Lưu ({localDrafts.length})
            </h3>
          </div>
          {localDrafts.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              Chưa có bản nháp nào. Hãy bấm <strong>Lưu Nháp Tạm</strong> trong trình soạn truyện.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {localDrafts.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-lg border border-slate-200 flex items-start justify-between gap-3 hover:border-indigo-300"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">{d.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Cập nhật: {d.updatedAt} · Mã NV: {d.employeeCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadDraft(d)}
                      className="px-2.5 py-1 rounded bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mở Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDraftsToStorage(localDrafts.filter((x) => x.id !== d.id))}
                      className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Xóa bản nháp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CÀI ĐẶT KẾT NỐI MOVIESHD4K.COM */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 max-w-2xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cấu Hình Kết Nối WordPress · https://movieshd4k.com/
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Mặc định hệ thống tự động đăng nhập qua cổng bảo mật{' '}
              <span className="font-mono text-slate-700">{loginUrl}</span>. Nếu bạn muốn dùng
              Application Password riêng hoặc đẩy qua Webhook, chọn chế độ bên dưới.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Chế độ kết nối</label>
            <select
              value={targetConfig.targetMode}
              onChange={(e) =>
                saveTargetConfig({
                  ...targetConfig,
                  targetMode: e.target.value as MoviesTargetConfig['targetMode'],
                })
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
            >
              <option value="default_wp">
                Mặc định (Tự động kết nối https://movieshd4k.com/nghean3737)
              </option>
              <option value="custom_wp">WordPress REST + Application Password riêng</option>
              <option value="webhook">Webhook JSON API tùy chỉnh</option>
            </select>
          </div>

          {targetConfig.targetMode === 'custom_wp' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <input
                type="url"
                value={targetConfig.customWpUrl}
                onChange={(e) => saveTargetConfig({ ...targetConfig, customWpUrl: e.target.value })}
                placeholder="https://movieshd4k.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
              <input
                type="text"
                value={targetConfig.customWpUser}
                onChange={(e) => saveTargetConfig({ ...targetConfig, customWpUser: e.target.value })}
                placeholder="WordPress Username"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
              <input
                type="password"
                value={targetConfig.customWpAppPassword}
                onChange={(e) =>
                  saveTargetConfig({ ...targetConfig, customWpAppPassword: e.target.value })
                }
                placeholder="WordPress Application Password (xxxx xxxx xxxx xxxx)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
          )}

          {targetConfig.targetMode === 'webhook' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <input
                type="url"
                value={targetConfig.webhookUrl}
                onChange={(e) => saveTargetConfig({ ...targetConfig, webhookUrl: e.target.value })}
                placeholder="Webhook Endpoint URL (https://...)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
              <input
                type="password"
                value={targetConfig.webhookSecret}
                onChange={(e) => saveTargetConfig({ ...targetConfig, webhookSecret: e.target.value })}
                placeholder="X-Webhook-Secret (nếu có)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
