// Simple Cost-of-Living Agent - Main Logic
// Streamlined version with minimal logging

const CONFIG = require('./config');
const { createAgentContext, addError, updateState, evaluateGoals } = require('./context');
const { selectStrategy, adaptSearchBasedOnResults } = require('./strategies');
const { delay } = require('./utils');
const { hasCachedData, loadCachedData, saveCacheData } = require('./cache');
const { calculatePPPAdjustedCosts, calculateRemoteWorkScore } = require('./scoring');
const { fetchWithBrightDataProxy, buildPerceptionFromSearchData } = require('./search');
const { extractCostData, generateRemoteWorkSummary } = require('./ai');

// PERCEPTION - Adaptive data gathering
async function perceive(context) {
  try {
    // Check cache first
    if (hasCachedData({ name: context.city, country: context.country }, CONFIG.cacheDir, CONFIG.cacheExpiryDays)) {
      const cachedPerception = loadCachedData({ name: context.city, country: context.country }, CONFIG.cacheDir);
      if (cachedPerception) {
        cachedPerception.metadata.data_source = 'cached_data';
        context.perception = cachedPerception;
        return context;
      }
    }

    const categorySearchResults = {};
    let totalOrganicResults = 0;
    let totalQualityScore = 0;
    let successfulCategories = 0;

    // Process each category with adaptive strategy selection
    for (const category of CONFIG.costCategories) {
      try {
        // STEP 1: Strategy-Level Learning (Strategy Selection) -- Modifies the source we use to search 
        // i.e. changes WHERE/WHICH SOURCE to search
        // Select strategy based on context (rent, groceries, internet, etc) and memory
        const strategy = selectStrategy(context, category);
        // Based on that, build a google query string for this city + country + category combination
        let searchQuery = strategy.buildQuery(context.city, context.country, category);

        // STEP 2: Query-Level Learning (Adaptations) -- Modifies queries 
        // i.e. HOW we search within the chosen source
        // Apply adaptations to modify the query based on reflect phase suggestions
        if (context.state.current_adaptations?.includes('expand_search_terms')) {
          // Make search broader with additional terms
          // TODO: use LLM call for this
          searchQuery += ` OR "${category.displayName} price" OR "${category.displayName} budget" OR "${category.displayName} expense"`;
        }
        if (context.state.current_adaptations?.includes('try_local_sources')) {
          // Tack on local community sources to search query
          // TODO: use LLM call for this
          searchQuery += ` site:reddit.com OR site:expat.com OR site:nomadlist.com`;
        }

        // STEP 3: Actually gather data; Execute the search query with Bright Data SERP API
        const rawSearchData = await fetchWithBrightDataProxy(searchQuery, CONFIG);
        // STEP 4: Based on that collected SERP data, build a perception of the category
        const categoryPerception = buildPerceptionFromSearchData(rawSearchData, context.city, category.name, CONFIG.maxResults);
        // STEP 5: Metadata. Apply strategy confidence modifier
        categoryPerception.metadata.confidence_modifier = strategy.confidence_modifier;
        categoryPerception.metadata.strategy_used = strategy.name;

        categorySearchResults[category.name] = categoryPerception;
        totalOrganicResults += categoryPerception.metadata.organic_results_count;
        totalQualityScore += categoryPerception.metadata.data_quality_score;
        successfulCategories++;

        await delay(CONFIG.delayBetweenRequests);

      } catch (categoryError) {
        addError(context, 'perception', `Category search failed: ${categoryError.message}`, category.name);

        // Record strategy failure
        const { recordStrategy } = require('./context');
        const strategy = selectStrategy(context, category); // Get the strategy that was attempted
        recordStrategy(context, strategy.name, category.name, false, 0);
      }
    }

    const perception = {
      timestamp: new Date().toISOString(),
      city: context.city,
      country: context.country,
      search_strategy: 'adaptive_agentic',
      category_searches: categorySearchResults,
      metadata: {
        total_organic_results: totalOrganicResults,
        average_data_quality_score: totalQualityScore / Math.max(successfulCategories, 1),
        categories_searched: CONFIG.costCategories.length,
        successful_categories: successfulCategories,
        data_source: 'fresh_serp_calls',
        agent_iteration: context.state.iteration
      }
    };

    // STEP 6: Save SERP data to cache for city/country combination
    saveCacheData({ name: context.city, country: context.country }, perception, CONFIG.cacheDir, CONFIG.cacheExpiryDays);

    context.perception = perception;

    // STEP 7: Update context state
    const completeness = successfulCategories / CONFIG.costCategories.length;
    updateState(context, { completeness });

    return context;

  } catch (error) {
    addError(context, 'perception', `Perception failure: ${error.message}`);
    throw error;
  }
}

// REASONING - AI analysis with confidence tracking
async function reason(context) {
  if (!context.perception) {
    const error = new Error('No perception data available for reasoning');
    addError(context, 'reasoning', error.message);
    throw error;
  }

  try {
    const costCategories = [];
    let totalConfidence = 0;
    let categoriesProcessed = 0;

    // Process each category
    for (const category of CONFIG.costCategories) {
      const categoryPerception = context.perception.category_searches[category.name];
      if (!categoryPerception) {
        continue;
      }

      try {
        const result = await extractCostData(categoryPerception, category, context.city, context.country);

        // Apply strategy confidence modifier
        const strategyModifier = categoryPerception.metadata.confidence_modifier || 1.0;
        result.confidence = Math.min(100, result.confidence * strategyModifier);
        result.strategy_used = categoryPerception.metadata.strategy_used;

        // Record strategy success/failure based on confidence
        const { recordStrategy } = require('./context');
        const isSuccess = result.confidence >= 60; // Consider 60%+ confidence as success
        recordStrategy(context, result.strategy_used, category.name, isSuccess, result.confidence);

        costCategories.push(result);
        totalConfidence += result.confidence;
        categoriesProcessed++;

        await delay(500);

      } catch (categoryError) {
        addError(context, 'reasoning', `Category analysis failed: ${categoryError.message}`, category.name);
      }
    }

    const averageConfidence = categoriesProcessed > 0 ? totalConfidence / categoriesProcessed : 0;

    // Calculate PPP adjustments
    const basicCosts = {};
    // Transform cost categories into a simple key-value object for PPP calculations
    // Convert category names to lowercase with underscores and only include categories with valid USD amounts
    costCategories.forEach(cat => {
      if (cat.usd_amount && cat.usd_amount > 0) {
        // Convert "Monthly Rent" -> "monthly_rent", "Internet" -> "internet", etc.
        basicCosts[cat.category.toLowerCase().replace(/\s+/g, '_')] = cat.usd_amount;
      }
    });

    const pppResults = calculatePPPAdjustedCosts(basicCosts, context.country, CONFIG.ppp);

    // Calculate remote work score
    const tempReasoning = {
      cost_analysis: {
        cost_categories: costCategories,
        ppp_analysis: pppResults
      }
    };
    const remoteWorkScore = calculateRemoteWorkScore(tempReasoning, CONFIG.remoteWorkWeights);

    const remoteWorkerSummary = await generateRemoteWorkSummary(
      context.city,
      context.country,
      costCategories,
      averageConfidence,
      remoteWorkScore,
      pppResults
    );

    const reasoning = {
      timestamp: new Date().toISOString(),
      city: context.city,
      country: context.country,
      cost_analysis: {
        city: context.city,
        country: context.country,
        analysis_timestamp: new Date().toISOString(),
        cost_categories: costCategories,
        ppp_analysis: pppResults,
        overall_assessment: {
          data_availability: averageConfidence > 70 ? 'good' : averageConfidence > 50 ? 'limited' : 'poor',
          source_reliability: averageConfidence > 70 ? 'high' : averageConfidence > 50 ? 'medium' : 'low',
          cost_level: null,
          summary: remoteWorkerSummary
        },
        total_confidence: averageConfidence
      },
      sources_analyzed: context.perception.metadata.total_organic_results,
      search_strategy: 'adaptive_agentic',
      data_quality_score: context.perception.metadata.average_data_quality_score,
      reasoning_model: 'gpt-4o-mini',
      agent_iteration: context.state.iteration,
      remote_work_score: remoteWorkScore
    };

    context.reasoning = reasoning;

    // Update context state
    updateState(context, { confidence: averageConfidence });

    return context;

  } catch (error) {
    addError(context, 'reasoning', `Reasoning failure: ${error.message}`);

    // Create fallback reasoning
    context.reasoning = {
      timestamp: new Date().toISOString(),
      city: context.city,
      country: context.country,
      cost_analysis: {
        city: context.city,
        country: context.country,
        analysis_timestamp: new Date().toISOString(),
        cost_categories: [],
        ppp_analysis: {
          original: {},
          ppp_adjusted: {},
          ppp_factor: CONFIG.ppp.find(p => p.country === context.country)?.value || 1.0,
          explanation: 'Error in analysis'
        },
        overall_assessment: {
          data_availability: 'poor',
          source_reliability: 'low',
          cost_level: null,
          summary: `${context.city} remote work analysis failed due to data collection issues.`
        },
        total_confidence: 0
      },
      remote_work_score: 0,
      sources_analyzed: context.perception?.metadata?.total_organic_results || 0,
      search_strategy: 'adaptive_agentic',
      data_quality_score: context.perception?.metadata?.average_data_quality_score || 0,
      reasoning_model: 'error-fallback',
      error: error.message
    };

    return context;
  }
}

// REFLECTION - Self-assessment and adaptation
async function reflect(context) {
  const evaluation = evaluateGoals(context);

  if (evaluation.goals_met) {
    return { should_continue: false, adaptations: [] };
  }

  if (!evaluation.should_retry) {
    return { should_continue: false, adaptations: [] };
  }

  // Analyze results for adaptation
  const results = context.reasoning?.cost_analysis?.cost_categories || [];
  const adaptationAnalysis = adaptSearchBasedOnResults(context, results);

  return {
    should_continue: true,
    adaptations: adaptationAnalysis.suggested_adaptations,
    needs_retry: adaptationAnalysis.needs_retry
  };
}

// MAIN AGENTIC TICK - Goal-oriented behavior with retry logic
async function agentTick(cityObj) {
  const context = createAgentContext(cityObj);

  while (context.state.iteration < context.state.max_iterations) {
    try {
      // Log current adaptations at start of iteration
      if (context.state.current_adaptations && context.state.current_adaptations.length > 0) {
        // Adaptations applied silently in simple version
      }

      // Perceive -> Reason -> Reflect cycle
      // Step 1: PERCEIVE - Go out and gather data
      await perceive(context);
      // Step 2: REASON - Think about what the data means  
      await reason(context);
      // Step 3: REFLECT - Ask "Did I do a good job? Should I try again?"
      const evaluation = await reflect(context);

      // Store adaptations in context for other functions to use
      context.state.current_adaptations = evaluation.adaptations;

      // Step 4: DECIDE - Based on reflection, keep going or stop
      if (!evaluation.should_continue) {
        break; // Stop, we're done!
      }
      // Step 5: ADAPT - Make changes for next attempt
      context.state.iteration++;

      // Apply adaptations that affect memory/strategy selection
      if (evaluation.adaptations.includes('alternative_category_approach')) {
        context.memory.failed_strategies = [];
      }
    } catch (error) {
      addError(context, 'agent_tick', `Iteration ${context.state.iteration + 1} failed: ${error.message}`);
      context.state.iteration++;

      if (context.state.iteration >= context.state.max_iterations) {
        break;
      }
    }
  }

  // Finalize context
  context.metadata.completed_at = new Date().toISOString();
  context.metadata.execution_time_ms = Date.now() - new Date(context.metadata.started_at).getTime();

  return context;
}

module.exports = {
  perceive,
  reason,
  reflect,
  agentTick
}; 