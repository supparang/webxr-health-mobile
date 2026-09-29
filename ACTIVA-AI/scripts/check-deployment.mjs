import "dotenv/config";
import { deploymentConfigurationErrors, productionGoEnabled } from "../server/deployment-config.js";

const errors = deploymentConfigurationErrors();
// This preparation command never approves a release.
if (productionGoEnabled()) errors.push("PREPARATION_REQUIRES_PRODUCTION_GO_DISABLED");
console.log(JSON.stringify({
  configurationValid: errors.length === 0,
  productionGoEnabled: productionGoEnabled(),
  errors,
  note: "Configuration check only. Database migration, Google Cloud settings and real sign-in still need acceptance."
}, null, 2));
process.exitCode = errors.length ? 1 : 0;
