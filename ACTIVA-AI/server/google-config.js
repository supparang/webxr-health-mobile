export function validGoogleClientId(value) {
  return /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value);
}

export function validGoogleDomain(value) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}
