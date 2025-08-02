import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface BrowserInfo {
  name: string;
  executablePath?: string;
  isInstalled: boolean;
  version?: string;
}

export interface BrowserManagerConfig {
  customBrowserPath?: string;
  skipBrowserCheck?: boolean;
  autoDownload?: boolean;
}

export class BrowserManager {
  private config: BrowserManagerConfig;

  constructor(config: BrowserManagerConfig = {}) {
    this.config = config;
  }

  /**
   * Check if Playwright browsers are installed and accessible
   */
  async checkPlaywrightBrowsers(): Promise<{
    chromium: BrowserInfo;
    firefox: BrowserInfo;
    webkit: BrowserInfo;
  }> {
    console.log(chalk.blue('🔍 Checking browser availability...'));

    const browsers = {
      chromium: await this.checkPlaywrightBrowser('chromium'),
      firefox: await this.checkPlaywrightBrowser('firefox'),
      webkit: await this.checkPlaywrightBrowser('webkit')
    };

    this.displayBrowserStatus(browsers);
    return browsers;
  }

  /**
   * Check a specific Playwright browser
   */
  private async checkPlaywrightBrowser(browserName: string): Promise<BrowserInfo> {
    try {
      // Try to get browser path from Playwright
      const browserPath = await this.getPlaywrightBrowserPath(browserName);
      
      if (browserPath && existsSync(browserPath)) {
        const version = await this.getBrowserVersion(browserName);
        return {
          name: browserName,
          executablePath: browserPath,
          isInstalled: true,
          version
        };
      }
    } catch (error) {
      // Browser not found via Playwright, try system installation
      const systemBrowser = await this.checkSystemBrowser(browserName);
      if (systemBrowser.isInstalled) {
        return systemBrowser;
      }
    }

    return {
      name: browserName,
      isInstalled: false
    };
  }

  /**
   * Get Playwright browser executable path
   */
  private async getPlaywrightBrowserPath(browserName: string): Promise<string | null> {
    try {
      // Try to launch browser and get executable path
      const browserModule = await import('playwright');
      let browser;
      
      switch (browserName) {
        case 'chromium':
          browser = browserModule.chromium;
          break;
        case 'firefox':
          browser = browserModule.firefox;
          break;
        case 'webkit':
          browser = browserModule.webkit;
          break;
        default:
          return null;
      }

      // Get executable path without launching
      const browserType = browser;
      return browserType.executablePath();
      
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️  Could not locate ${browserName} via Playwright`));
      return null;
    }
  }

  /**
   * Check for system-installed browsers
   */
  private async checkSystemBrowser(browserName: string): Promise<BrowserInfo> {
    const systemPaths = this.getSystemBrowserPaths(browserName);
    
    for (const browserPath of systemPaths) {
      if (existsSync(browserPath)) {
        return {
          name: browserName,
          executablePath: browserPath,
          isInstalled: true,
          version: 'System Installation'
        };
      }
    }

    return {
      name: browserName,
      isInstalled: false
    };
  }

  /**
   * Get common system browser installation paths
   */
  private getSystemBrowserPaths(browserName: string): string[] {
    const platform = os.platform();
    const paths: string[] = [];

    switch (browserName) {
      case 'chromium':
      case 'chrome':
        if (platform === 'win32') {
          paths.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
          );
        } else if (platform === 'darwin') {
          paths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        } else {
          paths.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/snap/bin/chromium');
        }
        break;
      
      case 'firefox':
        if (platform === 'win32') {
          paths.push(
            'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
            'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
          );
        } else if (platform === 'darwin') {
          paths.push('/Applications/Firefox.app/Contents/MacOS/firefox');
        } else {
          paths.push('/usr/bin/firefox', '/snap/bin/firefox');
        }
        break;
    }

    return paths;
  }

  /**
   * Get browser version
   */
  private async getBrowserVersion(browserName: string): Promise<string> {
    try {
      // Try to get version using exec
      const { stdout } = await execAsync('npx playwright --version');
      return stdout.trim();
    } catch (error) {
      return 'Playwright (version unknown)';
    }
  }

  /**
   * Display browser status to user
   */
  private displayBrowserStatus(browsers: Record<string, BrowserInfo>): void {
    console.log(chalk.blue('\n📊 Browser Status:'));
    console.log(chalk.cyan('═'.repeat(50)));

    Object.values(browsers).forEach(browser => {
      const status = browser.isInstalled 
        ? chalk.green('✅ Available') 
        : chalk.red('❌ Not Found');
      
      console.log(chalk.white(`${browser.name.padEnd(10)} ${status}`));
      
      if (browser.isInstalled && browser.executablePath) {
        console.log(chalk.gray(`           Path: ${browser.executablePath}`));
      }
      if (browser.isInstalled && browser.version) {
        console.log(chalk.gray(`           Version: ${browser.version}`));
      }
    });
    
    console.log(chalk.cyan('═'.repeat(50)));
  }

  /**
   * Download Playwright browsers
   */
  async downloadPlaywrightBrowsers(browsers: string[] = ['chromium']): Promise<boolean> {
    console.log(chalk.blue('📥 Downloading Playwright browsers...'));
    
    try {
      for (const browser of browsers) {
        console.log(chalk.gray(`   Downloading ${browser}...`));
        await execAsync(`npx playwright install ${browser}`);
        console.log(chalk.green(`   ✅ ${browser} installed`));
      }
      
      console.log(chalk.green('🎉 All browsers downloaded successfully!'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Browser download failed:'), error);
      return false;
    }
  }

  /**
   * Verify that at least one browser is available for testing
   */
  async ensureBrowserAvailable(): Promise<BrowserInfo | null> {
    if (this.config.skipBrowserCheck) {
      return { name: 'skipped', isInstalled: true };
    }

    const browsers = await this.checkPlaywrightBrowsers();
    
    // Check if we have at least Chromium (our preferred browser)
    if (browsers.chromium.isInstalled) {
      return browsers.chromium;
    }

    // Fallback to any available browser
    const availableBrowser = Object.values(browsers).find(b => b.isInstalled);
    if (availableBrowser) {
      return availableBrowser;
    }

    // No browsers available
    console.log(chalk.yellow('\n⚠️  No browsers found!'));
    
    if (this.config.autoDownload) {
      console.log(chalk.blue('🔄 Auto-downloading Chromium...'));
      const success = await this.downloadPlaywrightBrowsers(['chromium']);
      
      if (success) {
        const chromium = await this.checkPlaywrightBrowser('chromium');
        return chromium.isInstalled ? chromium : null;
      }
    } else {
      console.log(chalk.yellow('💡 Tip: Run with --download-browsers to automatically install browsers'));
      console.log(chalk.yellow('   Or install manually: npx playwright install chromium'));
    }

    return null;
  }

  /**
   * Get browser launch options for Playwright
   */
  getBrowserLaunchOptions(browserInfo?: BrowserInfo): Record<string, any> {
    const options: Record<string, any> = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    // Use custom browser path if specified
    if (this.config.customBrowserPath) {
      options.executablePath = this.config.customBrowserPath;
    } else if (browserInfo?.executablePath && !browserInfo.executablePath.includes('playwright')) {
      // Use system browser if not a Playwright browser
      options.executablePath = browserInfo.executablePath;
    }

    return options;
  }

  /**
   * Create browser manager with configuration
   */
  static create(config: BrowserManagerConfig = {}): BrowserManager {
    return new BrowserManager(config);
  }
}