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

export function getFacebookEmbeddedPost(
  value: string | null,
): FacebookEmbeddedPost | null {
  if (!value || value.length > MAX_FACEBOOK_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    !FACEBOOK_POST_HOSTNAMES.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port
  ) {
    return null;
  }

  const sourceUrl = canonicalPermalink(url) ?? canonicalPostsPath(url);
  if (!sourceUrl) return null;

  const embedUrl = new URL(FACEBOOK_PLUGIN_URL);
  embedUrl.searchParams.set('href', sourceUrl);
  embedUrl.searchParams.set('show_text', 'true');
  embedUrl.searchParams.set('width', '500');

  return {
    embedUrl: embedUrl.toString(),
    sourceUrl,
  };
}
