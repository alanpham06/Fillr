# Frontend

Vite + React UI for Fillr: lecture-template upload, settings, preview, workspace, and completed-notes upload. The iPad app is `NoteTemplate/`. Both talk to the same FastAPI backend.

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

## Workspace

After a lecture PDF is uploaded (or a template / filled PDF is generated), click **Write on this** on that pane.

- **Write** — draw with the mouse or trackpad
- **Type** — click to drop a text box, edit it, drag the box or ⠿ to move it
- Progress saves in `localStorage`, keyed by document id
- **Download** sends ink and typed notes to `POST /workspace/export` and downloads the flattened PDF

Completed notes are uploaded from the sidebar. There is no “download filled notes” CTA.
