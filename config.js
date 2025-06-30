const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); // adjust this path to your .env file

const CONFIG = {
  customerId: process.env.BRIGHT_DATA_CUSTOMER_ID,
  zone: process.env.BRIGHT_DATA_ZONE,
  password: process.env.BRIGHT_DATA_PASSWORD,
  proxyHost: 'brd.superproxy.io',
  proxyPort: 33335,
  
  // Budget for analysis (in USD per month)
  monthlyBudgetUSD: 2000,
  
  // PPP data for cities/countries we're covering. 
  // Hardcoded for now, but in production, getPPPFactor() in scoring.js should use an FX API to get this
  ppp: [
    {
      "country": "Germany",
      "value": 0.721158,
      "year": "2019"
    },
    {
      "country": "Portugal",
      "value": 0.547768,
      "year": "2019"
    },
    {
      "country": "Thailand",
      "value": 12.5736324625,
      "year": "2019"
    },
    {
      "country": "Indonesia",
      "value": 4743.33744682,
      "year": "2019"
    },
    {
      "country": "United States",
      "value": 1.0,
      "year": "2019"
    }
  ],
  // Cities we're covering. Should be dynamic in production.
  cities: [
    { name: 'Lisbon', country: 'Portugal' },
    { name: 'Austin', country: 'United States' },
    { name: 'Bali', country: 'Indonesia' },
    { name: 'Berlin', country: 'Germany' },
    { name: 'Bangkok', country: 'Thailand' }
  ],
  // Cost categories we're looking at to judge a city's remote work suitability. 
  costCategories: [
    {
      name: 'rent_1br',
      displayName: '1BR Apartment Rent',
      searchTemplate: 'average rent 1 bedroom apartment {city} site:numbeo.com OR site:expatistan.com'
    },
    {
      name: 'groceries',
      displayName: 'Monthly Groceries',
      searchTemplate: 'average monthly grocery cost {city} site:numbeo.com OR site:expatistan.com'
    },
    {
      name: 'transportation',
      displayName: 'Public Transportation Monthly Pass',
      searchTemplate: 'public transportation monthly pass cost {city} site:numbeo.com OR site:expatistan.com'
    },
    {
      name: 'utilities',
      displayName: 'Monthly Utilities',
      searchTemplate: 'monthly utilities electricity water gas cost {city} site:numbeo.com OR site:expatistan.com'
    },
    {
      name: 'internet',
      displayName: 'Internet Speed & Cost',
      searchTemplate: 'average internet speed cost fiber broadband {city} site:numbeo.com OR site:expatistan.com OR site:speedtest.net'
    }
  ],
  
  // Remote Work Scoring Weights. 
  // Currently a 70-30 split between just two, but you should add more categories and adjust the weights accordingly.
  remoteWorkWeights: {
    cost_of_living: 0.70,
    internet_quality: 0.30,
  },
  maxResults: 25, // max number of results to return from SERP API search
  dataDir: 'data', // directory to save data (markdown report) to   
  cacheDir: 'cache', // directory to save cache to
  delayBetweenRequests: 2000, // delay between requests to avoid overwhelming the API; 2 seconds is probably too cautious
  confidenceThreshold: 70, // confidence threshold for a city
  cacheExpiryDays: 7 // cache expiry days
};

module.exports = CONFIG; 