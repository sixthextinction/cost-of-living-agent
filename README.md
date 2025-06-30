# Agentic Cost-of-Living Analysis Tool

A multi-agent system that has minimal learning and memory, for analyzing and comparing the cost of living across different cities. 

Uses a fleet of AI agents to gather, analyze, and report on real-time cost of living data for a given list of cities, providing a breakdown tailored to a specified monthly budget. 

Uses Bright Data SERP API to gather results from Google, and OpenAI to reason about it. 

Once done, saves an executive report to a markdown file.

## Requirements

- Node.js
- An OpenAI subscription
- Bright Data SERP/proxy account (env var needs customer ID, zone, and password).

## Quick Start

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Credentials:**
    - Set your OpenAI API key as an environment variable (e.g., in a `.env` file).
      ```
      OPENAI_API_KEY=your_openai_api_key
      ```
    - Add your BrightData credentials here too
        ```
        BRIGHT_DATA_CUSTOMER_ID=hl_xxxxxx
        BRIGHT_DATA_ZONE=xxxxxx
        BRIGHT_DATA_PASSWORD=xxxxxxxxxxxxxxx
        ```

3.  **Run the Analysis:**

    - **Run with default budget:**
      ```bash
      node main.js
      ```

    - **Run with a custom budget (e.g., $1500/month):**
      ```bash
      node main.js 1500
      ```

    - **Show help:**
      ```bash
      node main.js help
      ```

## Configuration

Most of our project config is in `config.js`. You can modify it to:

- `cities`: Add or remove cities for analysis.
- `costCategories`: Define the expense categories to research.
- `monthlyBudgetUSD`: Set the default monthly budget.
- `cacheDays`: Adjust the cache duration for search results.

## How It Works

The system launches parallel agents for each specified city. Each agent performs a Perceive->Reason->Reflect cycle the following steps:

1.  **Search**: Gathers cost-of-living data for various categories using a search engine.
2.  **Analyze**: Uses an AI model to extract structured cost data from the search results.
3.  **Reflect & Retry**: If data quality is low, the agent retries with a different search strategy.
4.  **Report**: Once all agents complete, a comparative analysis and a final markdown report are generated, displayed in the console, and saved.

```
Simple Flow:
Cities → Parallel Analysis → Markdown Report → Output
         ↓
         Cache (for performance)
```

## Output

The tool outputs a clean markdown report directly to the console containing:
- Executive summary with key findings
- Cost comparison table
- Individual city details with remote work assessments


## Cache System

- Minimal filesystem based cache rolled from scratch; should probably replace that with something better for production
- Caches search results for 7 days by default
- Significantly reduces API costs on repeat runs
- Stored in `/cache` directory
- Automatic cleanup of expired data
