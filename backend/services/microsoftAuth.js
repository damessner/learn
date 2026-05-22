const jwt = require('jsonwebtoken');

// Using native global fetch

let jwksCache = {
  keys: null,
  expiresAt: 0
};

/**
 * Fetches public certificates from Microsoft's JWKS endpoint.
 * Caches keys in memory for 24 hours to reduce latency.
 */
async function getMicrosoftPublicKeys() {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const tenantId = process.env.MS_TENANT_ID || 'common';
  const url = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
  
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch Microsoft public keys: ${resp.statusText}`);
    }
    const data = await resp.json();
    if (!data || !data.keys) {
      throw new Error('JWKS endpoint returned an empty key set');
    }
    
    // Cache keys for 24 hours
    jwksCache = {
      keys: data.keys,
      expiresAt: now + 24 * 60 * 60 * 1000
    };
    
    return data.keys;
  } catch (err) {
    console.error('[AUTH] Microsoft JWKS fetch error:', err);
    throw new Error('Could not connect to Microsoft Identity provider for key verification');
  }
}

/**
 * Verifies a Microsoft client-issued ID token.
 * Validates issuer signature, client ID audience, and expiration claims.
 */
async function verifyMicrosoftIdToken(idToken) {
  if (!idToken) {
    throw new Error('Missing ID token');
  }

  // 1. Decode header to find Key ID (kid)
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid JWT format or missing kid header');
  }

  const { kid } = decoded.header;

  // 2. Fetch current JWK certificates
  const keys = await getMicrosoftPublicKeys();
  const matchingKey = keys.find(k => k.kid === kid);
  if (!matchingKey) {
    throw new Error(`Microsoft public key not found for kid: ${kid}`);
  }

  // 3. Format public X.509 certificate to PEM
  if (!matchingKey.x5c || !matchingKey.x5c.length) {
    throw new Error('JWK is missing the certificate chain (x5c)');
  }
  if (!matchingKey.x5c[0] || !matchingKey.x5c[0].trim()) {
    throw new Error('JWK certificate is empty or malformed');
  }
  
  // Wrap raw certificate payload into standard 64-char block lines
  const certPayload = matchingKey.x5c[0].replace(/\s+/g, '');
  if (!certPayload) {
    throw new Error('JWK certificate is empty or malformed');
  }
  const certLines = certPayload.match(/.{1,64}/g);
  if (!certLines || certLines.length === 0) {
    throw new Error('JWK certificate is empty or malformed');
  }
  const cert = `-----BEGIN CERTIFICATE-----\n${certLines.join('\n')}\n-----END CERTIFICATE-----\n`;

  // 4. Verify signature, audience, and issuer
  const tenantId = process.env.MS_TENANT_ID || 'common';
  const expectedIssuer = tenantId === 'common'
    ? null
    : `https://login.microsoftonline.com/${tenantId}/v2.0`;

  const options = {
    algorithms: ['RS256'],
    audience: process.env.MS_CLIENT_ID
  };

  if (expectedIssuer) {
    options.issuer = expectedIssuer;
  }

  const payload = jwt.verify(idToken, cert, options);

  // Fallback issuer checks for multi-tenant 'common' configs
  if (!expectedIssuer && payload.iss) {
    const isMsIssuer = payload.iss.startsWith('https://login.microsoftonline.com/') && payload.iss.endsWith('/v2.0');
    if (!isMsIssuer) {
      throw new Error(`Untrusted token issuer: ${payload.iss}`);
    }
  }

  // Extract core profile fields
  return {
    msId: payload.oid || payload.sub,
    name: payload.name || payload.preferred_username || 'Microsoft User',
    email: payload.preferred_username || payload.email || ''
  };
}

module.exports = { verifyMicrosoftIdToken };
