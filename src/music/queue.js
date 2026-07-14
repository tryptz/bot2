// Per-guild music state: a voice connection, an audio player, and a track queue.
// discord.js voice model: you JOIN a channel (connection), create a PLAYER,
// SUBSCRIBE the connection to the player, then feed the player AudioResources.
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { Readable } from 'node:stream';
import { getStreamUrl } from '../trypthifi.js';

// guildId -> { connection, player, queue: [track], current, textChannel }
const states = new Map();

export function getState(guildId) {
  return states.get(guildId);
}

// Create (or reuse) this guild's connection + player and wire them together.
export function ensureVoice(voiceChannel, textChannel) {
  let state = states.get(voiceChannel.guild.id);
  if (state) return state;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  state = { connection, player, queue: [], current: null, textChannel };
  states.set(voiceChannel.guild.id, state);

  // When a track finishes (Idle after playing), advance the queue.
  player.on(AudioPlayerStatus.Idle, () => {
    state.current = null;
    playNext(voiceChannel.guild.id).catch((err) => {
      state.textChannel?.send?.(`⚠️ Playback error: ${err.message}`);
    });
  });

  player.on('error', (err) => {
    state.textChannel?.send?.(`⚠️ Player error: ${err.message}`);
  });

  // If we get disconnected and can't recover quickly, tear the state down.
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Connecting, 5_000);
    } catch {
      destroy(voiceChannel.guild.id);
    }
  });

  return state;
}

// Add a track and kick off playback if nothing is currently playing.
export async function enqueue(guildId, track) {
  const state = states.get(guildId);
  if (!state) throw new Error('Not connected to a voice channel.');
  state.queue.push(track);
  if (!state.current) await playNext(guildId);
}

// Pull the next track, resolve its stream URL, and play it.
async function playNext(guildId) {
  const state = states.get(guildId);
  if (!state) return;

  const track = state.queue.shift();
  if (!track) return; // queue empty; stay connected, idle.

  const url = await getStreamUrl(track.id, track.quality);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to fetch audio (HTTP ${res.status}).`);

  // Default inputType (Arbitrary) makes @discordjs/voice pipe the stream through
  // ffmpeg, so FLAC/MP3/etc. are transcoded to Opus automatically.
  const resource = createAudioResource(Readable.fromWeb(res.body));
  state.current = track;
  state.player.play(resource);
  state.textChannel?.send?.(`▶️ Now playing: **${track.title}** — ${track.artist}`);
}

export function skip(guildId) {
  const state = states.get(guildId);
  if (!state || !state.current) return false;
  state.player.stop(); // triggers Idle -> playNext
  return true;
}

export function destroy(guildId) {
  const state = states.get(guildId);
  if (!state) return;
  try { state.player.stop(); } catch {}
  try { state.connection.destroy(); } catch {}
  states.delete(guildId);
}
