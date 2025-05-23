# Secure File Scanner

A React-based web application for scanning files using the VirusTotal API. Built with TypeScript, Vite, and modern tooling for optimal development experience.

## Features

- File drag-and-drop interface
- ZIP file processing and analysis
- Integrated VirusTotal scanning
- Real-time scan status monitoring
- Queue management for multiple files
- Responsive UI with Tailwind CSS
- Type-safe development with TypeScript

## Tech Stack

- React + TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- ESLint for code quality
- Modern React hooks and components

## Getting Started

### Prerequisites

- Node.js (latest LTS version recommended)
- NPM or Yarn
- VirusTotal API key

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file with your VirusTotal API key:
```
VITE_VIRUSTOTAL_API_KEY=your_api_key_here
```
4. Start the development server:
```bash
npm run dev
```

## Development

### Project Structure

```
src/
├── components/
│   ├── scanner/     # Scanner-specific components
│   └── ui/          # Reusable UI components
├── hooks/           # Custom React hooks
├── services/        # API services
├── types/          # TypeScript types
└── utils/          # Utility functions
```

### ESLint Configuration

For production applications, we recommend enabling type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    ...tseslint.configs.recommendedTypeChecked,
    // Or use strictTypeChecked for stricter rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

For React-specific linting, you can add:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## Key Components

- `FileDropzone`: Handles file upload and drag-and-drop functionality
- `QueueSummary`: Displays scanning queue status and progress
- `TaskCard`: Individual file scan result display
- `useQueue`: Custom hook for managing the scanning queue
- `virusTotalService`: Interface with VirusTotal API
- `zipUtils`: ZIP file processing utilities

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
