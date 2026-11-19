import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import type { Page } from "@playwright/test";
import type { ObsidianNoteIndexCache } from "../../src/adapters/obsidian/obsidian-note-index-cache";
import { parseNote } from "../../src/core/note/parsed-note";
import { createIndexedNote } from "../../src/features/notes/indexed-note";
import { createPersistedNoteIndexSnapshot } from "../../src/features/notes/note-index-cache";

declare global {
  interface Window {
    cacheFixture: { cache: (storagePath: string) => ObsidianNoteIndexCache };
  }
}

const a = entry("A.md");
const b = entry("nested/B.md");
const c = entry("C.md");

function entry(path: string) {
  return { file: { path, mtime: 10, size: 8 }, note: createIndexedNote(parseNote(path, "old body")) };
}

let script: string;
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import { ObsidianNoteIndexCache } from "./src/adapters/obsidian/obsidian-note-index-cache";
        export const cache = (base) => new ObsidianNoteIndexCache({
          getName: () => "Notes", configDir: ".obsidian", adapter: { getBasePath: () => base }
        });`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, format: "iife", globalName: "cacheFixture", platform: "browser",
  });
  script = bundle.outputFiles[0]!.text;
});

test.beforeEach(async ({ page }) => {
  await page.route("http://cache.test/", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html>" }));
  await page.goto("http://cache.test/");
  await page.addScriptTag({ content: script });
});

async function seedVersionOne(page: Page) {
  await page.evaluate((snapshot) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("chrono-notes", 1);
    request.onupgradeneeded = () => {
      const headers = request.result.createObjectStore("note-index-snapshots");
      // Old versions before status metadata wrote just the snapshot.
      for (const path of ["one", "two"]) headers.put(snapshot, "Notes\u0000" + path);
      for (const path of ["two", "orphan"]) {
        headers.put({ schema: 1, entryCount: 1 }, JSON.stringify(["metadata", "Notes\u0000" + path]));
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open legacy database"));
    request.onsuccess = () => { request.result.close(); resolve(); };
  }), createPersistedNoteIndexSnapshot([a]));
}

test("migrates v1 snapshots atomically and keeps same-name Vaults isolated", async ({ page }) => {
  await seedVersionOne(page);
  const report = await page.evaluate(async (snapshot) => {
    const first = window.cacheFixture.cache("one");
    const second = window.cacheFixture.cache("two");
    const orphan = window.cacheFixture.cache("orphan");
    const empty = window.cacheFixture.cache("empty");
    const status = await Promise.all([first, second, orphan, empty].map((cache) => cache.getStatus()));
    const legacy = await first.load();
    const needsMigration = first.needsFullSave;
    const bad = { ...snapshot.entries[0]!, uncloneable: () => 0 };
    const rejected = await first.save({ ...snapshot, entries: [...snapshot.entries, bad] })
      .then(() => false, () => true);
    const afterAbort = await first.load();
    await first.save(snapshot);
    const migrated = await first.load();
    const secondLegacy = await second.load();
    await second.save(snapshot);
    await first.clear();
    return {
      status, legacy, needsMigration, rejected, afterAbort, migrated,
      stillNeedsMigration: first.needsFullSave, secondLegacy,
      cleared: await first.getStatus(), surviving: await second.load(),
    };
  }, createPersistedNoteIndexSnapshot([b]));
  const old = createPersistedNoteIndexSnapshot([a]);
  const migrated = createPersistedNoteIndexSnapshot([b]);
  expect(report).toEqual({
    status: [{ state: "legacy" }, { state: "stored", entryCount: 1 }, { state: "invalid" }, { state: "empty" }],
    legacy: old, needsMigration: true, rejected: true, afterAbort: old, migrated,
    stillNeedsMigration: false, secondLegacy: old, cleared: { state: "empty" }, surviving: migrated,
  });
});

test("serializes changes and rolls back all row and metadata edits on clone failure", async ({ page }) => {
  const result = await page.evaluate(async ({ a, b, c }) => {
    const first = window.cacheFixture.cache("one");
    const second = window.cacheFixture.cache("one");
    await first.save({ schema: 7, entries: [a] });
    await Promise.all([
      first.applyChanges({ upserts: [b], deletes: [] }),
      second.applyChanges({ upserts: [c], deletes: [] }),
    ]);
    const count = await first.getStatus();
    const bad = { ...b, uncloneable: () => 0 };
    const aborted = await first.applyChanges({ upserts: [bad], deletes: [a.file.path] })
      .then(() => false, () => true);
    const afterAbort = await first.load();
    await first.applyChanges({ upserts: [b], deletes: [a.file.path, c.file.path, "missing.md"] });
    const touched: string[] = [];
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      touched.push(this.name + "/" + (typeof key === "string" ? key : "<other>"));
      return get.call(this, key);
    };
    const status = await first.getStatus();
    IDBObjectStore.prototype.get = get;
    const after = await first.load();
    await first.clear();
    const missingBaseline = await second.applyChanges({ upserts: [a], deletes: [] })
      .then(() => false, () => true);
    return { count, aborted, afterAbort, status, touched, after, missingBaseline };
  }, { a, b, c });
  expect(result).toEqual({
    count: { state: "stored", entryCount: 3 }, aborted: true,
    afterAbort: createPersistedNoteIndexSnapshot([a, c, b]),
    status: { state: "stored", entryCount: 1 },
    touched: [expect.stringMatching(/^note-index-snapshots\/\["metadata",/u)],
    after: createPersistedNoteIndexSnapshot([b]), missingBaseline: true,
  });
});

test("refreshes membership after another window replaces the baseline and compacts a large overlay", async ({ page }) => {
  const report = await page.evaluate(async ({ a, b, c }) => {
    const first = window.cacheFixture.cache("one");
    const second = window.cacheFixture.cache("one");
    await first.save({ schema: 7, entries: [a] });
    await second.load();
    await first.save({ schema: 7, entries: [c] });
    await second.applyChanges({ upserts: [a], deletes: [c.file.path] });
    const afterReplacement = await first.load();
    const additions = Array.from({ length: 256 }, (_, i) => {
      const path = i + ".md";
      return { ...b, file: { ...b.file, path }, note: { ...b.note, path } };
    });
    await second.applyChanges({ upserts: additions, deletes: [] });
    await first.load();
    const compaction = first.needsFullSave;
    await first.save({ schema: 7, entries: [a, ...additions] });
    const status = await second.getStatus();
    await second.load();
    return { afterReplacement, compaction, compacted: !second.needsFullSave, status };
  }, { a, b, c });
  expect(report).toEqual({
    afterReplacement: createPersistedNoteIndexSnapshot([a]), compaction: true, compacted: true,
    status: { state: "stored", entryCount: 257 },
  });
});

test("rejects corrupt manifests, mismatched overlay keys, and a missing baseline", async ({ page }) => {
  const report = await page.evaluate(async ({ a, b }) => {
    const cache = window.cacheFixture.cache("one");
    const key = "Notes\u0000one";
    const metadataKey = JSON.stringify(["metadata", key]);
    const edit = async (modify: (tx: IDBTransaction) => void) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("chrono-notes", 2);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error ?? new Error("Could not open cache"));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(["note-index-entries", "note-index-snapshots"], "readwrite");
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error ?? new Error("Fixture write aborted"));
          modify(tx);
        });
      } finally { db.close(); }
    };
    await cache.save({ schema: 7, entries: [a] });
    await cache.applyChanges({ upserts: [b], deletes: [] });
    await edit((tx) => { tx.objectStore("note-index-entries").put(a, [key, b.file.path]); });
    const wrongKey = await cache.load();
    await edit((tx) => {
      tx.objectStore("note-index-snapshots").put({ layout: "future", schema: 1, entryCount: 2 }, metadataKey);
    });
    const unknown = await cache.load();
    const unknownStatus = await cache.getStatus();
    await edit((tx) => { tx.objectStore("note-index-snapshots").delete(metadataKey); });
    const orphanRows = await cache.load();
    await cache.save({ schema: 7, entries: [a] });
    await edit((tx) => { tx.objectStore("note-index-snapshots").delete(key); });
    const missing = await cache.getStatus();
    return { wrongKey, unknown, unknownStatus, orphanRows, missing };
  }, { a, b });
  expect(report).toEqual({
    wrongKey: {}, unknown: {}, unknownStatus: { state: "invalid" }, orphanRows: {}, missing: { state: "invalid" },
  });
});
