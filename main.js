// Agentic Cost-of-Living Analysis V2
// Multi-agent system with reflexive evaluation, retry logic, and learning
// where each city gets its own autonomous agent with individual memory and retry logic

/*
 * ESTIMATED API USAGE PER RUN
 * =============================
 * 
 * BRIGHTDATA SERP API CALLS:
 * - Base scenario (5 cities × 5 categories × 1 iteration): 25 calls
 * - With retries (avg 1.5 iterations per agent): ~37 calls
 * 
 * OPENAI API CALLS (GPT-4o-mini):
 * - Cost extraction: 5 cities × 5 categories × avg 1.5 iterations = ~37 calls
 * - Remote work summary: 5 cities × avg 1.5 iterations = ~7 calls  
 * - Total: ~44 calls per run
 *
 * CACHE BENEFITS:
 * - Cached SERP data eliminates BrightData costs for repeat runs
 * - Cache expires after 7 days (of course, this is configurable in cache.js)
 * - For now, OpenAI costs remain the same (analysis always runs fresh)
 */

const CONFIG = require('./config');
const { agentTick } = require('./agent');
const { delay, saveMarkdownReport, contextToAnalysis } = require('./utils');
const { generateComparativeAnalysis, generateMarkdownReport } = require('./reports');

async function main(customBudget = null) {
  try {
    const budget = customBudget || CONFIG.monthlyBudgetUSD;
    console.log('Starting Cost-of-Living Analysis...');
    console.log(`Analyzing: ${CONFIG.cities.map(c => c.name).join(', ')}`);
    console.log(`Budget: $${budget.toLocaleString()}/month`);

    const startTime = Date.now();

    // Run multiple agent ticks in parallel with staggered start
    const agentPromises = CONFIG.cities.map(async (city, index) => {
      try {
        // Stagger agent starts to avoid overwhelming the API
        await delay(index * CONFIG.delayBetweenRequests);
        
        const context = await agentTick(city);
        return { context, error: null };
        
      } catch (error) {
        console.error(`❌ Analysis failed for ${city.name}: ${error.message}`);
        return { context: null, error: error.message };
      }
    });

    const agentResults = await Promise.all(agentPromises);
    const successfulAgents = agentResults.filter(result => result.context !== null);

    if (successfulAgents.length === 0) {
      throw new Error('No cities were successfully analyzed');
    }

    // We have all results, now generate comparative analysis
    const cityAnalyses = successfulAgents
      .map(result => contextToAnalysis(result.context))
      .filter(analysis => analysis !== null);

    const comparativeAnalysis = generateComparativeAnalysis(cityAnalyses, budget);
    // ...and a markdown report from it.
    const markdownReport = generateMarkdownReport(cityAnalyses, comparativeAnalysis);

    // Finally, save markdown report to file
    const reportPath = saveMarkdownReport(markdownReport, CONFIG.dataDir);

    const totalTime = Date.now() - startTime;
    
    console.log('\n' + markdownReport);
    console.log(`\n✅ Analysis complete! (${(totalTime / 1000).toFixed(1)}s)`);
    
    if (reportPath) {
      console.log(`Report saved to: ${reportPath}`);
    }

    return {
      summary: {
        total_cities: CONFIG.cities.length,
        successful_agents: successfulAgents.length,
        execution_time_ms: totalTime,
        budget_used: budget
      },
      city_analyses: cityAnalyses,
      markdown_report: markdownReport,
      report_path: reportPath
    };

  } catch (error) {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  }
}

// Totally optional - I'm using this as Agent as a CLI tool for now, so here's the CLI handling
// Run it like this: node main.js 2000 
// to run the analysis with a $2,000/mo budget
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === 'test') {
    const cityName = args[1];
    if (!cityName) {
      console.error('❌ Please specify a city name for testing');
      console.log(`Usage: node main.js test <city_name>`);
      console.log(`Available cities: ${CONFIG.cities.map(c => c.name).join(', ')}`);
      process.exit(1);
    }
    testSingleAgent(cityName);
  } else if (args.length > 0 && args[0] === 'help') {
    console.log('Cost of Living Analysis Tool\n');
    console.log('Usage:');
    console.log('  node main.js                    # Run analysis with default budget ($2,000)');
    console.log('  node main.js <budget>           # Run analysis with custom budget (e.g., 1500)');
    console.log('  node main.js test <city_name>   # Test analysis for a single city');
    console.log('  node main.js help               # Show this help message\n');
    console.log(`Available cities: ${CONFIG.cities.map(c => c.name).join(', ')}`);
    console.log(`Default budget: $${CONFIG.monthlyBudgetUSD.toLocaleString()}/month`);
  } else {
    // Check if first argument is a number (budget)
    let customBudget = null;
    if (args.length > 0) {
      const budgetArg = parseFloat(args[0]);
      if (!isNaN(budgetArg) && budgetArg > 0) {
        customBudget = budgetArg;
      } else {
        console.error('❌ Invalid budget amount. Please provide a positive number.');
        console.log('Usage: node main.js <budget>  (e.g., node main.js 1500)');
        process.exit(1);
      }
    }
    
    main(customBudget);
  }
}

module.exports = {
  main
}; 