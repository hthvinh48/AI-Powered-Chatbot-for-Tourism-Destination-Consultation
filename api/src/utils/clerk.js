let jwks = null;
let joseModulePromise = null;
let jwksMeta = null;

async function getJose() {
  if (!joseModulePromise) {
    joseModulePromise = import("jose");
  }
  return joseModulePromise;
}

function getJwks() {
  if (jwks) return jwks;
  const jwksUrl = process.env.CLERK_JWKS_URL;
  if (!jwksUrl) {
    throw new Error("Missing CLERK_JWKS_URL");
  }
  jwks = { url: new URL(jwksUrl), value: null };
  return jwks;
}

async function fetchJwksKids(jwksUrl) {
  if (jwksMeta?.url === jwksUrl && Array.isArray(jwksMeta?.kids)) return jwksMeta.kids;

  const response = await fetch(jwksUrl, { method: "GET" });
  if (!response.ok) return [];

  const json = await response.json().catch(() => null);
  const kids = Array.isArray(json?.keys) ? json.keys.map((k) => k?.kid).filter(Boolean) : [];
  jwksMeta = { url: jwksUrl, kids };
  return kids;
}

exports.verifyClerkToken = async (token) => {
  if (!token) throw new Error("Missing token");

  const issuer = process.env.CLERK_ISSUER || undefined;
  const audience = process.env.CLERK_AUDIENCE || undefined;

  const { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } = await getJose();

  const jwksState = getJwks();
  if (!jwksState.value) {
    jwksState.value = createRemoteJWKSet(jwksState.url);
  }

  let header = null;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    header = null;
  }

  const clockToleranceSeconds = Number(process.env.CLERK_CLOCK_TOLERANCE_SECONDS || 5);

  let verified;
  try {
    verified = await jwtVerify(token, jwksState.value, {
      issuer,
      audience,
      clockTolerance: Number.isFinite(clockToleranceSeconds) ? clockToleranceSeconds : 5,
    });
  } catch (err) {
    const msg = String(err?.message || "verify failed");
    if (msg.includes("no applicable key found")) {
      const kids = await fetchJwksKids(jwksState.url.toString());
      const kid = header?.kid ? String(header.kid) : "";
      const alg = header?.alg ? String(header.alg) : "";
      const info = `token kid=${kid || "?"} alg=${alg || "?"} jwksKids=${kids.slice(0, 8).join(",") || "?"}`;
      throw new Error(`${msg} (${info})`);
    }
    throw err;
  }

  const { payload } = verified;

  return payload;
};

exports.fetchClerkUser = async (clerkUserId) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");

  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`Failed to fetch Clerk user (${response.status})`);
    err.status = response.status;
    err.payload = text;
    throw err;
  }

  return response.json();
};

async function clerkPost(path) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");

  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`Clerk API failed (${response.status})`);
    err.status = response.status;
    err.payload = text;
    throw err;
  }

  return response.json().catch(() => ({}));
}

exports.banClerkUser = async (clerkUserId) => {
  return clerkPost(`/users/${encodeURIComponent(clerkUserId)}/ban`);
};

exports.unbanClerkUser = async (clerkUserId) => {
  return clerkPost(`/users/${encodeURIComponent(clerkUserId)}/unban`);
};
