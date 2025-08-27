import { AIServiceConfig, AIProvider, AICapabilityConfig, AIFeatureFlags, RateLimitConfig } from '../types/ai-types.js';

/**
 * Environment variable names for AI configuration
 */
export const AI_ENV_VARS = {
  // Primary API Key
  GOOGLE_GEMINI_API_KEY: 'GOOGLE_GEMINI_API_KEY',
  
  // Alternative API Keys
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY',
  
  // Service Configuration
  AI_PROVIDER: 'AI_PROVIDER',
  AI_MODEL: 'AI_MODEL',
  AI_ENDPOINT: 'AI_ENDPOINT',
  AI_MAX_TOKENS: 'AI_MAX_TOKENS',
  AI_TEMPERATURE: 'AI_TEMPERATURE',
  AI_TIMEOUT: 'AI_TIMEOUT',
  
  // Feature Flags
  AI_ENABLE_CONTENT_ANALYSIS: 'AI_ENABLE_CONTENT_ANALYSIS',
  AI_ENABLE_VISION_ANALYSIS: 'AI_ENABLE_VISION_ANALYSIS',
  AI_ENABLE_RAG_SEARCH: 'AI_ENABLE_RAG_SEARCH',
  AI_ENABLE_CHATBOT: 'AI_ENABLE_CHATBOT',
  AI_ENABLE_AUTO_RECOMMENDATIONS: 'AI_ENABLE_AUTO_RECOMMENDATIONS',
  AI_ENABLE_BATCH_ANALYSIS: 'AI_ENABLE_BATCH_ANALYSIS',
  
  // Privacy and Compliance
  AI_REQUIRE_EXPLICIT_CONSENT: 'AI_REQUIRE_EXPLICIT_CONSENT',
  AI_LOG_ANALYTICS: 'AI_LOG_ANALYTICS',
  
  // Rate Limiting
  AI_RATE_LIMIT_RPM: 'AI_RATE_LIMIT_RPM',
  AI_RATE_LIMIT_TPM: 'AI_RATE_LIMIT_TPM'
} as const;

/**
 * Default AI configuration values
 */
export const DEFAULT_AI_CONFIG = {
  provider: 'google-gemini' as AIProvider,
  model: 'gemini-1.5-pro',
  maxTokens: 8192,
  temperature: 0.3,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  rateLimiting: {
    requestsPerMinute: 60,
    tokensPerMinute: 1000000,
    burstLimit: 10
  } as RateLimitConfig
} as const;

/**
 * Default capability configuration
 */
export const DEFAULT_CAPABILITIES: AICapabilityConfig = {
  contentAnalysis: true,
  visionAnalysis: true,
  ragQueries: true,
  chatbot: true,
  reportGeneration: true,
  autoInsights: true
};

/**
 * Default feature flags (conservative defaults)
 */
export const DEFAULT_FEATURE_FLAGS: AIFeatureFlags = {
  enableContentIntelligence: false,
  enableVisualAnalysis: false,
  enableRAGSearch: false,
  enableChatbot: false,
  enableAutoRecommendations: false,
  enableBatchAnalysis: false,
  requireExplicitConsent: true,
  logAnalytics: false
};

/**
 * AI configuration validation result
 */
export interface AIConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  provider: AIProvider | null;
  availableFeatures: string[];
}

/**
 * Complete AI configuration object
 */
export interface CompleteAIConfig {
  service: AIServiceConfig;
  capabilities: AICapabilityConfig;
  features: AIFeatureFlags;
  isConfigured: boolean;
  validationErrors: string[];
}

/**
 * Validates AI configuration from environment variables
 */
export function validateAIConfig(): AIConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const availableFeatures: string[] = [];
  
  // Determine provider
  const provider = (process.env[AI_ENV_VARS.AI_PROVIDER] as AIProvider) || DEFAULT_AI_CONFIG.provider;
  
  // Validate API key based on provider
  let hasValidApiKey = false;
  
  switch (provider) {
    case 'google-gemini':
      if (process.env[AI_ENV_VARS.GOOGLE_GEMINI_API_KEY]) {
        hasValidApiKey = true;
        availableFeatures.push('content-analysis', 'vision-analysis', 'rag-queries');
      } else {
        errors.push(`Missing required environment variable: ${AI_ENV_VARS.GOOGLE_GEMINI_API_KEY}`);
      }
      break;
      
    case 'openai':
      if (process.env[AI_ENV_VARS.OPENAI_API_KEY]) {
        hasValidApiKey = true;
        availableFeatures.push('content-analysis', 'vision-analysis', 'chatbot');
      } else {
        errors.push(`Missing required environment variable: ${AI_ENV_VARS.OPENAI_API_KEY}`);
      }
      break;
      
    case 'anthropic':
      if (process.env[AI_ENV_VARS.ANTHROPIC_API_KEY]) {
        hasValidApiKey = true;
        availableFeatures.push('content-analysis', 'chatbot');
      } else {
        errors.push(`Missing required environment variable: ${AI_ENV_VARS.ANTHROPIC_API_KEY}`);
      }
      break;
      
    case 'azure':
      if (process.env[AI_ENV_VARS.AZURE_OPENAI_API_KEY]) {
        hasValidApiKey = true;
        availableFeatures.push('content-analysis', 'vision-analysis');
        
        if (!process.env[AI_ENV_VARS.AI_ENDPOINT]) {
          errors.push(`Azure provider requires ${AI_ENV_VARS.AI_ENDPOINT} to be set`);
        }
      } else {
        errors.push(`Missing required environment variable: ${AI_ENV_VARS.AZURE_OPENAI_API_KEY}`);
      }
      break;
      
    default:
      errors.push(`Unsupported AI provider: ${provider}`);
  }
  
  // Validate numeric configuration values
  const maxTokens = process.env[AI_ENV_VARS.AI_MAX_TOKENS];
  if (maxTokens && (isNaN(Number(maxTokens)) || Number(maxTokens) <= 0)) {
    errors.push(`Invalid ${AI_ENV_VARS.AI_MAX_TOKENS}: must be a positive number`);
  }
  
  const temperature = process.env[AI_ENV_VARS.AI_TEMPERATURE];
  if (temperature && (isNaN(Number(temperature)) || Number(temperature) < 0 || Number(temperature) > 2)) {
    errors.push(`Invalid ${AI_ENV_VARS.AI_TEMPERATURE}: must be between 0 and 2`);
  }
  
  const timeout = process.env[AI_ENV_VARS.AI_TIMEOUT];
  if (timeout && (isNaN(Number(timeout)) || Number(timeout) <= 0)) {
    errors.push(`Invalid ${AI_ENV_VARS.AI_TIMEOUT}: must be a positive number (milliseconds)`);
  }
  
  // Validate rate limiting
  const rateRpm = process.env[AI_ENV_VARS.AI_RATE_LIMIT_RPM];
  if (rateRpm && (isNaN(Number(rateRpm)) || Number(rateRpm) <= 0)) {
    errors.push(`Invalid ${AI_ENV_VARS.AI_RATE_LIMIT_RPM}: must be a positive number`);
  }
  
  const rateTpm = process.env[AI_ENV_VARS.AI_RATE_LIMIT_TPM];
  if (rateTpm && (isNaN(Number(rateTpm)) || Number(rateTpm) <= 0)) {
    errors.push(`Invalid ${AI_ENV_VARS.AI_RATE_LIMIT_TPM}: must be a positive number`);
  }
  
  // Generate warnings for missing optional features
  if (!hasValidApiKey) {
    warnings.push('No valid API key found - AI features will be disabled');
  }
  
  if (hasValidApiKey && availableFeatures.length === 0) {
    warnings.push('API key found but no features are available for the selected provider');
  }
  
  return {
    isValid: errors.length === 0 && hasValidApiKey,
    errors,
    warnings,
    provider: hasValidApiKey ? provider : null,
    availableFeatures
  };
}

/**
 * Loads AI service configuration from environment variables
 */
export function loadAIServiceConfig(provider?: AIProvider): AIServiceConfig | null {
  const validation = validateAIConfig();
  
  if (!validation.isValid || !validation.provider) {
    return null;
  }
  
  const selectedProvider = provider || validation.provider;
  let apiKey: string;
  
  switch (selectedProvider) {
    case 'google-gemini':
      apiKey = process.env[AI_ENV_VARS.GOOGLE_GEMINI_API_KEY] || '';
      break;
    case 'openai':
      apiKey = process.env[AI_ENV_VARS.OPENAI_API_KEY] || '';
      break;
    case 'anthropic':
      apiKey = process.env[AI_ENV_VARS.ANTHROPIC_API_KEY] || '';
      break;
    case 'azure':
      apiKey = process.env[AI_ENV_VARS.AZURE_OPENAI_API_KEY] || '';
      break;
    default:
      return null;
  }
  
  if (!apiKey) {
    return null;
  }
  
  return {
    provider: selectedProvider,
    apiKey,
    model: process.env[AI_ENV_VARS.AI_MODEL] || getDefaultModel(selectedProvider),
    endpoint: process.env[AI_ENV_VARS.AI_ENDPOINT],
    maxTokens: process.env[AI_ENV_VARS.AI_MAX_TOKENS] 
      ? Number(process.env[AI_ENV_VARS.AI_MAX_TOKENS]) 
      : DEFAULT_AI_CONFIG.maxTokens,
    temperature: process.env[AI_ENV_VARS.AI_TEMPERATURE] 
      ? Number(process.env[AI_ENV_VARS.AI_TEMPERATURE]) 
      : DEFAULT_AI_CONFIG.temperature,
    timeout: process.env[AI_ENV_VARS.AI_TIMEOUT] 
      ? Number(process.env[AI_ENV_VARS.AI_TIMEOUT]) 
      : DEFAULT_AI_CONFIG.timeout,
    retryAttempts: DEFAULT_AI_CONFIG.retryAttempts,
    rateLimiting: {
      requestsPerMinute: process.env[AI_ENV_VARS.AI_RATE_LIMIT_RPM] 
        ? Number(process.env[AI_ENV_VARS.AI_RATE_LIMIT_RPM]) 
        : DEFAULT_AI_CONFIG.rateLimiting.requestsPerMinute,
      tokensPerMinute: process.env[AI_ENV_VARS.AI_RATE_LIMIT_TPM] 
        ? Number(process.env[AI_ENV_VARS.AI_RATE_LIMIT_TPM]) 
        : DEFAULT_AI_CONFIG.rateLimiting.tokensPerMinute,
      burstLimit: DEFAULT_AI_CONFIG.rateLimiting.burstLimit
    }
  };
}

/**
 * Loads AI feature flags from environment variables
 */
export function loadAIFeatureFlags(): AIFeatureFlags {
  return {
    enableContentIntelligence: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_CONTENT_ANALYSIS, DEFAULT_FEATURE_FLAGS.enableContentIntelligence),
    enableVisualAnalysis: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_VISION_ANALYSIS, DEFAULT_FEATURE_FLAGS.enableVisualAnalysis),
    enableRAGSearch: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_RAG_SEARCH, DEFAULT_FEATURE_FLAGS.enableRAGSearch),
    enableChatbot: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_CHATBOT, DEFAULT_FEATURE_FLAGS.enableChatbot),
    enableAutoRecommendations: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_AUTO_RECOMMENDATIONS, DEFAULT_FEATURE_FLAGS.enableAutoRecommendations),
    enableBatchAnalysis: getBooleanEnvVar(AI_ENV_VARS.AI_ENABLE_BATCH_ANALYSIS, DEFAULT_FEATURE_FLAGS.enableBatchAnalysis),
    requireExplicitConsent: getBooleanEnvVar(AI_ENV_VARS.AI_REQUIRE_EXPLICIT_CONSENT, DEFAULT_FEATURE_FLAGS.requireExplicitConsent),
    logAnalytics: getBooleanEnvVar(AI_ENV_VARS.AI_LOG_ANALYTICS, DEFAULT_FEATURE_FLAGS.logAnalytics)
  };
}

/**
 * Gets complete AI configuration including validation status
 */
export function getCompleteAIConfig(): CompleteAIConfig {
  const validation = validateAIConfig();
  const service = loadAIServiceConfig();
  const capabilities = getCapabilitiesForProvider(validation.provider);
  const features = loadAIFeatureFlags();
  
  return {
    service: service || createEmptyServiceConfig(),
    capabilities,
    features,
    isConfigured: validation.isValid,
    validationErrors: validation.errors
  };
}

/**
 * Checks if AI features are available and enabled
 */
export function isAIFeatureAvailable(feature: keyof AIFeatureFlags): boolean {
  const config = getCompleteAIConfig();
  
  if (!config.isConfigured) {
    return false;
  }
  
  return config.features[feature];
}

/**
 * Gets a formatted error message for missing AI configuration
 */
export function getAIConfigErrorMessage(): string {
  const validation = validateAIConfig();
  
  if (validation.isValid) {
    return '';
  }
  
  let message = 'AI features are disabled due to configuration issues:\n\n';
  
  validation.errors.forEach(error => {
    message += `❌ ${error}\n`;
  });
  
  if (validation.warnings.length > 0) {
    message += '\nWarnings:\n';
    validation.warnings.forEach(warning => {
      message += `⚠️  ${warning}\n`;
    });
  }
  
  message += '\nTo enable AI features:\n';
  message += `1. Set ${AI_ENV_VARS.GOOGLE_GEMINI_API_KEY} environment variable\n`;
  message += '2. Restart the application\n';
  message += '3. Enable desired features via environment variables\n';
  
  return message;
}

/**
 * Creates a setup guide for AI configuration
 */
export function generateAISetupGuide(): string {
  const guide = `
# AI Features Setup Guide

## Quick Start (Google Gemini)
Set your Google Gemini API key:
\`\`\`bash
export ${AI_ENV_VARS.GOOGLE_GEMINI_API_KEY}="your_api_key_here"
\`\`\`

## Available Providers
- **google-gemini** (default): Content analysis, vision analysis, RAG queries
- **openai**: Content analysis, vision analysis, chatbot
- **anthropic**: Content analysis, chatbot
- **azure**: Content analysis, vision analysis

## Configuration Options
\`\`\`bash
# Provider Selection
export ${AI_ENV_VARS.AI_PROVIDER}="google-gemini"
export ${AI_ENV_VARS.AI_MODEL}="gemini-1.5-pro"

# Performance Tuning
export ${AI_ENV_VARS.AI_MAX_TOKENS}="8192"
export ${AI_ENV_VARS.AI_TEMPERATURE}="0.3"
export ${AI_ENV_VARS.AI_TIMEOUT}="30000"

# Feature Flags
export ${AI_ENV_VARS.AI_ENABLE_CONTENT_ANALYSIS}="true"
export ${AI_ENV_VARS.AI_ENABLE_VISION_ANALYSIS}="true"
export ${AI_ENV_VARS.AI_ENABLE_RAG_SEARCH}="true"
export ${AI_ENV_VARS.AI_ENABLE_CHATBOT}="true"

# Rate Limiting
export ${AI_ENV_VARS.AI_RATE_LIMIT_RPM}="60"
export ${AI_ENV_VARS.AI_RATE_LIMIT_TPM}="1000000"
\`\`\`

## Privacy Settings
\`\`\`bash
export ${AI_ENV_VARS.AI_REQUIRE_EXPLICIT_CONSENT}="true"
export ${AI_ENV_VARS.AI_LOG_ANALYTICS}="false"
\`\`\`
`;
  
  return guide.trim();
}

// Utility functions
function getBooleanEnvVar(envVar: string, defaultValue: boolean): boolean {
  const value = process.env[envVar];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'google-gemini':
      return 'gemini-1.5-pro';
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'azure':
      return 'gpt-4o';
    default:
      return DEFAULT_AI_CONFIG.model;
  }
}

function getCapabilitiesForProvider(provider: AIProvider | null): AICapabilityConfig {
  if (!provider) {
    return {
      contentAnalysis: false,
      visionAnalysis: false,
      ragQueries: false,
      chatbot: false,
      reportGeneration: false,
      autoInsights: false
    };
  }
  
  switch (provider) {
    case 'google-gemini':
      return {
        contentAnalysis: true,
        visionAnalysis: true,
        ragQueries: true,
        chatbot: true,
        reportGeneration: true,
        autoInsights: true
      };
      
    case 'openai':
      return {
        contentAnalysis: true,
        visionAnalysis: true,
        ragQueries: true,
        chatbot: true,
        reportGeneration: true,
        autoInsights: true
      };
      
    case 'anthropic':
      return {
        contentAnalysis: true,
        visionAnalysis: false, // Claude doesn't support vision in all versions
        ragQueries: true,
        chatbot: true,
        reportGeneration: true,
        autoInsights: true
      };
      
    case 'azure':
      return {
        contentAnalysis: true,
        visionAnalysis: true,
        ragQueries: true,
        chatbot: true,
        reportGeneration: true,
        autoInsights: true
      };
      
    default:
      return DEFAULT_CAPABILITIES;
  }
}

function createEmptyServiceConfig(): AIServiceConfig {
  return {
    provider: 'google-gemini',
    apiKey: '',
    model: DEFAULT_AI_CONFIG.model,
    maxTokens: DEFAULT_AI_CONFIG.maxTokens,
    temperature: DEFAULT_AI_CONFIG.temperature,
    timeout: DEFAULT_AI_CONFIG.timeout,
    retryAttempts: DEFAULT_AI_CONFIG.retryAttempts,
    rateLimiting: DEFAULT_AI_CONFIG.rateLimiting
  };
}