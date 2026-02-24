/**
 * MarkdownContent — renders markdown text with safe, styled output.
 * C3: replaces plain <p> text rendering for AI responses.
 */
import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  return (
    <div className={`markdown-body text-[13px] leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-[15px] font-bold mt-3 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[14px] font-bold mt-3 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-0.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-0.5">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="ml-2">{children}</li>,
          code: ({ children, className: cls }) => {
            const isBlock = cls?.startsWith("language-");
            return isBlock ? (
              <code className="block bg-[#F0F0F0] rounded-md px-3 py-2 text-[12px] font-mono overflow-x-auto mb-2 whitespace-pre">
                {children}
              </code>
            ) : (
              <code className="bg-[#F0F0F0] rounded px-1 py-0.5 text-[12px] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 pl-3 italic text-text-secondary mb-2">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-border-gray my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
