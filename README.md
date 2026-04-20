# Springfall Airlines

Premium airline booking system with authentication and seat selection.

## Setup

1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file from `.env.example`.
4. Start the app with `npm start`.

## Deployment

This project includes a Node backend and should be deployed to a Node-compatible host.

### Recommended free hosts

- Railway: https://railway.app
- Render: https://render.com
- Fly.io: https://fly.io

### Quick deploy steps

1. Create an account on your chosen host.
2. Connect your GitHub repo.
3. Set the build command to `npm install`.
4. Set the start command to `npm start`.
5. Add an environment variable `JWT_SECRET` with a secure random value.

## Hosting notes

- Do not deploy `node_modules` to GitHub.
- Use `.gitignore` to keep `node_modules` and `.env` out of version control.
- The front-end is served by the Node server in this repo.

## What is included

- `server.js` - Express backend and API endpoints
- `Index.html`, `auth.html`, `payment.html`, `seats.html` - front-end pages
- `script.js` - front-end interaction and session logic
- `style.css` - UI styling
- `Procfile` - required for many Node hosting platforms
- `.env.example` - example environment config
