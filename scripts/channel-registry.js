import fs from 'node:fs';
import process from 'node:process';

// Channel registry: [{ "channel_name": "SP-12345", "branch_name": "feat/SP-12345-foo" }, ...]
// Legacy entries are bare channel-name strings (branch unknown → branch_name: null) and are
// rewritten in the object form on the next add/remove. Older copies of this script still
// append bare strings, so the first entry for a channel wins — a late legacy duplicate must
// not erase the branch recorded for it.
// Read by src/channel.ts; written by the workflows through scripts/pages.sh.
// Same file as platform-ui/scripts/channel-registry.js.
//
//   --op=add    --name=<channel> [--branch=<branch>]  register / rebind (keeps branch if omitted)
//   --op=remove --name=<channel>                      unregister
//   --op=find   --branch=<branch>                     print the branch's channels, one per line
//   --op=owner  --name=<channel>                      print the channel's branch ('' if unknown)
const CHANNEL_REGEX = /^[A-Za-z0-9_-]{1,20}$/;
const OPS = ['add', 'remove', 'find', 'owner'];

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) {
      console.error(`Unexpected argument: ${arg}`);
      process.exit(2);
    }
    out[m[1]] = m[2];
  }
  return out;
}

const { op, file, name, branch } = parseArgs(process.argv);

if (!OPS.includes(op)) {
  console.error(`--op must be one of ${OPS.join(', ')} (got ${JSON.stringify(op)})`);
  process.exit(2);
}
if (!file) {
  console.error('--file is required');
  process.exit(2);
}
if (op !== 'find' && (!name || !CHANNEL_REGEX.test(name))) {
  console.error(`--name must match ^[A-Za-z0-9_-]{1,20}$ (got ${JSON.stringify(name)})`);
  process.exit(2);
}
if (op === 'find' && !branch) {
  console.error('--branch is required for --op=find');
  process.exit(2);
}

// A missing file is an empty registry; an unreadable one fails rather than being reset,
// since writing it back would drop every other channel.
const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
if (!Array.isArray(raw)) {
  console.error(`${file} is not a JSON array`);
  process.exit(1);
}

const channels = new Map();
for (const item of raw) {
  const entry = typeof item === 'string' ? { channel_name: item } : item;
  const channelName = entry?.channel_name;
  if (typeof channelName === 'string' && CHANNEL_REGEX.test(channelName) && !channels.has(channelName)) {
    channels.set(channelName, { channel_name: channelName, branch_name: entry.branch_name ?? null });
  }
}

if (op === 'find') {
  for (const entry of channels.values()) {
    if (entry.branch_name === branch) console.log(entry.channel_name);
  }
} else if (op === 'owner') {
  console.log(channels.get(name)?.branch_name ?? '');
} else {
  if (op === 'add') {
    channels.set(name, { channel_name: name, branch_name: branch ?? channels.get(name)?.branch_name ?? null });
  } else {
    channels.delete(name);
  }
  fs.writeFileSync(file, `${JSON.stringify([...channels.values()], null, 2)}\n`);
}
