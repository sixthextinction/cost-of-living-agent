/**
 * Here's all the math performed in this module:
 * 
 * 1. COST AGGREGATION & RANKING:
 *    - Total cost = Σ(category.usd_amount) for all valid categories
 *    - PPP adjusted cost = Σ(ppp_adjusted_values) using purchasing power parity
 *    - Category averages = Σ(amounts) / count for cross-city comparison
 * 
 * 2. BUDGET ANALYSIS:
 *    - Budget utilization = (total_cost / monthly_budget) × 100
 *    - Remaining budget = monthly_budget - total_cost
 *    - Budget efficiency = remote_work_score × (1 - (budget_utilization / 100) × 0.3)
 *      * Rewards cities with good remote work scores and lower budget usage
 *      * 30% penalty factor for high budget utilization
 * 
 * 3. RANKING ALGORITHMS:
 *    - Cost rankings: Sort by total_cost ASC (cheapest first)
 *    - PPP rankings: Sort by ppp_adjusted_cost ASC 
 *    - Efficiency rankings: Sort by budget_efficiency_score DESC (best value first)
 *    - Quality rankings: Sort by data_quality/confidence DESC
 * 
 * 4. STATISTICAL MEASURES:
 *    - Price ranges: A min/max across cities for each category
 *    - Averages: A simple arithmetic mean for category comparisons
 *    - Confidence scoring: A weighted average of data quality metrics
 */
function generateComparativeAnalysis(cityAnalyses, monthlyBudgetUSD = 2000) {
  const comparison = {
    timestamp: new Date().toISOString(),
    cities_compared: cityAnalyses.length,
    monthly_budget_usd: monthlyBudgetUSD,
    cost_rankings: {},
    category_analysis: {},
    budget_analysis: {},
    summary: {
      most_expensive: null,
      least_expensive: null,
      best_data_quality: null,
      cities_within_budget: 0,
      best_budget_fit: null
    }
  };

  const standardCategories = [
    '1BR Apartment Rent',
    'Monthly Groceries',
    'Public Transportation Monthly Pass',
    'Monthly Utilities',
    'Internet Speed & Cost'
  ];

  standardCategories.forEach(category => {
    const categoryData = cityAnalyses.map(analysis => {
      const catData = analysis.cost_analysis.cost_categories.find(c => c.category === category);
      return {
        city: analysis.city,
        amount: catData?.usd_amount || null,
        confidence: catData?.confidence || 0
      };
    }).filter(item => item.amount !== null);

    if (categoryData.length > 0) {
      categoryData.sort((a, b) => (a.amount || 0) - (b.amount || 0));
      comparison.category_analysis[category] = {
        cities_with_data: categoryData.length,
        cheapest: categoryData[0],
        most_expensive: categoryData[categoryData.length - 1],
        average: categoryData.reduce((sum, item) => sum + (item.amount || 0), 0) / categoryData.length,
        price_range: {
          min: categoryData[0].amount || 0,
          max: categoryData[categoryData.length - 1].amount || 0
        }
      };
    }
  });

  const cityScores = cityAnalyses.map(analysis => {
    const totalCost = analysis.cost_analysis.cost_categories
      .filter(cat => cat.usd_amount)
      .reduce((sum, cat) => sum + cat.usd_amount, 0);
    
    const pppAdjustedTotal = Object.values(analysis.cost_analysis.ppp_analysis.ppp_adjusted || {})
      .filter(val => typeof val === 'number')
      .reduce((sum, val) => sum + val, 0);
    
    const internetData = analysis.cost_analysis.cost_categories.find(c => c.category === 'Internet Speed & Cost');
    
    // Budget analysis
    const withinBudget = totalCost <= monthlyBudgetUSD;
    const budgetUtilization = (totalCost / monthlyBudgetUSD) * 100;
    const remainingBudget = monthlyBudgetUSD - totalCost;
    
    return {
      city: analysis.city,
      country: analysis.country,
      total_cost: totalCost,
      ppp_adjusted_cost: pppAdjustedTotal,
      ppp_factor: analysis.cost_analysis.ppp_analysis.ppp_factor,
      remote_work_score: analysis.remote_work_score || 0,
      internet_speed: internetData?.internet_speed_mbps || null,
      internet_cost: internetData?.usd_amount || null,
      confidence: analysis.cost_analysis.total_confidence,
      data_quality: analysis.data_quality_score,
      categories_found: analysis.cost_analysis.cost_categories.filter(cat => cat.usd_amount).length,
      // Budget-specific metrics
      within_budget: withinBudget,
      budget_utilization: budgetUtilization,
      remaining_budget: remainingBudget,
      budget_efficiency_score: withinBudget ? (analysis.remote_work_score || 0) * (1 - (budgetUtilization / 100) * 0.3) : 0
    };
  });

  cityScores.sort((a, b) => a.total_cost - b.total_cost);
  
  // Budget analysis
  const citiesWithinBudget = cityScores.filter(city => city.within_budget);
  comparison.summary.cities_within_budget = citiesWithinBudget.length;
  
  if (citiesWithinBudget.length > 0) {
    // Best budget fit = highest budget efficiency score among cities within budget
    const bestBudgetFit = citiesWithinBudget.sort((a, b) => b.budget_efficiency_score - a.budget_efficiency_score)[0];
    comparison.summary.best_budget_fit = bestBudgetFit.city;
  }
  
  comparison.budget_analysis = {
    cities_within_budget: citiesWithinBudget.map(city => ({
      city: city.city,
      country: city.country,
      total_cost: city.total_cost,
      remaining_budget: city.remaining_budget,
      budget_utilization: city.budget_utilization,
      remote_work_score: city.remote_work_score,
      budget_efficiency_score: city.budget_efficiency_score
    })),
    cities_over_budget: cityScores.filter(city => !city.within_budget).map(city => ({
      city: city.city,
      country: city.country,
      total_cost: city.total_cost,
      budget_overage: city.total_cost - monthlyBudgetUSD,
      budget_utilization: city.budget_utilization
    }))
  };
  
  comparison.cost_rankings = {
    by_total_cost: cityScores,
    by_ppp_adjusted_cost: [...cityScores].sort((a, b) => a.ppp_adjusted_cost - b.ppp_adjusted_cost),
    by_remote_work_score: [...cityScores].sort((a, b) => b.remote_work_score - a.remote_work_score),
    by_internet_speed: [...cityScores].filter(c => c.internet_speed).sort((a, b) => b.internet_speed - a.internet_speed),
    by_confidence: [...cityScores].sort((a, b) => b.confidence - a.confidence),
    by_data_quality: [...cityScores].sort((a, b) => b.data_quality - a.data_quality),
    by_budget_efficiency: citiesWithinBudget.sort((a, b) => b.budget_efficiency_score - a.budget_efficiency_score)
  };

  if (cityScores.length > 0) {
    comparison.summary.least_expensive = cityScores[0].city;
    comparison.summary.most_expensive = cityScores[cityScores.length - 1].city;
    comparison.summary.best_ppp_value = comparison.cost_rankings.by_ppp_adjusted_cost[0].city;
    comparison.summary.best_remote_work_score = comparison.cost_rankings.by_remote_work_score[0].city;
    comparison.summary.fastest_internet = comparison.cost_rankings.by_internet_speed.length > 0 ? 
      comparison.cost_rankings.by_internet_speed[0].city : null;
    comparison.summary.best_data_quality = comparison.cost_rankings.by_data_quality[0].city;
  }

  return comparison;
}

function generateMarkdownReport(cityAnalyses, comparativeAnalysis) {
  const budget = comparativeAnalysis.monthly_budget_usd;
  const citiesWithinBudget = comparativeAnalysis.budget_analysis.cities_within_budget;
  const citiesOverBudget = comparativeAnalysis.budget_analysis.cities_over_budget;
  
  let markdown = `# I Asked an AI Agent Where to Live on $${budget.toLocaleString()}/Month. It Compared ${cityAnalyses.length} Cities for Remote Workers/Digital Nomads.\n\n`;
  markdown += `*AI-powered analysis generated on: ${new Date().toLocaleDateString()}*\n\n`;

  // Executive Summary
  markdown += '## The Verdict\n\n';
  
  if (citiesWithinBudget.length > 0) {
    const bestFit = comparativeAnalysis.summary.best_budget_fit;
    const bestFitData = citiesWithinBudget.find(city => city.city === bestFit);
    
    markdown += `**Winner: ${bestFit}**\n\n`;
    markdown += `After analyzing ${cityAnalyses.length} cities, ${citiesWithinBudget.length} cities fit within the $${budget.toLocaleString()}/month budget. `;
    markdown += `${bestFit} emerges as the best choice, offering excellent value for remote workers with `;
    markdown += `$${Math.round(bestFitData.remaining_budget).toLocaleString()} left over each month.\n\n`;
    
    markdown += `**Key Findings:**\n`;
    markdown += `- **${citiesWithinBudget.length} out of ${cityAnalyses.length} cities** fit within the $${budget.toLocaleString()} budget\n`;
    markdown += `- **Most affordable**: ${comparativeAnalysis.summary.least_expensive}\n`;
    markdown += `- **Best remote work infrastructure**: ${comparativeAnalysis.summary.best_remote_work_score}\n`;
    if (comparativeAnalysis.summary.fastest_internet) {
      markdown += `- **Fastest internet**: ${comparativeAnalysis.summary.fastest_internet}\n`;
    }
  } else {
    markdown += `**Reality Check: None of the ${cityAnalyses.length} cities analyzed fit within the $${budget.toLocaleString()}/month budget.**\n\n`;
    markdown += `The most affordable option is ${comparativeAnalysis.summary.least_expensive}, but even that exceeds the budget. `;
    markdown += `Here's what you'd need to make it work:\n\n`;
  }
  
  markdown += '\n';

  // Budget Analysis Section
  if (citiesWithinBudget.length > 0) {
    markdown += '## Cities Within Budget\n\n';
    markdown += `These ${citiesWithinBudget.length} cities fit comfortably within your $${budget.toLocaleString()}/month budget:\n\n`;
    
    markdown += '| City | Monthly Cost | Money Left Over | Budget Used | Remote Work Score | Efficiency Score |\n';
    markdown += '|------|--------------|----------------|-------------|-------------------|------------------|\n';
    
    citiesWithinBudget.forEach(city => {
      const cityDisplay = city.country ? `${city.city}, ${city.country}` : city.city;
      markdown += `| **${cityDisplay}** | `;
      markdown += `$${Math.round(city.total_cost).toLocaleString()} | `;
      markdown += `$${Math.round(city.remaining_budget).toLocaleString()} | `;
      markdown += `${Math.round(city.budget_utilization)}% | `;
      markdown += `${city.remote_work_score}/100 | `;
      markdown += `${Math.round(city.budget_efficiency_score)}/100 |\n`;
    });
    
    markdown += '\n';
  }
  
  if (citiesOverBudget.length > 0) {
    markdown += '## Cities Over Budget\n\n';
    markdown += `These cities exceed your $${budget.toLocaleString()}/month budget:\n\n`;
    
    markdown += '| City | Monthly Cost | Over Budget By | Budget Used |\n';
    markdown += '|------|--------------|----------------|-------------|\n';
    
    citiesOverBudget.forEach(city => {
      const cityDisplay = city.country ? `${city.city}, ${city.country}` : city.city;
      markdown += `| **${cityDisplay}** | `;
      markdown += `$${Math.round(city.total_cost).toLocaleString()} | `;
      markdown += `$${Math.round(city.budget_overage).toLocaleString()} | `;
      markdown += `${Math.round(city.budget_utilization)}% |\n`;
    });
    
    markdown += '\n';
  }

  // Detailed Cost Breakdown
  markdown += '## Complete Cost Breakdown\n\n';

  const standardCategories = [
    '1BR Apartment Rent',
    'Monthly Groceries',
    'Public Transportation Monthly Pass',
    'Monthly Utilities',
    'Internet Speed & Cost'
  ];

  markdown += '| City | ';
  standardCategories.forEach(category => {
    markdown += `${category} | `;
  });
  markdown += 'Total | Budget Status | Remote Score |\n';

  markdown += '|------|';
  standardCategories.forEach(() => {
    markdown += '---------|';
  });
  markdown += '-------|---------------|-------------|\n';

  cityAnalyses.forEach(analysis => {
    const cityDisplay = analysis.country ? `${analysis.city}, ${analysis.country}` : analysis.city;
    const cityScore = comparativeAnalysis.cost_rankings.by_total_cost.find(c => c.city === analysis.city);
    
    markdown += `| **${cityDisplay}** | `;
    
    let totalCost = 0;
    
    standardCategories.forEach(category => {
      const catData = analysis.cost_analysis.cost_categories.find(c => c.category === category);
      
      if (catData?.usd_amount) {
        if (category === 'Internet Speed & Cost' && catData.internet_speed_mbps) {
          markdown += `$${catData.usd_amount.toFixed(0)} (${catData.internet_speed_mbps}Mbps) | `;
        } else {
          markdown += `$${catData.usd_amount.toFixed(0)} | `;
        }
        totalCost += catData.usd_amount;
      } else {
        markdown += 'N/A | ';
      }
    });
    
    markdown += `$${totalCost.toFixed(0)} | `;
    
    if (cityScore && cityScore.within_budget) {
      markdown += `✅ Under by $${Math.round(cityScore.remaining_budget)} | `;
    } else if (cityScore) {
      markdown += `❌ Over by $${Math.round(cityScore.total_cost - budget)} | `;
    } else {
      markdown += 'Unknown | ';
    }
    
    markdown += `${analysis.remote_work_score || 0}/100 |\n`;
  });

  markdown += '\n';

  // AI Agent Insights
  markdown += '## AI Agent Insights\n\n';
  cityAnalyses.forEach(analysis => {
    const cityDisplay = analysis.country ? `${analysis.city}, ${analysis.country}` : analysis.city;
    const cityScore = comparativeAnalysis.cost_rankings.by_total_cost.find(c => c.city === analysis.city);
    
    markdown += `### ${cityDisplay}\n`;
    
    if (analysis.cost_analysis.overall_assessment.summary) {
      markdown += `${analysis.cost_analysis.overall_assessment.summary}\n\n`;
    }
    
    if (cityScore) {
      if (cityScore.within_budget) {
        markdown += `**Budget Status**: ✅ **Fits within budget** - You'll have $${Math.round(cityScore.remaining_budget).toLocaleString()} left over each month\n`;
      } else {
        markdown += `**Budget Status**: ❌ **Over budget** - Would cost $${Math.round(cityScore.total_cost - budget).toLocaleString()} more than your $${budget.toLocaleString()} budget\n`;
      }
    }
    
    markdown += `**Remote Work Score**: ${analysis.remote_work_score || 0}/100\n`;
    const pppFactor = analysis.cost_analysis.ppp_analysis.ppp_factor || 1.0;
    markdown += `**PPP Factor**: ${pppFactor.toFixed(3)} (purchasing power vs USD)\n`;
    markdown += `**Data Confidence**: ${analysis.cost_analysis.total_confidence}%\n`;

    if (analysis.cost_analysis.cost_categories.length > 0) {
      markdown += '\n**Monthly Costs:**\n';
      analysis.cost_analysis.cost_categories.forEach(cat => {
        if (cat.usd_amount) {
          let costDisplay = `$${cat.usd_amount.toFixed(0)}`;
          
          if (cat.category === 'Internet Speed & Cost' && cat.internet_speed_mbps) {
            costDisplay += ` - ${cat.internet_speed_mbps} Mbps`;
          }
          
          markdown += `- ${cat.category}: ${costDisplay}\n`;
        }
      });
    }

    markdown += '\n';
  });

  // Methodology
  markdown += '## 🔬 Methodology\n\n';
  markdown += 'This analysis was conducted by an AI agent system that:\n\n';
  markdown += '1. **Searched** cost-of-living data from multiple sources (Numbeo, Expatistan)\n';
  markdown += '2. **Extracted** pricing for 5 key categories: rent, groceries, transportation, utilities, and internet\n';
  markdown += '3. **Analyzed** remote work suitability based on internet infrastructure and cost efficiency\n';
  markdown += '4. **Applied** purchasing power parity (PPP) adjustments for fair comparison\n';
  markdown += '5. **Calculated** budget efficiency scores to determine the best value within your budget\n\n';
  markdown += `**Budget**: $${budget.toLocaleString()}/month USD\n`;
  markdown += `**Cities Analyzed**: ${cityAnalyses.length}\n`;
  markdown += `**Average Data Confidence**: ${(cityAnalyses.reduce((sum, a) => sum + a.cost_analysis.total_confidence, 0) / cityAnalyses.length).toFixed(1)}%\n`;

  return markdown;
}

module.exports = {
  generateComparativeAnalysis,
  generateMarkdownReport
}; 