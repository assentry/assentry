import "dotenv/config";
import app from "./app";

// Long-running server (local development, or any host that runs `npm start`).
// On Vercel the same app is served by api/index.js instead.
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Assentry core listening on http://localhost:${port}`);
});
