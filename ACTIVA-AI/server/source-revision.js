// P4.5: expose only an auditable Git revision, never an arbitrary env value.
// Render defines RENDER_GIT_COMMIT for the deployed revision at runtime.
// A missing/non-SHA value is null (unverified), not a fabricated application hash.
const SHA40=/^[0-9a-f]{40}$/i;
export function deployedSourceCommit(env=process.env) {
  const raw=String(env.RENDER_GIT_COMMIT??"").trim();
  return SHA40.test(raw)?raw.toLowerCase():null;
}
