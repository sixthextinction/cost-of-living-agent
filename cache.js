const fs = require('fs');
const path = require('path');

function getCacheFilePath(cityObj, cacheDir = 'cache') {
  const cityIdentifier = `${cityObj.name}_${cityObj.country}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return path.join(cacheDir, `${cityIdentifier}_cache.json`);
}

function hasCachedData(cityObj, cacheDir = 'cache', cacheExpiryDays = 7) {
  try {
    const cacheFilePath = getCacheFilePath(cityObj, cacheDir);
    
    if (!fs.existsSync(cacheFilePath)) {
      return false;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
    const maxAge = cacheExpiryDays * 24 * 60 * 60 * 1000;
    
    if (cacheAge > maxAge) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

function loadCachedData(cityObj, cacheDir = 'cache') {
  try {
    const cacheFilePath = getCacheFilePath(cityObj, cacheDir);
    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    
    return cacheData.perception;
  } catch (error) {
    return null;
  }
}

function saveCacheData(cityObj, perception, cacheDir = 'cache', cacheExpiryDays = 7) {
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheFilePath = getCacheFilePath(cityObj, cacheDir);
    const cacheData = {
      timestamp: new Date().toISOString(),
      city: cityObj.name,
      country: cityObj.country,
      perception: perception,
      metadata: {
        cache_version: '1.0',
        expiry_days: cacheExpiryDays
      }
    };
    
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getCacheFilePath,
  hasCachedData,
  loadCachedData,
  saveCacheData
}; 