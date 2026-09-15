# englishschool.pro

Online English school platform with real-time WebSocket lesson sync.

## Stack
- Node.js + Express + Socket.io
- SQLite (better-sqlite3)
- JWT auth
- Vanilla JS SPA frontend

## Deploy on Railway
1. Fork this repo
2. Connect to Railway
3. Add volume mounted at `/data`
4. Set env var: `DB_PATH=/data/data.db`
5. Deploy

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@englishschool.pro | admin123 |
| Teacher | teacher@englishschool.pro | teacher123 |
| Student | student@englishschool.pro | student123 |

## Local Development
```bash
npm install
node src/server.js
# → http://localhost:3000
```
