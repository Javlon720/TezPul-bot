
import * as campaignQueries from '../db/queries/campaigns.queries.js';

export async function getDefaultActiveCampaign(client) {
  return campaignQueries.getDefaultActiveCampaign(client);
}

export async function getCampaignByCode(client, code) {
  return campaignQueries.getCampaignByCode(client, code);
}

export async function listCampaigns(client) {
  return campaignQueries.listCampaigns(client);
}
