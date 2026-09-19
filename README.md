# Lecture Template

Upload lecture slides, choose how filled-in the notes should be, and download a fill-in lecture template. This is not a homework solver.

SteelHacks 2026.

## Run locally

```bash
conda activate steelhacks
```

Install backend packages once:

```bash
pip install -r backend/requirements.txt
```

Start the API:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

In a second terminal:

```bash
conda activate steelhacks
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The React app calls FastAPI at `http://localhost:8000`.

Optional env files:

- Copy `.env.example` if you later add `NVIDIA_API_KEY` or `DATABASE_URL`. Neither is required for this stub.
- Copy `frontend/.env.example` to `frontend/.env` to change `VITE_API_BASE`.

Sample slides live in `backend/samples/`.
