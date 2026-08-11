/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't let `next dev` auto-append its agent-rules block to CLAUDE.md — that file is
  // hand-maintained project instructions, not a place for tooling to write to.
  agentRules: false,
};

export default nextConfig;
