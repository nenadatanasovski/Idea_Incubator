// server/communication/http-utils.ts
// HTTP utilities with IPv4 preference to avoid Node.js IPv6 timeout issues

import https from "https";

/**
 * Make HTTPS GET request with IPv4 forced.
 * Node's native fetch uses undici which can have IPv6 preference problems.
 */
export async function httpsGetIPv4(url: string, timeoutMs: number = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const req = https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      family: 4, // Force IPv4
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Make HTTPS POST request with IPv4 forced.
 */
export async function httpsPostIPv4(
  url: string, 
  body: object, 
  timeoutMs: number = 35000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyString = JSON.stringify(body);
    
    const req = https.request({
      method: 'POST',
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      family: 4, // Force IPv4
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(bodyString);
    req.end();
  });
}
