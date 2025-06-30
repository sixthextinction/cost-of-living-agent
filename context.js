// Agent Context - Simple state management for each agent
// FYI: you should have per agent tracing here in production  
function createAgentContext(cityObj) {
  return {
    // Basic city info
    city: cityObj.name,
    country: cityObj.country,

    // Phase results
    perception: null,
    reasoning: null,

    // Error tracking
    errors: [],

    // Agent state
    state: {
      iteration: 0,
      max_iterations: 3,
      confidence: 0,
      completeness: 0,
      goals_met: false
    },

    // Goals
    goals: {
      min_acceptable_confidence: 50, // 50% confidence = consider city acceptable
      confidence_target: 75, // 75% confidence = consider city complete
      completeness_target: 0.8 // 80% of categories covered = consider city complete
    },

    // Memory for learning
    /**
     * Agent uses memory to:
     * - Avoid repeating failed strategies within the same session
     * - Prefer previously successful strategies for specific categories
     * - Adapt its approach across iterations (up to 3 per session)
     */
    memory: {
      attempted_strategies: [],
      failed_strategies_by_category: {},    // per-category failures
      successful_strategies_by_category: {}, // per-category successes
      category_patterns: {}
    },

    // Metadata
    metadata: {
      started_at: new Date().toISOString(),
      completed_at: null,
      execution_time_ms: null
    }
  };
}

function addError(context, phase, message, category = null) {
  const error = {
    phase,
    message,
    category,
    timestamp: new Date().toISOString()
  };
  context.errors.push(error);
}

function updateState(context, updates) {
  Object.assign(context.state, updates);
}

// Evaluates whether the agent has met its analysis goals and determines if retry is needed
function evaluateGoals(context) {
  const confidence_met = context.state.confidence >= context.goals.confidence_target;
  const completeness_met = context.state.completeness >= context.goals.completeness_target;
  const min_acceptable = context.state.confidence >= context.goals.min_acceptable_confidence;

  context.state.goals_met = confidence_met && completeness_met;

  return {
    confidence_met,
    completeness_met,
    min_acceptable,
    goals_met: context.state.goals_met,
    should_retry: !context.state.goals_met && context.state.iteration < context.state.max_iterations && min_acceptable
  };
}

// Record the strategy that was attempted, whether it was successful, and the confidence in the result
function recordStrategy(context, strategyName, category, success, confidence = 0) {
  context.memory.attempted_strategies.push({
    strategy: strategyName,
    category,
    success,
    confidence,
    iteration: context.state.iteration,
    timestamp: new Date().toISOString()
  });

  // Initialize category arrays if they don't exist
  if (!context.memory.successful_strategies_by_category[category]) {
    context.memory.successful_strategies_by_category[category] = [];
  }
  if (!context.memory.failed_strategies_by_category[category]) {
    context.memory.failed_strategies_by_category[category] = [];
  }

  if (success) {
    if (!context.memory.successful_strategies_by_category[category].includes(strategyName)) {
      context.memory.successful_strategies_by_category[category].push(strategyName);
    }
  } else {
    if (!context.memory.failed_strategies_by_category[category].includes(strategyName)) {
      context.memory.failed_strategies_by_category[category].push(strategyName);
    }
  }
}

module.exports = {
  createAgentContext,
  addError,
  updateState,
  evaluateGoals,
  recordStrategy
}; 