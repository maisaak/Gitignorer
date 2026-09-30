# Gitignorer

A small full-stack app for detecting a project's technology markers and generating a clean, editable `.gitignore`.

## Run locally

Requires Node.js 18 or newer. No third-party packages or external services are needed.

```sh
npm start
```

Then open [http://localhost:3000](http://localhost:3000). For development with automatic server restarts, run `npm run dev`.

## Use it

- Drop a project folder, browse for one, or paste file paths to detect technologies. Only names and relative paths are read by the browser; file contents are never sent.
- Select or deselect stack templates manually.
- Enable the dotenv option when the project uses dotenv, and paste any existing rules you want preserved.
- Review the generated preview, then copy or download `.gitignore`.

The generator never adds rules for source directories or dependency lockfiles. OS-generated file rules are included by default; technology and editor rules are added only when detected or selected. User rules are deduplicated and kept at the end so explicit exceptions retain precedence.

## API

- `GET /api/templates` — list supported stacks and markers.
- `POST /api/generate` — generate a `.gitignore` from `{ "files": [], "selected": [], "existing": "", "dotenv": false }`.

Run the unit tests with `npm test`.
