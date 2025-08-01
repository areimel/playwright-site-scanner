Build a Node.js CLI app for running Playwright tests on whatever site the user specifies. I am building a tool to help me run Playwright tests against my website projets, and I want to be able to run them from a standalone CLI app that I can point at a URL instead of integrating Playwright into a project. The name of this tool will be "playwright-site-scanner".

I want the CLI app to use the following tech stack:
- Node.js & Typescript
- commander(https://www.npmjs.com/package/commander)
- chalk (https://www.npmjs.com/package/chalk)
- playwright (https://www.npmjs.com/package/playwright)

When running the CLI tool without arguments, it should open into a "walkthrough" style UI built with commander and chalk. It should first ask the user what URL they want to run tests on, and then start asking what settings they want to use. Since I am expecting to build out a fairly large number of test options, I want this to be a checklist-style selection. Once the user selects everything, the app should display a confirmation screen detailing what tests will be run, with a "y/n" confirmation request. The CLI app should then launch the Playwright tests, displaying what tests are currently running, have finished running, and are in the queue to be run, and an overall progress bar for the testing session. When finished, the CLI app should display a "tests complete" message with details about the session, such as how many tests succeeded or failed, how long the session took, any errors etc.

Do some research on building a well-designed, user-friendly CLI interface with Node, Typescript, Commander, and Chalk. Use ultrathink to formulate a detailed design doc named `CLI_DESIGN.md` where you'll write up notes and references for building command line UIs.

The Playwright code should be built using the "orchestrator" style of software architecture - build the Playwright integration around a custom runner file that acts as the central "brain" function, to give it full control over the entire testing session. This central file should then use a set of dedicated sub-function files that each handle specific tests/actions/functions, such as taking screenshots or scanning for errors.

For each testing sessions (ie, each time the user runs a set of tests), the CLI app should make a single date/timestamped folder where it saves the test results, which are then organized by page and test type. Here is an example of how I expect the resulting folder/file stucture to look:

```

- playwright-site-scanner-sessions
  - 7-22-2025_23-18
    - session-summary.md
    - index
      - index-summary.md
      - screenshots
        - index-desktop.png
        - index-tablet.png
        - index-mobile.png
      - scans
        - index-seo-scan.md
        - index-accessibility-scan.md
      - form-tests
        - index-form-tests.md
    - about
      - about-summary.md
      - screenshots
        - about-desktop.png
        - about-tablet.png
        - about-mobile.png
      - scans
        - about-seo-scan.md
        - about-accessibility-scan.md
      - form-tests
        - about-form-tests.md
```
The folder structure should go: `timestamped-session-folder > page-name > test-type > results-file`

To get our project started, I want us to include the following types of tests: 1) screenshots, 2) seo scans, 3) accessibility scans. I also want the CLI app to have the option of running tests on just the URL provided, or crawling the whole site and testing every available page. The app should also produce a brief summary of the results for each page in a markdown doc, along with another summary doc for the overall session.

Another feature the CLI app should have: an ASCII art logo/welcome screen - similar to the ASCII art logo for Claude Code.

Set up a markdown file to use as a planning doc for this project, so you can better keep track of your work. Break the project up into distinct phases, where each phase tackles a major part of the project's development, and each phase results in a fully-working, runnable MVP version of the project that can be tested. Keep your code DRY, maintain good separation of concerns, and use strong typing.

Use a todo list, and use sub-agents to develop features in parallel.