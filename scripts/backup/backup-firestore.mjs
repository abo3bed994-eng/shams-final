#!/usr/bin/env node
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.resolve(__dirname, "service-account.json");

const BACKUP_DIR =
  process.env.BACKUP_DIR || path.resolve(__dirname, "backups");

const COLLECTIONS = (process.env.BACKUP_COLLECTIONS || "users,products,orders,categories,settings,audit_log,push_tokens,sessions").split(",").map(s => s.trim()).filter(Boolean);

const KEEP_LAST = parseInt(process.env.BACKUP_KEEP || "30", 10);

function log(msg) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${t}] ${msg}`);
}

function err(msg) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.error(`[${t}] ❌ ${msg}`);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  err(`Service account file not found: ${SERVICE_ACCOUNT_PATH}`);
  err(`Generate one from: Firebase Console → Project Settings → Service Accounts → Generate new private key`);
  err(`Then save it as: scripts/backup/service-account.json`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return { __type: "date", value: value.toISOString() };
  if (typeof value === "object" && value !== null && typeof value.toDate === "function") {
    return { __type: "timestamp", value: value.toDate().toISOString() };
  }
  if (typeof value === "object" && value !== null && typeof value._latitude === "number" && typeof value._longitude === "number") {
    return { __type: "geopoint", lat: value._latitude, lng: value._longitude };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = serialize(value[k]);
    return out;
  }
  return value;
}

async function dumpCollection(name) {
  log(`📦 Dumping collection: ${name}`);
  const snap = await db.collection(name).get();
  const docs = [];
  snap.forEach(d => docs.push({ id: d.id, data: serialize(d.data()) }));
  log(`   ↳ ${docs.length} documents`);
  return docs;
}

function rotate(dir, keep) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  const toDelete = files.slice(keep);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(dir, f.name));
    log(`🗑️  Deleted old backup: ${f.name}`);
  }
}

async function main() {
  const startedAt = Date.now();
  log(`🚀 Starting Firestore backup`);
  log(`   Project: ${serviceAccount.project_id}`);
  log(`   Output:  ${BACKUP_DIR}`);
  log(`   Collections: ${COLLECTIONS.join(", ")}`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const result = {
    backedUpAt: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    collections: {},
    summary: {},
  };

  let total = 0;
  for (const col of COLLECTIONS) {
    try {
      const docs = await dumpCollection(col);
      result.collections[col] = docs;
      result.summary[col] = docs.length;
      total += docs.length;
    } catch (e) {
      err(`Failed to dump '${col}': ${e.message}`);
      result.summary[col] = `ERROR: ${e.message}`;
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `backup-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");
  const sizeKB = (fs.statSync(file).size / 1024).toFixed(1);

  log(`✅ Backup complete: ${file}`);
  log(`   Total documents: ${total}`);
  log(`   File size: ${sizeKB} KB`);
  log(`   Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  rotate(BACKUP_DIR, KEEP_LAST);
  log(`🎉 Done. Keeping last ${KEEP_LAST} backups.`);
}

main().catch(e => {
  err(e.stack || e.message);
  process.exit(1);
});
