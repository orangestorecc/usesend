import type { MDXComponents } from "mdx/types";

const components = {
  h1: ({ children, ...props }) => (
    <h1
      {...props}
      className="text-3xl font-semibold tracking-wide font-sans text-primary"
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      {...props}
      className="scroll-mt-24 text-xl font-semibold tracking-wide font-sans text-primary"
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="scroll-mt-24 text-lg font-medium tracking-wide font-sans"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-base font-normal tracking-wide leading-relaxed font-sans">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside font-sans pl-4 space-y-1">
      {children}
    </ul>
  ),
  a: ({ children, href }) => (
    <a href={href} className=" text-primary-light">
      {children}
    </a>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside font-sans pl-4 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-base leading-relaxed font-sans">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm font-sans">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 align-top text-muted-foreground">
      {children}
    </td>
  ),
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
