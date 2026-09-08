// GitHub Gist REST client. The token lives only in localStorage on this device;
// it is never written to the repo, never logged, and never sent anywhere but
// api.github.com.
export const FILENAME = 'thaikaraoke-state.json';
const API = 'https://api.github.com';

export class TokenExpired extends Error {
  constructor() { super('token expired, paste a new one'); this.name = 'TokenExpired'; }
}
export class GistConflict extends Error {
  constructor() { super('gist changed while syncing'); this.name = 'GistConflict'; }
}

async function req(token, path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) throw new TokenExpired();
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res;
}

export async function createGist(token, doc) {
  const res = await req(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: 'ThaiKaraoke sync state (private)',
      public: false,
      files: { [FILENAME]: { content: JSON.stringify(doc) } },
    }),
  });
  const j = await res.json();
  return { id: j.id, updatedAt: j.updated_at };
}

// Returns { doc, updatedAt }. doc is null when the gist has no usable payload.
export async function getGist(token, id) {
  const res = await req(token, '/gists/' + encodeURIComponent(id));
  const j = await res.json();
  const file = (j.files || {})[FILENAME];
  if (!file) return { doc: null, updatedAt: j.updated_at };
  let content = file.content;
  // Large payloads come back truncated with a raw_url to fetch instead.
  if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url)).text();
  let doc = null;
  try { doc = JSON.parse(content); } catch (e) { doc = null; }
  return { doc, updatedAt: j.updated_at };
}

// Optimistic concurrency: the caller passes the updated_at it merged against.
// If the gist moved on since then, the write is rejected so we can re-merge.
export async function patchGist(token, id, doc, expectedUpdatedAt) {
  if (expectedUpdatedAt) {
    const cur = await getGist(token, id);
    if (cur.updatedAt && cur.updatedAt !== expectedUpdatedAt) throw new GistConflict();
  }
  const res = await req(token, '/gists/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(doc) } } }),
  });
  const j = await res.json();
  return { id: j.id, updatedAt: j.updated_at };
}
