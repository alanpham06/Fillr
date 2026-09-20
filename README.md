# Fillr

Upload lecture slides, choose how filled-in the notes should be, and generate a fill-in lecture template. You can later photograph the handwritten sheet; we OCR it and merge the writing back in teal ink. This is not a homework solver.

The same product has two UIs that share `backend/`:

- `frontend/` — Vite React app for the computer (upload, generate, preview, workspace, completed-notes upload)
- `NoteTemplate/` — Expo Go iPad app (same generate flow plus a finger-friendly PDF workspace)

## Run locally

```bash
conda activate steelhacks
```

Install backend packages (and Tesseract once):

```bash
conda install -n steelhacks -c conda-forge tesseract
pip install -r backend/requirements.txt
```

Start the API:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is only required if an iPad or another machine must call the API. A local Vite-only session can still use `127.0.0.1`.

## Web (computer)

```bash
conda activate steelhacks
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The React app calls FastAPI at `http://localhost:8000`.

Upload slides, generate a template, then use **Write on this** on either PDF pane to open the workspace. Write draws with the mouse or trackpad; Type drops movable text boxes. Progress saves in `localStorage`. **Download** flattens ink and typed notes through `POST /workspace/export`. Completed notes are uploaded from the sidebar (there is no “download filled notes” button).

## iPad (Expo Go)

The iPad app lives in `NoteTemplate/` and is named **Fillr** in Expo. Tap an uploaded PDF or a generated template to open the write/type workspace.

```bash
conda activate steelhacks
cd NoteTemplate
npx expo login          # once; tunnel needs an Expo account
npx expo start --tunnel
```

On a physical iPad, `localhost` is the tablet. Paste a reachable API URL in the app (or set `EXPO_PUBLIC_API_BASE` in `NoteTemplate/.env`). From WSL that is usually an ngrok / Cloudflare Tunnel URL, not a guessed LAN IP. See [NoteTemplate/README.md](NoteTemplate/README.md).

Optional env files:

- Copy `.env.example` if you later add `NVIDIA_API_KEY` or `DATABASE_URL`. Neither is required. When `NVIDIA_API_KEY` is set, notes re-upload asks Nemotron to map OCR text onto template slots (text only — no images).
- Copy `frontend/.env.example` to `frontend/.env` to change `VITE_API_BASE`.
- Copy `NoteTemplate/.env.example` to `NoteTemplate/.env` to set `EXPO_PUBLIC_API_BASE` (iPad cannot use localhost unless it is a simulator on the same machine).

Sample slides live in `backend/samples/`.

## OCR

1. Digital PDFs use PyMuPDF native text.
2. A page with almost no extractable text is OCRed with Tesseract.
3. Images (png/jpg) go straight to Tesseract.
4. Re-uploaded completed notes are always OCRed, then compiled into a filled PDF.

Handwriting quality is limited with Tesseract. Expect missed words on faint pencil.

## Verify the extractor

```bash
conda activate steelhacks
cd backend
python tests/test_ocr_pipeline.py
```
