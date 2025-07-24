#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ascii_art_js_1 = require("./utils/ascii-art.js");
const walkthrough_js_1 = require("./commands/walkthrough.js");
const program = new commander_1.Command();
program
    .name('playwright-site-scanner')
    .description('Automated website testing with Playwright')
    .version('1.0.0');
program
    .command('start')
    .description('Start the interactive walkthrough')
    .action(async () => {
    console.clear();
    console.log((0, ascii_art_js_1.getWelcomeScreen)());
    console.log((0, ascii_art_js_1.getBanner)());
    console.log(chalk_1.default.gray('Starting interactive walkthrough...\n'));
    try {
        await (0, walkthrough_js_1.runWalkthrough)();
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ An error occurred:'), error);
        process.exit(1);
    }
});
// If no command is provided, show welcome screen and run walkthrough
if (process.argv.length === 2) {
    console.clear();
    console.log((0, ascii_art_js_1.getWelcomeScreen)());
    console.log((0, ascii_art_js_1.getBanner)());
    console.log(chalk_1.default.gray('Starting interactive walkthrough...\n'));
    (0, walkthrough_js_1.runWalkthrough)().catch((error) => {
        console.error(chalk_1.default.red('\n❌ An error occurred:'), error);
        process.exit(1);
    });
}
else {
    program.parse();
}
//# sourceMappingURL=cli.js.map