const FACEBOOK_POST_HOSTNAMES = new Set([
  'facebook.com',
  'm.facebook.com',
  'www.facebook.com',
]);

const FACEBOOK_PLUGIN_URL = 'https://www.facebook.com/plugins/post.php';
const MAX_FACEBOOK_URL_LENGTH = 2048;
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9]+$/;
const PAGE_ID_PATTERN = /^\d+$/;
const PAGE_SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

export type FacebookEmbeddedPost = {
  embedUrl: string;
  sourceUrl: string;
};

export type FacebookUrlClassification =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'page'; sourceUrl: string }
  | { kind: 'embedded-post'; post: FacebookEmbeddedPost };

function canonicalPermalink(url: URL): string | null {
  if (url.pathname !== '/permalink.php') return null;

  const storyId = url.searchParams.get('story_fbid');
  const pageId = url.searchParams.get('id');
  if (
    !storyId ||
    !pageId ||
    storyId.length > 200 ||
    pageId.length > 30 ||
    !EXTERNAL_ID_PATTERN.test(storyId) ||
    !PAGE_ID_PATTERN.test(pageId)
  ) {
    return null;
  }

  const canonical = new URL('https://www.facebook.com/permalink.php');
  canonical.searchParams.set('story_fbid', storyId);
  canonical.searchParams.set('id', pageId);
  return canonical.toString();
}

function canonicalPostsPath(url: URL): string | null {
  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (
    pathSegments.length !== 3 ||
    pathSegments[1] !== 'posts' ||
    !PAGE_SLUG_PATTERN.test(pathSegments[0]) ||
    pathSegments[2].length > 200 ||
    !EXTERNAL_ID_PATTERN.test(pathSegments[2])
  ) {
    return null;
  }

  return `https://www.facebook.com/${encodeURIComponent(pathSegments[0])}/posts/${encodeURIComponent(pathSegments[2])}`;
}

function canonicalPage(url: URL): string | null {
  if (url.pathname === '/profile.php') {
    const pageId = url.searchParams.get('id');
    if (!pageId || pageId.length > 30 || !PAGE_ID_PATTERN.test(pageId)) {
      return null;
    }

    const canonical = new URL('https://www.facebook.com/profile.php');
    canonical.searchParams.set('id', pageId);
    return canonical.toString();
  }

  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (
    pathSegments.length !== 1 ||
    !PAGE_SLUG_PATTERN.test(pathSegments[0]) ||
    ['plugins', 'permalink.php'].includes(pathSegments[0].toLowerCase())
  ) {
    return null;
  }

  return `https://www.facebook.com/${encodeURIComponent(pathSegments[0])}`;
}

export function classifyFacebookUrl(
  value: string | null,
): FacebookUrlClassification {
  const normalizedValue = value?.trim() ?? '';
  if (!normalizedValue) return { kind: 'empty' };
  if (normalizedValue.length > MAX_FACEBOOK_URL_LENGTH) {
    return { kind: 'invalid' };
  }

  let url: URL;
  try {
    url = new URL(normalizedValue);
  } catch {
    return { kind: 'invalid' };
  }

  if (
    url.protocol !== 'https:' ||
    !FACEBOOK_POST_HOSTNAMES.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port
  ) {
    return { kind: 'invalid' };
  }

  const sourceUrl = canonicalPermalink(url) ?? canonicalPostsPath(url);
  if (sourceUrl) {
    const embedUrl = new URL(FACEBOOK_PLUGIN_URL);
    embedUrl.searchParams.set('href', sourceUrl);
    embedUrl.searchParams.set('show_text', 'true');
    embedUrl.searchParams.set('width', '500');

    return {
      kind: 'embedded-post',
      post: {
        embedUrl: embedUrl.toString(),
        sourceUrl,
      },
    };
  }

  const pageUrl = canonicalPage(url);
  return pageUrl
    ? { kind: 'page', sourceUrl: pageUrl }
    : { kind: 'invalid' };
}

export function getFacebookEmbeddedPost(
  value: string | null,
): FacebookEmbeddedPost | null {
  const classification = classifyFacebookUrl(value);
  return classification.kind === 'embedded-post'
    ? classification.post
    : null;
}
