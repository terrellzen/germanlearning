# Stillwort — German at your pace

A static German vocabulary application built with React, TypeScript, Vite, and Tailwind CSS. Use passive playback on a visible second monitor or study manually. All vocabulary comes from the four original Anki exports in `data-source/`.

## Run locally

Requires Node.js 22.12+ (Node 24 is also supported).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No accounts, server, API keys, persistent browser storage, analytics, scores, or review schedules are required. Theme and session configuration live in memory.

```sh
npm test
npm run validate:vocab
npm run build
npm run preview
```

For browser smoke tests, keep `npm run dev` running on port 5173, run `npx playwright install chromium` once, then `npm run test:browser`. To use an existing Chromium executable, set `CHROMIUM_PATH` to its path. Screenshots are written to `data/`. The browser checks also simulate visibility changes and window blur; a real second-monitor check remains device-dependent.

## Learning

Select multiple collections, vocabulary direction, irregular-verb exercises, randomized or alphabetical order, and automatic or manual playback. Automatic defaults to 10 seconds for the question and 5 seconds for the answer; each accepts whole seconds from 1–300. Examples follow the language of each side: a German word comes with its German sentence, and an English meaning comes with the English translation. The question-side example is visible immediately; the answer-side sentence is revealed with the answer. Both can be hidden with **Show example sentences** in settings or the **Examples on/off** button during study. The study-screen toggle preserves the current card, answer, pause state, and remaining timer. The answer keeps the original question visible.

Controls provide Previous, Next, Reveal, Pause/Resume, Restart, Settings, fullscreen, and a dimmed focus view. Space reveals/advances, arrows navigate, P pauses/resumes automatic playback, and Escape returns to settings outside fullscreen. Keyboard shortcuts do not intercept input fields or focused buttons. Native Escape exits fullscreen first.

The presentation pauses on `visibilitychange` when hidden and stays paused on return. It does **not** listen for window blur, so using another application while the study page remains visible does not pause playback. Browsers and operating systems can still suspend background processes or sleeping devices; this application cannot override that policy. Fullscreen falls back gracefully when unavailable.

## Source inspection and import results

All four inputs are UTF-8 Anki text exports with four tab-separated columns: deck, front, back, tags. Four leading metadata lines declare tab separator, HTML false, deck column 1, and tags column 4. There are no field-name headers, note identifiers, scheduling fields, separate English example translations, or explicitly labeled conjugation persons. Four exercise decks in the irregular export are reconciled by infinitive + English meaning; the exports do not establish whether those cards originated from the same Anki note.

| Source | Input records | JSON entries | Mapping |
| --- | ---: | ---: | --- |
| A1 Book 1+2 export | 2,608 | 2,497 | German → English, exact normalized pair deduplication |
| A2 Book 3+4 export | 2,006 | 1,909 | German → English, exact normalized pair deduplication |
| Preposition export | 111 | 111 | Verb, preposition, case, prompt, meaning, example |
| Verbs export | 720 | 180 | Four exercise decks merged by infinitive + meaning |

Original Anki filenames and export contents remain unchanged. Original tags, chapter information, and raw text remain in `data-source/` and `data/source_records.csv`; public JSON omits deck/publisher names and tags. Separable-prefix markers between letters (`an.sehen`, `an🞌sehen`) normalize to `ansehen`. Articles, plural notation, variant forms, umlauts, and ß remain intact. An entry with a different translation remains distinct. Combining collections also deduplicates equal vocabulary/exercise pairs across levels.

The preposition back fields do not explicitly delimit English meaning from German sentence. All 111 boundaries were inspected and captured in `scripts/mappings/preposition-meanings.json`, keyed by stable source-content ID. The original combined field remains in JSON. New unmapped preposition records safely produce gap-fill cards rather than guessing boundaries. Add a reviewed mapping to enable translation directions for them.

Verb forms remain verbatim, including questionable source forms for the “would like” meaning of mögen. No grammatical person or missing conjugation is inferred. Supplied examples can illustrate the verb generally; they are not necessarily in the exercise's tense. Noun article and plural notation remain in the German text rather than being expanded from ambiguous shorthand.

## Context examples

At the user's request, German context sentences were added to the two collections that had no examples: all **2,497 A1 entries** and **1,909 A2 entries**, covering **4,399 distinct vocabulary senses** across both collections. Some words share a natural sentence when they fit the same situation. The irregular-verb and preposition collections retain their existing examples exactly.

These additions are authored learning content, separate from the original Anki material. `data-source/general-examples.csv` is the editable source, with `id`, `german`, `english`, and `example_de` columns. Keep the ID, German text, and English sense unchanged when editing a sentence. The importer joins by stable vocabulary ID and verifies the German/English sense before adding an example. It only fills missing examples on general vocabulary and never overwrites an existing example or modifies other deck types. Added JSON examples have `exampleSource: "authored"`.

Use **Show example sentences** in settings or the **Examples on/off** study-screen button. In German → English mode, the German word and sentence appear first; revealing adds the English word and translated sentence. English → German reverses the pairing. This works in both study modes. Conjugation exercises keep their German example until the answer phase because it may contain the target form. Toggling during study updates immediately without restarting the session.

After editing the example CSV, run `npm run import:vocab`. If you add general vocabulary, add its example row using the new ID from the generated JSON, then reimport. `npm run validate:vocab` flags general entries missing context sentences. The import summary includes example and missing-example counts. The combined spreadsheet `data/vocabulary.csv` also includes `example_de` and `example_en` columns; `python3 scripts/convert_vocab.py` refreshes it from the preserved exports plus the authored examples. English sentence translations are stored in `data-source/example-translations.csv`, matched by exact German sentence text, and imported as `exampleTranslation`. If you edit a German sentence, update its translation row too; the importer never reuses a translation for a different sentence. Public JSON and the combined CSV are generated outputs; edit `data-source/general-examples.csv` to keep sentence edits through future imports.

The English translations were initially produced offline with the [OPUS-MT German → English model](https://huggingface.co/Helsinki-NLP/opus-mt-de-en), then spot-checked and corrected. They are static, editable learning content; model weights and translation dependencies are not part of the application. The app needs no translation service or internet connection beyond downloading its static files. Original Anki German sentences and forms are preserved.

## Update vocabulary

```sh
npm run import:vocab
npm run import:vocab -- --collection irregular-verbs
npm run validate:vocab
npm test
npm run build
```

Accepted collection IDs are `a1`, `a2`, `prepositions`, and `irregular-verbs`. Regeneration is deterministic and overwrites public JSON, not editable CSV files. Update original exports before regeneration; back up changes first. `data/json-import-summary.json` reports the most recent import's source counts, metadata, input/output counts and warnings. The difference between input and output counts reflects merged records.

The TypeScript importer supports quoted CSV and TSV, embedded delimiters, multiline fields, optional empty tags, and leading Anki metadata. Malformed row shapes or unsupported grammar patterns fail visibly rather than dropping data. Source fields remain in preserved exports. HTML in future imports is rendered as escaped text by React, never injected as markup. The current exports explicitly declare no HTML.

Collection mappings live in `scripts/mappings/collections.json`. For another general collection, add its four-column export and a mapping with unique ID, display name, description, filename prefix, type `general`, and output JSON filename. Run the importer. The manifest-driven UI requires no collection-specific change. Other source shapes need a converter branch; new exercises belong in `src/engine.ts`, not the presentation component.

For spreadsheet editing, `data/vocabulary.csv` still contains the earlier combined 4,399-entry list, `data/irregular_verbs.csv` has 180 entries, and `data/prepositions.csv` has 111. The vocabulary CSV now includes the added German examples and their English translations. The irregular-verb and preposition CSV files also include both sentence languages. These are separate editable artifacts, not live application inputs. `scripts/convert_vocab.py` rebuilds those CSVs from original exports and overwrites CSV edits. To publish spreadsheet edits, convert them to the typed JSON schema (or adapt the importer); do not expect editing a CSV alone to update the app.

## Architecture

- `src/types.ts`: discriminated vocabulary types and defensive runtime validation.
- `src/loader.ts`: base-path-aware lazy fetching and in-memory collection caching.
- `src/engine.ts`: card generation, Fisher–Yates shuffle, German collation, cycle/history sequencing, monotonic phase clock.
- `src/useStudySession.ts`: timer lifecycle and page visibility handling.
- `src/App.tsx`: configuration and presentation views.
- `public/data/manifest.json`: collection descriptions, counts, and static JSON filenames.
- `tests/`: import, timing, exercise, ordering, and history tests.

A delayed callback transitions only one phase, giving the next phase its full duration rather than skipping unseen cards. Pause preserves milliseconds remaining. Random cycles include each card once, avoid equal cards across boundaries when possible, and preserve actual history when navigating backwards. Session history exists only in memory. Automatic transitions do not use an assertive live region.

## GitHub Pages

Repository: [terrellzen/germanlearning](https://github.com/terrellzen/germanlearning). The publication URL is [Stillwort](https://terrellzen.github.io/germanlearning/).

The site is published from the generated `gh-pages` branch. The source is maintained on `main`. After committing and pushing source changes, deploy using the authenticated GitHub CLI:

```sh
npm ci
git push origin main
npm run deploy:pages
```

`deploy:pages` validates vocabulary, runs tests, builds with the repository base path, publishes only `dist/` contents to `gh-pages` without force-pushing, and configures Pages to serve that branch. The temporary checkout is removed afterwards. `build.json` on the deployed site identifies the source commit. Check publication status with:

```sh
gh api repos/terrellzen/germanlearning/pages/builds/latest
```

The GitHub token available during initial publication could push repository content but lacked the separate `workflow` scope, so GitHub rejected uploading `.github/workflows/deploy.yml`. The ready-to-use Actions workflow is preserved in `deployment/github-actions.yml`. To enable automatic publication later, authenticate with workflow permission, copy that file to `.github/workflows/deploy.yml`, remove its ignore rule, commit it, and switch Pages' publishing source to GitHub Actions. The template validates vocabulary, runs tests, builds, uploads the artifact, and deploys on pushes to `main`.

For a local production build at the project path:

```sh
VITE_BASE_PATH=/germanlearning/ npm run build
VITE_BASE_PATH=/germanlearning/ npm run preview
```

Vite asset references and all JSON fetches respect the configured base. For an account-root repository or custom domain use `/`. There is no server-side routing. If a collection cannot load, check the publication status, base path, tracked JSON files, and manifest filename. Repeated imports replace collections rather than accumulating duplicates.

## Verification and limits

Unit tests cover full A1/A2 example coverage, reimport preservation, preserved German examples in the other two decks, translated-example coverage, language-side pairing, CSV validation, sense mismatches, both study directions, import parsing, stable duplicate handling, distinct verb senses and prepositions, missing conjugation filtering, runtime validation, German sorting, immutable shuffling, random/alphabetical cycling, backward history, 10s/5s phases, delayed callbacks, pauses, and resets. Browser smoke checks exercise configuration, example visibility and both toggle locations, question-language examples before reveal and answer-language examples after reveal, manual reveal/navigation, automatic playback, and narrow-screen overflow. Real second-monitor focus behavior and fullscreen permissions should also be checked on the target device/browser.
