# Secure File Scanner

A comprehensive React-based web application for secure file scanning and malware detection using the VirusTotal API. Features advanced ZIP file handling, real-time scanning, and an intuitive user interface. Built with TypeScript, Vite, and modern web technologies.

## Core Features

- **Advanced Security**

  - Robust ZIP file security with path traversal protection
  - Multi-layered file validation and hash verification
  - Malicious file extension detection
  - Real-time VirusTotal API integration for malware scanning
  - File integrity checks and sanitization

- **Rich User Experience**

  - Modern drag-and-drop interface with FileDropzone component
  - Live scan status monitoring and progress tracking
  - Comprehensive scan history management with HistoryView
  - Queue management and task visualization with QueueSummary and TaskCard
  - Rate limit monitoring with ApiRateLimitIndicator

- **Technical Features**
  - Full TypeScript implementation
  - React 18+ with custom hooks for business logic
  - Vite-powered development environment
  - IndexedDB storage with repository pattern
  - Sequential processing with intelligent rate limiting
  - Advanced error handling and recovery

## Tech Stack

- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- IndexedDB for local storage
- JSZip for ZIP processing
- ESLint for code quality

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- NPM or Yarn
- VirusTotal API key

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
# .env
VITE_VT_API_KEY=your_api_key_here
```

4. Start development server:

```bash
npm run dev
```

## Architecture

### Project Structure

```
src/
├── components/
│   ├── scanner/          # Core scanning components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── services/
│   ├── database/         # IndexedDB abstraction
│   ├── repositories/     # Data access layer
│   └── virusTotal/       # VirusTotal integration
├── utils/
│   ├── zip/             # ZIP security and processing
│   └── common.ts        # Shared utilities
└── types/               # TypeScript definitions
```

### Key Components

- **Scanner Components**

  - FileDropzone: File upload handling with validation
  - HistoryView: Scan history and results management
  - QueueSummary: Queue status and controls
  - TaskCard: Individual scan task display

- **UI Components**
  - ApiRateLimitIndicator: API usage monitoring
  - Badge: Status indicators
  - Button: Styled action buttons
  - Progress: Task progress visualization

### Core Services

- **Database Layer**

  - BaseRepository: Generic CRUD operations
  - DatabaseManager: IndexedDB initialization
  - Specialized repositories for files, history, queue, and settings

- **VirusTotal Integration**

  - VirusTotalClient: API communication
  - VirusTotalService: Business logic
  - Rate limiting and error handling

- **ZIP Processing**
  - Path validation and sanitization
  - Security analysis and checks
  - Extraction and creation utilities
  - Size estimation

### Utilities

- **File Processing**

  - Hash calculation
  - File type detection
  - Size formatting
  - Content validation

- **Queue Management**
  - Persistent queue state
  - Sequential processing with intelligent scheduling
  - Rate limiting and API quota management
  - Error recovery and retry logic

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
