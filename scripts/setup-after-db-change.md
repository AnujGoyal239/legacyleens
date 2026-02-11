# Setup After Database Architecture Change

Run these **on your machine** (with database reachable and no file locks):

## 1. Prisma generate

```bash
npx prisma generate
```

**If you get `EPERM: operation not permitted` (Windows):**
- Close other terminals and Cursor/VS Code windows that might be using the project.
- If the project is in **OneDrive**, try: pause OneDrive sync for this folder, or move the project outside OneDrive temporarily.
- Run again in a **new** terminal.

## 2. Apply migration

```bash
npx prisma migrate dev --name add_embeddings_pgvector
```

**If you use Supabase:**
- Ensure the **vector** extension is enabled: Supabase Dashboard → **Database** → **Extensions** → enable **vector**.
- Ensure `DATABASE_URL` in `.env` is correct and the database is reachable.

**If the migration was already applied**, you may see "already applied". That’s fine.

## 3. Reinstall dependencies (optional)

```bash
npm install
```

This updates the lockfile (Qdrant removed). The postinstall hook runs `prisma generate` again.

---

**Summary:** Run `npx prisma generate` then `npx prisma migrate dev` locally when nothing is locking `node_modules` and your database is reachable.
