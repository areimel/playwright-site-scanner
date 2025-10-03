import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { ProjectConfig } from '@shared/config-types.js';
import { TestType, ViewportConfig, PlaylistType } from '@shared/index.js';

let cachedConfig: ProjectConfig | null = null;

export async function loadConfig(): Promise<ProjectConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = path.join(process.cwd(), 'project-config.yaml');
    const configData = await fs.readFile(configPath, 'utf8');
    cachedConfig = yaml.load(configData) as ProjectConfig;
    
    if (!cachedConfig) {
      throw new Error('Failed to parse project-config.yaml');
    }
    
    return cachedConfig;
  } catch (error) {
    throw new Error(`Failed to load project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getAppConfig() {
  const config = await loadConfig();
  return config.app;
}

export async function getQRConfig() {
  const config = await loadConfig();
  return config.qrCode;
}

export async function getBrandingConfig() {
  const config = await loadConfig();
  return config.branding;
}

export async function getTestsConfig() {
  const config = await loadConfig();
  return config.tests;
}

export async function getViewportsConfig() {
  const config = await loadConfig();
  return config.viewports;
}

export async function getReporterConfig() {
  const config = await loadConfig();
  return config.reporter;
}

export async function getExecutionConfig() {
  const config = await loadConfig();
  return config.execution;
}

export async function getCLIConfig() {
  const config = await loadConfig();
  return config.cli;
}

export async function getDefaultsConfig() {
  const config = await loadConfig();
  return config.defaults;
}

export async function getPlaylistsConfig() {
  const config = await loadConfig();
  return config.playlists;
}

export async function getAvailableTestsAsArray(): Promise<TestType[]> {
  const testsConfig = await getTestsConfig();
  return Object.values(testsConfig).map(test => ({
    id: test.id,
    name: test.name,
    description: test.description,
    enabled: test.enabled
  }));
}

export async function getViewportsAsArray(): Promise<ViewportConfig[]> {
  const viewportsConfig = await getViewportsConfig();
  return Object.values(viewportsConfig);
}

export async function getTestClassifications() {
  const testsConfig = await getTestsConfig();
  const classifications: Record<string, any> = {};
  
  for (const [testId, testDef] of Object.entries(testsConfig)) {
    classifications[testId] = {
      testId: testDef.id,
      phase: testDef.phase,
      scope: testDef.scope,
      executionOrder: testDef.executionOrder,
      dependencies: testDef.dependencies,
      conflictsWith: testDef.conflictsWith,
      resourceIntensive: testDef.resourceIntensive,
      outputType: testDef.outputType
    };
  }
  
  return classifications;
}

export async function getPhaseDefinitions() {
  const executionConfig = await getExecutionConfig();
  const phaseDefinitions: Record<number, any> = {};
  
  for (const [phase, config] of Object.entries(executionConfig.phases)) {
    const phaseNum = parseInt(phase);
    phaseDefinitions[phaseNum] = {
      phase: phaseNum,
      name: config.name,
      description: config.description,
      scope: phaseNum === 1 ? 'session' : phaseNum === 4 ? 'session' : 'page', // Phase 1&4 are session, 2&3 are page
      dependencies: phaseNum === 1 ? [] : phaseNum === 2 ? [1] : phaseNum === 3 ? [1, 2] : [1, 2, 3],
      parallelizable: true
    };
  }
  
  return phaseDefinitions;
}

export async function getAvailablePlaylistsAsArray(): Promise<PlaylistType[]> {
  const playlistsConfig = await getPlaylistsConfig();
  return Object.values(playlistsConfig).map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    tests: playlist.tests
  }));
}

export async function getPlaylistById(playlistId: string): Promise<PlaylistType | null> {
  const playlistsConfig = await getPlaylistsConfig();
  const playlist = playlistsConfig[playlistId];

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