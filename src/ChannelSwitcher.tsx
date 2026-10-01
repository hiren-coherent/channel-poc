import { type ChannelEntry, DEFAULT_CHANNEL, switchChannel } from './channel';

interface Props {
  current: string;
  entries: ChannelEntry[];
}

export function ChannelSwitcher({ current, entries }: Props) {
  const options: ChannelEntry[] = [
    { channel_name: DEFAULT_CHANNEL, branch_name: 'main' },
    ...entries.filter((entry) => entry.channel_name !== DEFAULT_CHANNEL),
  ];
  // Keep the select value valid even when this channel isn't registered (a local run,
  // or a channel removed from the registry while you're still on it).
  if (!options.some((entry) => entry.channel_name === current)) {
    options.push({ channel_name: current, branch_name: null });
  }

  return (
    <label className="switcher">
      <span className="switcher-label">Deployment channel</span>
      <select
        value={current}
        onChange={(event) => switchChannel(event.target.value)}
        data-testid="channel-switcher"
      >
        {options.map((entry) => (
          <option key={entry.channel_name} value={entry.channel_name}>
            {entry.branch_name ? `${entry.channel_name} · ${entry.branch_name}` : entry.channel_name}
          </option>
        ))}
      </select>
    </label>
  );
}
