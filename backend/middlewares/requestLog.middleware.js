// One short line per request in the production logs, e.g. "POST /api/auth/login 401 12ms": enough to spot
// errors and slow endpoints. Only the path is written, never the query string (it can hold search words
// or an email), and never bodies or cookies (passwords, codes, session tokens).
const requestLog = (req, res, next) => {
    // Render's health check calls this every few seconds; logging it would drown out everything else.
    if (req.path === "/api/health") return next();

    const start = performance.now();
    res.once("finish", () => {
        const path = req.originalUrl.split("?")[0];
        console.log(`${req.method} ${path} ${res.statusCode} ${Math.round(performance.now() - start)}ms`);
    });
    next();
};

export default requestLog;
