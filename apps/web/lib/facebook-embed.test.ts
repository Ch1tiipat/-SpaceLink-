/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this test directly. */
const facebookAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: facebookTest }: typeof import('node:test') = require('node:test');
const { classifyFacebookUrl, getFacebookEmbeddedPost } = require(
  './facebook-embed.ts',
) as typeof import('./facebook-embed');

const APPROVED_POST_URL =
  'https://www.facebook.com/permalink.php?story_fbid=pfbid0tnM7mhDXkzgNMHR7Gnkupo1J6KiGuAa2sY8AUagqDTBQx9n7o7abZfQxxrQEewGjl&id=61594183376080';

facebookTest('builds an official plugin URL for the approved public post', () => {
  const result = getFacebookEmbeddedPost(APPROVED_POST_URL);

  facebookAssert.ok(result);
  facebookAssert.equal(result.sourceUrl, APPROVED_POST_URL);

  const embedUrl = new URL(result.embedUrl);
  facebookAssert.equal(embedUrl.origin, 'https://www.facebook.com');
  facebookAssert.equal(embedUrl.pathname, '/plugins/post.php');
  facebookAssert.equal(embedUrl.searchParams.get('href'), APPROVED_POST_URL);
  facebookAssert.equal(embedUrl.searchParams.get('show_text'), 'true');
  facebookAssert.equal(embedUrl.searchParams.get('width'), '500');
});

facebookTest('removes tracking parameters from a Facebook permalink', () => {
  const result = getFacebookEmbeddedPost(
    `${APPROVED_POST_URL}&ref=embed_post&utm_source=test#comments`,
  );

  facebookAssert.equal(result?.sourceUrl, APPROVED_POST_URL);
});

facebookTest('accepts the standard Facebook page posts path', () => {
  const result = getFacebookEmbeddedPost(
    'https://m.facebook.com/SpaceLink.SUT/posts/pfbid0123456789?ref=share',
  );

  facebookAssert.equal(
    result?.sourceUrl,
    'https://www.facebook.com/SpaceLink.SUT/posts/pfbid0123456789',
  );
});

facebookTest('does not embed a Facebook Page URL because it is not a post', () => {
  facebookAssert.equal(
    getFacebookEmbeddedPost('https://www.facebook.com/SpaceLink.SUT'),
    null,
  );
});

facebookTest('rejects non-HTTPS and credential-bearing URLs', () => {
  facebookAssert.equal(
    getFacebookEmbeddedPost(
      'http://www.facebook.com/permalink.php?story_fbid=123&id=456',
    ),
    null,
  );
  facebookAssert.equal(
    getFacebookEmbeddedPost(
      'https://user:password@www.facebook.com/permalink.php?story_fbid=123&id=456',
    ),
    null,
  );
});

facebookTest('rejects lookalike domains, plugin URLs, and unsafe schemes', () => {
  const rejectedUrls = [
    'https://facebook.com.example.test/permalink.php?story_fbid=123&id=456',
    'https://evilfacebook.com/permalink.php?story_fbid=123&id=456',
    'https://www.facebook.com/plugins/post.php?href=https://example.test',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ];

  for (const value of rejectedUrls) {
    facebookAssert.equal(getFacebookEmbeddedPost(value), null, value);
  }
});

facebookTest('rejects malformed or incomplete post identifiers', () => {
  const rejectedUrls = [
    'https://www.facebook.com/permalink.php?story_fbid=123',
    'https://www.facebook.com/permalink.php?story_fbid=123&id=not-a-page-id',
    'https://www.facebook.com/permalink.php?story_fbid=%3Cscript%3E&id=456',
    'https://www.facebook.com/SpaceLink.SUT/posts/',
    'https://www.facebook.com/SpaceLink.SUT/posts/123/extra',
  ];

  for (const value of rejectedUrls) {
    facebookAssert.equal(getFacebookEmbeddedPost(value), null, value);
  }
});

facebookTest('returns null for missing, invalid, or oversized input', () => {
  facebookAssert.equal(getFacebookEmbeddedPost(null), null);
  facebookAssert.equal(getFacebookEmbeddedPost('not a URL'), null);
  facebookAssert.equal(
    getFacebookEmbeddedPost(`https://www.facebook.com/${'a'.repeat(2100)}`),
    null,
  );
});

facebookTest('classifies an empty Facebook value as optional', () => {
  facebookAssert.deepEqual(classifyFacebookUrl('   '), { kind: 'empty' });
  facebookAssert.deepEqual(classifyFacebookUrl(null), { kind: 'empty' });
});

facebookTest('classifies the approved public post for the Admin preview', () => {
  const result = classifyFacebookUrl(APPROVED_POST_URL);

  facebookAssert.equal(result.kind, 'embedded-post');
  if (result.kind === 'embedded-post') {
    facebookAssert.equal(result.post.sourceUrl, APPROVED_POST_URL);
  }
});

facebookTest('classifies supported Facebook Page URLs without claiming an embed', () => {
  facebookAssert.deepEqual(
    classifyFacebookUrl(
      'https://www.facebook.com/profile.php?id=61594183376080&utm_source=test#about',
    ),
    {
      kind: 'page',
      sourceUrl:
        'https://www.facebook.com/profile.php?id=61594183376080',
    },
  );
  facebookAssert.deepEqual(
    classifyFacebookUrl('https://m.facebook.com/SpaceLink.SUT?ref=share'),
    {
      kind: 'page',
      sourceUrl: 'https://www.facebook.com/SpaceLink.SUT',
    },
  );
});

facebookTest('rejects unsafe Admin Facebook input before saving', () => {
  const rejectedValues = [
    '<iframe src="https://www.facebook.com/plugins/post.php"></iframe>',
    'http://www.facebook.com/SpaceLink.SUT',
    'https://facebook.com.evil.example/SpaceLink.SUT',
    'https://user:password@www.facebook.com/SpaceLink.SUT',
    'https://www.facebook.com:444/SpaceLink.SUT',
    'https://www.facebook.com/plugins/post.php?href=https://example.test',
  ];

  for (const value of rejectedValues) {
    facebookAssert.deepEqual(
      classifyFacebookUrl(value),
      { kind: 'invalid' },
      value,
    );
  }
});
