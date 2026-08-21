<div align="center">
  <picture>
    <img src="./docs/hero-banner.jpg" width="100%" alt="CinemaDB — Next-Generation Personal Movie Operating System" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.15);" />
  </picture>

  <br />
  <br />

[![SvelteKit](https://img.shields.io/badge/SvelteKit-5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-PostgreSQL-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

  <br />

  <p align="center">
    <strong>Personal Movie Operating System</strong> turning raw cinema data into a highly visual, fully streamed web experience.
  </p>
</div>

---

## ✨ Features

- 🖤 **Swiss OLED Design**: A meticulous, premium interface crafted with pure deep blacks (`#050507`), emerald accents (`#10b981`), and minimalist typography.
- ⚡ **Svelte 5 Runes**: Built on the absolute cutting edge of SvelteKit for unparalleled reactivity, performance, and zero-flicker transitions.
- 🎥 **Live Streaming Pipeline**: Seamless integration with multiple premium and backup streaming mirrors (VidLink Pro, VidSrc VIP, AutoEmbed).
- 🗃️ **Personal Data Engine**: Advanced tracking for watched history, favorites, custom dynamic lists, and deep personal analytics, powered by Drizzle ORM & PostgreSQL.
- 🤖 **AI Discovery**: Intelligent cinematic discovery powered by next-generation AI integrations.

## 🛠️ Technology Stack

| Category      | Technology                                                            |
| ------------- | --------------------------------------------------------------------- |
| **Framework** | [SvelteKit 5](https://kit.svelte.dev/) (Vite)                         |
| **Language**  | [TypeScript](https://www.typescriptlang.org/)                         |
| **Database**  | [PostgreSQL](https://www.postgresql.org/) + [Neon](https://neon.tech) |
| **ORM**       | [Drizzle ORM](https://orm.drizzle.team/)                              |
| **UI System** | Custom Vanilla CSS Tokens (No bulky CSS frameworks)                   |
| **Testing**   | [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/) |

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- PostgreSQL Database URL (e.g., Neon or local pg)
- TMDB API Key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TheoPerson/the-alans-data-base.git
   cd the-alans-data-base
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file at the root of the project:

   ```env
   DATABASE_URL="postgres://user:password@host:port/db"
   VITE_TMDB_API_KEY="your_tmdb_api_key"
   ```

4. **Initialize Database**

   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   _Your personal cinema OS will be running on `http://localhost:5173`._

## 🧪 Testing

Run the critical unit testing suite:

```bash
npm run test:unit
```

## 🗺️ Roadmap (V3)

- [x] Complete refactoring to Svelte 5 `$state` & `$derived` runes.
- [x] Swiss OLED Design System migration.
- [x] Backend interaction API (Ratings, Lists, History).
- [x] Unsandboxed iframe Player Container.
- [ ] User Profile & Social graph extensions.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

_Built with passion for the love of Cinema._
