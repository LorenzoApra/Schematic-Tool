# Schematic Tool - System Requirements

This document describes the minimum and recommended requirements to run the project on macOS and Windows.

## 1) Supported Operating Systems

- **macOS (minimum):** macOS 12 Monterey
- **Windows (minimum):** Windows 10 (64-bit)

Recommended:

- **macOS:** macOS 13+ Ventura/Sonoma
- **Windows:** Windows 11 (64-bit)

## 2) Runtime Requirements

- **Node.js:** 20.x LTS or newer
- **npm:** 10.x or newer
- **Browser (for using the app):**
  - Chrome 120+
  - Edge 120+
  - Firefox 120+

## 3) Hardware Requirements

Minimum:

- **CPU:** Dual-core modern CPU
- **RAM:** 8 GB
- **Disk:** 1 GB free space (project + dependencies + build artifacts)
- **Display:** 1366x768

Recommended:

- **CPU:** Quad-core
- **RAM:** 16 GB
- **Disk:** 2+ GB free space
- **Display:** 1920x1080

## 4) Required Libraries and Dependencies

Installed through `npm install`:

- `react`
- `react-dom`
- `vite`
- `typescript`
- `jspdf` (PDF export)
- `html2canvas` (graphic export)

No additional system libraries are required beyond Node.js/npm.

## 5) Network Requirements

- Internet access is required only for first-time dependency install (`npm install`).
- Local development server runs on:
  - **Host:** `127.0.0.1`
  - **Default port:** `4173`

## 6) Platform-Specific Start/Stop Commands

### macOS

- Start: `npm run starter:macos`
- Stop: `npm run stopper:macos`

Alternative:

- Start dev directly: `npm run dev`

### Windows

- Start: `npm run start:windows`
- Stop: `npm run stop:windows`

Alternative:

- Start dev directly: `npm run dev`

## 7) Setup Checklist

1. Install Node.js LTS (20+).
2. Clone/download the project.
3. Run `npm install`.
4. Start with platform command (or `npm run dev`).
5. Open the URL shown in terminal (default `http://127.0.0.1:4173/`).

## 8) Build and Production Check

- Build command: `npm run build`
- Preview production build: `npm run preview`