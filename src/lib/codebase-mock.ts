export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}

export const MOCK_CODEBASE: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    path: '/src',
    children: [
      {
        name: 'app',
        type: 'folder',
        path: '/src/app',
        children: [
          {
            name: 'layout.tsx',
            type: 'file',
            path: '/src/app/layout.tsx',
            content: `export default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}`
          },
          {
            name: 'page.tsx',
            type: 'file',
            path: '/src/app/page.tsx',
            content: `import { PublicHeader } from '@/components/layout/PublicHeader';\n\nexport default function Home() {\n  return (\n    <main>\n      <PublicHeader />\n      <h1>Welcome to Viby</h1>\n    </main>\n  );\n}`
          }
        ]
      },
      {
        name: 'components',
        type: 'folder',
        path: '/src/components',
        children: [
          {
            name: 'layout',
            type: 'folder',
            path: '/src/components/layout',
            children: [
              {
                name: 'PublicHeader.tsx',
                type: 'file',
                path: '/src/components/layout/PublicHeader.tsx',
                content: `'use client'\n\nimport Link from 'next/link';\n\nexport function PublicHeader() {\n  return (\n    <header class="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b">\n      <nav class="container mx-auto px-4 h-16 flex items-center justify-between">\n        <Link href="/">Logo</Link>\n        <div>Navigation Links</div>\n      </nav>\n    </header>\n  );\n}`
              },
              {
                name: 'Footer.tsx',
                type: 'file',
                path: '/src/components/layout/Footer.tsx',
                content: `export default function Footer() {\n  return <footer>© 2024 Viby</footer>;\n}`
              }
            ]
          },
          {
            name: 'ui',
            type: 'folder',
            path: '/src/components/ui',
            children: [
              { name: 'button.tsx', type: 'file', path: '/src/components/ui/button.tsx', content: `export const Button = () => <button>Click me</button>;` },
              { name: 'input.tsx', type: 'file', path: '/src/components/ui/input.tsx', content: `export const Input = () => <input />;` }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'public',
    type: 'folder',
    path: '/public',
    children: [
      { name: 'logo.svg', type: 'file', path: '/public/logo.svg' },
      { name: 'hero-bg.jpg', type: 'file', path: '/public/hero-bg.jpg' },
      { name: 'favicon.ico', type: 'file', path: '/public/favicon.ico' },
      {
        name: 'assets',
        type: 'folder',
        path: '/public/assets',
        children: [
          { name: 'icon-set.png', type: 'file', path: '/public/assets/icon-set.png' }
        ]
      }
    ]
  }
];

export const getAllFiles = (nodes: FileNode[]): { filePath: string; fileContent: string }[] => {
  const files: { filePath: string; fileContent: string }[] = [];
  const traverse = (n: FileNode) => {
    if (n.type === 'file' && n.content) {
      files.push({ filePath: n.path, fileContent: n.content });
    }
    if (n.children) {
      n.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return files;
};
