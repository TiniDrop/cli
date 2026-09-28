#!/usr/bin/env node
/**
 * TiniDrop CLI — deploy static sites and files via API key.
 *
 * Usage:
 *   tinidrop deploy ./dist
 *   tinidrop deploy ./dist --slug my-site
 *   tinidrop deploy deck.pdf --slug my-deck
 *
 * Env: TINIDROP_API_KEY (required), TINIDROP_API_URL (default https://tinidrop.com)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { zipSync } from 'fflate';

const DEFAULT_API_URL = 'https://tinidrop.com';

function printHelp() {
  console.log(`
TiniDrop CLI — deploy files to tinidrop.com

Commands:
  deploy <path>     Upload a file or folder (folders are zipped automatically)
  replace <path>    Same as deploy with --slug (updates existing link)

Options:
  --slug <slug>     Replace an existing file at this slug (PUT /api/upload)
  --project-id <id> Attach upload to a dashboard project
  --api-key <key>   API key (or set TINIDROP_API_KEY)
  --api-url <url>   API base URL (default ${DEFAULT_API_URL})

Examples:
  tinidrop deploy ./dist
  tinidrop deploy ./dist --slug acme-site
  tinidrop replace ./pitch-deck.pdf --slug my-deck

Get an API key: Dashboard → Settings → API Keys (Solo+ plan)
`);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = args.shift() ?? 'help';
  if (command === '--help' || command === '-h') command = 'help';

  let path = null;
  let slug = null;
  let projectId = null;
  let apiKey = process.env.TINIDROP_API_KEY ?? null;
  let apiUrl = process.env.TINIDROP_API_URL ?? DEFAULT_API_URL;

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--slug') slug = args[++i] ?? null;
    else if (a === '--project-id') projectId = args[++i] ?? null;
    else if (a === '--api-key') apiKey = args[++i] ?? null;
    else if (a === '--api-url') apiUrl = args[++i] ?? null;
    else if (!a.startsWith('-')) positional.push(a);
  }

  if (positional[0]) path = resolve(positional[0]);
  if (command === 'replace' && !slug) {
    console.error('replace requires --slug');
    process.exit(1);
  }

  return { command, path, slug, projectId, apiKey, apiUrl: apiUrl.replace(/\/$/, '') };
}

function collectFiles(dir, base = dir) {
  /** @type {{ path: string; full: string }[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectFiles(full, base));
    else if (st.isFile()) out.push({ path: relative(base, full).split('\\').join('/'), full });
  }
  return out;
}

function zipDirectory(dir) {
  const files = collectFiles(dir);
  if (files.length === 0) throw new Error('Directory is empty');
  const data = {};
  for (const { path, full } of files) {
    data[path] = readFileSync(full);
  }
  const zipped = zipSync(data, { level: 6 });
  const folderName = basename(dir);
  return { buffer: Buffer.from(zipped), filename: `${folderName}.zip` };
}

function loadUploadPayload(targetPath) {
  const st = statSync(targetPath);
  if (st.isDirectory()) {
    return zipDirectory(targetPath);
  }
  return {
    buffer: readFileSync(targetPath),
    filename: basename(targetPath),
  };
}

async function upload({ apiUrl, apiKey, slug, projectId, buffer, filename }) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  if (projectId) form.append('projectId', projectId);

  const method = slug ? 'PUT' : 'POST';
  if (slug) form.append('slug', slug);

  const res = await fetch(`${apiUrl}/api/upload`, {
    method,
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data;
}

async function main() {
  const { command, path, slug, projectId, apiKey, apiUrl } = parseArgs(process.argv.slice(2));

  if (command === 'help' || !command) {
    printHelp();
    return;
  }

  if (command !== 'deploy' && command !== 'replace') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  if (!path || !existsSync(path)) {
    console.error('Path not found:', path);
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Missing API key. Set TINIDROP_API_KEY or pass --api-key');
    process.exit(1);
  }

  const { buffer, filename } = loadUploadPayload(path);
  console.log(`Uploading ${filename} (${(buffer.length / 1024).toFixed(1)} KB)…`);

  const result = await upload({ apiUrl, apiKey, slug, projectId, buffer, filename });

  console.log('\n✓ Deployed');
  if (result.url) console.log('  URL:', result.url);
  if (result.siteUrl) console.log('  Site:', result.siteUrl);
  if (result.liveSiteUrl) console.log('  Live:', result.liveSiteUrl);
  if (result.slug) console.log('  Slug:', result.slug);
  if (result.isZipSite) console.log('  ZIP site:', result.fileCount ?? 0, 'files');
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
