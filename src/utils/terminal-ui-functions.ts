// Terminal UI Functions - Runtime logic for the YAML-driven TUI system

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  TerminalUIConfig,
  Step,
  InputStep,
  ListStep,
  CheckboxStep,
  ConfirmStep,
  GroupStep,
  DisplayStep,
  ActionStep,
  WalkthroughState,
  Condition,
  DefaultValue,
  MessageContent,
  StaticChoice,
  DynamicChoicesConfig,
  TextStyle,
  SummaryConfig,
  StyleColors,
  RegisteredFunction,
  TransformFunction,
  StepResult
} from '../types/terminal-ui-types.js';
import {
  loadConfig,
  getAvailableTestsAsArray,
  getAvailablePlaylistsAsArray,
  getPlaylistById,
  getViewportsAsArray,
  getReporterConfig,
  getDefaultsConfig
} from './config-loader.js';
import { validateUrl, resolveUrlByProbing } from './validation.js';
import { PlaylistManager } from '../orchestrator/playlists.js';
import { TestConfigManager } from '../orchestrator/test-config-manager.js';
import { TestType, CrawlMode } from '../types/index.js';

// ============= Config Loading =============

let cachedUIConfig: TerminalUIConfig | null = null;

export async function loadTerminalUIConfig(): Promise<TerminalUIConfig> {
  if (cachedUIConfig) {
    return cachedUIConfig;
  }

  const configPath = path.join(process.cwd(), 'src/utils/terminal-ui-content.yml');
  const configData = await fs.readFile(configPath, 'utf8');
  cachedUIConfig = yaml.load(configData) as TerminalUIConfig;

  if (!cachedUIConfig) {
    throw new Error('Failed to parse terminal-ui-content.yml');
  }

  return cachedUIConfig;
}

export function clearUIConfigCache(): void {
  cachedUIConfig = null;
}

// ============= Styling Functions =============

export function applyStyle(
  text: string,
  style: TextStyle,
  config: TerminalUIConfig
): string {
  let result = text;

  // Apply color
  if (style.color) {
    const colorValue =
      config.styling.colors[style.color as keyof StyleColors] || style.color;
    if (colorValue.startsWith('#')) {
      result = chalk.hex(colorValue)(result);
    } else {
      // Fallback to chalk method if exists
      const chalkMethod = (chalk as Record<string, unknown>)[colorValue];
      if (typeof chalkMethod === 'function') {
        result = (chalkMethod as (text: string) => string)(result);
      }
    }
  }

  // Apply text formatting
  if (style.bold) {
    result = chalk.bold(result);
  }
  if (style.italic) {
    result = chalk.italic(result);
  }

  // Apply indentation
  if (style.indent) {
    result = ' '.repeat(style.indent) + result;
  }

  // Apply prefix symbol
  if (style.prefix) {
    const symbol = getSymbol(style.prefix, config);
    result = `${symbol} ${result}`;
  }

  return result;
}

export function getSymbol(symbolKey: string, config: TerminalUIConfig): string {
  const symbolMap: Record<string, string> = {
    success: '\u2705',
    warning: '\u26A0\uFE0F',
    error: '\u274C',
    info: '\uD83D\uDD0D',
    arrow: '\u27A1\uFE0F',
    checkmark: '\u2713',
    cross: '\u2717',
    mobile: '\uD83D\uDCF1',
    settings: '\uD83D\uDD27',
    chart: '\uD83D\uDCCA',
    spider: '\uD83D\uDD77\uFE0F',
    page: '\uD83D\uDCC4',
    rocket: '\uD83D\uDE80',
    stop: '\u23F9\uFE0F',
    save: '\uD83D\uDCBE'
  };

  return symbolMap[symbolKey] || symbolKey;
}

// ============= Message Rendering =============

export async function renderMessage(
  message: MessageContent,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<void> {
  let messageText: string;
  let style: TextStyle = {};

  if ('ref' in message) {
    const referenced = config.messages[message.ref];
    if (!referenced) {
      console.warn(`Warning: Message reference '${message.ref}' not found`);
      return;
    }
    messageText = referenced.text;
    style = referenced.style || {};
  } else {
    messageText = message.text;
    style = message.style || {};
  }

  // Interpolate variables from state
  messageText = interpolateVariables(messageText, state.collectedData);

  if (style.newlineBefore) {
    console.log();
  }

  console.log(applyStyle(messageText, style, config));

  if (style.newlineAfter) {
    console.log();
  }
}

export function interpolateVariables(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
    const value = getNestedValue(data, varPath);
    return value !== undefined ? String(value) : match;
  });
}

// ============= Condition Evaluation =============

export function evaluateCondition(
  condition: Condition,
  data: Record<string, unknown>
): boolean {
  const fieldValue = getNestedValue(data, condition.field);

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'notEquals':
      return fieldValue !== condition.value;
    case 'contains':
      return Array.isArray(fieldValue)
        ? fieldValue.includes(condition.value)
        : String(fieldValue).includes(String(condition.value));
    case 'notContains':
      return Array.isArray(fieldValue)
        ? !fieldValue.includes(condition.value)
        : !String(fieldValue).includes(String(condition.value));
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'notExists':
      return fieldValue === undefined || fieldValue === null;
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);
    default:
      return false;
  }
}

// ============= Default Value Resolution =============

export async function resolveDefaultValue(
  defaultConfig: DefaultValue,
  state: WalkthroughState
): Promise<unknown> {
  try {
    switch (defaultConfig.source) {
      case 'config':
        if (defaultConfig.path) {
          const projectConfig = await loadConfig();
          return (
            getNestedValue(
              projectConfig as unknown as Record<string, unknown>,
              defaultConfig.path
            ) ?? defaultConfig.fallback
          );
        }
        return defaultConfig.fallback;

      case 'static':
        return defaultConfig.value;

      case 'function':
        if (defaultConfig.function) {
          const fn = getRegisteredFunction(defaultConfig.function);
          return fn ? await fn(state) : defaultConfig.fallback;
        }
        return defaultConfig.fallback;

      default:
        return defaultConfig.fallback;
    }
  } catch {
    return defaultConfig.fallback;
  }
}

// ============= Choice Building =============

export async function buildChoices(
  step: Step,
  config: TerminalUIConfig,
  _state: WalkthroughState
): Promise<Array<{ name: string; value: string; short?: string; checked?: boolean; disabled?: boolean | string }>> {
  const choices: Array<{ name: string; value: string; short?: string; checked?: boolean; disabled?: boolean | string }> = [];

  // Add static choices first
  if ('choices' in step && step.choices) {
    for (const choice of step.choices) {
      if (choice.static !== false) {
        choices.push(formatChoice(choice, config));
      }
    }
  }

  // Add dynamic choices
  if ('dynamicChoices' in step && step.dynamicChoices) {
    const dynamicItems = await loadDynamicChoices(step.dynamicChoices, config);
    choices.push(...dynamicItems);
  }

  return choices;
}

export async function loadDynamicChoices(
  dynamicConfig: DynamicChoicesConfig,
  config: TerminalUIConfig
): Promise<Array<{ name: string; value: string; short?: string; checked?: boolean }>> {
  let items: Array<Record<string, unknown>> = [];

  switch (dynamicConfig.source) {
    case 'tests':
      items = (await getAvailableTestsAsArray()) as unknown as Array<Record<string, unknown>>;
      break;
    case 'playlists':
      items = (await getAvailablePlaylistsAsArray()) as unknown as Array<Record<string, unknown>>;
      break;
    case 'viewports':
      items = (await getViewportsAsArray()) as unknown as Array<Record<string, unknown>>;
      break;
    default: {
      // Try to load from project config
      const projectConfig = await loadConfig();
      const configValue = getNestedValue(
        projectConfig as unknown as Record<string, unknown>,
        dynamicConfig.source
      );
      items = configValue ? Object.values(configValue as Record<string, unknown>) as Array<Record<string, unknown>> : [];
    }
  }

  // Apply filter if specified
  if (dynamicConfig.filter) {
    items = items.filter((item) =>
      evaluateCondition(dynamicConfig.filter!, item as unknown as Record<string, unknown>)
    );
  }

  return items.map((item) => {
    const name = interpolateVariables(dynamicConfig.nameTemplate, item as unknown as Record<string, unknown>);
    const styledName = dynamicConfig.descriptionStyle
      ? formatNameWithDescription(item as unknown as Record<string, unknown>, dynamicConfig, config)
      : name;

    return {
      name: styledName,
      value: item[dynamicConfig.valueKey] as string,
      short: dynamicConfig.shortKey
        ? (item[dynamicConfig.shortKey] as string)
        : (item[dynamicConfig.valueKey] as string),
      checked: dynamicConfig.checkedDefault ?? false
    };
  });
}

function formatNameWithDescription(
  item: Record<string, unknown>,
  dynamicConfig: DynamicChoicesConfig,
  config: TerminalUIConfig
): string {
  const mainText = (item.name as string) || (item[dynamicConfig.valueKey] as string);
  const description = item.description as string | undefined;

  if (description && dynamicConfig.descriptionStyle) {
    const styledDesc = applyStyle(description, dynamicConfig.descriptionStyle, config);
    return `${mainText} - ${styledDesc}`;
  }

  return mainText;
}

function formatChoice(
  choice: StaticChoice,
  config: TerminalUIConfig
): { name: string; value: string; short?: string; disabled?: boolean | string } {
  let name = choice.name;

  if (choice.style) {
    name = applyStyle(name, choice.style, config);
  }

  return {
    name,
    value: choice.value,
    short: choice.short || choice.value,
    disabled: choice.disabled
  };
}

// ============= Step Execution =============

export async function executeStep(
  step: Step,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<unknown> {
  // Check condition
  if (step.condition && !evaluateCondition(step.condition, state.collectedData)) {
    state.skippedSteps.push(step.id);
    return null;
  }

  // Render pre-messages
  if (step.preMessages) {
    for (const msg of step.preMessages) {
      await renderMessage(msg, config, state);
    }
  }

  // Execute pre-action
  if (step.preAction?.function) {
    const fn = getRegisteredFunction(step.preAction.function);
    if (fn) {
      await fn(state, step.preAction.params);
    }
  }

  // Execute step based on type
  let result: unknown;

  switch (step.type) {
    case 'input':
      result = await executeInputStep(step as InputStep, config, state);
      break;
    case 'list':
      result = await executeListStep(step as ListStep, config, state);
      break;
    case 'checkbox':
      result = await executeCheckboxStep(step as CheckboxStep, config, state);
      break;
    case 'confirm':
      result = await executeConfirmStep(step as ConfirmStep, config, state);
      break;
    case 'group':
      result = await executeGroupStep(step as GroupStep, config, state);
      break;
    case 'display':
      await executeDisplayStep(step as DisplayStep, config, state);
      result = null;
      break;
    case 'action':
      result = await executeActionStep(step as ActionStep, config, state);
      break;
  }

  // Store result
  if (step.outputKey && result !== null) {
    state.collectedData[step.outputKey] = result;
  }

  // Render post-messages
  if (step.postMessages) {
    for (const msg of step.postMessages) {
      await renderMessage(msg, config, state);
    }
  }

  // Execute post-action
  if (step.postAction?.function) {
    const fn = getRegisteredFunction(step.postAction.function);
    if (fn) {
      await fn(state, step.postAction.params);
    }
  }

  state.completedSteps.push(step.id);

  // Process triggers to determine next step
  if (step.triggers) {
    for (const trigger of step.triggers) {
      if (evaluateCondition(trigger.condition, state.collectedData)) {
        if (trigger.gotoStep) {
          return { _nextStep: trigger.gotoStep } as StepResult;
        }
        if (trigger.skipStep) {
          state.skippedSteps.push(trigger.skipStep);
        }
        if (trigger.action) {
          const fn = getRegisteredFunction(trigger.action);
          if (fn) await fn(state);
        }
      }
    }
  }

  return result;
}

async function executeInputStep(
  step: InputStep,
  _config: TerminalUIConfig,
  state: WalkthroughState
): Promise<unknown> {
  const defaultValue = step.default
    ? await resolveDefaultValue(step.default, state)
    : undefined;

  const validationFn = step.validation?.function
    ? getRegisteredFunction(step.validation.function)
    : undefined;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: step.prompt.name,
      message: step.prompt.message,
      default: defaultValue,
      validate: validationFn
        ? (input: string) => validationFn({ ...state, collectedData: { ...state.collectedData, [step.prompt.name]: input } }) as boolean | string | Promise<boolean | string>
        : undefined
    }
  ]);

  return answers[step.prompt.name];
}

async function executeListStep(
  step: ListStep,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<unknown> {
  const choices = await buildChoices(step, config, state);
  const defaultValue = step.default
    ? await resolveDefaultValue(step.default, state)
    : undefined;

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: step.prompt.name,
      message: step.prompt.message,
      choices,
      default: defaultValue,
      loop: step.options?.loop ?? true,
      pageSize: step.options?.pageSize
    }
  ]);

  return answers[step.prompt.name];
}

async function executeCheckboxStep(
  step: CheckboxStep,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<unknown> {
  const choices = await buildChoices(step, config, state);

  const validate = step.validation
    ? (answer: unknown[]) => {
        if (step.validation?.minSelected && answer.length < step.validation.minSelected) {
          return (
            step.validation.errorMessage ||
            `Please select at least ${step.validation.minSelected} option(s).`
          );
        }
        if (step.validation?.maxSelected && answer.length > step.validation.maxSelected) {
          return (
            step.validation.errorMessage ||
            `Please select no more than ${step.validation.maxSelected} option(s).`
          );
        }
        return true;
      }
    : undefined;

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: step.prompt.name,
      message: step.prompt.message,
      choices,
      validate,
      loop: step.options?.loop ?? true,
      pageSize: step.options?.pageSize
    }
  ]);

  return answers[step.prompt.name];
}

async function executeConfirmStep(
  step: ConfirmStep,
  _config: TerminalUIConfig,
  state: WalkthroughState
): Promise<boolean> {
  const defaultValue = step.default
    ? await resolveDefaultValue(step.default, state)
    : true;

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: step.prompt.name,
      message: step.prompt.message,
      default: defaultValue
    }
  ]);

  return answers[step.prompt.name];
}

async function executeGroupStep(
  step: GroupStep,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  for (const [key, subStep] of Object.entries(step.subSteps)) {
    const fullSubStep = { ...subStep, id: `${step.id}.${key}`, order: 0 } as Step;
    results[key] = await executeStep(fullSubStep, config, state);
  }

  return results;
}

async function executeDisplayStep(
  step: DisplayStep,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<void> {
  for (const msg of step.messages) {
    await renderMessage(msg, config, state);
  }
}

async function executeActionStep(
  step: ActionStep,
  _config: TerminalUIConfig,
  state: WalkthroughState
): Promise<unknown> {
  const fn = getRegisteredFunction(step.action.function);
  if (fn) {
    return await fn(state, step.action.params);
  }
  return null;
}

// ============= Summary Rendering =============

export async function renderConfigurationSummary(
  summaryConfig: SummaryConfig,
  config: TerminalUIConfig,
  state: WalkthroughState
): Promise<void> {
  // Title
  console.log(applyStyle(summaryConfig.title, { color: 'secondary' }, config));

  // Divider
  const dividerColor =
    config.styling.colors[summaryConfig.divider.color as keyof StyleColors] ||
    summaryConfig.divider.color;
  console.log(
    chalk.hex(dividerColor)(
      summaryConfig.divider.char.repeat(summaryConfig.divider.length)
    )
  );

  // Fields
  for (const field of summaryConfig.fields) {
    // Check condition
    if (
      field.condition &&
      !evaluateCondition(field.condition, state.collectedData)
    ) {
      continue;
    }

    let value = getNestedValue(state.collectedData, field.valueFrom);

    // Apply transform
    if (field.transform) {
      const transformFn = getTransformFunction(field.transform);
      if (transformFn) {
        value = await transformFn(value, state);
      }
    }

    // Format output
    const prefix = field.prefix ? `${getSymbol(field.prefix, config)} ` : '';
    console.log(chalk.white(`${prefix}${field.label}: ${value}`));
  }

  // Closing divider
  console.log(
    chalk.hex(dividerColor)(
      summaryConfig.divider.char.repeat(summaryConfig.divider.length)
    )
  );
}

// ============= Flow Control =============

export async function runWalkthroughFlow(): Promise<WalkthroughState> {
  const config = await loadTerminalUIConfig();

  const state: WalkthroughState = {
    currentStepId: '',
    collectedData: {},
    completedSteps: [],
    skippedSteps: []
  };

  // Load initial data from project config
  state.collectedData.viewports = await getViewportsAsArray();
  state.collectedData.reporter = await getReporterConfig();
  state.collectedData.verboseMode = process.env.VERBOSE === 'true';

  // Get ordered steps
  const orderedSteps = Object.values(config.steps).sort(
    (a, b) => a.order - b.order
  );

  let stepIndex = 0;

  while (stepIndex < orderedSteps.length) {
    const step = orderedSteps[stepIndex];
    state.currentStepId = step.id;

    // Skip if already completed or skipped
    if (
      state.completedSteps.includes(step.id) ||
      state.skippedSteps.includes(step.id)
    ) {
      stepIndex++;
      continue;
    }

    const result = await executeStep(step, config, state);

    // Handle explicit jump
    if (result && typeof result === 'object' && '_nextStep' in (result as StepResult)) {
      const nextStepId = (result as StepResult)._nextStep;
      const nextIndex = orderedSteps.findIndex((s) => s.id === nextStepId);
      if (nextIndex !== -1) {
        stepIndex = nextIndex;
        continue;
      }
    }

    stepIndex++;
  }

  return state;
}

// ============= Utility Functions =============

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ============= Function Registry =============

const functionRegistry: Map<string, RegisteredFunction> = new Map();

export function registerFunction(name: string, fn: RegisteredFunction): void {
  functionRegistry.set(name, fn);
}

export function getRegisteredFunction(name: string): RegisteredFunction | undefined {
  return functionRegistry.get(name);
}

// Transform functions registry
const transformRegistry: Map<string, TransformFunction> = new Map();

export function registerTransform(name: string, fn: TransformFunction): void {
  transformRegistry.set(name, fn);
}

export function getTransformFunction(name: string): TransformFunction | undefined {
  return transformRegistry.get(name);
}

// ============= Pre-registered Functions =============

// Validation functions
registerFunction('validateUrl', (_state: WalkthroughState, _params?: Record<string, unknown>) => {
  // This is a wrapper - actual validation happens via inquirer's validate
  return true;
});

// For inquirer validation, we need a direct reference to validateUrl
registerFunction('validateUrlDirect', async (state: WalkthroughState) => {
  const url = state.collectedData.url as string;
  return validateUrl(url);
});

// Action functions
registerFunction('resolveAndDisplayUrl', async (state: WalkthroughState) => {
  const url = state.collectedData.url as string;
  const resolvedUrl = await resolveUrlByProbing(url);

  console.log(chalk.green(`URL set to: ${url}`));
  if (resolvedUrl !== url) {
    console.log(chalk.yellow(`\uD83D\uDD0E Resolved to: ${resolvedUrl}\n`));
  } else {
    console.log();
  }

  state.collectedData.resolvedUrl = resolvedUrl;
  return resolvedUrl;
});

registerFunction('displayCrawlModeMessage', async (state: WalkthroughState) => {
  const crawlMode = state.collectedData.crawlMode as string;
  const messages: Record<string, string> = {
    single: '\uD83D\uDCC4 Will test single page only',
    smart: '\uD83D\uDD77\uFE0F  Will crawl site (smart mode - skipping duplicate templates)',
    full: '\uD83D\uDD77\uFE0F  Will crawl entire site (all pages)',
    deep: '\uD83D\uDD77\uFE0F  Deep crawl mode - unlimited pages, sitemap generation only'
  };
  console.log(chalk.yellow(messages[crawlMode]) + '\n');

  // Set crawlSite for backward compatibility
  state.collectedData.crawlSite = crawlMode !== 'single';
});

registerFunction('configureDeepCrawl', async (state: WalkthroughState) => {
  const groupResult = state.collectedData.deepCrawlConfig as Record<string, unknown>;
  const deepCrawlConfig = {
    enabled: true,
    crawlerType: groupResult.crawlerType,
    checkpointInterval: 100,
    resumeFromCheckpoint: groupResult.resumeFromCheckpoint
  };

  console.log(
    chalk.green(
      `\u2705 Deep crawl configured: ${groupResult.crawlerType} crawler, ` +
        `${groupResult.resumeFromCheckpoint ? 'will resume' : 'fresh start'}\n`
    )
  );

  state.collectedData.deepCrawlConfig = deepCrawlConfig;
  return deepCrawlConfig;
});

registerFunction('processManualTestSelection', async (state: WalkthroughState) => {
  const selectedTestIds = (state.collectedData.selectedTestIds as string[]) || [];
  const availableTests = await getAvailableTestsAsArray();

  const selectedTests = availableTests
    .filter((test) => selectedTestIds.includes(test.id))
    .map((test) => ({ ...test, enabled: true }));

  console.log(chalk.green(`\u2705 Selected ${selectedTests.length} test(s)\n`));
  state.collectedData.usedPlaylist = null;

  return selectedTests;
});

registerFunction('loadPlaylistTests', async (state: WalkthroughState) => {
  const playlistId = state.collectedData.selectionMode as string;
  const playlistManager = new PlaylistManager();
  const selectedTests = await playlistManager.getPlaylistTests(playlistId);

  state.collectedData.usedPlaylist = playlistId;
  return selectedTests;
});

registerFunction('displayPlaylistInfo', async (state: WalkthroughState) => {
  const playlistId = state.collectedData.usedPlaylist as string;
  const playlist = await getPlaylistById(playlistId);
  const selectedTests = state.collectedData.selectedTests as TestType[];

  console.log(chalk.green(`\u2705 ${playlist?.name} testing playlist selected`));
  console.log(chalk.gray(`   ${playlist?.description}`));
  console.log(
    chalk.cyan(`   Tests: ${selectedTests.map((t) => t.name).join(', ')}\n`)
  );
  console.log(chalk.green(`\u2705 Selected ${selectedTests.length} test(s)\n`));
});

registerFunction('showConfigurationSummary', async (state: WalkthroughState) => {
  const config = await loadTerminalUIConfig();
  await renderConfigurationSummary(config.configurationSummary, config, state);

  // Check for tests that will be filtered out
  const crawlMode = state.collectedData.crawlMode as CrawlMode;
  const crawlSite = state.collectedData.crawlSite as boolean;

  if (crawlMode === 'deep') {
    const testConfig = {
      url: state.collectedData.resolvedUrl as string,
      crawlSite: true,
      crawlMode: crawlMode,
      selectedTests: state.collectedData.selectedTests as TestType[],
      viewports: state.collectedData.viewports as Array<{ name: string; width: number; height: number }>,
      reporter: state.collectedData.reporter as { enabled: boolean; type: 'html'; openBehavior: 'always' | 'never' | 'on-failure'; includeScreenshots: boolean; includeDetailedLogs: boolean }
    };
    const { disabledTests } = await TestConfigManager.filterTestsForDeepCrawl(testConfig);
    if (disabledTests.length > 0) {
      console.log(chalk.yellow('\nThe following tests are disabled in deep crawl mode:'));
      disabledTests.forEach((testId) => {
        console.log(chalk.yellow(`   - ${TestConfigManager.getTestName(testId)}`));
      });
      console.log(chalk.gray('   Deep crawl mode only supports sitemap generation.\n'));
    }
  } else if (!crawlSite) {
    const testConfig = {
      url: state.collectedData.resolvedUrl as string,
      crawlSite: false,
      crawlMode: crawlMode,
      selectedTests: state.collectedData.selectedTests as TestType[],
      viewports: state.collectedData.viewports as Array<{ name: string; width: number; height: number }>,
      reporter: state.collectedData.reporter as { enabled: boolean; type: 'html'; openBehavior: 'always' | 'never' | 'on-failure'; includeScreenshots: boolean; includeDetailedLogs: boolean }
    };
    const { disabledTests } = await TestConfigManager.filterTestsForSinglePageScan(testConfig);
    if (disabledTests.length > 0) {
      console.log(chalk.yellow('\nThe following tests require site crawling and will be skipped:'));
      disabledTests.forEach((testId) => {
        console.log(chalk.yellow(`   - ${TestConfigManager.getTestName(testId)}`));
      });
      console.log(chalk.gray('   Enable "Crawl entire site" to run these tests.\n'));
    }
  }
});

registerFunction('handleConfirmation', async (state: WalkthroughState) => {
  const confirmed = state.collectedData.confirmed as boolean;

  if (!confirmed) {
    console.log(chalk.yellow('\n\u23F9\uFE0F  Test session cancelled.'));
    process.exit(0);
  }

  console.log(chalk.green('\n\uD83D\uDE80 Starting test session...\n'));
});

// Transform functions
registerTransform('crawlModeLabel', (value: unknown) => {
  const labels: Record<string, string> = {
    single: 'Single page only',
    smart: 'Smart crawl (skip duplicate templates)',
    full: 'Full site crawl',
    deep: 'Deep crawl (unlimited pages, sitemap-only)'
  };
  return labels[value as string] || value;
});

registerTransform('crawlerTypeLabel', (value: unknown) => {
  return value === 'cheerio' ? 'Lightweight (HTTP)' : 'Full browser';
});

registerTransform('resumeLabel', (value: unknown) => {
  return value ? 'Yes (if checkpoint exists)' : 'No (fresh start)';
});

registerTransform('playlistLabel', async (value: unknown, state: WalkthroughState) => {
  const playlist = await getPlaylistById(value as string);
  const tests = state.collectedData.selectedTests as TestType[];
  return `${playlist?.name} (${tests?.length || 0} tests)`;
});

registerTransform('testNamesJoin', (tests: unknown) => {
  const testArray = tests as TestType[];
  return testArray?.map((t) => t.name).join(', ') || 'None';
});

registerTransform('viewportNamesJoin', (viewports: unknown) => {
  const viewportArray = viewports as Array<{ name: string }>;
  return viewportArray?.map((v) => v.name).join(', ') || 'None';
});

registerTransform('outputModeLabel', (verbose: unknown) => {
  return verbose ? 'Verbose logging' : 'Clean loading screen';
});

registerTransform('reporterStatusLabel', (reporter: unknown) => {
  const reporterObj = reporter as { enabled?: boolean; openBehavior?: string } | undefined;
  if (!reporterObj?.enabled) return 'Disabled';
  return `Enabled (${reporterObj.openBehavior})`;
});

// Export validateUrl for direct use by inquirer
export { validateUrl };
