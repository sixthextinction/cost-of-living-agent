// Dynamic Strategy Selection - Multiple search approaches
// each strategy has a confidence modifier (how much to trust results from this source)
const SEARCH_STRATEGIES = {
  numbeo_focused: {
    name: 'numbeo_focused',
    description: 'Focus on Numbeo.com data',
    confidence_modifier: 1.0,
    buildQuery: (city, country, category) => 
      `${category.displayName} cost ${city} ${country} site:numbeo.com`,
    sites: ['numbeo.com']
  },
  
  expatistan_focused: {
    name: 'expatistan_focused', 
    description: 'Focus on Expatistan.com data',
    confidence_modifier: 0.9,
    buildQuery: (city, country, category) =>
      `${category.displayName} price ${city} ${country} site:expatistan.com`,
    sites: ['expatistan.com']
  },
  
  reddit_local: {
    name: 'reddit_local',
    description: 'Local Reddit discussions',
    confidence_modifier: 0.8,
    buildQuery: (city, country, category) =>
      `${city} cost of living ${category.name} site:reddit.com`,
    sites: ['reddit.com']
  },
  
  multi_source: {
    name: 'multi_source',
    description: 'Multiple reliable sources',
    confidence_modifier: 1.1,
    buildQuery: (city, country, category) =>
      `${category.displayName} cost ${city} ${country} site:numbeo.com OR site:expatistan.com OR site:livingcost.org`,
    sites: ['numbeo.com', 'expatistan.com', 'livingcost.org']
  },
  
  government_stats: {
    name: 'government_stats',
    description: 'Official government statistics',
    confidence_modifier: 1.2,
    buildQuery: (city, country, category) =>
      `${country} official statistics cost living ${category.name} government data`,
    sites: ['gov', 'statistics']
  },
  
  expat_forums: {
    name: 'expat_forums',
    description: 'Expat community forums',
    confidence_modifier: 0.7,
    buildQuery: (city, country, category) =>
      `expat ${city} living costs ${category.name} forum community`,
    sites: ['expat', 'forum']
  }
};

// The brains of the operation.
// Selects a strategy based on a given category (rent, groceries, internet, etc)
function selectStrategy(context, category) {
  // Removed addTrace import for simple version
  
  const categoryName = category.name;
  
  // Step 0: Before we start...
  // Get failed strategies for this category (the Reflect phase saved these, if any)
  const categoryFailedStrategies = context.memory.failed_strategies_by_category[categoryName] || [];
  const categorySuccessfulStrategies = context.memory.successful_strategies_by_category[categoryName] || [];
  
  // Get still-available strategies (i.e. ones not yet failed for this specific category)
  const availableStrategies = Object.values(SEARCH_STRATEGIES).filter(strategy =>
    !categoryFailedStrategies.includes(strategy.name)
  );
  
  if (availableStrategies.length === 0) {
    // No available strategies left, using fallback
    return SEARCH_STRATEGIES.multi_source;
  }
  
  // Step 1: Based on available strategies from Step 0, select a strategy
  let selectedStrategy;
  
  // 1.1. Try historically successful strategies first (for this specific category)
  const successfulStrategy = availableStrategies.find(strategy =>
    categorySuccessfulStrategies.includes(strategy.name)
  );
  
  if (successfulStrategy) {
    selectedStrategy = successfulStrategy;
    // Using previously successful strategy
  }
  // 1.2. Okay so there is no record of previous strategies i.e. this is iteration 0. 
  // For our first iteration, start with a deliberately broad, general strategy
  else if (context.state.iteration === 0) {
    selectedStrategy = SEARCH_STRATEGIES.multi_source;
    // First attempt using multi_source strategy
  }
  // 1.3. If that didn't work, lets go down the list picking strategies one by one. 
  // This is an adaptive selection based on iteration. 
  else {
    const strategyOrder = [
      SEARCH_STRATEGIES.numbeo_focused,
      SEARCH_STRATEGIES.reddit_local,
      SEARCH_STRATEGIES.government_stats,
      SEARCH_STRATEGIES.expatistan_focused,
      SEARCH_STRATEGIES.expat_forums
      // anything else you might think of
    ];
    
    const nextStrategy = strategyOrder.find(strategy => 
      availableStrategies.includes(strategy)
    );
    
    selectedStrategy = nextStrategy || availableStrategies[0];
    // Trying different strategy for subsequent iteration
  }
  
  return selectedStrategy;
}

// Simplified learning system - just determines if we need to retry based on confidence
function adaptSearchBasedOnResults(context, results) {
  // FYI: you should have per agent tracing here in production
  // Analyze results to determine if retry is needed
  const lowConfidenceCategories = results.filter(r => r.confidence < 60);
  const highConfidenceCategories = results.filter(r => r.confidence > 80);
  
  // Great, now we have a list of low confidence categories and high confidence categories identified
  return {
    needs_retry: lowConfidenceCategories.length > results.length * 0.5, // More than 50% low confidence
    suggested_adaptations: generateAdaptations(context, lowConfidenceCategories)
  };
}

// Generate adaptations based on the results of the search
// This is a simple, static list of recommendations that the agent can use to improve the query (expand search terms, try alternative approaches, try local sources, etc)
// In production, you should have a more dynamic list of adaptations s
function generateAdaptations(context, lowConfidenceCategories) {
  const adaptations = [];
  
  // If many categories failed, try broader search
  if (lowConfidenceCategories.length > 2) {
    adaptations.push('expand_search_terms');
  }
  
  // If we have low confidence categories, try alternative approaches
  if (lowConfidenceCategories.length > 0) {
    adaptations.push('alternative_category_approach');
    adaptations.push('try_local_sources');
  }
  
  return adaptations;
}

module.exports = {
  SEARCH_STRATEGIES,
  selectStrategy,
  adaptSearchBasedOnResults,
  generateAdaptations
}; 