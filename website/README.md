# TransConet Public Website

This is an isolated static public website for TransConet-Apex1.

## Safety boundary

The website is intentionally independent of:

- `mobile-app/`
- `admin-app/`
- `backend/`
- Prisma/database configuration
- existing root build scripts

It contains only HTML, CSS and JavaScript, so adding it as `website/` does not require changing the existing application architecture.

## Local preview

Open `index.html` in a browser, or serve the directory with any static HTTP server.

## Next integration stages

1. Add real app download/login/signup links.
2. Add production domain and SEO metadata.
3. Connect only public API endpoints that are explicitly approved.
4. Add analytics after the public pages are stable.
