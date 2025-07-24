"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWalkthrough = runWalkthrough;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const validation_js_1 = require("../utils/validation.js");
const test_orchestrator_js_1 = require("../orchestrator/test-orchestrator.js");
const AVAILABLE_TESTS = [
    {
        id: 'screenshots',
        name: 'Screenshots',
        description: 'Capture screenshots across different viewports',
        enabled: false
    },
    {
        id: 'seo',
        name: 'SEO Scan',
        description: 'Analyze SEO elements (meta tags, headings, etc.)',
        enabled: false
    },
    {
        id: 'accessibility',
        name: 'Accessibility Scan',
        description: 'Check for accessibility issues and WCAG compliance',
        enabled: false
    }
];
const VIEWPORTS = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 }
];
async function runWalkthrough() {
    console.log(chalk_1.default.blue('🌐 Let\'s set up your website testing session!\n'));
    // Step 1: Get URL
    const { url } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'What URL would you like to test?',
            validate: validation_js_1.validateUrl,
            default: 'https://example.com'
        }
    ]);
    console.log(chalk_1.default.green(`✅ URL set to: ${url}\n`));
    // Step 2: Ask about site crawling
    const { crawlSite } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'crawlSite',
            message: 'Would you like to crawl the entire site and test all pages?',
            default: false
        }
    ]);
    const crawlMessage = crawlSite
        ? chalk_1.default.yellow('🕷️  Will crawl entire site')
        : chalk_1.default.yellow('📄 Will test single page only');
    console.log(`${crawlMessage}\n`);
    // Step 3: Select tests
    console.log(chalk_1.default.blue('🧪 Select which tests you\'d like to run:\n'));
    const { selectedTestIds } = await inquirer_1.default.prompt([
        {
            type: 'checkbox',
            name: 'selectedTestIds',
            message: 'Choose your tests:',
            choices: AVAILABLE_TESTS.map(test => ({
                name: `${test.name} - ${chalk_1.default.gray(test.description)}`,
                value: test.id,
                checked: false
            })),
            validate: (answer) => {
                if (answer.length === 0) {
                    return 'Please select at least one test to run.';
                }
                return true;
            }
        }
    ]);
    const selectedTests = AVAILABLE_TESTS.filter(test => selectedTestIds.includes(test.id)).map(test => ({ ...test, enabled: true }));
    console.log(chalk_1.default.green(`✅ Selected ${selectedTests.length} test(s)\n`));
    // Step 4: Confirmation
    await showConfirmation({
        url,
        crawlSite,
        selectedTests,
        viewports: VIEWPORTS
    });
}
async function showConfirmation(config) {
    console.log(chalk_1.default.blue('📋 Test Configuration Summary:'));
    console.log(chalk_1.default.cyan('═'.repeat(50)));
    console.log(chalk_1.default.white(`🌐 URL: ${config.url}`));
    console.log(chalk_1.default.white(`🕷️  Crawl entire site: ${config.crawlSite ? 'Yes' : 'No'}`));
    console.log(chalk_1.default.white(`🧪 Selected tests: ${config.selectedTests.map(t => t.name).join(', ')}`));
    console.log(chalk_1.default.white(`📱 Viewports: ${config.viewports.map(v => v.name).join(', ')}`));
    console.log(chalk_1.default.cyan('═'.repeat(50)));
    const { confirmed } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: 'Ready to start testing?',
            default: true
        }
    ]);
    if (confirmed) {
        console.log(chalk_1.default.green('\n🚀 Starting test session...\n'));
        const orchestrator = new test_orchestrator_js_1.TestOrchestrator();
        await orchestrator.runTests(config);
    }
    else {
        console.log(chalk_1.default.yellow('\n⏹️  Test session cancelled.'));
        process.exit(0);
    }
}
//# sourceMappingURL=walkthrough.js.map