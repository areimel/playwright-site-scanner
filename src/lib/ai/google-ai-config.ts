import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

interface GoogleAIConfig {
  apiKey: string;
  model: string;
  embedModel: string;
  maxTokens: number;
  temperature: number;
}

export class GoogleAIConfigManager {
  private configPath: string;
  private defaultConfig: GoogleAIConfig = {
    apiKey: '',
    model: 'gemini-1.5-pro-latest',
    embedModel: 'text-embedding-004',
    maxTokens: 1000,
    temperature: 0.1
  };

  constructor() {
    this.configPath = path.join('.config', 'google-ai.json');
  }

  /**
   * Get Google AI configuration with API key validation
   */
  async getConfig(): Promise<GoogleAIConfig> {
    try {
      // First check environment variable
      const envApiKey = process.env.GOOGLE_AI_API_KEY;
      if (envApiKey) {
        return {
          ...this.defaultConfig,
          apiKey: envApiKey
        };
      }

      // Then check config file
      const config = await this.loadConfigFile();
      if (config && config.apiKey) {
        return config;
      }

      throw new Error('No Google AI API key found');
      
    } catch (error) {
      throw new Error(`Google AI configuration error: ${error}`);
    }
  }

  /**
   * Validate that the API key is available and properly formatted
   */
  async validateAPIKey(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      
      // Basic format validation for Google AI API keys
      if (!config.apiKey || config.apiKey.length === 0) {
        return false;
      }

      // Google AI API keys typically start with 'AIza' and are ~39 characters long
      if (config.apiKey.startsWith('AIza') && config.apiKey.length >= 35) {
        return true;
      }

      console.warn(chalk.yellow('⚠️  API key format may be incorrect for Google AI'));
      return true; // Allow non-standard formats in case of updates
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: Partial<GoogleAIConfig>): Promise<void> {
    try {
      const currentConfig = await this.loadConfigFile() || this.defaultConfig;
      const updatedConfig = { ...currentConfig, ...config };
      
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(
        this.configPath, 
        JSON.stringify(updatedConfig, null, 2), 
        'utf8'
      );
      
      console.log(chalk.green('✅ Google AI configuration saved'));
      
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Get configuration instructions for users
   */
  getSetupInstructions(): string {
    return `
🤖 Google AI API Configuration Required

To use RAG (Retrieval Augmented Generation) features, you need a Google AI API key:

1. Visit: https://aistudio.google.com/app/apikey
2. Create a new API key
3. Set it as an environment variable:
   
   Windows (Command Prompt):
   set GOOGLE_AI_API_KEY=your_api_key_here
   
   Windows (PowerShell):
   $env:GOOGLE_AI_API_KEY="your_api_key_here"
   
   macOS/Linux:
   export GOOGLE_AI_API_KEY=your_api_key_here

4. Or save it to a config file using the saveConfig method

The RAG service will automatically use the API key from environment variables or config file.

Note: Keep your API key secure and never commit it to version control!
    `;
  }

  /**
   * Check if API key is configured from any source
   */
  async isConfigured(): Promise<boolean> {
    try {
      await this.getConfig();
      return true;
    } catch {
      return false;
    }
  }

  private async loadConfigFile(): Promise<GoogleAIConfig | null> {
    try {
      if (await this.fileExists(this.configPath)) {
        const configData = await fs.readFile(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        return { ...this.defaultConfig, ...config };
      }
      return null;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not load config file: ${error}`));
      return null;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}