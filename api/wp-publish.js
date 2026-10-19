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
    'Saint', 'Tropez', 'Cannes', 'Rome', 'Malibu', 'Hawaii', 'Manhattan',
    'Cabo', 'San', 'Lucas', 'Ibiza', 'Mallorca', 'Mykonos', 'Santorini', 'Sardinia', 'Capri',
    'Amalfi', 'Positano', 'Portofino', 'Como', 'Venice', 'Milan', 'Tuscany',
    'Bora', 'Tahiti', 'Fiji', 'Maui', 'Kauai', 'Oahu', 'Honolulu', 'Aspen', 'Hamptons',
    'Montauk', 'Palm', 'Springs', 'Miami', 'Beach', 'Lane', 'Hills',
    'Bel', 'Air', 'Calabasas', 'Santa', 'Brentwood', 'tribeca', 'Soho',
    'Notting', 'Hill', 'Mayfair', 'Chelsea', 'Kensington', 'glastonbury', 'Coachella',
    'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter',
    'Facebook', 'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People',
    'Los', 'Angeles', 'New', 'York',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Recognize', 'Them',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Hilton',
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
    'Scroll', 'Stay', 'Read', 'Click', 'Share', 'Watch', 'See', 'Know', 'About',
    'Avalon', 'Getty', 'GettyImages', 'Backgrid', 'Splash', 'Shutterstock', 'WireImage',
    'Fatal', 'Attraction', 'Natural', 'Big', 'Chill', 'World', 'Garp',
    'Die', 'Pulp', 'Fiction', 'Sixth', 'Sense', 'Unbreakable', 'Moonlighting',
    'Matrix', 'Reloaded', 'Revolutions', 'Spectre', 'Malena', 'Irreversible', 'Beetlejuice'
  ]);

  const stopPhrases = new Set([
    'santa monica', 'sandy lane', 'beverly hills', 'palm springs', 'bora bora',
    'saint tropez', 'notting hill', 'new york', 'los angeles', 'miami beach',
    'french riviera', 'cabo san lucas', 'lake como', 'west hollywood', 'west london',
    'south of france', 'byron bay', 'die hard', 'pulp fiction', 'sixth sense',
    'legally blonde', 'morning show', 'dirty dancing', 'ferris bueller', 'big little lies',
    'hello sunshine', 'daily mail', 'page six', 'people magazine', 'golden globes',
    'academy awards', 'real housewives'
  ]);

  const isWednesdayShowContext = /\b(Nevermore|Addams|Ortega|Enid|Morticia|Ophelia|Pugsley|Gomez)\b/i.test(
    `${sample} ${title}`
  );
  if (!isWednesdayShowContext) {
    stopWords.add('Wednesday');
  }

  const exPartnerSet = new Set();
  const exRegex =
    /\b(?:split|divorce|divorced|separated|separation|parted\s+ways)\s+from\s+(?:[a-z-]+\s+){0,3}([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})/gi;
  let exMatch;
  while ((exMatch = exRegex.exec(sample)) !== null) {
    exPartnerSet.add(exMatch[1].trim());
  }

  const stats = new Map();

  const companionRegex =
    /\b(?:with|alongside|beside|and)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|beau)\s*(?:,\s*(?:\d{2}-year-old\s+)?(?:[a-z-]+\s+){0,3})?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set();
  let cm;
  while ((cm = companionRegex.exec(sample.slice(0, 1200))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 3)
      .join(' ');
    if (cName.split(/\s+/).length >= 2 && !stopPhrases.has(cName.toLowerCase())) {
      companionSet.add(cName);
    }
  }

  const nameAgeAfterRegex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)\s*,\s*\d{2}\b/g;
  let nam;
  while ((nam = nameAgeAfterRegex.exec(sample.slice(0, 1200))) !== null) {
    const rawName = nam[1].trim();
    const cleanParts = rawName.split(/\s+/).filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: nam.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 48;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-zA-Z-]+){0,4})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|surgeon|mother|father|icon|legend|winner|daughter|son|director|showrunners?)(?:\s+[a-zA-Z-]+){0,2})\s*,?\s+(?:Dr\.\s+)?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
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
    if (stopPhrases.has(candidate.toLowerCase())) continue;
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
    const leadBonusA = a[1].firstIdx < 80 ? 48 : a[1].firstIdx < 280 ? 36 : a[1].firstIdx < 550 ? 20 : 0;
    const leadBonusB = b[1].firstIdx < 80 ? 48 : b[1].firstIdx < 280 ? 36 : b[1].firstIdx < 550 ? 20 : 0;
    const compPenaltyA = a[1].isCompanion ? -28 : 0;
    const compPenaltyB = b[1].isCompanion ? -28 : 0;
    const exPenaltyA = exPartnerSet.has(a[0]) ? -50 : 0;
    const exPenaltyB = exPartnerSet.has(b[0]) ? -50 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA + exPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB + exPenaltyB;
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
      !exPartnerSet.has(p) &&
      (info.isCompanion || info.bioBoost > 0 || (info.firstIdx < 650 && info.count >= 2)) &&
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

  const visualSceneText = `${imgAltText} ${sample.slice(0, 2400)}`.toLowerCase();
  const outfitKeywords = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver|gothic|monochrome|tailored|oversized|fitted|linen|silk|satin|cashmere|knit|velvet|plunging|strapless|halter|two-piece|one-piece)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|maxi\s+dress|summer\s+dress|sundress|tank\s+top|crop\s+top|t-shirt|tee|shirt|blouse|top|jacket|blazer|coat|trench\s+coat|cardigan|sweater|jumper|hoodie|suit|pantsuit|jumpsuit|jeans|trousers|pants|slacks|skirt|miniskirt|leggings|outfit|ensemble|wardrobe|costume|look|attire|sunglasses|shades|hat|cap|beanie|boots|sneakers|heels|sandals|loafers))\b/gi;
  let om;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 6) {
      outfitKeywords.push(phrase);
    }
  }

  const bodyLower = sample.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'notting hill',
    'west hollywood', 'london', 'malibu', 'new york city', 'new york', 'manhattan',
    'miami beach', 'miami', 'bahamas', 'cabo san lucas', 'cabo', 'caribbean',
    'cannes', 'paris', 'eiffel tower', 'venice', 'beverly hills', 'los angeles',
    'santa monica', 'calabasas', 'brentwood', 'bel-air', 'hamptons', 'montauk',
    'aspen', 'palm springs', 'hawaii', 'maui', 'ibiza', 'mallorca', 'mykonos',
    'santorini', 'amalfi', 'positano', 'portofino', 'lake como', 'sardinia',
    'capri', 'rome', 'milan', 'florence', 'bora bora', 'tahiti', 'fiji',
    'sydney', 'melbourne', 'toronto', 'vancouver', 'tokyo', 'dubai',
    'nevermore academy', 'ireland', 'dublin'
  ];
  const locationKeywords = [];
  for (const loc of locationGlossary) {
    const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locRe = new RegExp(`\\b${escaped}\\b`, 'i');
    if (locRe.test(bodyLower) && locationKeywords.length < 4) {
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
    'pregnancy', 'baby bump', 'stroll', 'walk', 'shopping', 'lunch', 'brunch',
    'dinner', 'coffee', 'kiss', 'kisses', 'holding hands', 'arm-in-arm',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday', 'season 3',
    'season 2', 'netflix', 'filming', 'premiere', 'cast', 'gothic', 'nevermore'
  ];
  const eventKeywords = [];
  for (const ev of eventGlossary) {
    const escaped = ev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const evRe = new RegExp(`\\b${escaped}\\b`, 'i');
    if (
      evRe.test(bodyLower) &&
      eventKeywords.length < 4 &&
      !outfitKeywords.some((o) => o.includes(ev))
    ) {
      eventKeywords.push(ev);
    }
  }

  let articleCategory = 'celebrity_romance_vacation';
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
  } else if (
    /\b(notting\s+hill|neighborhood|stroll|streets?\s+of|sidewalk|cafe|coffee|shopping|london|manhattan|new\s+york|west\s+hollywood|beverly\s+hills)\b/i.test(
      sample
    ) &&
    !/\b(beach|bikini|swimsuit|ocean|surf|waves|sand|yacht|resort|island|tropical)\b/i.test(sample)
  ) {
    articleCategory = 'city_neighborhood_outing';
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

function stripTrackingQueryFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const toRemove = [];
    u.searchParams.forEach((_v, k) => {
      if (
        /^(fbclid|gclid|dclid|msclkid|twclid|ttclid|igshid|mibextid|mc_cid|mc_eid|_ga|_gl|ref|fb_action_ids|fb_action_types|fb_source|utm_[a-z0-9_]+|_aem_[a-z0-9_]*)$/i.test(
          k
        )
      ) {
        toRemove.push(k);
      }
    });
    for (const k of toRemove) u.searchParams.delete(k);
    return u.href;
  } catch {
    return rawUrl;
  }
}

async function scrapeWebArticleForSeoRewrite(rawUrl) {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = stripTrackingQueryFromUrl(cleanUrl);

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

  const cleanBoilerplateTailFromParagraph = (rawTxt) => {
    return rawTxt
      .replace(
        /\s*(?:What|Who|Which) is your (?:absolute )?favorite\b[\s\S]*$/i,
        ''
      )
      .replace(
        /\s*(?:Let['’]s|Drop a comment|Share your thoughts|Tell us in the comments|Sound off in the comments|What do you think\??)\b[\s\S]*$/i,
        ''
      )
      .replace(
        /\s*(?:Scroll down to|Click through to|Stay tuned for|Follow us on)\b[\s\S]*$/i,
        ''
      )
      .trim();
  };

  const isPureBoilerplateLine = (txt) => {
    const lower = txt.toLowerCase();
    return (
      /^(read more|related:|also read|share this|follow us|subscribe|advertisement|sponsored|source:|photo credit|click here|leave a comment|let's swap)/i.test(
        lower
      ) ||
      /^(what|who|which) is your (absolute )?favorite\b/i.test(lower)
    );
  };

  const extractParagraphsFromHtml = (htmlChunk) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const tag = m[1].toLowerCase();
      const rawTxt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      const txt = cleanBoilerplateTailFromParagraph(rawTxt);
      if (!txt || isPureBoilerplateLine(txt)) continue;
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
    if (featUrl) {
      addImage(featUrl, originalTitle, true);
    }

    const contentHtml = String((postJson.content && postJson.content.rendered) || '');
    extractParagraphsFromHtml(contentHtml);
    const contentImgs = collectImgsFromHtml(contentHtml, cleanUrl);
    for (const img of contentImgs) {
      addImage(img.url, img.alt || originalTitle, images.length === 0);
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
              if (mUrl) {
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
          if (ogImg && ogImg[1]) {
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

function extractSpecificFactsFromParagraph(text, profile) {
  const clean = stripHtmlTags(text).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
  const sents = splitIntoSentences(clean);
  const firstSent = sents[0] || clean;
  const secondSent = sents[1] || '';
  const thirdSent = sents[2] || '';

  const quotedMatches = [
    ...(clean.match(/['"“‘]([^'"”’]{3,65})['"”’]/g) || []),
  ].map((q) => q.replace(/^['"“‘]|['"”’]$/g, '').trim());

  const yearMatches = [
    ...(clean.match(/\b(19\d{2}s?|20\d{2}s?|\d{1,2}-year-old|\d+\s+years?\b)/gi) || []),
  ];

  const stopSet = new Set([
    'The', 'In', 'On', 'At', 'For', 'With', 'From', 'Into', 'During', 'After', 'Before',
    'While', 'When', 'Where', 'Although', 'Because', 'Since', 'Unless', 'Until', 'Whether',
    'However', 'Moreover', 'Furthermore', 'Meanwhile', 'Instead', 'Beyond', 'Across',
    'Through', 'Between', 'Among', 'Around', 'Inside', 'Outside', 'Behind', 'Beneath',
    'Despite', 'Throughout', 'Alongside', 'Besides', 'Looking', 'Taking', 'Building',
    'Examining', 'Further', 'Adding', 'Bringing', 'Focusing', 'Tracing', 'Stepping',
    'Unpacking', 'Delving', 'Considering', 'Reflecting', 'Revisiting', 'Expanding',
    'According', 'Speaking', 'Walking', 'Strolling', 'Wearing', 'Sporting', 'Showing',
    'Sharing', 'Enjoying', 'Celebrating', 'Appearing', 'Making', 'Keeping', 'Proving',
    'He', 'She', 'They', 'Her', 'His', 'Their', 'This', 'That', 'These', 'Those',
    'Both', 'Each', 'Every', 'Many', 'Most', 'Some', 'Such', 'Other', 'Another',
  ]);
  const properPhrases = [];
  const propRe =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,18}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,18}){0,2})\b/g;
  let pm;
  while ((pm = propRe.exec(clean)) !== null) {
    const phrase = pm[1].trim();
    const firstWord = phrase.split(/\s+/)[0].replace(/['’]s$/i, '');
    if (stopSet.has(firstWord)) continue;
    if (!properPhrases.includes(phrase) && properPhrases.length < 8) {
      properPhrases.push(phrase);
    }
  }

  const visualPhrases = [];
  const visRe =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering|glittering|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard|denim|leather|lace|sheer|sequin|silver|tailored|oversized|fitted|linen|silk|satin|cashmere|knit|velvet|casual|relaxed)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|top|shirt|blouse|jacket|blazer|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble|wardrobe|sunglasses|look|attire))\b/gi;
  let vm;
  while ((vm = visRe.exec(clean)) !== null) {
    const vp = vm[1].trim();
    if (!visualPhrases.some((x) => x.toLowerCase() === vp.toLowerCase()) && visualPhrases.length < 5) {
      visualPhrases.push(vp);
    }
  }

  return {
    clean,
    sents,
    firstSent,
    secondSent,
    thirdSent,
    quotedMatches,
    yearMatches,
    properPhrases,
    visualPhrases,
    primary: profile.primaryPerson || profile.subjectDisplay || 'the star',
    secondary: profile.secondaryPerson || '',
  };
}

function expandFactBlockToAround150Words({
  baseFactText,
  contextProfile,
  allFactsPool,
  language,
  paragraphIndex,
}) {
  const extracted = extractSpecificFactsFromParagraph(baseFactText, contextProfile);
  const cleanBase = extracted.clean;
  const primary = extracted.primary;
  const secondary = extracted.secondary;
  const coupleOrSubject = secondary ? `${primary} and ${secondary}` : primary;

  const supList = contextProfile.supportingEntities || [];
  const localEntities = extracted.properPhrases.filter(
    (p) =>
      !primary.toLowerCase().includes(p.toLowerCase()) &&
      (!secondary || !secondary.toLowerCase().includes(p.toLowerCase()))
  );
  const anchorEntity =
    localEntities[0] ||
    (supList.length > 0 ? supList[paragraphIndex % supList.length] : '') ||
    coupleOrSubject;
  const secondAnchorEntity =
    localEntities[1] ||
    (supList.length > 1 ? supList[(paragraphIndex + 1) % supList.length] : '') ||
    primary;

  const loc =
    contextProfile.locationKeywords && contextProfile.locationKeywords.length > 0
      ? contextProfile.locationKeywords
          .slice(0, 2)
          .map((l) => l.replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(' and ')
      : '';
  const visualDetail =
    extracted.visualPhrases[0] ||
    (contextProfile.outfitKeywords && contextProfile.outfitKeywords.length > 0
      ? contextProfile.outfitKeywords[paragraphIndex % contextProfile.outfitKeywords.length]
      : '');
  const timeDetail =
    extracted.yearMatches[0] ||
    (contextProfile.timeframeKeywords && contextProfile.timeframeKeywords.length > 0
      ? contextProfile.timeframeKeywords[paragraphIndex % contextProfile.timeframeKeywords.length]
      : '');
  const quotedWork = extracted.quotedMatches[0] || '';

  let combined = cleanBase;
  if (combined.split(/\s+/).filter(Boolean).length < 42 && allFactsPool && allFactsPool.length > 1) {
    const nextFact = allFactsPool[(paragraphIndex + 1) % allFactsPool.length];
    if (nextFact && !combined.includes(nextFact.slice(0, 28))) {
      combined = `${combined} ${nextFact}`;
    }
  }

  const factBridgeSentences =
    language === 'vi'
      ? [
          `Chi tiết thực tế này trong bài viết làm nổi bật hình ảnh của ${coupleOrSubject}${visualDetail ? ` gắn liền với nét đặc trưng ${visualDetail}` : ''}${loc ? ` tại ${loc}` : ''}, mang đến cái nhìn trực quan và sát với ngữ cảnh câu chuyện.`,
          `Khi đặt dữ kiện xoay quanh ${anchorEntity}${quotedWork ? ` cùng dấu ấn "${quotedWork}"` : ''}${timeDetail ? ` vào cột mốc ${timeDetail}` : ''} cạnh các chi tiết trong ảnh minh họa, người đọc dễ dàng nhận ra mạch phát triển tự nhiên và nhất quán của nhân vật.`,
          `Từng chi tiết được ghi lại trong đoạn văn và khung hình minh họa đều cho thấy phong thái đời thường chân thực của ${primary}${secondary ? ` bên cạnh ${secondary}` : ''}, hoàn toàn tách biệt khỏi những đồn đoán bên ngoài.`,
          `Bên cạnh đó, mối liên hệ thực tế giữa ${coupleOrSubject} và ${secondAnchorEntity}${loc ? ` ở ${loc}` : ''} góp phần giải thích rõ nét hơn bối cảnh xuất hiện trong loạt ảnh của bài viết.`,
          `Nhìn từ tổng thể các đoạn văn gốc, câu chuyện về ${coupleOrSubject}${timeDetail ? ` (${timeDetail})` : ''} không chỉ dừng lại ở một khoảnh khắc đơn lẻ mà còn phản ánh trọn vẹn hành trình sự nghiệp lẫn cuộc sống riêng.`,
          `Qua từng góc máy minh họa kết hợp cùng thông tin xác thực về ${anchorEntity}, bài viết khắc họa sống động sức hút bền bỉ của ${primary} trong lòng công chúng.`,
        ]
      : [
          `Looking closely at the specific details documented in this passage and the accompanying photographs, ${coupleOrSubject}${visualDetail ? `—captured with ${visualDetail}—` : ' '}projected an unmistakable sense of ease${loc ? ` in ${loc}` : ''} that immediately grounded the scene.`,
          `Connecting the context around ${anchorEntity}${quotedWork ? ` and "${quotedWork}"` : ''}${timeDetail ? ` from ${timeDetail}` : ''} directly to the visual moments in the report illustrates how naturally ${primary}'s personal and professional chapters intersect.`,
          `Every concrete observation in the paragraph—from the candid body language of ${coupleOrSubject} to the surrounding atmosphere${loc ? ` of ${loc}` : ''}—reinforces why these unscripted snapshots resonate far more deeply than staged publicity appearances.`,
          `At the same time, the documented link involving ${secondAnchorEntity}${visualDetail ? ` alongside the ${visualDetail} aesthetic` : ''} adds vital texture to the story, giving readers a complete view of what transpired behind the lens.`,
          `Tracing how ${primary}${secondary ? ` and ${secondary}` : ''} navigated this chapter${timeDetail ? ` around ${timeDetail}` : ''} reveals a consistent pattern of authenticity, where quiet real-world moments speak volumes about their bond and priorities.`,
          `Taken alongside the illustrative photographs in the article, these verified details surrounding ${anchorEntity} and ${coupleOrSubject} bring clarity and depth to every frame captured during the outing.`,
          `Rather than relying on spectacle, the genuine dynamic between ${coupleOrSubject}${loc ? ` while spending time in ${loc}` : ''} highlights a grounded, self-assured presence that longtime admirers immediately recognize.`,
          `Furthermore, the interplay between ${primary}'s established career milestones${quotedWork ? ` such as "${quotedWork}"` : ''} and the relaxed reality shown in the photos underscores how seamlessly the pieces of this narrative fit together.`,
        ];

  let attempt = 0;
  while (
    combined.split(/\s+/).filter(Boolean).length < 142 &&
    attempt < factBridgeSentences.length
  ) {
    const addon =
      factBridgeSentences[(paragraphIndex * 2 + attempt) % factBridgeSentences.length];
    if (!combined.includes(addon.slice(0, 32))) {
      combined = `${combined} ${addon}`;
    }
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 175) {
    const sliced = finalWords.slice(0, 164).join(' ');
    const lastDot = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? ')
    );
    if (lastDot > 480) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

function buildHeadingForParagraph(unitText, profile, headingIndex, originalHeadings, language) {
  const cleanOrig = (originalHeadings || [])
    .map((h) => h.replace(/^##\s*/, '').trim())
    .filter((h) => h.length >= 8 && h.length <= 110);
  if (headingIndex < cleanOrig.length) {
    return cleanOrig[headingIndex];
  }

  const isVi = language === 'vi';
  const extracted = extractSpecificFactsFromParagraph(unitText, profile);
  const primary = extracted.primary;
  const secondary = extracted.secondary;
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const loc =
    profile.locationKeywords && profile.locationKeywords[0]
      ? profile.locationKeywords[0].replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
  const visual =
    extracted.visualPhrases[0] ||
    (profile.outfitKeywords && profile.outfitKeywords[headingIndex % profile.outfitKeywords.length]) ||
    '';
  const time =
    extracted.yearMatches[0] ||
    (profile.timeframeKeywords && profile.timeframeKeywords[headingIndex % profile.timeframeKeywords.length]) ||
    '';
  const quote = extracted.quotedMatches[0] || '';
  const localEntity =
    extracted.properPhrases.find(
      (p) =>
        !primary.toLowerCase().includes(p.toLowerCase()) &&
        (!secondary || !secondary.toLowerCase().includes(p.toLowerCase()))
    ) || '';

  if (isVi) {
    const viTemplates = [
      `${subjectPair}${loc ? ` Tại ${loc}` : ''}: Chi Tiết Thực Tế Trong Từng Khung Hình`,
      `Dấu Ấn Của ${primary}${quote ? ` Với "${quote}"` : localEntity ? ` Cùng ${localEntity}` : ''} Trong Bài Viết`,
      `Phong Thái Đời Thường${visual ? ` (${visual})` : ''} Của ${subjectPair} Qua Ảnh Minh Họa`,
      `Bối Cảnh Câu Chuyện${time ? ` Năm ${time}` : ''}${loc ? ` Ở ${loc}` : ''} Và Những Dữ Kiện Đáng Chú Ý`,
      `Mối Gắn Kết Giữa ${subjectPair}${localEntity ? ` Và ${localEntity}` : ''} Nhìn Từ Nội Dung Chính`,
      `Toàn Cảnh Hành Trình Của ${primary} Qua Các Đoạn Văn Gốc`,
    ];
    return viTemplates[headingIndex % viTemplates.length];
  }

  const enTemplates = [
    `${subjectPair}${loc ? ` in ${loc}` : ''}: Inside the Candid Moments Captured on Camera`,
    `${primary}'s Journey${quote ? ` From "${quote}"` : localEntity ? ` Alongside ${localEntity}` : ''} and Key Story Details`,
    `Effortless Style and Real-World Chemistry${visual ? `: The ${visual} Look` : ` of ${subjectPair}`}`,
    `Timeline and Context${time ? ` (${time})` : ''}: What the Article Reveals About ${subjectPair}`,
    `Behind the Photographs: ${localEntity || subjectPair}${loc ? ` in ${loc}` : ''} and Notable Highlights`,
    `How ${subjectPair} Balances Career Milestones With Private Moments`,
    `Closer Look at the Visual Details and Background Surrounding ${primary}`,
  ];
  return enTemplates[headingIndex % enTemplates.length];
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
    const cleanedLine = line
      .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite\b[\s\S]*$/i, '')
      .replace(/\s*(?:Let['’]s|Drop a comment|Share your thoughts|Tell us in the comments)\b[\s\S]*$/i, '')
      .trim();
    if (!cleanedLine) continue;

    if (cleanedLine.startsWith('## ')) {
      originalHeadings.push(cleanedLine.replace(/^##\s*/, '').trim());
    } else if (
      cleanedLine.length >= 12 &&
      cleanedLine.length <= 85 &&
      !/[.!]$/.test(cleanedLine) &&
      (cleanedLine.endsWith('?') || /^[a-z0-9\s'’“-]+$/i.test(cleanedLine))
    ) {
      originalHeadings.push(cleanedLine);
    } else if (cleanedLine.length >= 25) {
      sourceParagraphs.push(cleanedLine);
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
      for (const s of sents) {
        factUnits.push(s);
      }
    } else if (sents.length === 2) {
      factUnits.push(sents[0]);
      factUnits.push(sents[1]);
    } else if (sp.length >= 25) {
      factUnits.push(sp);
    }
  }

  const primary = profile.primaryPerson || profile.subjectDisplay || 'the star';
  const secondary = profile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const locs = (profile.locationKeywords || []).map((l) =>
    l.replace(/\b\w/g, (c) => c.toUpperCase())
  );
  const outfits = profile.outfitKeywords || [];

  let synIdx = 0;
  while (factUnits.length < 15 && synIdx < Math.max(allSourceSentences.length * 2, 15)) {
    if (allSourceSentences.length > 0) {
      const sA = allSourceSentences[synIdx % allSourceSentences.length];
      const sB =
        allSourceSentences[(synIdx + 2) % allSourceSentences.length] || '';
      const imageContextNote =
        images[synIdx % Math.max(images.length, 1)]?.alt &&
        images[synIdx % Math.max(images.length, 1)]?.alt !== articleTitle
          ? images[synIdx % Math.max(images.length, 1)].alt
          : '';

      const prefix = isVi
        ? `Phân tích sát theo mạch nội dung và hình ảnh minh họa trong bài${imageContextNote ? ` (${imageContextNote})` : ''}:`
        : `Examining the documented details and visual evidence from the story${imageContextNote ? ` (${imageContextNote})` : ''}:`;

      const combinedUnit =
        sB && sB !== sA ? `${prefix} ${sA} ${sB}` : `${prefix} ${sA}`;
      factUnits.push(combinedUnit);
    } else {
      const fallbackUnit = isVi
        ? `Trong các đoạn văn và hình ảnh minh họa của bài viết, câu chuyện xoay quanh ${subjectPair}${locs[0] ? ` tại ${locs[0]}` : ''}${outfits[0] ? ` với trang phục ${outfits[0]}` : ''} được khắc họa rõ nét qua từng khoảnh khắc thực tế.`
        : `Across the paragraphs and illustrative photographs of the report, the story of ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` featuring ${outfits[0]}` : ''} unfolds through specific, real-world moments.`;
      factUnits.push(fallbackUnit);
    }
    synIdx++;
  }

  const targetUnits = factUnits.slice(0, 18);
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
      h2ForPara = buildHeadingForParagraph(
        unitText,
        profile,
        h2Index,
        originalHeadings,
        language
      );
    }

    finalParagraphs150Words.push({
      h2: h2ForPara,
      text: expanded150,
    });
  });

  const htmlBlocks = [];
  const totalParas = finalParagraphs150Words.length;
  let imgIdx = 0;

  const buildImageCaptionFromParagraphs = (img, displayNum) => {
    const rawAlt = String((img && img.alt) || '').trim();
    const isGenericOrCuriosityAlt =
      !rawAlt ||
      rawAlt === articleTitle ||
      /\?$|\b(recognize|who are they|who is he|who is she|article image|key photo|story image)\b/i.test(
        rawAlt
      );
    if (!isGenericOrCuriosityAlt && rawAlt.length >= 12) {
      return rawAlt;
    }
    if (allSourceSentences.length > 0) {
      const matchingSent =
        allSourceSentences[(displayNum - 1) % allSourceSentences.length] || '';
      const shortSent = matchingSent.split(/\s+/).slice(0, 18).join(' ').replace(/[,:;]+$/, '');
      if (shortSent.length >= 15) {
        return `${subjectPair}: ${shortSent}${shortSent.endsWith('.') ? '' : '...'}`;
      }
    }
    return `${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` (${outfits[0]})` : ''} - Photo #${displayNum}`;
  };

  const renderFigureBlock = (img, displayNum) => {
    const cleanAlt = buildImageCaptionFromParagraphs(img, displayNum);
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

async function tryDiscoverSourceArticleImagesFromText(rawTitle, rawBodyText) {
  const candidateOrigins = ['https://beaware.fun'];
  const slugFromTitle = String(rawTitle || '')
    .toLowerCase()
    .replace(/['’"“”?!:;,.()[\]]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const firstSentence = splitIntoSentences(rawBodyText)[0] || '';
  const searchSnippet = firstSentence
    .split(/\s+/)
    .slice(0, 9)
    .join(' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const origin of candidateOrigins) {
    try {
      if (slugFromTitle && slugFromTitle.length >= 12) {
        const slugUrl = `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slugFromTitle)}&_embed`;
        const res = await fetchWithTimeout(
          slugUrl,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr[0] && arr[0].link) {
            const scraped = await scrapeWebArticleForSeoRewrite(String(arr[0].link));
            if (scraped.images.length > 0) {
              return {
                title: scraped.originalTitle,
                excerpt: scraped.originalExcerpt,
                articleText: scraped.articleText,
                sourceUrl: scraped.sourceUrl,
                images: scraped.images,
              };
            }
          }
        }
      }

      if (searchSnippet && searchSnippet.length >= 18) {
        const searchUrl = `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchSnippet)}&per_page=3&_embed`;
        const res = await fetchWithTimeout(
          searchUrl,
          { headers: { 'User-Agent': SCRAPER_USER_AGENT } },
          3500
        );
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            const probeWords = searchSnippet.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
            const matchedPost =
              arr.find((p) =>
                stripHtmlTags(String((p && p.content && p.content.rendered) || ''))
                  .toLowerCase()
                  .includes(probeWords)
              ) || arr[0];
            if (matchedPost && matchedPost.link) {
              const scraped = await scrapeWebArticleForSeoRewrite(String(matchedPost.link));
              if (scraped.images.length > 0) {
                return {
                  title: scraped.originalTitle,
                  excerpt: scraped.originalExcerpt,
                  articleText: scraped.articleText,
                  sourceUrl: scraped.sourceUrl,
                  images: scraped.images,
                };
              }
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

async function generateSeoArticleWithAiFast(params) {
  const language = params.language === 'vi' ? 'vi' : 'en';
  let scrapedImages = [];
  let sourceTitle = params.existingTitle ? cleanScrapedTitle(params.existingTitle) : '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  const extractNonImageHttpUrl = (inputStr) => {
    const matches = String(inputStr || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const rawM of matches) {
      const cleaned = rawM.replace(/[),.;]+$/, '');
      if (!/\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i.test(cleaned) && !/youtube\.com|youtu\.be/i.test(cleaned)) {
        return cleaned;
      }
    }
    return '';
  };

  const urlToScrape =
    String(params.sourceUrl || '').trim() ||
    extractNonImageHttpUrl(params.topic) ||
    extractNonImageHttpUrl(params.existingContent);

  if (urlToScrape) {
    try {
      const scraped = await scrapeWebArticleForSeoRewrite(urlToScrape);
      scrapedImages = scraped.images;
      if (!sourceTitle) sourceTitle = scraped.originalTitle;
      sourceExcerpt = scraped.originalExcerpt;
      sourceArticleText = scraped.articleText;
      resolvedSourceUrl = scraped.sourceUrl;
    } catch (err) {
      if (params.mode === 'from_url') throw err;
    }
  }

  const rawHtmlOrText = [params.topic, params.existingContent]
    .map((s) => String(s || '').trim())
    .filter((s) => s && s !== sourceTitle && s !== urlToScrape)
    .join('\n\n');

  if (!sourceArticleText && rawHtmlOrText) {
    const extractedParas = [];
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let pm;
    while ((pm = pRegex.exec(rawHtmlOrText)) !== null) {
      const cleanP = stripHtmlTags(pm[2])
        .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
        .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanP.length >= 20 && !extractedParas.includes(cleanP)) {
        extractedParas.push(cleanP);
      }
    }

    if (extractedParas.length > 0) {
      sourceArticleText = extractedParas.join('\n\n');
    } else {
      sourceArticleText = stripHtmlTags(rawHtmlOrText)
        .replace(/https?:\/\/[^\s"'<>]+/gi, '')
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 20)
        .join('\n\n');
    }
  }

  if (Array.isArray(params.existingImages) && params.existingImages.length > 0) {
    const seen = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const ex of params.existingImages) {
      if (!ex || !ex.url) continue;
      const k = String(ex.url).split('?')[0].toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        scrapedImages.push({
          url: String(ex.url),
          alt: String(ex.alt || sourceTitle || 'Article Image'),
          isFeatured: scrapedImages.length === 0,
          isExternal: Boolean(ex.isExternal),
        });
      }
    }
  }

  if (params.existingContent || params.topic) {
    const existingImgs = collectImgsFromHtml(
      `${params.topic || ''}\n${params.existingContent || ''}`,
      resolvedSourceUrl || DEFAULT_WP_SITE
    );
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

  if (scrapedImages.length === 0 && (sourceTitle || sourceArticleText)) {
    const discovered = await tryDiscoverSourceArticleImagesFromText(
      sourceTitle || params.topic,
      sourceArticleText || params.existingContent || params.topic
    );
    if (discovered && discovered.images.length > 0) {
      scrapedImages = discovered.images;
      if (!sourceTitle && discovered.title) sourceTitle = discovered.title;
      if (!sourceExcerpt && discovered.excerpt) sourceExcerpt = discovered.excerpt;
      if (!sourceArticleText && discovered.articleText) sourceArticleText = discovered.articleText;
      if (!resolvedSourceUrl && discovered.sourceUrl) resolvedSourceUrl = discovered.sourceUrl;
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

  const neededExternalCount =
    scrapedImages.length >= 5 ? 0 : Math.max(0, 6 - scrapedImages.length);

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
          existingTitle: body.existingTitle ? String(body.existingTitle) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
          existingImages: Array.isArray(body.existingImages) ? body.existingImages : undefined,
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

      // 3. Xử lý tìm thêm ảnh ngoài (hoặc tự động dò ảnh bài gốc nếu chưa có ảnh gốc)
      if (action === 'search_external_images') {
        const query = String(body.query || '');
        let existingImgs = Array.isArray(body.existingImages) ? body.existingImages : [];
        let discoveredOrigImgs = [];

        if (existingImgs.filter((im) => im && !im.isExternal).length === 0) {
          const urlMatch = String(body.articleText || body.query || '').match(
            /https?:\/\/[^\s"'<>]+/i
          );
          const urlCandidate =
            String(body.sourceUrl || '').trim() || (urlMatch ? urlMatch[0] : '');
          if (urlCandidate) {
            try {
              const scraped = await scrapeWebArticleForSeoRewrite(urlCandidate);
              if (scraped.images.length > 0) {
                discoveredOrigImgs = scraped.images.map((im, idx) => ({
                  url: im.url,
                  alt: im.alt || scraped.originalTitle || String(body.title || ''),
                  isFeatured: idx === 0,
                  isExternal: false,
                }));
              }
            } catch {}
          }
          if (discoveredOrigImgs.length === 0 && (body.title || body.articleText)) {
            const disc = await tryDiscoverSourceArticleImagesFromText(
              String(body.title || query),
              String(body.articleText || query)
            );
            if (disc && disc.images.length > 0) {
              discoveredOrigImgs = disc.images.map((im, idx) => ({
                url: im.url,
                alt: im.alt || disc.title || String(body.title || ''),
                isFeatured: idx === 0,
                isExternal: false,
              }));
            }
          }
          if (discoveredOrigImgs.length > 0) {
            existingImgs = [...discoveredOrigImgs, ...existingImgs];
          }
        }

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
        const neededCount =
          discoveredOrigImgs.length >= 5
            ? 0
            : Math.max(0, Number(body.limit || 6) - discoveredOrigImgs.length);
        const extImages =
          neededCount > 0
            ? await searchExternalRelatedImages(
                (ctxProfile && ctxProfile.combinedSearchQuery) || query,
                neededCount,
                excludeKeys,
                ctxProfile
              )
            : [];
        return res.status(200).json({
          ok: true,
          images: [...discoveredOrigImgs, ...extImages],
          originalImages: discoveredOrigImgs,
        });
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
