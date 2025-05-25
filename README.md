# Secure File Scanner

A comprehensive React-based web application for secure file scanning and malware detection using the VirusTotal API. Features advanced ZIP file handling, real-time scanning, and an intuitive user interface. Built with TypeScript, Vite, and modern web technologies.

## Core Features

- **Advanced Security**
  - Robust ZIP file security with path traversal protection
  - Multi-layered file validation and hash verification
  - Malicious file extension detection
  - Real-time VirusTotal integration for malware scanning
  - File integrity checks and sanitization

- **Rich User Experience**
  - Modern drag-and-drop interface
  - Live scan status monitoring
  - Detailed progress tracking for batch processing
  - Responsive design with Tailwind CSS
  - Persistent queue with recovery capabilities
  - Comprehensive scan history management

- **Developer-Focused**
  - Full TypeScript support
  - Vite-powered development environment
  - Component-based architecture
  - Custom React hooks for business logic
  - Extensive error handling
  - Repository pattern for data management

## Tech Stack

- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- IndexedDB for local storage
- ESLint for code quality
- JSZip for ZIP processing

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
│   ├── database/         # Database abstraction
│   ├── repositories/     # Data access layer
│   └── virusTotal/       # VirusTotal integration
├── utils/
│   ├── zip/             # ZIP processing utilities
│   └── common.ts        # Shared utilities
└── types/               # TypeScript definitions
```

### Key Components

- **FileDropzone**: Handles file uploads with validation
- **HistoryView**: Manages scan history and results display
- **QueueSummary**: Provides queue status and management
- **TaskCard**: Individual scan task visualization
- **ErrorBoundary**: Application-wide error handling

### Core Services

- **Database Layer**
  - IndexedDB-based storage
  - Repository pattern implementation
  - Transaction management
  - Data migration support

- **VirusTotal Integration**
  - File submission handling
  - Report retrieval and parsing
  - Rate limiting
  - Error recovery

- **ZIP Processing**
  - Secure extraction and validation
  - Path traversal prevention
  - Malicious content detection
  - Size estimation and validation

### Utilities

- **Security**
  - File hash calculation
  - Extension validation
  - Path sanitization
  - Content type detection

- **Queue Management**
  - Persistent queue state
  - Task prioritization
  - Progress tracking
  - Error recovery

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
