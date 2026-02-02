import { TestConfig, TestType, ViewportConfig, CrawlMode, DeepCrawlConfig, ReporterConfig } from '@shared/index.js';
import { TestOrchestrator } from '@orchestrator/test-orchestrator.js';
import { runWalkthroughFlow } from '@utils/terminal-ui-functions.js';

export async function runWalkthrough(): Promise<void> {
  // Run the YAML-driven walkthrough flow
  const state = await runWalkthroughFlow();

  // If confirmed, start the test orchestrator
  if (state.collectedData.confirmed) {
    const config: TestConfig = {
      url: state.collectedData.resolvedUrl as string,
      crawlSite: state.collectedData.crawlSite as boolean,
      crawlMode: state.collectedData.crawlMode as CrawlMode,
      selectedTests: state.collectedData.selectedTests as TestType[],
      viewports: state.collectedData.viewports as ViewportConfig[],
      reporter: state.collectedData.reporter as ReporterConfig,
      verboseMode: state.collectedData.verboseMode as boolean,
      usedPlaylist: state.collectedData.usedPlaylist as string | null,
      deepCrawlConfig: state.collectedData.deepCrawlConfig as DeepCrawlConfig | undefined
    };

    const orchestrator = new TestOrchestrator();
    await orchestrator.runTests(config);
  }
}
