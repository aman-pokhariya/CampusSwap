# CampusSwap

The trusted marketplace for your campus: buy, sell, rent, swap or give away anything, with verified students only.

> 🚧 In progress. A full README with screenshots and an architecture diagram is coming in Chunk 7.

## Tech stack

- **Frontend:** React 19, Vite, Redux Toolkit, React Router 7, Tailwind CSS v4
- **Backend:** Node.js, Express 5, MongoDB + Mongoose, JWT in HttpOnly cookies, Zod, Helmet, rate limiting

## Run it locally

You need Node.js 20+ and a MongoDB Atlas connection string.

```bash
# 1. Install everything (root, backend and frontend)
npm run setup

# 2. Create backend/.env from the example and fill in MONGO_URI and JWT_SECRET
cp backend/.env.example backend/.env

# 3. Add the campuses (safe to run again any time)
npm run seed

# 4. Start the API (port 8084) and the web app (port 5173) together
npm run dev
```

Open http://localhost:5173.

In development, OTP codes are printed in the terminal, so you can test with any seeded campus email,
for example `you@campusswap.dev` (the demo campus).

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the backend and frontend together |
| `npm run seed` | Creates or updates campuses from `backend/seed/campuses.data.js` |
| `npm run make-admin --prefix backend -- you@college.edu` | Gives an account the admin role |
| `npm run build` | Builds the frontend for production |
