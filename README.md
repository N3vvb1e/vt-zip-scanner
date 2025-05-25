# Secure File Scanner

A React-based web application for secure file scanning using the VirusTotal API, with special focus on safe ZIP file handling and malware detection. Built with TypeScript, Vite, and modern tooling for optimal development experience.

## Core Features

- **Secure File Processing**
  - Safe ZIP file handling with path traversal protection
  - File hash calculation and verification
  - Dangerous file extension detection
  - Real-time malware scanning via VirusTotal

- **Modern UI/UX**
  - Intuitive drag-and-drop interface
  - Real-time scan status monitoring
  - Progress tracking for multiple files
  - Responsive design with Tailwind CSS
  - Persistent queue management

- **Developer Experience**
  - Type-safe development with TypeScript
  - Fast development server with Vite
  - Comprehensive error boundary handling
  - Component-based architecture
  - Automated file hash verification

## Tech Stack

- React + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- ESLint for code quality
- Modern React hooks and patterns

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

## Project Architecture

### Directory Structure
```
src/
├── components/
│   ├── scanner/     # Core scanning components
│   │   ├── FileDropzone.tsx
│   │   ├── HistoryView.tsx
│   │   ├── QueueSummary.tsx
│   │   └── TaskCard.tsx
│   └── ui/          # Reusable UI components
├── hooks/           # Custom React hooks
├── services/        # API and persistence services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions including security
```

### Key Components

- **FileDropzone**: Handles secure file upload with validation
- **HistoryView**: Manages scan history and results
- **QueueSummary**: Displays queue status and progress
- **TaskCard**: Individual scan result visualization
- **ErrorBoundary**: Global error handling

### Core Services

- **virusTotalService**: 
  - File submission to VirusTotal
  - Report retrieval
  - API key validation

- **persistenceService**: 
  - Queue state management
  - Scan history persistence
  - Data recovery

### Security Utils

- **secureZipUtils**:
  - Path traversal protection
  - Dangerous extension detection
  - Safe ZIP creation and handling

- **common**:
  - File hash calculation
  - Size formatting
  - Type detection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Push to your branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
