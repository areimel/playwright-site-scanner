const { TestConfigManager } = require('./dist/orchestrator/test-config-manager.js');

// Create a test configuration similar to what would be created by the walkthrough
const testConfig = {
  url: 'https://alecreimel.com',
  crawlSite: true,
  selectedTests: [
    { id: 'screenshots', name: 'Screenshots', description: 'Capture screenshots across different viewports', enabled: true },
    { id: 'seo', name: 'SEO Scan', description: 'Analyze SEO elements (meta tags, headings, etc.)', enabled: true },
    { id: 'accessibility', name: 'Accessibility Scan', description: 'Check for accessibility issues and WCAG compliance', enabled: true },
    { id: 'sitemap', name: 'Sitemap Generation', description: 'Generate XML sitemap for search engine submission', enabled: true },
    { id: 'content-scraping', name: 'Content Scraping', description: 'Extract page content and images to markdown files', enabled: true },
    { id: 'site-summary', name: 'Site Summary', description: 'Generate comprehensive site overview report', enabled: true },
    { id: 'api-key-scan', name: 'API Key Security Scan', description: 'Scan site for exposed API keys and security tokens', enabled: true }
  ],
  viewports: [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 }
  ],
  reporter: {
    enabled: true,
    type: 'html',
    openBehavior: 'always',
    includeScreenshots: true,
    includeDetailedLogs: true
  }
};

// Test the configuration validation
console.log('Testing configuration validation...');
const validation = TestConfigManager.validateConfig(testConfig);
console.log('Validation result:', validation);

if (validation.valid) {
  console.log('✅ Configuration validation passed!');
  console.log('Test can proceed without the "Missing dependencies: site-crawling" error.');
} else {
  console.log('❌ Configuration validation failed:');
  validation.errors.forEach(error => console.log(`  - ${error}`));
}