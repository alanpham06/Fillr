# Frontend

Vite + React app for lecture-template upload, settings, preview, and download.

```bash
conda activate steelhacks
cd frontend
npm install
npm run dev
```

The UI expects the FastAPI server on port 8000:

```bash
conda activate steelhacks
cd backend
uvicorn main:app --reload --port 8000
```

Then open http://localhost:5173.
