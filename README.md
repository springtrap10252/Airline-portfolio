# Springfall Airlines

Premium airline booking system with authentication and seat selection.

## Setup

1. Clone the repository.
2. Run `npm install`.
3. Set up PostgreSQL database:
   - Create a PostgreSQL database (local or cloud)
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string
   - Update `JWT_SECRET` with a secure random string
4. Start the app with `npm start`.

## Database

This application uses PostgreSQL for data persistence. The database tables are automatically created when the server starts.

### Local PostgreSQL Setup

If running locally, install PostgreSQL and create a database:

```bash
# Example for local PostgreSQL
DATABASE_URL=postgresql://username:password@localhost:5432/airline_db
```

### Cloud PostgreSQL

For production deployment, use a cloud PostgreSQL service like:
- Railway PostgreSQL (automatically provided)
- Supabase
- Neon
- ElephantSQL

## Deployment

This project includes a Node backend and should be deployed to a Node-compatible host.

### Recommended free hosts

- Railway: https://railway.app (includes PostgreSQL)
- Render: https://render.com
- Fly.io: https://fly.io

### Quick deploy steps

1. Create an account on your chosen host.
2. Connect your GitHub repo.
3. Set the build command to `npm install`.
4. Set the start command to `npm start`.
5. Add environment variables:
   - `JWT_SECRET` with a secure random value
   - `DATABASE_URL` with your PostgreSQL connection string (Railway provides this automatically)

## Hosting notes

- Do not deploy `node_modules` to GitHub.
- Use `.gitignore` to keep `node_modules` and `.env` out of version control.
- The front-end is served by the Node server in this repo.
- Database tables are automatically created on first run.

## What is included

- `server.js` - Express backend with PostgreSQL database
- `Index.html`, `auth.html`, `payment.html`, `seats.html` - front-end pages
- `script.js` - front-end interaction and session logic
- `style.css` - UI styling
- `Procfile` - required for many Node hosting platforms
- `.env.example` - example environment config
