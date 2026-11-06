# White Walker review

A public, static GitHub Pages site for reviewing the four levels of the **White Walker** (Biały Wędrowiec) figurine. It has a single viewport with one native **Poziom** select. The heavy model downloads only after the visitor clicks **Uruchom 3D**. After that, changing the level cancels any stale load, releases the previous scene and loads the new level into the same viewport.

| Level | Seasons | Model ID | Composition |
| ---: | ---: | --- | --- |
| 1 | 1 | `white-walker-1` | White Walker alone on the snow base with three red ESTES discs |
| 2 | 3 | `white-walker-2` | with the black GRIP EQ backpack |
| 3 | 5 | `white-walker-3` | with the black ZÜCA cart |
| 4 | 7 | `white-walker-4` | with the ZÜCA cart and the telescopic retriever |

Direct link to a level: `https://bitz3d.github.io/white-walker-review/?model=white-walker-N`. Unknown IDs show a 404 message and do not download any model data.

## Publication boundary

- Only explicitly authorized White Walker levels and their thumbnails are published.
- `public/models.json` is the public catalog and the deployment allowlist. The validator fails closed if any of these hold:
  - `public/` contains an unlisted file;
  - a path escapes its folder;
  - a part, gzip or decoded hash or size differs;
  - a GLB needs any extension other than `EXT_meshopt_compression`;
  - the staged site exceeds 950 MB (GitHub Pages allows 1 GB).

## Assets

- Each level is the **lossless** output of the workspace's shared figurine exporter: meshopt-compressed geometry whose decoded bytes are identical to the full-quality export, and unchanged texture bytes.
- Each GLB is gzipped (level 9) and split into ordered parts below 50 MiB. The manifest records each part's URL, size and SHA-256, and the gzip and decoded GLB sizes and hashes.
- The browser verifies every part, the whole gzip and the decoded GLB before parsing it with three.js `GLTFLoader` plus `MeshoptDecoder`.
- There is no decimation, texture resizing or lossy step.
- Visitors can download the assets.

## Local build with the existing pinned dependencies

No dependency installation is needed or intended. Link the existing dependency directory, build, lock and stage:

```bash
ln -s ../blender-agnet/projects/phoenix/delivery/web_v001/viewer-test/node_modules node_modules
node node_modules/vite/bin/vite.js build
python3 scripts/update_dist_lock.py
node --test scripts/catalog_navigation.test.mjs
python3 scripts/validate_and_stage.py --output _site   # refuses an existing output directory
```

`dist/` and `dist-files.json` are committed. `node_modules/` and `_site/` are not.

## Local verification

Serve the staged site on an unused loopback port:

```bash
python3 scripts/serve_local.py --root _site --port 5299
```

Then open `http://127.0.0.1:5299/white-walker-review/`. The browser check uses an existing local Playwright installation and the installed headful Chrome; it installs nothing:

```bash
PLAYWRIGHT_PACKAGE=/path/to/existing/package.json node scripts/verify_browser.mjs \
  --url http://127.0.0.1:5299/white-walker-review/ --out-dir /path/outside/this/repository/browser-run
```

The check:

- starts level 1 explicitly and switches to levels 2–4 with the select in the same session;
- verifies the decoded hashes and rendered triangles;
- records errors and WebGL context loss;
- captures the reset and 3/4 views.

It runs on a desktop only. It is not a phone test. Keep its output outside this repository.

## Owner-only manual publication

- `.github/workflows/publish.yml` has only `workflow_dispatch`. The job requires all of these:
  - repository `Bitz3d/white-walker-review`;
  - branch `main`;
  - both `github.actor` and `github.triggering_actor` equal to `Bitz3d`.
- It validates, stages `_site/` from the locked `dist/` and the manifest-listed `public/` files only, and deploys it to GitHub Pages.
- Pushing assets to this public repository makes them downloadable before any deployment.
