process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const { openai } = require('@ai-sdk/openai');
const { generateObject } = require('ai');
const { z } = require('zod');

async function extractCostData(categoryPerception, category, cityName, countryName) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const searchData = categoryPerception.sources.google_search;
  const formattedResults = JSON.stringify(searchData, null, 2);

  let prompt = `You are a cost analysis assistant. Extract ${category.displayName} cost data for ${cityName}, ${countryName} from these targeted search results.

City: "${cityName}, ${countryName}"
Target Category: "${category.displayName}"

Search Results:
${formattedResults}

Extract the following information:
1. Find the most relevant and recent cost data for ${category.displayName}
2. Extract the amount and currency
3. Convert to USD if possible
4. Identify the source and reliability
5. Provide context (e.g., city center vs suburbs, monthly vs daily)
6. Assign a confidence score as an INTEGER from 0 to 100 (IMPORTANT: This must be a whole number percentage like 85, not a decimal like 0.85)`;

  if (category.name === 'internet') {
    prompt += `

INTERNET SPECIFIC REQUIREMENTS:
7. Extract internet speed in Mbps (look for download speeds)
8. Rate internet reliability on a scale of 0-100 based on user reviews/reports
9. Determine if fiber internet is widely available (true/false)
10. Look for monthly internet package costs (not daily or hourly rates)

INTERNET DATA SOURCES: Prioritize Numbeo, Speedtest.net data, ISP websites, and user reviews.`;
  }

  prompt += `

Focus on credible sources like Numbeo, Expatistan, or official city data.

CONFIDENCE SCORING GUIDE (return as INTEGER 0-100):
- 90-100: Recent data from Numbeo/Expatistan with clear pricing
- 70-89: Reliable source but older data or less specific location
- 50-69: General estimates or less reliable sources  
- 30-49: Rough estimates or poor source quality
- 0-29: Very unreliable or no data found

EXAMPLE CONFIDENCE VALUES: 85, 72, 91, 43 (NOT 0.85, 0.72, 0.91, 0.43)

Return structured data for this specific category only.`;

  const baseSchema = {
    category: z.literal(category.displayName),
    amount: z.number().nullable(),
    currency: z.string().nullable(),
    usd_amount: z.number().nullable(),
    source: z.string().nullable(),
    context: z.string().nullable(),
    confidence: z.number().min(0).max(100),
    notes: z.string().nullable()
  };

  if (category.name === 'internet') {
    baseSchema.internet_speed_mbps = z.number().nullable();
    baseSchema.internet_reliability_score = z.number().min(0).max(100).nullable();
    baseSchema.fiber_availability = z.boolean().nullable();
  }

  const result = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object(baseSchema),
    prompt: prompt
  });

  return result.object;
}

async function generateRemoteWorkSummary(cityName, countryName, costCategories, averageConfidence, remoteWorkScore, pppResults) {
  const summaryPrompt = `You are a remote work consultant. Based on the cost analysis data for ${cityName}, ${countryName}, write a concise summary (2-3 sentences) that helps remote workers understand this city's suitability.

Cost Data Summary:
- Average confidence: ${averageConfidence.toFixed(1)}%
- Categories analyzed: ${costCategories.length}
- Remote work score: ${remoteWorkScore}/100
- PPP factor: ${pppResults.ppp_factor.toFixed(3)}
- Country: ${countryName}

Key costs found:
${costCategories.map(cat => `- ${cat.category}: ${cat.usd_amount ? `$${cat.usd_amount}` : 'Not found'} (${cat.confidence}% confidence)`).join('\n')}

Write a practical summary that mentions:
1. Overall affordability/value proposition
2. Key strengths for remote workers (internet, costs, lifestyle)
3. Data reliability context
4. Specific appeal (e.g., time zones, infrastructure, cost savings)

Example format: "Lisbon offers a strong balance for remote workers, with affordable rent, reliable internet, and high quality-of-life scores. Based on a confidence score of 78.3%, it is considered a high-potential location for remote living, especially for Europeans seeking time zone alignment."

Keep it concise and actionable for someone deciding where to live remotely.`;

  try {
    const summaryResult = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        summary: z.string().describe("Remote worker-focused summary of the city's suitability")
      }),
      prompt: summaryPrompt
    });
    return summaryResult.object.summary;
  } catch (error) {
    return `${cityName} shows ${averageConfidence > 70 ? 'strong' : averageConfidence > 50 ? 'moderate' : 'limited'} data availability for remote work planning. With a ${remoteWorkScore}/100 remote work score and ${pppResults.ppp_factor.toFixed(3)} PPP factor, it ${remoteWorkScore > 70 ? 'appears well-suited' : remoteWorkScore > 50 ? 'offers mixed potential' : 'may present challenges'} for remote workers based on available cost and infrastructure data.`;
  }
}

module.exports = {
  extractCostData,
  generateRemoteWorkSummary
}; 