/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the letterhead PDF is bundled with the PDF route on Vercel.
  outputFileTracingIncludes: {
    "/api/report/[id]": ["./assets/**/*"],
  },
};
export default nextConfig;