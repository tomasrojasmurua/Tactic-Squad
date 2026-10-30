// Address of the multiplayer server (server/, Cloudflare Workers). Empty here: the deploy
// (.github/workflows/pages.yml) writes the real one into the published site. Empty = the
// multiplayer shows as unavailable. `?servidor=http://host:port` in the page's address
// overrides it (a local server: scripts/local-server.mjs, or `wrangler dev`).
export const SERVER_URL = '';
