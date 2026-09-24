// Keep the existing cache and YouTube secret on the extraction service during migration.
export default {
  fetch(request, env) {
    return env.METADATA.fetch(request);
  },
};
