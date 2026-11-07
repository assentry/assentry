// Vercel serverless entry point: every request (see vercel.json rewrites)
// is handled by the same Express app that `npm start` runs, compiled to dist/.
require("dotenv/config");
module.exports = require("../dist/app").default;
