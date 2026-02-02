// Terminal UI Types - TypeScript interfaces for the YAML-driven TUI system

// ============= Styling Types =============

export interface StyleColors {
  primary: string;
  secondary: string;
  warning: string;
  error: string;
  muted: string;
  info: string;
  accent: string;
}

export interface StyleSymbols {
  success: string;
  warning: string;
  error: string;
  info: string;
  arrow: string;
}

export interface GlobalStyling {
  colors: StyleColors;
  symbols: StyleSymbols;
}

export interface TextStyle {
  color?: keyof StyleColors | string;
  prefix?: keyof StyleSymbols | string;
  indent?: number;
  newlineBefore?: boolean;
  newlineAfter?: boolean;
  bold?: boolean;
  italic?: boolean;
}

// ============= Message Types =============

export interface MessageDefinition {
  text: string;
  style?: TextStyle;
}

export interface MessageReference {
  ref: string;
}

export type MessageContent = MessageDefinition | MessageReference;

// ============= Default Value Types =============

export type DefaultSource = 'config' | 'static' | 'function';

export interface DefaultValue {
  source: DefaultSource;
  path?: string;
  value?: unknown;
  function?: string;
  fallback?: unknown;
}

// ============= Condition Types =============

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'exists'
  | 'notExists'
  | 'greaterThan'
  | 'lessThan';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

// ============= Choice Types =============

export interface StaticChoice {
  value: string;
  name: string;
  short?: string;
  style?: TextStyle;
  static?: boolean;
  disabled?: boolean | string;
}

export interface DynamicChoicesConfig {
  source: 'tests' | 'playlists' | 'viewports' | string;
  nameTemplate: string;
  valueKey: string;
  shortKey?: string;
  checkedDefault?: boolean;
  descriptionStyle?: TextStyle;
  filter?: Condition;
}

// ============= Validation Types =============

export interface InputValidation {
  function?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  errorMessage?: string;
}

export interface CheckboxValidation {
  minSelected?: number;
  maxSelected?: number;
  errorMessage?: string;
}

export type ValidationConfig = InputValidation | CheckboxValidation;

// ============= Trigger Types =============

export interface StepTrigger {
  condition: Condition;
  gotoStep?: string;
  skipStep?: string;
  action?: string;
}

// ============= Prompt Types =============

export interface PromptConfig {
  message: string;
  name: string;
}

export interface PromptOptions {
  loop?: boolean;
  helpMode?: 'always' | 'never' | 'auto';
  pageSize?: number;
}

// ============= Action Types =============

export interface ActionConfig {
  function: string;
  params?: Record<string, unknown>;
}

// ============= Step Types =============

export type StepType =
  | 'input'
  | 'list'
  | 'checkbox'
  | 'confirm'
  | 'group'
  | 'display'
  | 'action';

export interface BaseStep {
  id: string;
  order: number;
  type: StepType;
  condition?: Condition;
  preMessages?: MessageContent[];
  postMessages?: MessageContent[];
  preAction?: ActionConfig;
  postAction?: ActionConfig;
  outputKey?: string;
  triggers?: StepTrigger[];
}

export interface InputStep extends BaseStep {
  type: 'input';
  prompt: PromptConfig;
  validation?: InputValidation;
  default?: DefaultValue;
  transformer?: string;
}

export interface ListStep extends BaseStep {
  type: 'list';
  prompt: PromptConfig;
  choices?: StaticChoice[];
  dynamicChoices?: DynamicChoicesConfig;
  default?: DefaultValue;
  options?: PromptOptions;
}

export interface CheckboxStep extends BaseStep {
  type: 'checkbox';
  prompt: PromptConfig;
  choices?: StaticChoice[];
  dynamicChoices?: DynamicChoicesConfig;
  validation?: CheckboxValidation;
  options?: PromptOptions;
}

export interface ConfirmStep extends BaseStep {
  type: 'confirm';
  prompt: PromptConfig;
  default?: DefaultValue;
}

export interface GroupStep extends BaseStep {
  type: 'group';
  subSteps: Record<string, Omit<Step, 'id' | 'order'>>;
}

export interface DisplayStep extends BaseStep {
  type: 'display';
  messages: MessageContent[];
}

export interface ActionStep extends BaseStep {
  type: 'action';
  action: ActionConfig;
}

export type Step =
  | InputStep
  | ListStep
  | CheckboxStep
  | ConfirmStep
  | GroupStep
  | DisplayStep
  | ActionStep;

// ============= Summary Display Types =============

export interface SummaryField {
  label: string;
  valueFrom: string;
  condition?: Condition;
  transform?: string;
  prefix?: string;
}

export interface SummaryConfig {
  title: string;
  divider: {
    char: string;
    length: number;
    color: keyof StyleColors | string;
  };
  fields: SummaryField[];
}

// ============= Root Config Type =============

export interface TerminalUIConfig {
  styling: GlobalStyling;
  messages: Record<string, MessageDefinition>;
  steps: Record<string, Step>;
  configurationSummary: SummaryConfig;
}

// ============= Runtime State Types =============

export interface WalkthroughState {
  currentStepId: string;
  collectedData: Record<string, unknown>;
  completedSteps: string[];
  skippedSteps: string[];
}

// ============= Function Registry Types =============

export type RegisteredFunction = (
  state: WalkthroughState,
  params?: Record<string, unknown>
) => Promise<unknown> | unknown;

export type TransformFunction = (
  value: unknown,
  state: WalkthroughState
) => Promise<unknown> | unknown;

// ============= Step Result Type =============

export interface StepResult {
  _nextStep?: string;
  [key: string]: unknown;
}
