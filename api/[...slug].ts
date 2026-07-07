import { createApp } from "../server/src/app";

// Vercel invokes this exactly like an HTTP request handler, and an Express
// app instance is already a valid `(req, res) => void` handler — so no
// adapter is needed. Socket.io is intentionally NOT started here: it needs a
// persistent process, which serverless functions don't provide. REST routes
// (auth, chats, messages, friends, admin, uploads) work fully; real-time
// push/typing/calls require deploying `server/` to a persistent host later.
export default createApp();
