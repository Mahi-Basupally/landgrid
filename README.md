# LandGrid

Map. Manage. Embed.

LandGrid turns real-estate master plans into interactive site plans that can be viewed publicly, managed by project teams, and embedded into another website.

## Core experiences

- **View** — public project/site-plan experience.
- **Map & Manage** — authenticated project inventory management.
- **Embed** — project view suitable for embedding in another website.

## Authentication

LandGrid uses passwordless email login. Users enter an existing email address and a verification code. There is no password-based enrollment flow.

For local development, `config/application.properties` contains `LANDGRID_LOGIN_CODE=123456`. This is a temporary development backdoor. Remove it and replace it with a real email delivery/one-time-code provider before production.

## Project membership

A user can own or participate in multiple projects. Project memberships support `admin` and `sales`. Admins manage project configuration and members; sales users can update plot inventory such as status and price.

## Development

```bash
npm install
npm run dev
```

The repository is intentionally small. JSON files are retained for local development and the Cape Town sample; production persistence should move to a database/object store.
