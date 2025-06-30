function getPPPFactor(country, pppData) {
  const pppEntry = pppData.find(p => p.country === country);
  return pppEntry ? pppEntry.value : 1.0;
}

function calculatePPPAdjustedCosts(costs, country, pppData) {
  const pppFactor = getPPPFactor(country, pppData); // Recommend using an FX API to get the PPP factor for a country
  const adjustedCosts = {};
  
  Object.entries(costs || {}).forEach(([key, value]) => {
    if (typeof value === 'number' && value > 0 && !isNaN(value)) {
      adjustedCosts[key] = value * pppFactor;
    } else {
      adjustedCosts[key] = 0;
    }
  });
  
  return {
    original: costs || {},
    ppp_adjusted: adjustedCosts,
    ppp_factor: pppFactor,
    explanation: pppFactor < 1 ? 'Lower costs due to higher purchasing power' : 
                 pppFactor > 1 ? 'Higher costs due to lower purchasing power' : 
                 'USD baseline'
  };
}

function calculateRemoteWorkScore(analysis, weights) {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Cost of Living Score = 70% of total score
  const costCategories = analysis.cost_analysis.cost_categories.filter(c => 
    ['1BR Apartment Rent', 'Monthly Groceries', 'Monthly Utilities'].includes(c.category) && c.usd_amount
  );
  
  if (costCategories.length > 0) {
    const avgMonthlyCost = costCategories.reduce((sum, c) => sum + c.usd_amount, 0);
    const costScore = Math.max(0, Math.min(100, 100 - ((avgMonthlyCost - 500) / 2500) * 100));
    totalScore += costScore * weights.cost_of_living;
    totalWeight += weights.cost_of_living;
  }
  
  // Internet Quality Score = 30% of total score
  const internetData = analysis.cost_analysis.cost_categories.find(c => c.category === 'Internet Speed & Cost');
  if (internetData && internetData.internet_speed_mbps) {
    const speed = internetData.internet_speed_mbps;
    const minSpeed = 10;
    const maxSpeed = 100;
    const internetScore = Math.max(5, Math.min(100, 
      100 * (Math.log(speed + minSpeed) - Math.log(minSpeed)) / (Math.log(maxSpeed + minSpeed) - Math.log(minSpeed))
    ));
    totalScore += internetScore * weights.internet_quality;
    totalWeight += weights.internet_quality;
  }
  
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

module.exports = {
  getPPPFactor,
  calculatePPPAdjustedCosts,
  calculateRemoteWorkScore
}; 