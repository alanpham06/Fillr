# Fillr (Expo Go)

iPad app for Fillr: upload a lecture PDF, set density / text size / diagram and code toggles, generate a fill-in template, preview the source and generated PDFs, then open a workspace to write or type on a page. You can also share the original or an annotated PDF.

This is not a homework solver.

The display name is **Fillr** (`slug`: `fillr`). The app folder is `NoteTemplate/`.

## Run on an iPad

Expo Go tunnel needs an Expo account.

```bash
cd NoteTemplate
npx expo login          # once, if you are not already logged in
npx expo start --tunnel
```

Scan the QR code with Expo Go. `--tunnel` is the reliable way to reach Metro from an iPad when the project is running in WSL.

Copy `.env.example` to `.env` if you want a default API URL baked in at Metro start:

```bash
cp .env.example .env
```

`EXPO_PUBLIC_API_BASE` is inlined when Metro starts. After you change `.env`, restart Metro. You can also paste a URL in the in-app **API server** field without restarting.

## Workspace

Tap **Write on this** (or the bar on a preview) for uploaded slides or a generated template / filled overlay. In the workspace:

- **Write** — finger or Apple Pencil ink on the current page
- **Type** — tap to drop a text box, edit it, drag the box or ⠿ to move it
- **Save** — ink and typed notes autosave on-device (AsyncStorage), keyed by document id
- **Download** — the API flattens ink and text onto a shareable PDF
- **← Notes** — returns to the template screen (autosave first; you get a prompt if save fails)

Prev / Next switches pages. Undo drops the last stroke or text box. Clear page wipes that page only.

## Backend (must be reachable from the iPad)

`localhost` on the iPad is the iPad itself, not your computer.

```bash
conda activate steelhacks
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is required so the API is not bound only to `127.0.0.1`.

Then set the API URL in the app (or `EXPO_PUBLIC_API_BASE`) to something the iPad can actually open.

### Why a LAN IP often fails from WSL

WSL2 has its own virtual NIC. An iPad on Wi-Fi talking to your Windows host IP usually does **not** reach a FastAPI process inside WSL unless you set up Windows port proxy / mirrored networking.

Practical hackathon options:

1. **Public tunnel for the API** (most reliable from WSL):
   ```bash
   # in another terminal, after uvicorn is listening on 8000
   ngrok http 8000
   # or: cloudflared tunnel --url http://localhost:8000
   ```
   Paste the `https://…` URL into the app’s API server field. Metro can still use `npx expo start --tunnel`.
2. **Windows host IP**, only if you have already forwarded port 8000 from Windows into WSL and the iPad can open `http://<windows-lan-ip>:8000/health`.
3. **iOS Simulator on a Mac** can use `http://localhost:8000` because localhost is the Mac.

Tap **Save and test** in the app. It should hit `/health` and say connected.

## What Expo Go can and cannot do

- Upload uses `expo-document-picker` (Files). No custom native build.
- Template-screen PDF preview is a `WebView` pointed at the PDF URL. The workspace renders each page as a PNG from the API so ink can sit on top.
- Apple Pencil is treated as a normal touch path — pressure / tilt are not available without native modules. Finger drawing works.
- If the WebView stays blank (common if the API is unreachable, or on Android Expo Go), use **Share template PDF** / **Open / Share PDF** via `expo-sharing`.
- Cleartext `http://` works in Expo Go. A production build would need HTTPS or ATS exceptions.

## leftover gaps

- Workspace export is a real PDF (PyMuPDF flatten). Ink is polylines, not vector-perfect Pencil strokes; typed notes use Helvetica.
- PDF preview quality on the template screen is “good enough on iPad, not the desktop react-pdf pane.”
- WSL networking is the usual blocker, not the React Native UI.
- Completed-notes OCR is the same backend path as the web app; handwriting quality is limited.
