const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

async function fetchWithBrightDataProxy(searchQuery, config) {
  try {
    const proxyUrl = `http://brd-customer-${config.customerId}-zone-${config.zone}:${config.password}@${config.proxyHost}:${config.proxyPort}`;

    const agent = new HttpsProxyAgent(proxyUrl, {
      rejectUnauthorized: false
    });

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=${config.maxResults}&brd_json=1`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      agent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      return data;

    } catch (parseError) {
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error('Received HTML instead of JSON - proxy may not be working correctly');
      } else {
        throw new Error('Response is not valid JSON');
      }
    }
  } catch (error) {
    console.error('❌ Search request failed:', error.message);
    throw error;
  }
}
/**
 * The next two COULD be moved to utils.js since they are, essentially, data mapping/utility functions.
 * But I've kept them here as they are specific to the SERP data. 
 */

// build a Perception object from the SERP data that can be fed to the Reasoning phase
function buildPerceptionFromSearchData(searchResults, city, categoryName, maxResults) {
  const cleanedGoogleSearch = {
    organic: searchResults.organic?.slice(0, maxResults).map(result => ({
      title: result.title,
      description: result.description,
      link: result.link,
      display_link: result.display_link
    })) || [],
    knowledge: searchResults.knowledge ? {
      description: searchResults.knowledge.description,
      facts: searchResults.knowledge.facts?.map(fact => ({
        key: fact.key,
        value: fact.value
      })) || []
    } : null
  };

  return {
    timestamp: new Date().toISOString(),
    city: city,
    category: categoryName,
    search_strategy: 'targeted_category_specific',
    sources: {
      google_search: cleanedGoogleSearch,
      raw_data: searchResults
    },
    metadata: {
      organic_results_count: cleanedGoogleSearch.organic?.length || 0,
      has_knowledge_graph: !!cleanedGoogleSearch.knowledge,
      data_quality_score: calculateDataQualityScore(cleanedGoogleSearch)
    }
  };
}

// 5 points per organic search result, capped at 50 (10+ results)
// 20 pointss if google's knowledge graph is present
// 10 points per relevant source (we're defining numbeo, expatistan, and livingcost as relevant sources )
// combines all of the above but is capped at 100
function calculateDataQualityScore(searchData) {
  let score = 0;

  score += Math.min(searchData.organic.length * 5, 50);

  if (searchData.knowledge) score += 20;

  const relevantSources = searchData.organic.filter(item =>
    item.display_link?.includes('numbeo') ||
    item.display_link?.includes('expatistan') ||
    item.display_link?.includes('livingcost')
  ).length;
  score += Math.min(relevantSources * 10, 30);

  return Math.min(score, 100);
}

module.exports = {
  fetchWithBrightDataProxy,
  buildPerceptionFromSearchData,
  calculateDataQualityScore
}; 