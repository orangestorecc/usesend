import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

/** @type {import("next").NextConfig} */
const config = {
  // Use static export in production by default; keep dev server dynamic
  output: "export",
  images: {
    // Required for static export if using images
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.doras.to",
        pathname: "/Sayr/**",
      },
    ],
  },
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
});

export default withMDX(config);
