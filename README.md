# MediCast

A full-stack application with a FastAPI backend and a React + Vite + TypeScript + Tailwind CSS frontend.

## Prerequisites

### Backend
- Python 3.14+ (see `backend/.python-version`)
- [uv](https://docs.astral.sh/uv/) - Python package/project manager

### Frontend
- [Node.js](https://nodejs.org/) (recommended: latest LTS)
- npm (comes with Node.js)

## Getting Started (Fresh Clone)

```bash
git clone https://github.com/THEJAS-BK/MediCast.git
cd MediCast
```

### Backend Setup

```bash
cd backend

# Create/sync the virtual environment and install dependencies
uv sync

# Run the development server
uv run fastapi dev
# Or with uvicorn directly
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000` by default. FastAPI docs are available at `http://localhost:8000/docs`.

The app entrypoint is defined in `pyproject.toml` as `app.main:app` (under `[tool.fastapi]`).

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The frontend dev server will typically start at `http://localhost:5173` (Vite's default).

## Project Structure

```
MediCast/
├── backend/          # FastAPI backend (managed with uv)
│   ├── src/app/      # Application source code
│   ├── pyproject.toml
│   └── uv.lock
└── frontend/         # React + Vite frontend
    ├── src/          # Application source code
    └── package.json
```

## Notes

- Backend uses FastAPI with standard extras (`fastapi[standard]`). `uv sync` will install all dependencies from `pyproject.toml`/`uv.lock`.
- Frontend uses Vite 8, React 19, TypeScript, Tailwind CSS v4 with `@tailwindcss/vite`.
- The backend is configured with build system `uv_build` and module name `app`.

