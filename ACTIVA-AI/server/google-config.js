export function validGoogleClientId(value) {
  return /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value);
}

export function validGoogleDomain(value) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

export function validGoogleEmail(value) {
  const email=String(value || "").trim().toLowerCase();
  if (!email || email.length > 320 || email.includes("*")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
