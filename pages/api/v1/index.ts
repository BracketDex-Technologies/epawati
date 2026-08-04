import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_request: NextApiRequest, response: NextApiResponse) {
  response.status(200).json({
    docs: '/api/docs',
    health: '/api/v1/health/ready',
    service: 'digital-mandal-api',
    status: 'ok',
  });
}
