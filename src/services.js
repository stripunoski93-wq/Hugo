import { openAccountPage, checkServiceHealth } from './browser.js';

const serviceUrls = {
  'Google Drive': 'https://drive.google.com',
  'Slack': 'https://app.slack.com',
  'Canva': 'https://www.canva.com',
  'GitHub': 'https://github.com',
  'YouTube Studio': 'https://studio.youtube.com',
  'CapCut Web': 'https://www.capcut.com'
};

const serviceChecks = {
  'Google Drive': 'text=My Drive',
  'Slack': '[data-qa="sidebar"]',
  'Canva': '[data-testid="editor-container"]',
  'GitHub': '[data-testid="repositories-header"]'
};

export async function openAccountConnector(service) {
  const url = serviceUrls[service];
  if (!url) return null;
  
  console.log(`Opening ${service} login at ${url}`);
  const page = await openAccountPage(url);
  return page;
}

export async function checkAllServices() {
  const status = {};
  for (const [service, url] of Object.entries(serviceUrls)) {
    const health = await checkServiceHealth(url, serviceChecks[service]);
    status[service] = health;
  }
  return status;
}

export { serviceUrls, serviceChecks };
