# Nivas PMS - Setup Guide

This guide provides step-by-step instructions to set up and run the Nivas PMS (Property Management System) on a new machine. The system consists of a REST API backend (ElysiaJS + Bun) and a React frontend (Vite).

## Prerequisites

Before starting, ensure you have the following installed:

1.  **Node.js**: v18 or higher (v20 recommended). [Download](https://nodejs.org/)
2.  **Bun**: The backend runtime. [Download](https://bun.sh/)
    - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
3.  **PostgreSQL**: v14 or higher. [Download](https://www.postgresql.org/download/)
4.  **Git**: For version control. [Download](https://git-scm.com/)

---

## 1. Clone the Repository

Clone the project to your local machine:

```bash
git clone <repository-url> nivas-pms
cd nivas-pms
```

---

## 2. Backend Setup (`nivas-backend`)

### A. Install Dependencies

```bash
cd nivas-backend
bun install
```

### B. Environment Configuration

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Edit `.env` and configure your database connection and secrets:

    ```env
    # Database (Ensure this matches your PostgreSQL setup)
    DATABASE_URL="postgresql://postgres:password@localhost:5432/nivas_db?schema=public"

    # App Secrets
    JWT_SECRET="your-super-secret-key-change-this"
    
    # Server Port
    PORT=3000
    ```

### C. Database Setup

1.  Create the database in PostgreSQL (e.g., via pgAdmin or psql):
    ```sql
    CREATE DATABASE nivas_db;
    ```
2.  Run migrations to create tables:
    ```bash
    bun run db:push
    ```
3.  (Optional) Seed initial data:
    ```bash
    bun run db:seed
    ```

### D. Start the Server

```bash
bun dev
```
The backend API will run at `http://localhost:3000`.

---

## 3. Frontend Setup (`nivas-frontend`)

Open a new terminal window.

### A. Install Dependencies

```bash
cd nivas-frontend
npm install
# OR
pnpm install
# OR 
bun install
```

### B. Environment Configuration

1.  Copy the example file:
    ```bash
    cp .env.example .env
    ```
2.  Edit `.env` to point to your backend:

    ```env
    VITE_API_URL="http://localhost:3000/api/v1"
    ```

### C. Start the Client

```bash
npm run dev
```
The frontend application will typically run at `http://localhost:5173`.

---

## 4. Troubleshooting

-   **Database Connection Error**: Ensure PostgreSQL is running and the credentials in `.env` are correct.
-   **CORS Errors**: Ensure the backend `.env` allows the frontend URL (if applicable) or that you are using the correct API URL in the frontend config.
-   **PDF Fonts Missing**: The `pdfmake` library uses standard fonts. If you see font errors, ensure `roboto` is available or check network access if loading remote resources.

## 5. Development Workflow

-   **Backend**: Edit files in `src/`. The server auto-reloads.
-   **Frontend**: Edit files in `src/`. Vite HMR updates the browser instantly.
-   **Docs**: API documentation is available at `http://localhost:3000/swagger` (if enabled in `src/index.ts`).

---

**Enjoy building with Nivas PMS!**
