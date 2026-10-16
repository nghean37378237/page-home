// Vercel Serverless Function for /api/wp-publish (100% Self-Contained Pure JS)
const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const SCRAPER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const WP_EMPLOYEE_AUTHOR_MAP = [
  { code: 'M2001', wpUserId: 2, wpUsername: 'Ly', displayName: 'Ms Ly (M2001)', staffUsername: 'MS.LY' },
  { code: 'H2000', wpUserId: 3, wpUsername: 'Huyen', displayName: 'Ms Huyen (H2000)', staffUsername: 'MS.HUYEN' },
  { code: 'H0088', wpUserId: 4, wpUsername: 'Hiep', displayName: 'Hiep MS (H0088)', staffUsername: 'MSHIEP' },
  { code: 'A0005', wpUserId: 5, wpUsername: 'Nhi', displayName: 'Ms Nhi (A0005)', staffUsername: 'MS.NHI' },
  { code: 'A0006', wpUserId: 6, wpUsername: 'adgoole', displayName: 'Mr Google (A0006)', staffUsername: 'Quản Lý (Admin)' },
  { code: 'H0082', wpUserId: 1, wpUsername: 'admin', displayName: 'Admin (H0082)', staffUsername: 'Admin' },
];

let cachedPublishSession = null;

function fetchWithTimeout(url, options = {}, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#038;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html) {
  if (!html) return '';
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function resolveWpUserIdByEmployeeCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.code === clean);
  return found ? found.wpUserId : 6;
}

function resolveEmployeeByWpUserId(wpUserId) {
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.wpUserId === Number(wpUserId));
  return (
    found || {
      code: 'A0006',
      wpUserId: Number(wpUserId) || 6,
      wpUsername: 'adgoole',
      displayName: 'Mr Google (A0006)',
      staffUsername: 'Quản Lý (Admin)',
    }
  );
}

function resolveAbsUrl(rawUrl, baseUrl) {
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

function isIgnorableImage(url) {
  const lower = String(url || '').toLowerCase();
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
    lower.includes('placeholder')
  ) {
    return true;
  }
  const tinyMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyMatch) {
    const w = Number(tinyMatch[1]);
    const h = Number(tinyMatch[2]);
    if (w < 150 && h < 150) return true;
  }
  return false;
}

function pickBestSrcFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const cleanedSrcset = String(srcset).replace(/data:image\/[^,\s]+,[^\s,]+/gi, '');
  const candidates = [];
  for (const part of cleanedSrcset.split(',')) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0] || tokens[0].startsWith('data:')) continue;
    const u = resolveAbsUrl(tokens[0], baseUrl);
    if (!u || isIgnorableImage(u)) continue;
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

function collectImgsFromHtml(htmlChunk, baseUrl) {
  const list = [];
  const sourceRegex = /<source\b[^>]*>/gi;
  let sm;
  while ((sm = sourceRegex.exec(htmlChunk)) !== null) {
    const tag = sm[0];
    const ss =
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (ss && ss[1]) {
      const best = pickBestSrcFromSrcset(ss[1], baseUrl);
      if (best && !isIgnorableImage(best)) {
        list.push({ url: best, alt: '' });
      }
    }
  }

  const imgRegex = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(htmlChunk)) !== null) {
    const tag = m[0];
    const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const hMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (wMatch && hMatch) {
      const w = Number(wMatch[1]);
      const h = Number(hMatch[1]);
      if (w > 10 && h > 10 && w < 110 && h < 110) continue;
    }

    const ssMatches = [
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i),
      tag.match(/\bdata-srcset=["']([^"']+)["']/i),
      tag.match(/\bsrcset=["']([^"']+)["']/i),
    ];
    let chosen = '';
    for (const ss of ssMatches) {
      if (ss && ss[1]) {
        const cand = pickBestSrcFromSrcset(ss[1], baseUrl);
        if (cand && !isIgnorableImage(cand)) {
          chosen = cand;
          break;
        }
      }
    }

    if (!chosen) {
      const srcCandidates = [
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i),
        tag.match(/\bdata-src=["']([^"']+)["']/i),
        tag.match(/\bdata-original=["']([^"']+)["']/i),
        tag.match(/\bdata-full-url=["']([^"']+)["']/i),
        tag.match(/\bdata-large_image=["']([^"']+)["']/i),
        tag.match(/\bdata-hi-res-src=["']([^"']+)["']/i),
        tag.match(/\bdata-orig-file=["']([^"']+)["']/i),
        tag.match(/\bdata-ezsrc=["']([^"']+)["']/i),
        tag.match(/\bdata-url=["']([^"']+)["']/i),
        tag.match(/\bsrc=["']([^"']+)["']/i),
      ];
      for (const sc of srcCandidates) {
        if (sc && sc[1] && !sc[1].trim().startsWith('data:')) {
          const resolved = resolveAbsUrl(sc[1], baseUrl);
          if (resolved && !isIgnorableImage(resolved)) {
            chosen = resolved;
            break;
          }
        }
      }
    }
    if (!chosen || isIgnorableImage(chosen)) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
    list.push({ url: chosen, alt });
  }

  const figLinkRegex =
    /<(?:figure|div)\b[^>]*class=["'][^"']*(?:wp-block-image|wp-caption|gallery-item|post-thumbnail|featured-image)[^"']*["'][^>]*>[\s\S]*?<a\b[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi;
  let flm;
  while ((flm = figLinkRegex.exec(htmlChunk)) !== null) {
    const resolved = resolveAbsUrl(flm[1], baseUrl);
    if (resolved && !isIgnorableImage(resolved)) {
      list.push({ url: resolved, alt: '' });
    }
  }

  return list;
}

function isTrackingOrLocalePathSegment(seg) {
  const s = String(seg || '').toLowerCase().trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(vn\d*|en\d*|us\d*|uk\d*|au\d*|ca\d*|amp|feed|print|page|embed|track)$/i.test(s)) {
    return true;
  }
  if (s.length <= 4 && /^[a-z]{1,3}\d{1,2}$/i.test(s)) return true;
  return false;
}

function humanizeUrlSlugToTitle(pathname) {
  const segs = String(pathname || '')
    .split('/')
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
    .filter((s) => s && !isTrackingOrLocalePathSegment(s));
  const best =
    segs.sort((a, b) => b.length - a.length)[0] ||
    String(pathname || '').split('/').filter(Boolean).pop() ||
    '';
  const cleaned = best.replace(/[-_]+/g, ' ').trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return '';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanScrapedTitle(rawTitle) {
  const decoded = decodeHtmlEntities(rawTitle || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const strippedSite = decoded
    .replace(/\s+[|–—-]\s+[^|–—-]{2,35}\.(com|net|org|fun|vn|info|us|co\.uk)$/i, '')
    .trim();
  if (strippedSite && strippedSite === strippedSite.toLowerCase()) {
    return strippedSite.replace(/(^\w|\.\s+\w|\b[a-z]{4,})/g, (m) =>
      m.charAt(0).toUpperCase() + m.slice(1)
    );
  }
  return strippedSite;
}

function analyzeArticleSubjectAndContext(title, text, userKeyword, existingImages) {
  const fullText = decodeHtmlEntities(String(text || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const imgAltText = Array.isArray(existingImages)
    ? existingImages
        .map((im) => `${(im && im.alt) || ''} ${String((im && im.url) || '').split('/').pop() || ''}`)
        .join(' ')
    : '';
  const sample = fullText.slice(0, 6000);

  const stopWords = new Set([
    'There', 'The', 'This', 'That', 'These', 'Those', 'When', 'While', 'Where',
    'What', 'Who', 'Why', 'How', 'Proving', 'Looking', 'Taking', 'Channeling',
    'Addressing', 'Stepping', 'Enjoying', 'Sharing', 'Showing', 'Making', 'Soaking',
    'Confirming', 'Embracing', 'Walking', 'Strolling', 'Wearing', 'Smiling', 'Spotted',
    'Showcasing', 'Exiting', 'Following', 'Considering', 'Because', 'Although', 'Though',
    'Whether', 'Unless', 'Since', 'Once', 'Whereas', 'Whenever', 'Wherever', 'However',
    'Meanwhile', 'Furthermore', 'Moreover', 'Nevertheless', 'Nonetheless', 'Instead',
    'Otherwise', 'Therefore', 'Thus', 'Hence', 'Accordingly', 'Consequently', 'Subsequently',
    'Previously', 'Recently', 'Currently', 'Finally', 'Ultimately', 'Initially', 'Originally',
    'Fortunately', 'Unfortunately', 'Thankfully', 'Luckily', 'Sadly', 'Happily',
    'Reportedly', 'Allegedly', 'Apparently', 'Obviously', 'Clearly', 'Certainly', 'Surely',
    'Indeed', 'Actually', 'Naturally', 'Typically', 'Usually', 'Generally', 'Normally',
    'Frequently', 'Occasionally', 'Sometimes', 'Often', 'Rarely', 'Seldom', 'Never', 'Always',
    'Perhaps', 'Maybe', 'Possibly', 'Probably', 'Likely', 'Unlikely', 'Doubtless', 'Undoubtedly',
    'As', 'If', 'So', 'Yet', 'Nor', 'Or', 'And', 'But', 'For', 'To', 'Of', 'In', 'On', 'At', 'By',
    'With', 'From', 'Into', 'Onto', 'Upon', 'Out', 'Off', 'Over', 'Under', 'Above', 'Below',
    'Up', 'Down', 'Across', 'Along', 'Around', 'Through', 'Throughout', 'During', 'Before',
    'After', 'Until', 'Till', 'Between', 'Among', 'Amidst', 'Within', 'Without',
    'Inside', 'Outside', 'Behind', 'Beyond', 'Beside', 'Besides', 'Near', 'Next', 'Toward',
    'Towards', 'Against', 'Despite', 'Concerning', 'According', 'Speaking',
    'Shielding', 'Completing', 'Expecting', 'Running', 'Visiting', 'Both', 'Holding', 'Wrapping',
    'Turning', 'Adding', 'Bringing', 'Giving', 'Getting', 'Keeping', 'Leaving', 'Letting',
    'Putting', 'Setting', 'Standing', 'Sitting', 'Lying', 'Going', 'Coming', 'Being', 'Having',
    'Doing', 'Saying', 'Telling', 'Asking', 'Thinking', 'Knowing', 'Seeing', 'Hearing', 'Feeling',
    'Finding', 'Calling', 'Trying', 'Working', 'Playing', 'Living', 'Moving', 'Starting',
    'Stopping', 'Beginning', 'Ending', 'Continuing', 'Growing', 'Changing', 'Leading',
    'Understanding', 'Watching', 'Creating', 'Spending', 'Opening', 'Closing',
    'Winning', 'Losing', 'Falling', 'Rising', 'Building', 'Breaking', 'Carrying', 'Catching',
    'Choosing', 'Drawing', 'Driving', 'Eating', 'Fighting', 'Flying', 'Forgetting', 'Forgiving',
    'Freezing', 'Hanging', 'Hiding', 'Hitting', 'Hurting', 'Laying', 'Learning', 'Lending',
    'Meaning', 'Meeting', 'Paying', 'Reading', 'Riding', 'Ringing', 'Seeking', 'Selling', 'Sending',
    'Shaking', 'Shining', 'Shooting', 'Shutting', 'Singing', 'Sinking', 'Sleeping', 'Sliding',
    'Stealing', 'Sticking', 'Stinging', 'Striking', 'Swearing', 'Sweeping', 'Swimming', 'Swinging',
    'Teaching', 'Tearing', 'Throwing', 'Waking', 'Weaving', 'Weeping', 'Winding', 'Withdrawing', 'Writing',
    'His', 'Her', 'Their', 'Our', 'Your', 'My', 'Its', 'Hers', 'Theirs', 'Ours', 'Yours', 'Mine',
    'He', 'She', 'They', 'We', 'You', 'It', 'One', 'Someone', 'Anyone', 'Everyone', 'No', 'None',
    'Nothing', 'Something', 'Anything', 'Everything', 'Some', 'Any', 'All', 'Many', 'Much',
    'More', 'Most', 'Few', 'Fewer', 'Fewest', 'Little', 'Less', 'Least', 'Several', 'Enough',
    'Each', 'Every', 'Either', 'Neither', 'Other', 'Another', 'Such', 'Same', 'Different',
    'Various', 'Certain', 'Numerous', 'Countless', 'Multiple', 'Single', 'Double', 'Triple',
    'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last', 'Previous', 'Former', 'Latter',
    'Hollywood', 'Caribbean', 'Barbados', 'London', 'West', 'North', 'South', 'East',
    'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California', 'Florida',
    'United', 'States', 'America', 'British', 'English', 'American', 'Great', 'Britain',
    'French', 'Riviera', 'Mediterranean', 'German', 'Italian', 'Spanish', 'Mexican',
    'Saint', 'Tropez', 'Cannes', 'Paris', 'Rome', 'Malibu', 'Hawaii', 'Manhattan',
    'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter',
    'Facebook', 'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Sandy', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Recognize', 'Them',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Beverly', 'Hilton', 'Hills', 'Santa', 'Monica',
    'Stunning', 'Pregnant', 'Timeless', 'Beloved', 'Famous', 'Reality', 'Heartthrob', 'Icon',
    'Real', 'Housewives', 'Brat', 'Pack', 'Night', 'Heat', 'Glad', 'Mark', 'Twain',
    'Morning', 'Show', 'France', 'Europe', 'European', 'Exclusive', 'Story', 'Highlights',
    'Season', 'Episode', 'Episodes', 'Series', 'Netflix', 'Prime', 'Video', 'Disney',
    'Max', 'Hulu', 'Paramount', 'Peacock', 'Nevermore', 'School',
    'Part', 'Balance', 'Horror', 'Dark', 'Comedy', 'Viewers', 'Fans', 'Audience', 'Audiences',
    'Showrunners', 'Executive', 'Producers', 'Production', 'Official', 'Trailer', 'Teaser',
    'Premiere', 'Release', 'Date', 'Cast', 'Characters', 'Character', 'Mystery', 'Supernatural',
    'Gothic', 'Visual', 'Style', 'Identity', 'History', 'Hidden', 'Change', 'World', 'Life',
    'Love', 'Family', 'Friends', 'Couple', 'Romance', 'Relationship', 'Marriage', 'Wedding',
    'Divorce', 'Split', 'Breakup', 'Children', 'Kids', 'Son', 'Daughter', 'Mother', 'Father',
    'Parents', 'Sister', 'Brother', 'Siblings', 'Cousin', 'Aunt', 'Uncle', 'Niece', 'Nephew',
    'Grandmother', 'Grandfather', 'Grandparents', 'Grandson', 'Granddaughter', 'Grandchildren',
    'Boyfriend', 'Girlfriend', 'Fiance', 'Fiancee', 'Husband', 'Wife', 'Spouse', 'Ex',
    'Late', 'Young', 'Old', 'Older', 'Younger', 'Eldest', 'Youngest', 'Middle', 'Only',
    'Small', 'Large', 'Good', 'Best', 'Better', 'Bad', 'Worst', 'Worse',
    'High', 'Low', 'Long', 'Short', 'Tall', 'Wide', 'Narrow', 'Deep', 'Shallow', 'Thick', 'Thin',
    'Heavy', 'Light', 'Strong', 'Weak', 'Hard', 'Soft', 'Fast', 'Slow', 'Quick', 'Early',
    'Modern', 'Ancient', 'Classic', 'Traditional', 'Contemporary', 'Future', 'Past', 'Present',
    'Current', 'Recent', 'Upcoming', 'Ongoing', 'Final', 'Initial', 'Original', 'Main', 'Major',
    'Minor', 'Primary', 'Secondary', 'Central', 'Key', 'Important', 'Significant', 'Special',
    'Specific', 'Particular', 'General', 'Common', 'Usual', 'Normal', 'Regular', 'Standard',
    'Rare', 'Unique', 'Unusual', 'Strange', 'Odd', 'Weird', 'Mysterious', 'Secret', 'Private',
    'Public', 'Personal', 'Professional', 'Unofficial', 'Formal', 'Informal',
    'True', 'False', 'Real', 'Fake', 'Actual', 'Possible', 'Impossible',
    'Uncertain', 'Sure', 'Unsure', 'Clear', 'Unclear', 'Obvious', 'Apparent',
    'Visible', 'Invisible', 'Known', 'Unknown', 'Popular', 'Favorite',
    'Successful', 'Rich', 'Wealthy', 'Poor', 'Free', 'Busy', 'Ready', 'Able', 'Unable',
    'Happy', 'Sad', 'Angry', 'Afraid', 'Scared', 'Proud', 'Sorry', 'Fond',
    'Full', 'Empty', 'Open', 'Closed', 'Shut', 'Clean', 'Dirty', 'Bright',
    'Warm', 'Cool', 'Cold', 'Hot', 'Dry', 'Wet', 'Sweet', 'Sour', 'Bitter', 'Salty', 'Fresh',
    'White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'Brown',
    'Gray', 'Grey', 'Silver', 'Gold', 'Blonde', 'Brunette', 'Bald',
    'Legally', 'Lies', 'Walk', 'Line', 'Home', 'Alabama',
    'Cruel', 'Intentions', 'Election', 'Wild', 'Hello', 'Sunshine', 'Book', 'Club', 'Thing',
    'Writers', 'Creators', 'Eiffel', 'Tower', 'Famously', 'Archival',
    'Scroll', 'Stay', 'Read', 'Click', 'Share', 'Watch', 'See', 'Know', 'About'
  ]);

  const isWednesdayShowContext = /\b(Nevermore|Addams|Ortega|Enid|Morticia|Ophelia|Pugsley|Gomez)\b/i.test(
    `${sample} ${title}`
  );
  if (!isWednesdayShowContext) {
    stopWords.add('Wednesday');
  }

  const stats = new Map();

  const companionRegex =
    /\b(?:with|alongside|beside)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|model|actress|actor|financier)?\s*(?:,\s*(?:\d{2}-year-old\s+)?(?:[a-z-]+\s+){0,3})?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set();
  let cm;
  while ((cm = companionRegex.exec(sample.slice(0, 1000))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 3)
      .join(' ');
    if (cName.split(/\s+/).length >= 2) {
      companionSet.add(cName);
    }
  }

  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-zA-Z-]+){0,4})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|surgeon|husband|wife|partner|boyfriend|girlfriend|mother|father|icon|legend|winner|daughter|son|director|showrunners?)(?:\s+[a-zA-Z-]+){0,2})\s*,?\s+(?:Dr\.\s+)?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 42;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  const regex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}){1,2})\b/g;
  let m;
  const textToScan = sample || `${title || ''} ${imgAltText}`;
  while ((m = regex.exec(textToScan)) !== null) {
    const rawName = m[1].trim().replace(/['’]s$/i, '');
    const parts = rawName.split(/\s+/);
    if (parts.some((p) => stopWords.has(p.replace(/['’]s$/i, '')))) continue;
    if (parts.length < 2) continue;
    const candidate = parts.join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: m.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.count += 1;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  for (const [fullName, info] of stats.entries()) {
    const tokens = fullName.split(/\s+/);
    const firstName = tokens[0];
    const lastName = tokens[tokens.length - 1];
    if (lastName && lastName.length >= 4 && !stopWords.has(lastName)) {
      const lastRegex = new RegExp(`\\b${lastName}\\b`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(28, (totalLastMentions - info.count) * 6);
      }
    }
    if (firstName && firstName.length >= 4 && !stopWords.has(firstName)) {
      const firstRegex = new RegExp(`\\b${firstName}\\b`, 'g');
      const totalFirstMentions = (sample.match(firstRegex) || []).length;
      if (totalFirstMentions > info.count) {
        info.bioBoost += Math.min(24, (totalFirstMentions - info.count) * 5);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 280 ? 38 : a[1].firstIdx < 550 ? 22 : 0;
    const leadBonusB = b[1].firstIdx < 280 ? 38 : b[1].firstIdx < 550 ? 22 : 0;
    const compPenaltyA = a[1].isCompanion ? -22 : 0;
    const compPenaltyB = b[1].isCompanion ? -22 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  let primaryPerson = rankedPeople[0] || (userKeyword && String(userKeyword).trim()) || '';
  if (!primaryPerson && isWednesdayShowContext) {
    primaryPerson = /\bJenna\s+Ortega\b/i.test(sample) ? 'Jenna Ortega' : 'Wednesday Addams';
  }
  if (!primaryPerson) {
    primaryPerson =
      cleanScrapedTitle(title)
        .split(/[:–—|-]/)[0]
        .trim()
        .slice(0, 50) || 'the star';
  }

  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      (info.firstIdx < 900 || info.isCompanion || info.count >= 2) &&
      (info.count >= 2 || info.bioBoost > 0 || info.isCompanion) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  const supportingEntities = rankedEntries
    .map(([p]) => p)
    .filter(
      (p) =>
        p !== primaryPerson &&
        p !== secondaryPerson &&
        !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
        (!secondaryPerson || !secondaryPerson.toLowerCase().includes(p.toLowerCase()))
    )
    .slice(0, 8);

  const visualSceneText = `${imgAltText} ${sample.slice(0, 1800)}`.toLowerCase();
  const outfitKeywords = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver|gothic|monochrome)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|tank\s+top|t-shirt|tee|shirt|top|jacket|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble|wardrobe|costume))\b/gi;
  let om;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 4) {
      outfitKeywords.push(phrase);
    }
  }

  const bodyLower = sample.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'notting hill',
    'west hollywood', 'london', 'malibu', 'new york city', 'new york', 'manhattan',
    'miami', 'bahamas', 'cabo', 'caribbean', 'cannes', 'paris', 'eiffel tower',
    'venice', 'beverly hills', 'los angeles', 'nevermore academy', 'ireland', 'dublin'
  ];
  const locationKeywords = [];
  for (const loc of locationGlossary) {
    if (bodyLower.includes(loc) && locationKeywords.length < 4) {
      locationKeywords.push(loc);
    }
  }

  const timeframeKeywords = [];
  const timeRegex =
    /\b((?:in|since|during|by|until|around|early|late|mid-|summer|Spring|winter|fall|autumn)\s+(?:19\d{2}|20\d{2})|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:\d{1,2},?\s+)?(?:19\d{2}|20\d{2})|season\s+\d+|19\d{2}s|20\d{2})\b/gi;
  let tm;
  while ((tm = timeRegex.exec(sample)) !== null) {
    const tf = tm[1].replace(/\s+/g, ' ').trim();
    if (!timeframeKeywords.some((k) => k.toLowerCase() === tf.toLowerCase()) && timeframeKeywords.length < 5) {
      timeframeKeywords.push(tf);
    }
  }

  const eventGlossary = [
    'bikini', 'swimsuit', 'bathing suit', 'yacht', 'beach', 'boat', 'pregnant',
    'pregnancy', 'baby bump', 'stroll', 'lunch', 'brunch', 'kiss', 'kisses',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday', 'season 3',
    'season 2', 'netflix', 'filming', 'premiere', 'cast', 'gothic', 'nevermore'
  ];
  const eventKeywords = [];
  for (const ev of eventGlossary) {
    if (
      bodyLower.includes(ev) &&
      eventKeywords.length < 4 &&
      !outfitKeywords.some((o) => o.includes(ev))
    ) {
      eventKeywords.push(ev);
    }
  }

  let articleCategory = 'celebrity_lifestyle';
  if (
    /\b(season\s+\d|netflix|showrunners?|episodes?|filming|cast|series|character|sequel|spin-?off|nevermore|addams)\b/i.test(
      sample
    )
  ) {
    articleCategory = 'screen_production';
  } else if (
    /\b(red\s+carpet|awards?|gala|premiere|ceremony|gown|golden\s+globes|oscars|emmys|grammys)\b/i.test(
      sample
    )
  ) {
    articleCategory = 'red_carpet_event';
  } else if (/\b(19[6789]\d|archival|throwback|decades\s+ago|late\s+actor|legacy)\b/i.test(sample)) {
    articleCategory = 'retrospective_feature';
  }

  const eventWords = [...outfitKeywords, ...locationKeywords, ...eventKeywords].slice(0, 6);

  const subjectDisplay = secondaryPerson
    ? `${primaryPerson} and ${secondaryPerson}`
    : primaryPerson;

  const combinedSearchQuery = [
    primaryPerson,
    secondaryPerson,
    outfitKeywords[0] || '',
    locationKeywords[0] || '',
    eventKeywords[0] || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    primaryPerson,
    secondaryPerson,
    supportingEntities,
    outfitKeywords,
    locationKeywords,
    timeframeKeywords,
    eventKeywords,
    eventWords,
    articleCategory,
    subjectDisplay,
    combinedSearchQuery: combinedSearchQuery || primaryPerson || title,
  };
}

async function searchExternalRelatedImages(rawQuery, limit = 6, excludeKeys = new Set(), contextProfile) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const effectiveProfile =
    contextProfile || analyzeArticleSubjectAndContext(cleanQuery, cleanQuery);

  const primaryPerson = (
    effectiveProfile.primaryPerson ||
    cleanQuery.split(/\s+/).slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = (effectiveProfile.secondaryPerson || '').trim();
  const outfitKeywords = effectiveProfile.outfitKeywords || [];
  const locationKeywords = effectiveProfile.locationKeywords || [];
  const eventKeywords = effectiveProfile.eventKeywords || [];
  const eventWords = effectiveProfile.eventWords || [];

  if (!primaryPerson && !cleanQuery) return [];

  const queries = [
    [primaryPerson, secondaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0], 'dailymail']
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, secondaryPerson, locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], eventKeywords[0]].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const outfitTokens = outfitKeywords
    .flatMap((w) => w.toLowerCase().split(/\s+/))
    .filter((t) => t.length >= 3);
  const locTokens = locationKeywords.map((w) => w.toLowerCase()).filter(Boolean);
  const evTokens = eventKeywords.map((w) => w.toLowerCase()).filter(Boolean);

  const scoredCandidates = [];
  const seen = new Set(excludeKeys);
  const seenMd5 = new Set();

  for (const q of uniqueQueries) {
    if (scoredCandidates.length >= Math.max(limit * 3, 10)) break;
    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
        q
      )}&setmkt=en-US&setlang=en-US&cc=US&first=1`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
            Cookie: '_EDGE_S=mkt=en-us; SRCHHPGUSR=SRCHLANG=en&WLS=2',
          },
        },
        4200
      );
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.matchAll(/m="(\{[^"]+\})"/g);
      for (const m of matches) {
        try {
          const obj = JSON.parse(decodeHtmlEntities(m[1]));
          const imgUrl = String(obj.murl || '').trim();
          if (!imgUrl || isIgnorableImage(imgUrl)) continue;
          if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(imgUrl)) continue;
          if (
            /gettyimages\.|alamy\.|shutterstock\.|istockphoto\.|dreamstime\.|depositphotos\.|123rf\.|pond5\.|prettylittlething\.|shein\.|ido\.org\.tw|tiktok\.com\/api/i.test(
              imgUrl
            )
          ) {
            continue;
          }

          const normKey = imgUrl
            .split('?')[0]
            .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
            .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
            .toLowerCase();
          if (seen.has(normKey)) continue;
          if (obj.md5 && seenMd5.has(String(obj.md5))) continue;

          const titleText = decodeHtmlEntities(String(obj.t || obj.desc || ''))
            .replace(/[\uE000-\uF8FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const purl = String(obj.purl || '');
          const hay = `${titleText} ${purl} ${imgUrl}`.toLowerCase();

          const hasFullPrimary =
            Boolean(primaryPerson) && hay.includes(primaryPerson.toLowerCase());
          const hasAllPTokens = pTokens.length > 0 && pTokens.every((tk) => hay.includes(tk));
          if (!hasFullPrimary && !hasAllPTokens) continue;

          let score = hasFullPrimary ? 60 : 45;

          if (secondaryPerson && hay.includes(secondaryPerson.toLowerCase())) score += 50;
          else if (sTokens.length > 0 && sTokens.every((tk) => hay.includes(tk))) score += 35;

          for (const ot of outfitTokens) {
            if (hay.includes(ot)) score += 22;
          }
          for (const lt of locTokens) {
            if (hay.includes(lt)) score += 25;
          }
          for (const et of evTokens) {
            if (hay.includes(et)) score += 15;
          }
          if (
            /dailymail\.|justjared\.|hawtcelebs\.|celebmafia\.|pagesix\.|usmagazine\.|people\.com|thesun\.|mirror\.co\.uk|backgrid/i.test(
              hay
            )
          ) {
            score += 30;
          }

          seen.add(normKey);
          if (obj.md5) seenMd5.add(String(obj.md5));

          scoredCandidates.push({
            url: imgUrl,
            alt: titleText || `${primaryPerson} - ${eventWords.join(' ')}`.trim(),
            isFeatured: false,
            isExternal: true,
            score,
            purl,
          });
        } catch {
          // ignore malformed item
        }
      }
    } catch {
      // ignore timeout/search errors
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score);
  const topPurl = scoredCandidates[0] && scoredCandidates[0].purl;
  if (topPurl) {
    for (const item of scoredCandidates) {
      if (item.purl && item.purl === topPurl) {
        item.score += 25;
      }
    }
    scoredCandidates.sort((a, b) => b.score - a.score);
  }

  return scoredCandidates.slice(0, limit).map(({ score: _s, purl: _p, ...rest }) => rest);
}

async function searchRelatedYouTubeVideos(rawQuery, limit = 2, contextProfile) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery && !(contextProfile && contextProfile.primaryPerson)) return [];

  const primaryPerson = (
    (contextProfile && contextProfile.primaryPerson) ||
    cleanQuery.split(/\s+/).slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = ((contextProfile && contextProfile.secondaryPerson) || '').trim();
  const eventWords = (contextProfile && contextProfile.eventWords) || [];

  const queries = [
    [primaryPerson, secondaryPerson, eventWords.slice(0, 2).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, eventWords.slice(0, 3).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
    cleanQuery.split(/\s+/).slice(0, 8).join(' '),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const eTokens = eventWords.map((w) => w.toLowerCase()).filter(Boolean);

  const candidates = [];
  const seen = new Set();

  for (const q of uniqueQueries) {
    if (candidates.length >= 12) break;
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const res = await fetchWithTimeout(
        searchUrl,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
          },
        },
        4200
      );
      if (!res.ok) continue;
      const html = await res.text();

      const rendererRegex =
        /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
      let match;
      while ((match = rendererRegex.exec(html)) !== null && candidates.length < 18) {
        const videoId = match[1];
        const rawTitle = decodeHtmlEntities(
          match[2]
            .replace(/\\u0026/g, '&')
            .replace(/\\"/g, '"')
            .trim()
        );
        if (!videoId || seen.has(videoId)) continue;

        const lowerTitle = rawTitle.toLowerCase();
        const hasPerson =
          (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) ||
          pTokens.some((tk) => lowerTitle.includes(tk));
        if (!hasPerson && candidates.length >= limit) continue;

        let score = 0;
        if (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) score += 50;
        else if (hasPerson) score += 25;

        if (secondaryPerson && lowerTitle.includes(secondaryPerson.toLowerCase())) score += 45;
        else if (sTokens.some((tk) => lowerTitle.includes(tk))) score += 20;

        for (const ew of eTokens) {
          if (lowerTitle.includes(ew)) score += 15;
        }

        seen.add(videoId);
        candidates.push({
          videoId,
          title: rawTitle,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          score,
        });
      }
    } catch {
      // ignore timeout
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

async function scrapeWebArticleForSeoRewrite(rawUrl) {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const parsedUrl = new URL(cleanUrl);
  const origin = parsedUrl.origin;

  let originalTitle = '';
  let originalExcerpt = '';
  const paragraphs = [];
  const images = [];
  const seenImgKeys = new Set();

  const addImage = (url, alt = '', isFeatured = false) => {
    const resolved = resolveAbsUrl(url, cleanUrl);
    if (!resolved || isIgnorableImage(resolved)) return;
    const key = resolved
      .split('?')[0]
      .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)$)/i, '')
      .toLowerCase();
    if (seenImgKeys.has(key)) return;
    seenImgKeys.add(key);
    images.push({
      url: resolved,
      alt: alt || originalTitle || 'Article Image',
      isFeatured,
      isExternal: false,
    });
  };

  const extractParagraphsFromHtml = (htmlChunk) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const tag = m[1].toLowerCase();
      const txt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      if (
        /^(read more|related:|also read|share this|follow us|subscribe|advertisement|sponsored|source:|photo credit|click here)/i.test(
          txt
        )
      ) {
        continue;
      }
      if ((tag === 'h2' || tag === 'h3') && txt.length >= 8 && txt.length <= 140) {
        const marker = `## ${txt}`;
        if (!paragraphs.includes(marker)) paragraphs.push(marker);
      } else if (txt.length >= 25 && !paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  };

  const parseWpPostObject = async (postJson) => {
    if (!postJson || !postJson.id) return;
    if (postJson.title && postJson.title.rendered) {
      originalTitle = cleanScrapedTitle(postJson.title.rendered);
    }
    if (postJson.excerpt && postJson.excerpt.rendered) {
      originalExcerpt = stripHtmlTags(postJson.excerpt.rendered);
    }
    const contentHtml = String((postJson.content && postJson.content.rendered) || '');
    extractParagraphsFromHtml(contentHtml);
    const contentImgs = collectImgsFromHtml(contentHtml, cleanUrl);
    for (const img of contentImgs) {
      addImage(img.url, img.alt || originalTitle, images.length === 0);
    }

    const embeddedMedia =
      postJson._embedded &&
      postJson._embedded['wp:featuredmedia'] &&
      postJson._embedded['wp:featuredmedia'][0];
    const featUrl =
      (embeddedMedia &&
        embeddedMedia.media_details &&
        embeddedMedia.media_details.sizes &&
        embeddedMedia.media_details.sizes.full &&
        embeddedMedia.media_details.sizes.full.source_url) ||
      (embeddedMedia &&
        embeddedMedia.media_details &&
        embeddedMedia.media_details.sizes &&
        embeddedMedia.media_details.sizes.large &&
        embeddedMedia.media_details.sizes.large.source_url) ||
      (embeddedMedia && embeddedMedia.source_url) ||
      '';
    if (featUrl && (contentImgs.length === 0 || !/\bcollage[-_\d]/i.test(featUrl))) {
      addImage(featUrl, originalTitle, images.length === 0);
    }

    if (images.length < 5 && postJson.id) {
      try {
        const mediaRes = await fetchWithTimeout(
          `${origin}/wp-json/wp/v2/media?parent=${postJson.id}&per_page=20`,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (mediaRes.ok) {
          const mediaList = await mediaRes.json();
          if (Array.isArray(mediaList)) {
            for (const mItem of mediaList) {
              const mUrl =
                (mItem &&
                  mItem.media_details &&
                  mItem.media_details.sizes &&
                  mItem.media_details.sizes.full &&
                  mItem.media_details.sizes.full.source_url) ||
                (mItem &&
                  mItem.media_details &&
                  mItem.media_details.sizes &&
                  mItem.media_details.sizes.large &&
                  mItem.media_details.sizes.large.source_url) ||
                (mItem && mItem.source_url) ||
                '';
              if (mUrl && !/\bcollage[-_\d]/i.test(mUrl)) {
                addImage(
                  mUrl,
                  decodeHtmlEntities((mItem && mItem.alt_text) || (mItem && mItem.title && mItem.title.rendered) || originalTitle),
                  images.length === 0
                );
              }
            }
          }
        }
      } catch {}
    }
  };

  const pathSegs = parsedUrl.pathname.split('/').filter(Boolean);
  const numericId =
    pathSegs.length > 0 && /^\d+$/.test(pathSegs[0])
      ? Number(pathSegs[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p'))
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  const slugCandidates = pathSegs
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, '').trim())
    .filter((s) => s && !isTrackingOrLocalePathSegment(s))
    .sort((a, b) => b.length - a.length);
  const lastSlugSeg = slugCandidates[0] || '';

  const tryFetchWpRestPost = async (apiEndpoint) => {
    try {
      const wpRes = await fetchWithTimeout(
        apiEndpoint.includes('_embed')
          ? apiEndpoint
          : `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}_embed`,
        { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
        4500
      );
      if (!wpRes.ok) return;
      const data = await wpRes.json();
      if (Array.isArray(data) && data.length > 0) {
        await parseWpPostObject(data[0]);
      } else if (data && data.id) {
        await parseWpPostObject(data);
      }
    } catch {
      // fallback to HTML
    }
  };

  if (numericId) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericId}?_embed`);
  } else if (lastSlugSeg) {
    await tryFetchWpRestPost(
      `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSlugSeg)}&_embed`
    );
    if (images.length === 0 && paragraphs.length === 0) {
      const searchQ = lastSlugSeg.replace(/[-_]+/g, ' ').trim();
      if (searchQ.length >= 5) {
        await tryFetchWpRestPost(
          `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchQ)}&per_page=1&_embed`
        );
        if (images.length === 0 && paragraphs.length === 0) {
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

  if (paragraphs.length === 0 || images.length === 0 || !originalTitle) {
    try {
      const pageRes = await fetchWithTimeout(
        cleanUrl,
        {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        },
        4500
      );

      if (pageRes.ok) {
        const html = await pageRes.text();

        const wpJsonLink = html.match(
          /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
        );
        const shortlinkId = html.match(/<link[^>]+rel=["']shortlink["'][^>]+href=["'][^"']*\?p=(\d+)["']/i);
        const postClassId = html.match(/\bpostid-(\d+)\b/i);

        if (images.length === 0) {
          if (wpJsonLink && wpJsonLink[1]) {
            await tryFetchWpRestPost(resolveAbsUrl(wpJsonLink[1], cleanUrl));
          } else if ((shortlinkId && shortlinkId[1]) || (postClassId && postClassId[1])) {
            const pid = (shortlinkId && shortlinkId[1]) || (postClassId && postClassId[1]);
            await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${pid}?_embed`);
          }
        }

        if (images.length === 0 || paragraphs.length === 0 || !originalTitle) {
          if (!originalTitle) {
            const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
            const ogTitle =
              html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
              html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (h1Match && stripHtmlTags(h1Match[1]).length > 10) {
              originalTitle = cleanScrapedTitle(h1Match[1]);
            } else if (ogTitle && ogTitle[1]) {
              originalTitle = cleanScrapedTitle(ogTitle[1]);
            }
          }

          if (!originalExcerpt) {
            const ogDesc =
              html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (ogDesc && ogDesc[1]) {
              originalExcerpt = decodeHtmlEntities(ogDesc[1]);
            }
          }

          const ogImg =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
          if (ogImg && ogImg[1] && !/\bcollage[-_\d]/i.test(ogImg[1])) {
            addImage(ogImg[1], originalTitle, images.length === 0);
          }

          const cleanBody = html
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

          let primaryZone = cleanBody;
          const articleTagMatch = cleanBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
          if (articleTagMatch && articleTagMatch[1]) {
            primaryZone = articleTagMatch[1];
          } else {
            const contentDivStart = cleanBody.search(
              /<div\b[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content|single-content|article-body|story-body)[^"']*["'][^>]*>/i
            );
            if (contentDivStart !== -1) {
              primaryZone = cleanBody.slice(contentDivStart, contentDivStart + 120000);
            } else {
              const mainMatch = cleanBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
              if (mainMatch && mainMatch[1]) primaryZone = mainMatch[1];
            }
          }

          extractParagraphsFromHtml(primaryZone);
          for (const img of collectImgsFromHtml(primaryZone, cleanUrl)) {
            addImage(img.url, img.alt || originalTitle, images.length === 0);
          }
          if (images.length < 2) {
            for (const img of collectImgsFromHtml(cleanBody, cleanUrl)) {
              addImage(img.url, img.alt || originalTitle, images.length === 0);
            }
          }
        }
      }
    } catch {
      // Fallback to slug title
    }
  }

  if (!originalTitle) {
    originalTitle = humanizeUrlSlugToTitle(parsedUrl.pathname) || 'Exclusive Celebrity Story';
  }

  return {
    sourceUrl: cleanUrl,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    originalTitle,
    originalExcerpt,
    articleText: paragraphs.join('\n\n'),
    images: images.slice(0, 20),
  };
}

function splitIntoSentences(text) {
  const cleaned = stripHtmlTags(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const protectedText = cleaned
    .replace(/\b(Dr|Mr|Ms|Mrs|St|Jr|Sr|vs|Prof|Inc|Ltd)\.\s+/g, '$1__DOT__ ')
    .replace(/\bU\.S\./g, 'U__DOT__S__DOT__');
  const rawParts = protectedText.split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/);
  return rawParts
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length >= 20);
}

function expandFactBlockToAround150Words({
  baseFactText,
  contextProfile,
  allFactsPool,
  language,
  paragraphIndex,
}) {
  const cleanBase = stripHtmlTags(baseFactText).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();

  const primary = contextProfile.primaryPerson || contextProfile.subjectDisplay || 'the star';
  const secondary = contextProfile.secondaryPerson || '';
  const coupleOrSubject = secondary ? `${primary} and ${secondary}` : primary;
  const supList = contextProfile.supportingEntities || [];
  const supporting = supList.length > 0 ? supList.slice(0, 3).join(', ') : '';
  const specificSup = supList.length > 0 ? supList[paragraphIndex % supList.length] : '';
  const loc =
    contextProfile.locationKeywords && contextProfile.locationKeywords.length > 0
      ? contextProfile.locationKeywords
          .slice(0, 2)
          .map((l) => l.replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(' and ')
      : '';
  const outfit =
    contextProfile.outfitKeywords && contextProfile.outfitKeywords.length > 0
      ? contextProfile.outfitKeywords[paragraphIndex % contextProfile.outfitKeywords.length]
      : '';
  const timeframe =
    contextProfile.timeframeKeywords && contextProfile.timeframeKeywords.length > 0
      ? contextProfile.timeframeKeywords[paragraphIndex % contextProfile.timeframeKeywords.length]
      : '';
  const category = contextProfile.articleCategory || 'celebrity_lifestyle';

  const localNames = (
    cleanBase.match(/\b[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})+\b/g) || []
  ).filter((n) => !/^(Considering Season|From Nevermore|Beyond Nevermore|While Wednesday|Because Thing|As Season)$/i.test(n));
  const localFocusEntity = localNames[0] || specificSup || primary;

  const baseWordsCount = cleanBase.split(/\s+/).filter(Boolean).length;
  let combined = cleanBase;
  if (baseWordsCount < 35 && allFactsPool && allFactsPool.length > 1) {
    const companionFact = allFactsPool[(paragraphIndex * 3 + 1) % allFactsPool.length];
    if (companionFact && !combined.includes(companionFact.slice(0, 25))) {
      combined = `${combined} ${companionFact}`;
    }
  }

  let contextualElaborations = [];

  if (language === 'vi') {
    if (category === 'screen_production') {
      contextualElaborations = [
        `Đi sâu vào chi tiết nội dung này, khán giả có thể thấy rõ tâm huyết của đội ngũ sản xuất cũng như diễn xuất ấn tượng của ${coupleOrSubject}${supporting ? ` cùng sự góp mặt của ${supporting}` : ''}. Việc đầu tư kỹ lưỡng từ bối cảnh quay${loc ? ` tại ${loc}` : ''} cho đến chiều sâu tâm lý nhân vật giúp mạch truyện trở nên cuốn hút, chặt chẽ và giàu kịch tính hơn qua từng phân cảnh.`,
        `Bên cạnh những thông tin cốt lõi vừa được hé lộ${timeframe ? ` xoay quanh cột mốc ${timeframe}` : ''}, giới phê bình đánh giá rất cao cách xây dựng thế giới nhân vật quanh ${localFocusEntity}. Sự kết hợp ăn ý giữa các gương mặt quen thuộc và những nhân tố mới mang lại làn gió tươi mới, mở ra nhiều nút thắt bất ngờ khiến người xem không ngừng mong đợi.`,
        `Nhìn từ góc độ nghệ thuật và quy mô thực hiện, từng chi tiết về tạo hình, bối cảnh${loc ? ` ở ${loc}` : ''} lẫn đường dây kịch bản đều phản ánh bước tiến lớn của dự án gắn liền với ${coupleOrSubject}. Những hé lộ thực tế từ hậu trường cho thấy toàn bộ ê-kíp đã làm việc tỉ mỉ để giữ trọn bản sắc độc đáo vốn đã làm nên sức hút vang dội của tác phẩm.`,
        `Hơn thế nữa, sự phối hợp giữa ${coupleOrSubject}${supporting ? ` và các cộng sự như ${supporting}` : ''} tiếp tục khẳng định sức hút bền bỉ của thương hiệu trong lòng khán giả toàn cầu. Mỗi tình tiết được phát triển trong nội dung bài viết đều góp phần làm sáng tỏ bức tranh toàn cảnh về hành trình tiếp theo của các nhân vật chính.`,
        `Đặc biệt, cách triển khai mạch truyện xoay quanh ${localFocusEntity} cho thấy sự cân bằng khéo léo giữa yếu tố bí ẩn đặc trưng và chiều sâu cảm xúc. Người hâm mộ theo dõi sát sao từng bước phát triển của dự án đều nhận định rằng những thay đổi này sẽ tạo nên điểm nhấn bùng nổ khi tác phẩm chính thức ra mắt.`,
        `Không dừng lại ở đó, việc mở rộng không gian câu chuyện${loc ? ` sang ${loc}` : ''} cùng những thử thách mới dành cho ${primary} giúp tác phẩm duy trì được nhịp độ lôi cuốn từ đầu đến cuối. Từng chi tiết nhỏ trong kịch bản đều được cài cắm có chủ đích, hứa hẹn mang đến trải nghiệm điện ảnh mãn nhãn.`,
      ];
    } else {
      contextualElaborations = [
        `Phân tích sâu hơn từ những chi tiết thực tế trong bài viết, có thể thấy ${coupleOrSubject} đang tận hưởng trọn vẹn từng khoảnh khắc đáng nhớ${loc ? ` tại ${loc}` : ''}${timeframe ? ` vào dịp ${timeframe}` : ''}. Từ phong thái tự nhiên${outfit ? ` trong trang phục ${outfit}` : ''} cho đến sự gắn kết ăn ý, mọi khung hình đều khắc họa rõ nét cuộc sống đời thường ấm áp và chân thực của nhân vật.`,
        `Đặt trong mạch câu chuyện xuyên suốt bài viết, mối quan hệ và nhịp sống của ${coupleOrSubject}${supporting ? ` cũng như sự gắn bó với ${supporting}` : ''} cho thấy sự cân bằng tinh tế giữa sự nghiệp bận rộn và không gian riêng tư. Những khoảnh khắc sẻ chia bình dị${loc ? ` nơi ${loc}` : ''} chính là chất keo gắn kết giúp câu chuyện nhận được sự đồng cảm lớn từ công chúng.`,
        `Không chỉ gây ấn tượng bởi vẻ ngoài rạng rỡ${outfit ? ` cùng lựa chọn ${outfit}` : ''}, hành trình của ${primary}${secondary ? ` bên cạnh ${secondary}` : ''} còn phản ánh một giai đoạn trưởng thành, viên mãn và tràn đầy năng lượng tích cực. Từng chi tiết cụ thể được ghi nhận trong bài đều làm nổi bật tính cách gần gũi, chân thành phía sau ánh hào quang.`,
        `Nhìn lại toàn bộ các dữ kiện xoay quanh ${coupleOrSubject}${timeframe ? ` từ ${timeframe}` : ''}, người hâm mộ càng thêm ngưỡng mộ cách nhân vật trân trọng những giá trị gia đình và cảm xúc thật. Sự hòa quyện giữa công việc, cuộc sống cá nhân và những chuyến đi ý nghĩa${loc ? ` tại ${loc}` : ''} đã tạo nên một dấu ấn đẹp đẽ và đầy sức sống.`,
        `Qua góc nhìn của những người theo dõi lâu năm, những hình ảnh và chi tiết gắn liền với ${localFocusEntity} minh chứng cho sức hút tự nhiên không cần phô trương. Chính sự giản dị, tinh tế trong từng cử chỉ đời thường lại tạo nên sức lan tỏa mạnh mẽ hơn bất kỳ sự kiện hào nhoáng nào.`,
        `Thêm vào đó, cách ${coupleOrSubject} gìn giữ sự riêng tư nhưng vẫn thoải mái tận hưởng niềm vui bên những người thân yêu${supporting ? ` như ${supporting}` : ''} mang đến nguồn cảm hứng tích cực. Mỗi dấu mốc được đề cập trong bài đều góp phần hoàn thiện bức chân dung sống động và chân thực.`,
      ];
    }
  } else {
    if (category === 'screen_production') {
      contextualElaborations = [
        `Expanding on these specific production details, viewers can appreciate how thoughtfully the creative team and ${coupleOrSubject}${supporting ? `, alongside ${supporting},` : ''} are shaping the next chapter of the story. From the atmospheric filming locations${loc ? ` across ${loc}` : ''} to the intricate character dynamics, every element has been crafted to deepen the central mystery while honoring the distinctive tone that audiences love.`,
        `Looking closer at the developments unfolding around ${localFocusEntity}${timeframe ? ` heading into ${timeframe}` : ''}, longtime fans and television critics alike have noted how seamlessly the new casting additions and narrative arcs build upon earlier foundations. By weaving together family lore, sharp wit, and high-stakes suspense${supporting ? ` involving figures like ${supporting}` : ''}, the series continues to expand its creative scope in compelling ways.`,
        `From a storytelling and visual design perspective, the choices surrounding ${coupleOrSubject}${loc ? ` and settings such as ${loc}` : ''} play a vital role in establishing mood and pacing before a single line of dialogue is spoken. Every wardrobe detail, architectural backdrop, and behind-the-scenes decision works in harmony to make the onscreen world feel both immersive and unmistakably distinctive.`,
        `Furthermore, the collaborative synergy between ${coupleOrSubject}${supporting ? ` and creative forces including ${supporting}` : ''} underscores why anticipation remains so high among global viewers. Each concrete update from the production reinforces a commitment to bold character evolution, ensuring that the upcoming episodes deliver both emotional resonance and unforgettable twists.`,
        `Delving deeper into the narrative implications for ${localFocusEntity}, industry observers point out that balancing established canon with fresh dramatic tension requires exceptional precision. As the storyline ventures into uncharted territory${loc ? ` around ${loc}` : ''}, the interplay between veteran performers and newcomers promises to elevate the stakes significantly.`,
        `At the same time, the visual and thematic continuity anchored by ${primary}${secondary ? ` and ${secondary}` : ''} ensures that the heart of the series remains intact even as its world grows darker and more complex. Fans analyzing each detail from the set recognize how deliberately these clues set the stage for a landmark television event.`,
        `Equally important is how the production schedule${timeframe ? ` around ${timeframe}` : ''} reflects the ambitious scale of the project. With intricate set pieces, gothic aesthetics, and tightly guarded plot turns involving ${specificSup || primary}, the creative team is leaving no stone unturned in delivering a worthy continuation.`,
        `In addition, the emphasis on character-driven mystery allows ${localFocusEntity} to explore new emotional dimensions while preserving the razor-sharp humor that defined earlier chapters. Every scene and casting choice highlighted in the coverage points toward a richer, more expansive television experience.`,
        `Considering the global reception of ${primary}'s performance, it comes as no surprise that every behind-the-scenes update${loc ? ` from ${loc}` : ''} sparks widespread analysis across entertainment circles. The careful integration of lore, atmosphere, and ensemble chemistry remains the cornerstone of the show's enduring appeal.`,
        `Moreover, by spotlighting ${specificSup || coupleOrSubject} within this evolving arc, the writers open the door to deeper secrets and long-awaited confrontations. Viewers who have followed the clues from the beginning can see how organically these new elements fit into the overarching mythology.`,
      ];
    } else if (category === 'red_carpet_event') {
      contextualElaborations = [
        `Unpacking the details of this memorable appearance, observers can clearly see how ${coupleOrSubject} brought an unmistakable blend of warmth, confidence, and grace to the occasion${loc ? ` in ${loc}` : ''}. Whether dazzling in ${outfit || 'striking couture'} or sharing genuine, supportive moments behind the scenes, every aspect of the outing reflected a deeply grounded sense of self-assurance.`,
        `Looking deeper into the personal and professional milestones surrounding ${localFocusEntity}${supporting ? `, as well as projects and loved ones like ${supporting},` : ''} reveals how intentional choices have shaped this fulfilling chapter. Balancing high-profile television and film commitments with meaningful personal priorities has allowed ${primary} to shine with authentic poise.`,
        `From a fashion and cultural standpoint, ${primary}'s hands-on approach to styling${outfit ? `—highlighted by the ${outfit}—` : ' '}resonates strongly with audiences who value body confidence and individuality. Rather than following rigid industry formulas, every public moment and candid interaction${loc ? ` in ${loc}` : ''} celebrates real strength, mutual respect, and creative empowerment.`,
        `Moreover, the natural chemistry and quiet support between ${coupleOrSubject} illustrate how meaningful companionship thrives alongside a demanding entertainment career. Each detail shared from the appearance offers fans an inspiring glimpse into a life built on patience, artistic passion, and genuine happiness.`,
        `Reflecting on the broader journey of ${localFocusEntity}${timeframe ? ` around ${timeframe}` : ''}, commentators have praised the refreshing honesty and elegance on display throughout the event. By embracing every milestone with confidence and gratitude, ${primary} continues to set a powerful example both on and off the red carpet.`,
        `Beyond the flashbulbs and formal poses${loc ? ` at ${loc}` : ''}, it is the candid warmth between ${coupleOrSubject}${specificSup ? ` and ${specificSup}` : ''} that leaves the strongest impression. Moments like these remind audiences that authentic connection and self-expression remain the most timeless style statements of all.`,
        `Furthermore, the career momentum surrounding ${primary}${supporting ? ` across projects involving ${supporting}` : ''} adds even greater significance to this public celebration. Seeing artistic accomplishment paired with personal fulfillment underscores why admirers remain so supportive of every new endeavor.`,
        `As conversations around the event continue, fashion editors and fans alike point to ${localFocusEntity}'s presence as a standout highlight of the season. Every thoughtful detail—from wardrobe craftsmanship to heartfelt remarks—reflects a star completely at ease in the spotlight.`,
      ];
    } else if (category === 'retrospective_feature') {
      contextualElaborations = [
        `Examining the historical context and specific details surrounding ${coupleOrSubject}${loc ? ` in ${loc}` : ''}${timeframe ? ` during ${timeframe}` : ''} offers readers a much richer understanding of the moment captured on camera. Rather than viewing these snapshots in isolation, looking at the real timeline, personal relationships${supporting ? `, and key figures such as ${supporting}` : ''} preserves the true meaning behind the archive.`,
        `When revisiting the documented facts around ${localFocusEntity}, cultural historians and devoted followers emphasize how important accurate context remains in entertainment journalism. Every detail—from ${outfit || 'the candid styling'} to the setting${loc ? ` of ${loc}` : ''}—serves as a tangible link to an unforgettable chapter in pop culture history.`,
        `Stepping back to appreciate the broader legacy of ${coupleOrSubject}${timeframe ? ` across ${timeframe}` : ''}, it becomes clear why audiences continue to revisit these enduring stories and photographs. The combination of creative brilliance, candid human vulnerability, and timeless charisma ensures that their impact remains deeply felt years later.`,
        `Ultimately, preserving the genuine narrative around ${primary}${supporting ? ` alongside ${supporting}` : ''} allows both longtime admirers and new generations to connect with the real history behind the images. Each verified detail adds depth, respect, and emotional clarity to a remarkable life and career.`,
        `Looking closer at how ${localFocusEntity} navigated both public adulation and private bonds${loc ? ` in ${loc}` : ''} reveals a portrait of rare authenticity. Unlike staged publicity shoots, these documented moments capture the unvarnished grace and emotional truth that defined an era.`,
        `In addition, the enduring interest in ${coupleOrSubject}${specificSup ? ` and their connection with ${specificSup}` : ''} speaks to the lasting power of genuine artistry and human connection. By separating myth from documented reality, readers gain a far more meaningful appreciation for their story.`,
        `Across the decades${timeframe ? ` since ${timeframe}` : ''}, the influence of ${primary} has only grown stronger as biographers and fans uncover the full context behind these iconic chapters. Every preserved photograph and firsthand account enriches our collective memory of a truly singular figure.`,
        `Taken in full perspective, the story of ${localFocusEntity} reminds us that behind every legendary career lies a tapestry of quiet friendships, personal resilience, and unscripted moments that deserve to be remembered with care and accuracy.`,
      ];
    } else {
      contextualElaborations = [
        `Looking closely at the specific details of this getaway${loc ? ` in ${loc}` : ''}${timeframe ? ` on ${timeframe}` : ''}, it is easy to see why ${coupleOrSubject} appeared so thoroughly relaxed and in sync. From ${outfit ? `the effortless summer styling featuring ${outfit}` : 'their effortless coastal aesthetic'} to the unhurried pace of the afternoon, every moment reflected genuine affection away from demanding schedules.`,
        `Tracing the broader arc of ${coupleOrSubject}'s relationship${timeframe ? ` since ${timeframe}` : ''}${loc ? ` across destinations like ${loc}` : ''}, insiders and longtime observers note how naturally their partnership has flourished. By prioritizing uninterrupted quality time and blending their respective worlds${supporting ? `—including ${supporting}—` : ''}, they have built a remarkably grounded and supportive dynamic.`,
        `Beyond the sun-drenched scenery${loc ? ` of ${loc}` : ''}, what stands out most about ${primary} and ${secondary || 'their inner circle'} is the seamless balance between high-level professional achievements${supporting ? ` involving ${supporting}` : ''} and quiet family routines. Every candid gesture captured during the outing speaks to a mature, joyful chapter defined by mutual respect and shared contentment.`,
        `Furthermore, seeing ${coupleOrSubject} embrace these unscripted moments${loc ? ` along the coast of ${loc}` : ''} offers fans a refreshing glimpse into life behind the spotlight. Rather than grand spectacle, it is the simple warmth of shared laughter, coastal breezes, and close family bonds that makes their story so genuinely compelling.`,
        `Focusing on the personal milestones surrounding ${localFocusEntity}, those close to the pair have consistently highlighted how refreshing it is to keep their romance low-key and authentic. Whether spending time in ${loc || 'their favorite retreats'} or navigating busy work commitments, their mutual devotion remains unmistakable.`,
        `At the same time, ${primary}'s ability to juggle major creative ventures${specificSup ? ` alongside connections to ${specificSup}` : ''} while carving out peaceful getaways with ${secondary || 'loved ones'} demonstrates an inspiring sense of balance. Every detail from the trip underscores a season of calm happiness and emotional renewal.`,
        `Observers also note how effortlessly ${coupleOrSubject} have integrated their friends and family${supporting ? `, including ${supporting},` : ''} into this new chapter. That foundation of trust and shared joy shines through in every candid photograph from the outing.`,
        `Ultimately, the enduring warmth between ${coupleOrSubject}${loc ? ` during their time in ${loc}` : ''} captures the essence of a partnership built on genuine compatibility. Away from red carpets and studio sets, these quiet, sun-lit moments tell the truest story of all.`,
      ];
    }
  }

  let attempt = 0;
  while (combined.split(/\s+/).filter(Boolean).length < 140 && attempt < contextualElaborations.length) {
    const addon =
      contextualElaborations[(paragraphIndex * 2 + attempt) % contextualElaborations.length];
    if (!combined.includes(addon.slice(0, 36))) {
      combined = combined ? `${combined} ${addon}` : addon;
    }
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 172) {
    const sliced = finalWords.slice(0, 162).join(' ');
    const lastDot = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? ')
    );
    if (lastDot > 520) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

function buildContentDrivenSubheadings(contextProfile, originalHeadings, language) {
  const isVi = language === 'vi';
  const primary = contextProfile.primaryPerson || contextProfile.subjectDisplay || 'Nhân vật chính';
  const secondary = contextProfile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} & ${secondary}` : primary;
  const loc1 = contextProfile.locationKeywords && contextProfile.locationKeywords[0]
    ? contextProfile.locationKeywords[0].replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const sup1 = (contextProfile.supportingEntities && contextProfile.supportingEntities[0]) || '';
  const sup2 = (contextProfile.supportingEntities && contextProfile.supportingEntities[1]) || '';
  const time1 = (contextProfile.timeframeKeywords && contextProfile.timeframeKeywords[0]) || '';
  const outfit1 = (contextProfile.outfitKeywords && contextProfile.outfitKeywords[0]) || '';
  const cat = contextProfile.articleCategory;

  const cleanOrig = (originalHeadings || [])
    .map((h) => h.replace(/^##\s*/, '').trim())
    .filter((h) => h.length >= 8 && h.length <= 120);

  let generated = [];

  if (isVi) {
    if (cat === 'screen_production') {
      generated = [
        `Cột Mốc Sản Xuất Mới Nhất Của ${subjectPair}${loc1 ? ` Tại ${loc1}` : ''}`,
        `Dàn Diễn Viên Thực Lực Và Sự Góp Mặt Của ${sup1 || primary}${sup2 ? ` Cùng ${sup2}` : ''}`,
        `Bối Cảnh Quay Ấn Tượng${loc1 ? ` Ở ${loc1}` : ''} Và Phong Cách Nghệ Thuật Đặc Trưng`,
        `Chia Sẻ Từ Đội Ngũ Sáng Tạo Về Hướng Đi Mới Của ${primary}`,
        `Chiều Sâu Tâm Lý Nhân Vật Và Những Bí Ẩn Đang Chờ Hé Lộ`,
        `Lịch Trình Ra Mắt${time1 ? ` (${time1})` : ''} Và Kỳ Vọng Từ Khán Giả Toàn Cầu`,
      ];
    } else {
      generated = [
        `Khoảnh Khắc Đời Thường Đáng Nhớ Của ${subjectPair}${loc1 ? ` Tại ${loc1}` : ''}`,
        `Phong Cách Thời Trang Tự Nhiên${outfit1 ? `: Điểm Nhấn ${outfit1}` : ` Của ${primary}`}`,
        `Hành Trình Gắn Kết Và Sự Đồng Điệu Giữa ${subjectPair}`,
        `Sự Cân Bằng Giữa Sự Nghiệp Đỉnh Cao Và Không Gian Riêng Tư`,
        `Mối Quan Hệ Gần Gũi Với Gia Đình Và ${sup1 || 'Những Người Thân Yêu'}`,
        `Sức Hút Chân Thực Của ${primary} Trong Lòng Người Hâm Mộ`,
      ];
    }
  } else {
    if (cat === 'screen_production') {
      generated = [
        `Inside the Production Milestone Featuring ${subjectPair}${loc1 ? ` in ${loc1}` : ''}`,
        `New and Returning Cast Additions${sup1 ? `: ${sup1}${sup2 ? ` and ${sup2}` : ''}` : ''}`,
        `Atmospheric Locations${loc1 ? ` Across ${loc1}` : ''} and Signature Visual Identity`,
        `Showrunners and Creative Leadership on Expanding ${primary}'s World`,
        `Character Evolution, Family Lore, and Deepening Mysteries`,
        `What Viewers Can Expect Ahead of the ${time1 || 'Upcoming'} Release`,
      ];
    } else if (cat === 'red_carpet_event') {
      generated = [
        `${subjectPair} Shining Together${loc1 ? ` in ${loc1}` : ''}`,
        `Signature Couture and Hands-On Styling${outfit1 ? `: The ${outfit1}` : ''}`,
        `Balancing Screen Milestones${sup1 ? ` Like ${sup1}` : ''} With Personal Fulfillment`,
        `Mutual Support and Lasting Chemistry Behind the Scenes`,
        `Championing Confidence, Individuality, and Authentic Grace`,
        `What Comes Next for ${primary} on Screen and Beyond`,
      ];
    } else if (cat === 'retrospective_feature') {
      generated = [
        `The Real Context Behind ${subjectPair}'s Iconic Moment${time1 ? ` (${time1})` : ''}`,
        `Inside the Setting${loc1 ? ` of ${loc1}` : ''} and Genuine Personal Bonds`,
        `How ${primary}${sup1 ? ` and ${sup1}` : ''} Shaped an Unforgettable Era`,
        `Separating Documented History From Pop Culture Myth`,
        `Enduring Artistry, Charisma, and Cultural Impact`,
        `Why ${primary}'s Legacy Continues to Resonate With Generations`,
      ];
    } else {
      generated = [
        `Inside ${subjectPair}'s Sun-Soaked Getaway${loc1 ? ` in ${loc1}` : ''}`,
        `Effortless Coastal Style${outfit1 ? `: Highlighting the ${outfit1}` : ` and Candid Moments`}`,
        `How ${subjectPair}'s Low-Key Romance Has Flourished${time1 ? ` Since ${time1}` : ''}`,
        `Balancing Career Ventures${sup1 ? ` and ${sup1}` : ''} With Private Serenity`,
        `Family Harmony and Blending Worlds${sup2 ? ` With ${sup2}` : ''}`,
        `A Grounded, Joyful Chapter Ahead for ${subjectPair}`,
      ];
    }
  }

  const combined = [];
  for (const h of [...cleanOrig, ...generated]) {
    if (!combined.includes(h)) combined.push(h);
  }
  return combined.slice(0, 9);
}

function buildLongFormSeoArticle2000To5000Words({
  articleTitle,
  focusKeyword,
  sourceArticleText,
  images,
  youtubeVideos,
  language,
  contextProfile,
}) {
  const isVi = language === 'vi';
  const profile =
    contextProfile ||
    analyzeArticleSubjectAndContext(articleTitle, sourceArticleText, focusKeyword, images);

  const rawLines = String(sourceArticleText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const originalHeadings = [];
  const sourceParagraphs = [];

  for (const line of rawLines) {
    if (line.startsWith('## ')) {
      originalHeadings.push(line.replace(/^##\s*/, '').trim());
    } else if (
      line.length >= 12 &&
      line.length <= 85 &&
      !/[.!]$/.test(line) &&
      (line.endsWith('?') || /^[a-z0-9\s'’“-]+$/i.test(line))
    ) {
      originalHeadings.push(line);
    } else if (line.length >= 25) {
      sourceParagraphs.push(line);
    }
  }

  const allSourceSentences = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    for (const s of sents) {
      if (!allSourceSentences.includes(s)) {
        allSourceSentences.push(s);
      }
    }
  }

  const factUnits = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    if (sents.length >= 3) {
      const mid = Math.ceil(sents.length / 2);
      factUnits.push(sents.slice(0, mid).join(' '));
      factUnits.push(sents.slice(mid).join(' '));
    } else if (sents.length === 2 && sp.split(/\s+/).length >= 45) {
      factUnits.push(sents[0]);
      factUnits.push(sents[1]);
    } else {
      factUnits.push(sp);
    }
  }

  const primary = profile.primaryPerson || profile.subjectDisplay || 'the star';
  const secondary = profile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const locs = (profile.locationKeywords || []).map((l) =>
    l.replace(/\b\w/g, (c) => c.toUpperCase())
  );
  const sups = profile.supportingEntities || [];
  const outfits = profile.outfitKeywords || [];
  const timeframes = profile.timeframeKeywords || [];

  const synthesisAngles = isVi
    ? [
        allSourceSentences[0]
          ? `Đi sâu phân tích chi tiết mở đầu trong bài viết: ${allSourceSentences[0]}`
          : `Trọng tâm của câu chuyện xoay quanh ${subjectPair}${locs[0] ? ` tại ${locs[0]}` : ''} cùng những diễn biến thực tế đang thu hút sự chú ý lớn.`,
        allSourceSentences[1]
          ? `Khía cạnh tiếp theo được làm rõ trong nội dung bài là ${allSourceSentences[1]}`
          : `Mỗi chi tiết xoay quanh ${primary}${secondary ? ` và ${secondary}` : ''}${outfits[0] ? ` với hình ảnh ${outfits[0]}` : ''} đều mang lại góc nhìn sinh động và chân thực.`,
        allSourceSentences[2]
          ? `Đáng chú ý hơn, bài viết nhấn mạnh vào cột mốc quan trọng: ${allSourceSentences[2]}`
          : `Sự kết nối giữa ${subjectPair}${sups[0] ? ` cùng các yếu tố liên quan tới ${sups[0]}` : ''} tạo nên chiều sâu đặc biệt cho toàn bộ mạch truyện.`,
        allSourceSentences[3]
          ? `Nhìn từ bối cảnh thực tế được đề cập: ${allSourceSentences[3]}`
          : `Tại ${locs.join(' và ') || 'bối cảnh chính của câu chuyện'}, ${subjectPair} đã để lại nhiều ấn tượng sâu sắc qua từng hoạt động cụ thể.`,
        allSourceSentences[4]
          ? `Một chi tiết đắt giá khác trong bài viết cũng thu hút sự quan tâm đặc biệt: ${allSourceSentences[4]}`
          : `Quá trình phát triển${timeframes[0] ? ` gắn liền với mốc thời gian ${timeframes[0]}` : ''} cho thấy bước chuyển mình rõ nét của ${primary}.`,
        allSourceSentences[5]
          ? `Tiếp nối mạch thông tin trong bài: ${allSourceSentences[5]}`
          : `Bên cạnh nhân vật trung tâm là ${primary}, sự xuất hiện của ${secondary || sups.slice(0, 2).join(', ') || 'các cộng sự'} càng làm nổi bật bức tranh toàn cảnh.`,
        allSourceSentences[6]
          ? `Khép lại chuỗi dữ kiện cốt lõi trong bài viết: ${allSourceSentences[6]}`
          : `Tổng hợp toàn bộ những thông tin thực tế xoay quanh ${subjectPair}, độc giả có thể cảm nhận trọn vẹn giá trị và sức hút của câu chuyện.`,
      ]
    : [
        allSourceSentences[0]
          ? `Taking a closer analytical look at the opening details of the report: ${allSourceSentences[0]}`
          : `At the center of the story is ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}, whose latest chapter brings together compelling personal and professional developments.`,
        allSourceSentences[1]
          ? `Building directly on the scene described in the coverage: ${allSourceSentences[1]}`
          : `Every specific detail surrounding ${primary}${secondary ? ` and ${secondary}` : ''}${outfits[0] ? `, including the ${outfits[0]},` : ''} highlights the authentic atmosphere of the moment.`,
        allSourceSentences[2]
          ? `Another pivotal detail highlighted within the story notes how ${allSourceSentences[2].charAt(0).toLowerCase()}${allSourceSentences[2].slice(1)}`
          : `The timeline connecting ${subjectPair}${timeframes[0] ? ` around ${timeframes[0]}` : ''}${locs[1] ? ` and ${locs[1]}` : ''} reveals a thoughtful, organic progression.`,
        allSourceSentences[3]
          ? `Examining the broader background shared in the article: ${allSourceSentences[3]}`
          : `Key connections involving ${sups.slice(0, 3).join(', ') || subjectPair} add important context to how ${primary} navigates both career and personal priorities.`,
        allSourceSentences[4]
          ? `Further underscoring the depth of this chapter, the report points out: ${allSourceSentences[4]}`
          : `Across ${locs.join(' and ') || 'each setting featured in the story'}, the interplay between ${subjectPair} demonstrates genuine poise and lasting chemistry.`,
        allSourceSentences[5]
          ? `Adding another layer of insight from the documented account: ${allSourceSentences[5]}`
          : `Whether focusing on ${sups[0] || primary}'s creative milestones or quiet moments away from the cameras, the details paint a cohesive and engaging portrait.`,
        allSourceSentences[6]
          ? `Bringing together the final threads of the coverage: ${allSourceSentences[6]}`
          : `Taken together, every fact surrounding ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''} underscores why audiences remain so invested in their ongoing journey.`,
      ];

  let synIdx = 0;
  while (factUnits.length < 16 && synIdx < synthesisAngles.length * 2) {
    const candidate = synthesisAngles[synIdx % synthesisAngles.length];
    const extraSent =
      allSourceSentences.length > 0
        ? allSourceSentences[(synIdx + 2) % allSourceSentences.length]
        : '';
    const merged =
      extraSent && !candidate.includes(extraSent.slice(0, 30))
        ? `${candidate} ${extraSent}`
        : candidate;
    factUnits.push(merged);
    synIdx++;
  }

  const targetUnits = factUnits.slice(0, 20);
  const subheadings = buildContentDrivenSubheadings(profile, originalHeadings, language);

  const finalParagraphs150Words = [];

  targetUnits.forEach((unitText, idx) => {
    const expanded150 = expandFactBlockToAround150Words({
      baseFactText: unitText,
      contextProfile: profile,
      allFactsPool: allSourceSentences,
      language,
      paragraphIndex: idx,
    });

    let h2ForPara;
    if (idx > 0 && idx % 2 === 0) {
      const h2Index = Math.floor((idx - 2) / 2);
      if (h2Index < subheadings.length) {
        h2ForPara = subheadings[h2Index];
      }
    }

    finalParagraphs150Words.push({
      h2: h2ForPara,
      text: expanded150,
    });
  });

  const htmlBlocks = [];
  const totalParas = finalParagraphs150Words.length;
  let imgIdx = 0;

  const renderFigureBlock = (img, displayNum) => {
    const cleanAlt =
      img.alt && img.alt !== articleTitle
        ? img.alt
        : `${profile.subjectDisplay || primary} - Photo #${displayNum}`;
    const altText = String(cleanAlt).replace(/"/g, '&quot;');
    const sourceBadge = img.isExternal
      ? isVi
        ? `Ảnh bổ sung #${displayNum}`
        : `Supplemental Photo #${displayNum}`
      : isVi
      ? `Ảnh trong bài #${displayNum}`
      : `Article Photo #${displayNum}`;
    return `<figure class="wp-block-image size-large article-image-block" style="margin: 24px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" loading="lazy" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
  };

  if (images.length > 0) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

  const remainingImgs = Math.max(0, images.length - imgIdx);
  const imgStep =
    remainingImgs > 0 ? Math.max(1, Math.floor(totalParas / (remainingImgs + 1))) : 999;

  finalParagraphs150Words.forEach((item, idx) => {
    if (item.h2) {
      htmlBlocks.push(
        `<h2 style="margin: 30px 0 14px 0; font-weight: 800; line-height: 1.35;">${item.h2}</h2>`
      );
    }

    htmlBlocks.push(
      `<p style="margin: 0 0 22px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>\n<br />`
    );

    if (
      imgIdx < images.length &&
      ((idx + 1) % imgStep === 0 || idx >= totalParas - (images.length - imgIdx))
    ) {
      htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
    }
  });

  while (imgIdx < images.length) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

  if (youtubeVideos.length > 0) {
    const headingText = isVi
      ? '🎬 Video Liên Quan Đáng Chú Ý'
      : '🎬 Related Videos & Exclusive Moments';

    htmlBlocks.push(`<h2 style="margin: 32px 0 16px 0; font-weight: 800;">${headingText}</h2>`);

    youtubeVideos.forEach((v, idx) => {
      const safeTitle = String(v.title || '').replace(/"/g, '&quot;');
      htmlBlocks.push(
        `<div class="wp-youtube-embed-box" style="margin: 20px 0 28px 0;">
  <p style="margin-bottom: 10px;"><strong>Video #${idx + 1}: ${v.title}</strong></p>
  <figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 12px 0;">
    <div class="wp-block-embed__wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
      <iframe src="https://www.youtube.com/embed/${v.videoId}" title="${safeTitle}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </figure>
  <p style="font-size: 13px; color: #475569;">👉 <a href="${v.watchUrl}" target="_blank" rel="noopener noreferrer">${
          isVi ? 'Xem trực tiếp trên YouTube' : 'Watch on YouTube'
        }: ${v.title}</a></p>
</div>`
      );
    });
  }

  const finalHtml = htmlBlocks.join('\n\n');
  const plainWords = stripHtmlTags(finalHtml).split(/\s+/).filter(Boolean).length;

  return {
    html: finalHtml,
    wordCount: plainWords,
    paragraphCount: finalParagraphs150Words.length,
  };
}

async function generateSeoArticleWithAiFast(params) {
  const language = params.language === 'vi' ? 'vi' : 'en';
  let scrapedImages = [];
  let sourceTitle = '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  const rawUrlCandidate = String(params.sourceUrl || '').trim() || String(params.topic || '').trim();
  const detectedUrlMatch = rawUrlCandidate.match(/https?:\/\/[^\s"'<>]+/i);
  const urlToScrape =
    params.mode === 'from_url'
      ? rawUrlCandidate
      : detectedUrlMatch
      ? detectedUrlMatch[0]
      : '';

  if (urlToScrape) {
    const scraped = await scrapeWebArticleForSeoRewrite(urlToScrape);
    scrapedImages = scraped.images;
    sourceTitle = scraped.originalTitle;
    sourceExcerpt = scraped.originalExcerpt;
    sourceArticleText = scraped.articleText;
    resolvedSourceUrl = scraped.sourceUrl;
  } else {
    sourceArticleText = String(params.existingContent || params.topic || '').trim();
  }

  if (params.existingContent) {
    const existingImgs = collectImgsFromHtml(String(params.existingContent), resolvedSourceUrl || DEFAULT_WP_SITE);
    const seen = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const ex of existingImgs) {
      const k = ex.url.split('?')[0].toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        scrapedImages.push({
          url: ex.url,
          alt: ex.alt || sourceTitle || 'Article Image',
          isFeatured: scrapedImages.length === 0,
          isExternal: false,
        });
      }
    }
  }

  const contextProfile = analyzeArticleSubjectAndContext(
    sourceTitle || params.topic,
    sourceArticleText || params.existingContent || params.topic,
    params.keyword,
    scrapedImages
  );

  const effectiveTopic =
    sourceTitle || String(params.topic || '').trim() || String(params.existingContent || '').slice(0, 120);
  const kw =
    contextProfile.primaryPerson ||
    String(params.keyword || '').trim() ||
    effectiveTopic.split(/[:–—|-]/)[0].trim();

  const generatedTitle =
    sourceTitle ||
    String(params.topic || '').split('\n')[0].trim().slice(0, 95) ||
    'Exclusive Celebrity Story & Highlights';

  const generatedSlug = generatedTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  const firstCleanSent = splitIntoSentences(sourceArticleText)[0] || '';
  const generatedExcerpt =
    sourceExcerpt ||
    (firstCleanSent
      ? firstCleanSent.slice(0, 158)
      : `Read the full story about ${contextProfile.subjectDisplay || kw}.`);

  const generatedKeyword =
    (contextProfile.primaryPerson || kw).slice(0, 55) || 'Celebrity';
  const generatedTags = [
    contextProfile.primaryPerson || generatedKeyword,
    ...(contextProfile.secondaryPerson ? [contextProfile.secondaryPerson] : []),
    ...(contextProfile.supportingEntities || []).slice(0, 2),
    params.categoryName || 'Showbiz',
    'Celeb24h',
  ];

  const existingKeys = new Set(
    scrapedImages.map((img) =>
      img.url
        .split('?')[0]
        .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
        .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
        .toLowerCase()
    )
  );
  const searchTopicQuery =
    contextProfile.combinedSearchQuery || generatedKeyword || generatedTitle;

  const realContentImgCount = scrapedImages.filter(
    (img) => !/\bcollage[-_\d]/i.test(img.url)
  ).length;
  const neededExternalCount =
    realContentImgCount >= 5 ? 0 : Math.max(2, 6 - realContentImgCount);

  const [externalImages, relatedVideos] = await Promise.all([
    neededExternalCount > 0
      ? searchExternalRelatedImages(
          searchTopicQuery,
          neededExternalCount,
          existingKeys,
          contextProfile
        )
      : Promise.resolve([]),
    searchRelatedYouTubeVideos(searchTopicQuery, 2, contextProfile),
  ]);

  const allCombinedImages = [...scrapedImages, ...externalImages];

  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    images: allCombinedImages,
    youtubeVideos: relatedVideos,
    language,
    contextProfile,
  });

  return {
    ok: true,
    mode: resolvedSourceUrl ? 'from_url' : 'from_text',
    sourceUrl: resolvedSourceUrl || undefined,
    title: generatedTitle,
    slug: generatedSlug,
    excerpt: generatedExcerpt,
    focusKeyword: generatedKeyword,
    searchQuery: searchTopicQuery,
    tags: generatedTags,
    contentHtml: longFormResult.html,
    wordCount: longFormResult.wordCount,
    paragraphCount: longFormResult.paragraphCount,
    featuredImageUrl:
      (scrapedImages[0] && scrapedImages[0].url) ||
      (allCombinedImages[0] && allCombinedImages[0].url) ||
      '',
    extractedImages: allCombinedImages,
    sourceImages: scrapedImages,
    externalImages,
    originalImageCount: scrapedImages.length,
    externalImageCount: externalImages.length,
    youtubeVideos: relatedVideos,
  };
}

async function getWpRestSession(forceRefresh = false) {
  if (!forceRefresh && cachedPublishSession && cachedPublishSession.expiresAt > Date.now()) {
    return cachedPublishSession;
  }

  const loginUrl = `${DEFAULT_WP_SITE}/wp-login.php`;
  const body = new URLSearchParams({
    log: DEFAULT_WP_USER,
    pwd: DEFAULT_WP_PASS,
    'wp-submit': 'Log In',
    redirect_to: `${DEFAULT_WP_SITE}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetchWithTimeout(
    loginUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
        'User-Agent': SCRAPER_USER_AGENT,
      },
      body: body.toString(),
      redirect: 'manual',
    },
    6000
  );

  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  const cookieHeader = rawCookies
    .map((c) => c.split(';')[0])
    .filter(
      (c) =>
        c.startsWith('wordpress_logged_in_') ||
        c.startsWith('wordpress_sec_') ||
        c.startsWith('wordpress_') ||
        c.startsWith('wp-settings-')
    )
    .join('; ');

  const postNewRes = await fetchWithTimeout(
    `${DEFAULT_WP_SITE}/wp-admin/post-new.php`,
    {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': SCRAPER_USER_AGENT,
      },
    },
    6000
  );
  const html = await postNewRes.text();
  const nonceMatch = html.match(/wpApiSettings\s*=\s*(\{[^;]+\})/);
  let restNonce = '';
  let restRoot = `${DEFAULT_WP_SITE}/wp-json/`;

  if (nonceMatch && nonceMatch[1]) {
    try {
      const parsed = JSON.parse(nonceMatch[1]);
      restNonce = parsed.nonce || '';
      restRoot = parsed.root || restRoot;
    } catch {}
  }

  cachedPublishSession = {
    cookieHeader,
    restNonce,
    restRoot: restRoot.endsWith('/') ? restRoot : `${restRoot}/`,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };

  return cachedPublishSession;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const session = await getWpRestSession();
      const headers = {
        Cookie: session.cookieHeader,
        'X-WP-Nonce': session.restNonce,
        'User-Agent': SCRAPER_USER_AGENT,
      };

      const [catRes, postsRes] = await Promise.all([
        fetchWithTimeout(`${session.restRoot}wp/v2/categories?per_page=50`, { headers }, 5500),
        fetchWithTimeout(
          `${session.restRoot}wp/v2/posts?_embed&per_page=25&status=publish,draft,future&context=edit`,
          { headers },
          5500
        ),
      ]);

      const rawCats = catRes.ok ? await catRes.json() : [];
      const categories = Array.isArray(rawCats)
        ? rawCats.map((c) => ({
            id: Number(c.id),
            name: decodeHtmlEntities(c.name || ''),
            slug: String(c.slug || ''),
            count: Number(c.count || 0),
          }))
        : [];

      const catMap = new Map();
      categories.forEach((c) => catMap.set(c.id, c.name));

      const rawPosts = postsRes.ok ? await postsRes.json() : [];
      const posts = Array.isArray(rawPosts)
        ? rawPosts.map((p) => {
            const authorInfo = resolveEmployeeByWpUserId(p.author);
            const catIds = Array.isArray(p.categories) ? p.categories.map(Number) : [];
            const embeddedMedia =
              p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0];
            const featuredImageUrl =
              (embeddedMedia && embeddedMedia.source_url) ||
              (embeddedMedia &&
                embeddedMedia.media_details &&
                embeddedMedia.media_details.sizes &&
                embeddedMedia.media_details.sizes.medium &&
                embeddedMedia.media_details.sizes.medium.source_url) ||
              '';
            return {
              id: Number(p.id),
              title: decodeHtmlEntities(
                typeof p.title === 'object' ? p.title.raw || p.title.rendered || '' : p.title || ''
              ),
              content:
                typeof p.content === 'object'
                  ? p.content.raw || p.content.rendered || ''
                  : p.content || '',
              excerpt: stripHtmlTags(
                typeof p.excerpt === 'object'
                  ? p.excerpt.raw || p.excerpt.rendered || ''
                  : p.excerpt || ''
              ),
              slug: String(p.slug || ''),
              status: p.status || 'publish',
              date: String(p.date || ''),
              modified: String(p.modified || ''),
              link: String(p.link || `${DEFAULT_WP_SITE}/${p.id}`),
              authorId: Number(p.author || 6),
              authorName: authorInfo.displayName,
              employeeCode: authorInfo.code,
              categories: catIds,
              categoryNames: catIds.map((id) => catMap.get(id) || `#${id}`),
              featuredMediaId: Number(p.featured_media || 0),
              featuredImageUrl,
            };
          })
        : [];

      return res.status(200).json({
        ok: true,
        siteUrl: DEFAULT_WP_SITE,
        categories,
        posts,
        authors: WP_EMPLOYEE_AUTHOR_MAP,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || 'publish');

      // 1. Xử lý Viết bài chuẩn SEO 2.000 - 5.000 từ + lấy hết ảnh + ảnh ngoài + 2 Video YouTube
      if (action === 'ai_write' || action === 'ai_generate') {
        const result = await generateSeoArticleWithAiFast({
          topic: String(body.topic || ''),
          keyword: body.keyword ? String(body.keyword) : undefined,
          language: body.language === 'vi' ? 'vi' : 'en',
          categoryName: body.categoryName ? String(body.categoryName) : undefined,
          mode: body.mode || 'from_url',
          sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
        });
        return res.status(200).json(result);
      }

      // 2. Xử lý tìm 2 Video YouTube liên quan
      if (action === 'search_youtube') {
        const query = String(body.query || '');
        const existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        const ctxProfile =
          body.articleText || body.title
            ? analyzeArticleSubjectAndContext(
                String(body.title || query),
                String(body.articleText || query),
                query,
                existingImgs
              )
            : undefined;
        const videos = await searchRelatedYouTubeVideos(
          (ctxProfile && ctxProfile.combinedSearchQuery) || query,
          Number(body.limit || 2),
          ctxProfile
        );
        return res.status(200).json({ ok: true, videos });
      }

      // 3. Xử lý tìm thêm ảnh ngoài
      if (action === 'search_external_images') {
        const query = String(body.query || '');
        const existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        const excludeKeys = new Set(
          existingImgs
            .map((im) =>
              String((im && im.url) || '')
                .split('?')[0]
                .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
                .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
                .toLowerCase()
            )
            .filter(Boolean)
        );
        const ctxProfile =
          body.articleText || body.title || existingImgs.length > 0
            ? analyzeArticleSubjectAndContext(
                String(body.title || query),
                String(body.articleText || query),
                query,
                existingImgs
              )
            : undefined;
        const images = await searchExternalRelatedImages(
          (ctxProfile && ctxProfile.combinedSearchQuery) || query,
          Number(body.limit || 6),
          excludeKeys,
          ctxProfile
        );
        return res.status(200).json({ ok: true, images });
      }

      const session = await getWpRestSession();

      // 4. Upload Media lên WordPress
      if (action === 'upload_media') {
        let buffer;
        let mimeType = 'image/jpeg';
        const finalFileName = body.fileName || `celeb24h-${Date.now()}.jpg`;
        if (body.base64Data) {
          const match = String(body.base64Data).match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
          );
          if (match) {
            mimeType = match[1];
            buffer = Buffer.from(match[2], 'base64');
          } else {
            buffer = Buffer.from(body.base64Data, 'base64');
          }
        } else if (body.imageUrl) {
          let refererOrigin = DEFAULT_WP_SITE;
          try {
            refererOrigin = `${new URL(String(body.imageUrl)).origin}/`;
          } catch {}
          const imgRes = await fetchWithTimeout(
            body.imageUrl,
            {
              headers: {
                'User-Agent': SCRAPER_USER_AGENT,
                Referer: refererOrigin,
                Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
              },
            },
            5000
          );
          const arr = await imgRes.arrayBuffer();
          buffer = Buffer.from(arr);
        }
        const uploadRes = await fetchWithTimeout(
          `${session.restRoot}wp/v2/media`,
          {
            method: 'POST',
            headers: {
              Cookie: session.cookieHeader,
              'X-WP-Nonce': session.restNonce,
              'Content-Type': mimeType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
            },
            body: new Uint8Array(buffer),
          },
          6000
        );
        const mediaJson = await uploadRes.json();
        return res.status(200).json({
          ok: uploadRes.ok,
          id: Number(mediaJson.id || 0),
          url: String(mediaJson.source_url || ''),
        });
      }

      // 5. Đẩy bài viết lên WordPress
      const empCode = String(body.employeeCode || 'A0006').trim().toUpperCase();
      const wpAuthorId = resolveWpUserIdByEmployeeCode(empCode);
      const pubTitle = String(body.title || '').trim();
      let pubContent = String(body.content || '').trim();
      let candidateImgs = Array.isArray(body.extractedImages)
        ? body.extractedImages.filter((im) => im && im.url)
        : [];

      if (!/<img\b/i.test(pubContent)) {
        if (candidateImgs.length === 0 && body.sourceUrl) {
          try {
            const scraped = await scrapeWebArticleForSeoRewrite(String(body.sourceUrl));
            candidateImgs = [...scraped.images];
          } catch {}
        }
        if (candidateImgs.length < 5) {
          try {
            const ctxProfile = analyzeArticleSubjectAndContext(
              pubTitle,
              pubContent,
              Array.isArray(body.tags) ? body.tags[0] : undefined,
              candidateImgs
            );
            const excludeKeys = new Set(
              candidateImgs.map((im) =>
                String(im.url || '')
                  .split('?')[0]
                  .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
                  .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
                  .toLowerCase()
              )
            );
            const needed = Math.max(0, 6 - candidateImgs.length);
            if (needed > 0) {
              const ext = await searchExternalRelatedImages(
                ctxProfile.combinedSearchQuery || pubTitle,
                needed,
                excludeKeys,
                ctxProfile
              );
              candidateImgs = [...candidateImgs, ...ext];
            }
          } catch {}
        }
        if (candidateImgs.length === 0 && body.featuredImageUrl) {
          candidateImgs = [{ url: String(body.featuredImageUrl), alt: pubTitle }];
        }
        if (candidateImgs.length > 0) {
          const figureBlocks = candidateImgs.map((img) => {
            const altText = String(img.alt || pubTitle).replace(/"/g, '&quot;');
            const sourceBadge = img.isExternal ? 'Editorial Visual Highlight' : 'Featured Story Moment';
            return `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
          });
          const pParts = pubContent.split(/(<\/p>\s*(?:<br\s*\/?>)?)/i);
          if (pParts.length < 3) {
            pubContent = `${figureBlocks[0]}\n\n${pubContent}\n\n${figureBlocks.slice(1).join('\n\n')}`;
          } else {
            const totalParas = Math.floor(pParts.length / 2);
            const step = Math.max(1, Math.floor(totalParas / (figureBlocks.length + 1)));
            let figIdx = 0;
            let paraCount = 0;
            const out = [];
            for (let i = 0; i < pParts.length; i++) {
              out.push(pParts[i]);
              if (i % 2 === 1) {
                paraCount++;
                if (figIdx < figureBlocks.length && (paraCount % step === 0 || paraCount === totalParas - 1)) {
                  out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
                }
              }
            }
            while (figIdx < figureBlocks.length) {
              out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
            }
            pubContent = out.join('');
          }
        }
      }

      const effectiveFeaturedUrl =
        body.featuredImageUrl || (candidateImgs[0] && candidateImgs[0].url) || '';

      let featuredMediaId = Number(body.featuredMediaId || 0);
      if (!featuredMediaId && (body.featuredImageBase64 || effectiveFeaturedUrl)) {
        try {
          let buffer = null;
          let mimeType = 'image/jpeg';
          if (body.featuredImageBase64) {
            const m = String(body.featuredImageBase64).match(
              /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
            );
            if (m) {
              mimeType = m[1];
              buffer = Buffer.from(m[2], 'base64');
            }
          } else if (effectiveFeaturedUrl) {
            let refererOrigin = DEFAULT_WP_SITE;
            try {
              refererOrigin = `${new URL(String(effectiveFeaturedUrl)).origin}/`;
            } catch {}
            const imgRes = await fetchWithTimeout(
              String(effectiveFeaturedUrl),
              {
                headers: {
                  'User-Agent': SCRAPER_USER_AGENT,
                  Referer: refererOrigin,
                  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                },
              },
              4500
            );
            if (imgRes.ok) {
              const ct = imgRes.headers.get('content-type');
              if (ct && ct.startsWith('image/')) mimeType = ct.split(';')[0];
              const arr = await imgRes.arrayBuffer();
              buffer = Buffer.from(arr);
            }
          }
          if (buffer) {
            const upRes = await fetchWithTimeout(
              `${session.restRoot}wp/v2/media`,
              {
                method: 'POST',
                headers: {
                  Cookie: session.cookieHeader,
                  'X-WP-Nonce': session.restNonce,
                  'Content-Type': mimeType,
                  'Content-Disposition': `attachment; filename="featured-${Date.now()}.jpg"`,
                },
                body: new Uint8Array(buffer),
              },
              5000
            );
            if (upRes.ok) {
              const upJson = await upRes.json();
              if (upJson && upJson.id) featuredMediaId = Number(upJson.id);
            }
          }
        } catch {
          // continue publishing even if featured image upload times out
        }
      }

      const postPayload = {
        title: pubTitle,
        content: pubContent,
        excerpt: String(body.excerpt || '').trim(),
        status: body.status || 'publish',
        author: wpAuthorId,
        categories:
          Array.isArray(body.categories) && body.categories.length > 0 ? body.categories : [2],
      };
      if (body.slug) postPayload.slug = body.slug;
      if (featuredMediaId) postPayload.featured_media = featuredMediaId;

      const endpoint = body.postId
        ? `${session.restRoot}wp/v2/posts/${body.postId}`
        : `${session.restRoot}wp/v2/posts`;

      const wpRes = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            Cookie: session.cookieHeader,
            'X-WP-Nonce': session.restNonce,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postPayload),
        },
        7000
      );
      const created = await wpRes.json();
      if (!wpRes.ok) {
        return res.status(wpRes.status).json({
          ok: false,
          error: (created && created.message) || 'Không thể đẩy bài lên WordPress',
        });
      }
      const cleanLink = String(created.link || `${DEFAULT_WP_SITE}/${created.id}`).replace(
        /\/+$/,
        ''
      );
      const trackingLink = empCode
        ? `${cleanLink}${cleanLink.includes('?') ? '&' : '?'}${empCode}`
        : cleanLink;

      return res.status(200).json({
        ok: true,
        post: {
          id: Number(created.id),
          title: postPayload.title,
          link: cleanLink,
          trackingLink,
          status: created.status || body.status || 'publish',
          slug: String(created.slug || ''),
          date: String(created.date || new Date().toISOString()),
          authorId: wpAuthorId,
          employeeCode: empCode,
        },
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Internal Server Error',
    });
  }
}
