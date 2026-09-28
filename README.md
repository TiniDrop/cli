# TiniDrop CLI

Deploy a file or a static site to [tinidrop.com](https://tinidrop.com) from the terminal.

API keys live in **Dashboard → Settings → API Keys** (Solo and above).

## Usage

```bash
npm install
npx tinidrop deploy ./dist
npx tinidrop deploy ./dist --slug my-site
npx tinidrop deploy deck.pdf --slug my-deck
npx tinidrop replace ./pitch-deck.pdf --slug my-deck
```

```bash
export TINIDROP_API_KEY=td_...
tinidrop deploy ./dist
```

### Options

| Flag | Meaning |
| --- | --- |
| `--slug <slug>` | Update an existing link (PUT) |
| `--project-id <id>` | Attach the upload to a dashboard project |
| `--api-key <key>` | Override `TINIDROP_API_KEY` |
| `--api-url <url>` | Default `https://tinidrop.com` |

Folders are zipped automatically. HTML/ZIP sites go live at a `*.tinidrop.app` host.

## Product

The hosted product is at [tinidrop.com](https://tinidrop.com). Company profile: [github.com/TiniDrop](https://github.com/TiniDrop).
