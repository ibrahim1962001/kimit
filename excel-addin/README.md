# Kimit Excel Add-in (Stages 1-4)

This is the initial scaffold for embedding Kimit inside Excel Task Pane.

## Implemented now

- Stage 1: Excel task pane scaffold + command button.
- Stage 2: Import active worksheet rows and push them into Kimit app.
- Stage 3: Pull current Kimit dataset back from app and apply to Excel sheet.
- Stage 4: End-to-end bridge controls in task pane (Import / Push / Pull / Apply).

## Run locally

1. Start the Kimit app:

```bash
npm run dev --prefix datapath-app
```

2. Serve add-in static files on HTTPS port `3000`:

```bash
npx http-server "excel-addin" -S -C cert.pem -K key.pem -p 3000
```

> You need a local certificate (`cert.pem`, `key.pem`).  
> If you do not have one yet, generate trusted localhost certs first (mkcert recommended).

3. Sideload the manifest in Excel:
   - Excel -> Insert -> Office Add-ins -> My Add-ins -> Upload My Add-in
   - Select `excel-addin/manifest.xml`

4. Open the task pane from the Home tab button:
   - `Kimit` group -> `Open Kimit Dashboard`

## Bridge flow

1. Click `Import Active Sheet` (reads worksheet rows into add-in cache).
2. Click `Push to Dashboard` (sends rows into Kimit via `postMessage` bridge).
3. Work inside Kimit dashboard/editors.
4. Click `Pull from Dashboard` (fetch latest `workData` from Kimit).
5. Click `Apply to Sheet` (writes pulled rows to active worksheet).

## Notes

- The task pane embeds your running app URL (default: `http://localhost:5173`) in an iframe.
- App bridge messages are handled in `datapath-app/src/App.tsx`.
- For production, replace localhost URLs in `manifest.xml` with your deployed HTTPS host.
