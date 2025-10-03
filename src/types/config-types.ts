export interface ProjectConfig {
  app: AppConfig;
  qrCode: QRCodeConfig;
  branding: BrandingConfig;
  tests: TestsConfig;
  viewports: ViewportsConfig;
  reporter: ReporterConfig;
  execution: ExecutionConfig;
  cli: CLIConfig;
  playlists: PlaylistsConfig;
  defaults: DefaultsConfig;
}

export interface AppConfig {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  repository: string;
  bugsUrl: string;
}

export interface QRCodeConfig {
  url: string;
  message: string;
  enabled: boolean;
}

export interface BrandingConfig {
  welcomeScreen: {
    ascii: string;
    color: string;
  };
  banner: {
    title: string;
    subtitle: string;
    builtBy: string;
    moreTools: string;
    color: string;
  };
}

export interface TestDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  phase: 1 | 2 | 3;
  scope: 'session' | 'page';
  executionOrder: number;
  dependencies: string[];
  conflictsWith: string[];
  resourceIntensive: boolean;
  outputType: 'per-page' | 'site-wide';
}

export interface TestsConfig {
  [testId: string]: TestDefinition;
}

export interface PlaylistDefinition {
  id: string;
  name: string;
  description: string;
  tests: string[];
}

export interface PlaylistsConfig {
  [playlistId: string]: PlaylistDefinition;
}

export interface ViewportDefinition {
  name: string;
  width: number;
  height: number;
}

export interface ViewportsConfig {
  [viewportName: string]: ViewportDefinition;
}

export interface ReporterConfig {
  enabled: boolean;
  type: 'html';
  openBehavior: 'always' | 'never' | 'on-failure';
  includeScreenshots: boolean;
  includeDetailedLogs: boolean;
}

export interface PhaseConfig {
  name: string;
  description: string;
  maxConcurrency: number;
}

export interface ExecutionConfig {
  phases: {
    [phase: number]: PhaseConfig;
  };
  crawling: {
    maxPages: number;
    waitForNetworkIdle: boolean;
  };
  browser: {
    headless: boolean;
    disableSandbox: boolean;
  };
}

export interface CommandConfig {
  description: string;
  options?: {
    [optionName: string]: {
      description: string;
      default?: any;
    };
  };
}

export interface CLIConfig {
  commands: {
    [commandName: string]: CommandConfig;
  };
}

export interface DefaultsConfig {
  url: string;
  crawlSite: boolean;
}