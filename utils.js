const fs = require('fs');
const path = require('path');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Save the report to a markdown file
function saveMarkdownReport(content, dataDir = 'data') {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_cost_comparison_report.md`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, content, 'utf8');
    return filepath;
  } catch (error) {
    console.error(`❌ Failed to save report: ${error.message}`);
    return null;
  }
}

// Convert agent context to analysis format for reports
function contextToAnalysis(context) {
  if (!context.reasoning) {
    return null;
  }

  return {
    city: context.city,
    country: context.country,
    timestamp: context.metadata.completed_at || new Date().toISOString(),
    phases: {
      perception: context.perception,
      reasoning: context.reasoning
    },
    summary: {
      confidence: context.state.confidence,
      categories_found: context.reasoning.cost_analysis.cost_categories.filter(c => c.usd_amount).length,
      data_quality_score: context.reasoning.data_quality_score,
      search_strategy: 'adaptive_agentic',
      errors_count: context.errors.length,
      iterations_needed: context.state.iteration,
      goals_met: context.state.goals_met
    },
    ...context.reasoning
  };
}

module.exports = {
  delay,
  saveMarkdownReport,
  contextToAnalysis
}; 