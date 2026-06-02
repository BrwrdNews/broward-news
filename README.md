# Broward News

Fort Lauderdale & Broward County, Florida — Public Safety News Website

## Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- PostgreSQL + Prisma ORM
- NextAuth.js (admin login)

---

## Setup

### 1. Install Node.js
Download from https://nodejs.org (LTS version recommended, 20+)

### 2. Install PostgreSQL
Download from https://www.postgresql.org/download/windows/
- During install, remember your password for the `postgres` user
- Default port: 5432

### 3. Create the database
Open pgAdmin or psql and run:
```sql
CREATE DATABASE broward_news;
```

### 4. Configure environment
Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/broward_news"
NEXTAUTH_SECRET="run: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
NEXTAUTH_URL="http://localhost:3000"
```

### 5. Install dependencies
```bash
npm install
```

### 6. Run database migrations
```bash
npm run db:push
```

### 7. Seed initial admin user + sample story
```bash
npm run db:seed
```
Default admin credentials:
- Email: `admin@browardnews.local`
- Password: `admin123!`

**Change this password immediately in production.**

### 8. Start development server
```bash
npm run dev
```

Visit http://localhost:3000

---

## Admin Panel
Go to http://localhost:3000/admin/login

Workflow:
1. **Create** a story (fills as DRAFT)
2. **Submit for Review** → PENDING_REVIEW
3. Admin **Approves** → APPROVED
4. Admin **Publishes** → PUBLISHED (visible on public site)

Stories can also be **Rejected** at any review stage.

### Headline workflow
Each story has:
- `headline_standard` — factual, straightforward
- `headline_catchy` — tabloid-style, curiosity-driven
- `headline_chosen` — admin's final pick (can edit either or write custom)

---

## Story Guidelines

### Required closing on every story
> "An arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court."

### Source priority
1. Broward County Sheriff's Office arrest records
2. Fort Lauderdale Police Department press releases
3. Broward Clerk of Courts criminal case search
4. Broward County public records / open data
5. Official city/county public safety feeds
6. Local news RSS feeds (context only)

### Avoid
- Guilt-implying language without conviction
- Invented details or motives
- Sensationalizing minors, victims, sex crimes, or domestic violence

---

## Production Deployment

1. Set `NEXTAUTH_URL` to your real domain
2. Use a strong `NEXTAUTH_SECRET`
3. Run `npm run build && npm start`
4. Consider Vercel + Supabase (PostgreSQL) for easy hosting
