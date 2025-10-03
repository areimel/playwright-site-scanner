import { PlaylistType, TestType } from '../types/index.js';
import { PlaylistDefinition } from '../types/config-types.js';
import { getPlaylistsConfig, getAvailableTestsAsArray } from '../utils/config-loader.js';

export class PlaylistManager {
  private playlistsConfig: Record<string, PlaylistDefinition> | null = null;
  private availableTests: TestType[] | null = null;

  constructor() {}

  async getAvailablePlaylists(): Promise<PlaylistType[]> {
    if (!this.playlistsConfig) {
      this.playlistsConfig = await getPlaylistsConfig();
    }

    return Object.values(this.playlistsConfig).map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      tests: playlist.tests
    }));
  }

  async getPlaylistById(playlistId: string): Promise<PlaylistType | null> {
    if (!this.playlistsConfig) {
      this.playlistsConfig = await getPlaylistsConfig();
    }

    const playlist = this.playlistsConfig[playlistId];
    if (!playlist) {
      return null;
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      tests: playlist.tests
    };
  }

  async getPlaylistTests(playlistId: string): Promise<TestType[]> {
    const playlist = await this.getPlaylistById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID '${playlistId}' not found`);
    }

    if (!this.availableTests) {
      this.availableTests = await getAvailableTestsAsArray();
    }

    const selectedTests = this.availableTests.filter(test =>
      playlist.tests.includes(test.id)
    ).map(test => ({ ...test, enabled: true }));

    return selectedTests;
  }

  async validatePlaylist(playlistId: string): Promise<{ valid: boolean; missingTests: string[] }> {
    const playlist = await this.getPlaylistById(playlistId);
    if (!playlist) {
      return { valid: false, missingTests: [] };
    }

    if (!this.availableTests) {
      this.availableTests = await getAvailableTestsAsArray();
    }

    const availableTestIds = this.availableTests.map(test => test.id);
    const missingTests = playlist.tests.filter(testId => !availableTestIds.includes(testId));

    return {
      valid: missingTests.length === 0,
      missingTests
    };
  }

  async isPlaylistAvailable(playlistId: string): Promise<boolean> {
    if (!this.playlistsConfig) {
      this.playlistsConfig = await getPlaylistsConfig();
    }

    return playlistId in this.playlistsConfig;
  }
}